// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HolderFeeDistributor} from "../src/legacy/HolderFeeDistributor.sol";
import {VestingVault} from "../src/core/VestingVault.sol";
import {IVestingVault} from "../src/interfaces/IVestingVault.sol";
import {LaunchpadToken} from "../src/core/LaunchpadToken.sol";
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
        vault = new VestingVault(address(this));
        // Alice stands in for a launcher: she funds and opens the schedules below.
        vault.setLauncher(alice, true);

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
        vm.prank(alice);
        distributor.checkpoint(address(token));
        vm.prank(bob);
        distributor.checkpoint(address(token));

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
        vm.prank(attacker);
        distributor.checkpoint(address(token));
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

    /// @dev Funds the vault and opens a cliff-less schedule for Bob, as a launcher does at launch.
    function _grantToBob(uint256 amount, uint64 duration) internal returns (uint256 id) {
        vm.startPrank(alice);
        token.transfer(address(vault), amount);
        id = vault.createSchedule(address(token), bob, amount, 0, duration);
        vm.stopPrank();
    }

    function test_VestingVaultLinearRelease() public {
        // Not block.timestamp: via-IR may re-read it after a warp instead of keeping this value.
        uint256 start = vm.getBlockTimestamp();
        uint256 id = _grantToBob(10_000 * 1e18, 100 days);

        // At t=0, claimable is 0
        assertEq(vault.releasable(id), 0);

        // Advance 50 days (halfway) -> 50% unlocked (5,000 DIV)
        vm.warp(start + 50 days);
        assertEq(vault.releasable(id), 5_000 * 1e18);

        // Bob claims 5,000 DIV
        vm.prank(bob);
        vault.claimVested(id);
        assertEq(vault.releasable(id), 0);
        assertEq(token.balanceOf(bob), 400_000_000 * 1e18 + 5_000 * 1e18);

        // Advance to 100 days (full duration) -> remaining 50% unlocked
        vm.warp(start + 100 days);
        assertEq(vault.releasable(id), 5_000 * 1e18);
        vm.prank(bob);
        vault.claimVested(id);
        assertEq(vault.releasable(id), 0);
        assertEq(token.balanceOf(bob), 400_000_000 * 1e18 + 10_000 * 1e18);
    }

    /// @dev Revocation was removed on purpose (a creator could otherwise unlock a "locked" buy):
    ///      neither the funder nor the vault owner can take back tokens, vested or not.
    function test_VestingCannotBeRevoked() public {
        // Not block.timestamp: via-IR may re-read it after a warp instead of keeping this value.
        uint256 start = vm.getBlockTimestamp();
        uint256 id = _grantToBob(10_000 * 1e18, 100 days);
        vm.warp(start + 25 days);

        uint256 aliceBalanceBefore = token.balanceOf(alice);
        uint256 bobBalanceBefore = token.balanceOf(bob);

        // The old entry point is gone, for the funder and the vault owner alike.
        bytes memory revoke = abi.encodeWithSignature("revokeVesting(address,address)", address(token), bob);
        vm.prank(alice);
        (bool aliceOk,) = address(vault).call(revoke);
        assertFalse(aliceOk, "funder cannot revoke");
        (bool ownerOk,) = address(vault).call(revoke);
        assertFalse(ownerOk, "owner cannot revoke");

        // Claiming is the beneficiary's alone.
        vm.prank(alice);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.claimVested(id);

        // Bob keeps the full grant: 2,500 now (25% vested), the rest as it vests; Alice gets nothing back.
        vm.prank(bob);
        vault.claimVested(id);
        assertEq(token.balanceOf(bob) - bobBalanceBefore, 2_500 * 1e18);
        vm.warp(start + 100 days);
        vm.prank(bob);
        vault.claimVested(id);
        assertEq(token.balanceOf(bob) - bobBalanceBefore, 10_000 * 1e18);
        assertEq(token.balanceOf(alice), aliceBalanceBefore);
    }

    /// @dev S8: a third party can neither open a schedule nor block the creator's real grant, even
    ///      after sending the vault tokens for one.
    function test_VestingSquatterCannotBlockRealGrant() public {
        address squatter = makeAddr("squatter");
        vm.prank(alice);
        token.transfer(squatter, 1);
        vm.startPrank(squatter);
        token.transfer(address(vault), 1);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.createSchedule(address(token), bob, 1, 0, 36_500 days);
        vm.stopPrank();

        uint256 bobBalanceBefore = token.balanceOf(bob);
        uint256 id = _grantToBob(10_000 * 1e18, 100 days);

        vm.warp(block.timestamp + 100 days);
        vm.prank(bob);
        assertEq(vault.claimVested(id), 10_000 * 1e18);
        assertEq(token.balanceOf(bob) - bobBalanceBefore, 10_000 * 1e18);
    }
}
