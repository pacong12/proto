// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HolderFeeDistributor} from "../src/HolderFeeDistributor.sol";
import {VestingVault} from "../src/VestingVault.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {ILaunchpadToken} from "../src/interfaces/ILaunchpadToken.sol";
import {MockWETH} from "./Mocks.sol";

contract HolderSharingAndVestingTest is Test {
    HolderFeeDistributor public distributor;
    VestingVault public vault;
    MockWETH public weth;
    LaunchpadToken public token;

    address public deployer = address(0xCAFE);
    address public alice = address(0x1111);
    address public bob = address(0x2222);
    address public mockLocker = address(0x3333);

    function setUp() public {
        weth = new MockWETH();
        distributor = new HolderFeeDistributor(address(weth), mockLocker);
        vault = new VestingVault();

        ILaunchpadToken.Socials memory s = ILaunchpadToken.Socials("", "", "", "", "");
        token = new LaunchpadToken();
        token.initialize(
            "Dividends Token",
            "DIV",
            "ipfs://div",
            "Token with holder dividends",
            s,
            deployer,
            address(weth),
            deployer
        );

        // Distribute tokens: Alice holds 600M (60%), Bob holds 400M (40%) of 1B supply
        vm.startPrank(deployer);
        token.transfer(alice, 600_000_000 * 1e18);
        token.transfer(bob, 400_000_000 * 1e18);
        vm.stopPrank();

        // Give deployer some WETH to deposit rewards
        vm.deal(deployer, 10 ether);
        vm.startPrank(deployer);
        weth.deposit{value: 10 ether}();
        vm.stopPrank();
    }

    function test_HolderFeeDistributionProRata() public {
        // H-03 fix: snapshotBalance is 0 until checkpoint or claimReward is called.
        // Holders must checkpoint before depositRewards to earn from that deposit.
        distributor.checkpoint(address(token), alice);
        distributor.checkpoint(address(token), bob);

        // I-05 fix: depositRewards is now restricted to the locker address.
        // Fund the mock locker with WETH and have it approve + deposit.
        vm.startPrank(deployer);
        weth.transfer(mockLocker, 10 ether);
        vm.stopPrank();

        vm.startPrank(mockLocker);
        weth.approve(address(distributor), 10 ether);
        distributor.depositRewards(address(token), 10 ether);
        vm.stopPrank();

        // Alice (60%) should earn 6 WETH, Bob (40%) should earn 4 WETH
        uint256 aliceEarned = distributor.earned(address(token), alice);
        uint256 bobEarned = distributor.earned(address(token), bob);

        assertEq(aliceEarned, 6 ether);
        assertEq(bobEarned, 4 ether);

        // Alice claims her 6 WETH
        vm.prank(alice);
        distributor.claimReward(address(token));
        assertEq(weth.balanceOf(alice), 6 ether);
        assertEq(distributor.earned(address(token), alice), 0);
    }

    function test_FlashLoanCheckpointExploitDefeated() public {
        address attacker = address(0x9999);

        // 1. Attacker temporarily acquires tokens (simulating a flash loan)
        vm.prank(alice);
        token.transfer(attacker, 500_000_000 * 1e18);

        // 2. Attacker checkpoints their temporary high balance
        distributor.checkpoint(address(token), attacker);
        assertEq(distributor.snapshotBalance(address(token), attacker), 500_000_000 * 1e18);

        // 3. Attacker returns tokens (flash loan repaid in same transaction)
        vm.prank(attacker);
        token.transfer(alice, 500_000_000 * 1e18);
        assertEq(token.balanceOf(attacker), 0);

        // 4. Rewards are deposited by the locker
        vm.startPrank(deployer);
        weth.transfer(mockLocker, 5 ether);
        vm.stopPrank();

        vm.startPrank(mockLocker);
        weth.approve(address(distributor), 5 ether);
        distributor.depositRewards(address(token), 5 ether);
        vm.stopPrank();

        // 5. Attacker earned is ZERO because live balance is 0 (effectiveBalance = min(snap, live))
        assertEq(distributor.earned(address(token), attacker), 0, "attacker must earn 0 after returning tokens");

        // 6. Attacker claim yields 0 reward
        vm.prank(attacker);
        uint256 claimed = distributor.claimReward(address(token));
        assertEq(claimed, 0, "attacker claimed amount must be 0");
        assertEq(weth.balanceOf(attacker), 0, "attacker receives no WETH");
    }

    function test_VestingVaultLinearRelease() public {
        uint256 grantAmount = 10_000 * 1e18;
        uint256 duration = 100 days;

        vm.startPrank(alice);
        token.approve(address(vault), grantAmount);
        vault.createVestingSchedule(address(token), bob, grantAmount, duration);
        vm.stopPrank();

        // At t=0, claimable is 0
        assertEq(vault.getClaimableAmount(address(token), bob), 0);
        uint256 start = block.timestamp;

        // Advance 50 days (halfway) -> 50% unlocked (5,000 DIV)
        vm.warp(start + 50 days);
        assertEq(vault.getClaimableAmount(address(token), bob), 5_000 * 1e18);

        // Bob claims 5,000 DIV
        vm.prank(bob);
        vault.claimVested(address(token));
        assertEq(vault.getClaimableAmount(address(token), bob), 0);

        // Advance to 100 days (full duration) -> remaining 50% unlocked
        vm.warp(start + 100 days);
        assertEq(vault.getClaimableAmount(address(token), bob), 5_000 * 1e18);
        vm.prank(bob);
        vault.claimVested(address(token));
        assertEq(vault.getClaimableAmount(address(token), bob), 0);
    }

    function test_VestingRevoke() public {
        uint256 grantAmount = 10_000 * 1e18;
        uint256 duration = 100 days;
        uint256 start = block.timestamp;

        vm.startPrank(alice);
        token.approve(address(vault), grantAmount);
        vault.createVestingSchedule(address(token), bob, grantAmount, duration);
        vm.stopPrank();

        // Advance 25 days -> 25% vested
        vm.warp(start + 25 days);

        uint256 aliceBalanceBefore = token.balanceOf(alice);
        uint256 bobBalanceBefore = token.balanceOf(bob);

        // Alice revokes
        vm.prank(alice);
        vault.revokeVesting(address(token), bob);

        // Bob receives 2,500 (25% vested), Alice gets back 7,500 (unvested)
        assertEq(token.balanceOf(bob) - bobBalanceBefore, 2_500 * 1e18);
        assertEq(token.balanceOf(alice) - aliceBalanceBefore, 7_500 * 1e18);

        // Claimable is now zero (schedule revoked)
        assertEq(vault.getClaimableAmount(address(token), bob), 0);

        // Cannot revoke twice
        vm.prank(alice);
        vm.expectRevert(VestingVault.AlreadyRevoked.selector);
        vault.revokeVesting(address(token), bob);
    }
}
