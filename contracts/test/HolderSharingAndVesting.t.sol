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
        token = new LaunchpadToken(
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
        // Deposit 10 WETH fee rewards for token holders
        vm.startPrank(deployer);
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
}
