// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BuybackBurner} from "../src/BuybackBurner.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {ILaunchpadToken} from "../src/interfaces/ILaunchpadToken.sol";
import {MockWETH, MockSwapRouter} from "./Mocks.sol";

contract BuybackBurnerTest is Test {
    MockWETH public weth;
    MockSwapRouter public swapRouter;
    LaunchpadToken public targetToken;
    BuybackBurner public burner;

    address public deployer = address(0x1111);

    function setUp() public {
        weth = new MockWETH();
        swapRouter = new MockSwapRouter();

        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");
        targetToken = new LaunchpadToken(
            "Proto Token",
            "PROTO",
            "ipfs://proto",
            "Native utility token",
            socials,
            deployer,
            address(weth),
            deployer
        );

        burner = new BuybackBurner(
            address(targetToken),
            address(weth),
            address(swapRouter)
        );

        vm.deal(deployer, 100 ether);
    }

    function test_BuybackExecution() public {
        vm.prank(deployer);
        weth.deposit{value: 5 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 5 ether);

        assertEq(weth.balanceOf(address(burner)), 5 ether);

        // M-01 fix: executeBuyback requires a positive minAmountOut.
        uint256 burned = burner.executeBuyback(500 * 10**18);
        assertGt(burned, 0);
        assertEq(burner.totalBurned(), burned);
        assertEq(burner.lastBuybackTimestamp(), block.timestamp);

        // Cooldown: next call within window must revert.
        vm.expectRevert(BuybackBurner.CooldownActive.selector);
        burner.executeBuyback(500 * 10**18);

        // After cooldown, a new buyback succeeds.
        vm.warp(block.timestamp + 3601);
        vm.prank(deployer);
        weth.deposit{value: 2 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 2 ether);

        uint256 burnedSecond = burner.executeBuyback(100 * 10**18);
        assertGt(burnedSecond, 0);
        assertEq(burner.totalBurned(), burned + burnedSecond);
    }

    function test_NonOwnerCannotExecuteBuyback_BUG05() public {
        vm.prank(deployer);
        weth.deposit{value: 1 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 1 ether);

        vm.prank(address(0x9999));
        vm.expectRevert(BuybackBurner.Unauthorized.selector);
        burner.executeBuyback(100 * 10**18);
    }

    function test_ZeroMinAmountOutReverts_M01() public {
        vm.prank(deployer);
        weth.deposit{value: 1 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 1 ether);

        // M-01 fix: zero minimum must be rejected.
        vm.expectRevert(BuybackBurner.ZeroMinAmountOut.selector);
        burner.executeBuyback(0);
    }

    function test_SlippageProtection() public {
        vm.prank(deployer);
        weth.deposit{value: 1 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 1 ether);

        // Request a minimum far above the mock router output of 1000 tokens.
        vm.expectRevert(BuybackBurner.SlippageExceeded.selector);
        burner.executeBuyback(50_000 * 10**18);
    }

    function test_EmergencyWithdrawWeth() public {
        vm.prank(deployer);
        weth.deposit{value: 3 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 3 ether);

        address recipient = address(0x5555);
        burner.emergencyWithdrawWeth(recipient);

        assertEq(weth.balanceOf(recipient), 3 ether);
        assertEq(weth.balanceOf(address(burner)), 0);
    }

    function test_OwnerConfiguration() public {
        burner.setCooldown(1800);
        assertEq(burner.cooldown(), 1800);

        burner.setMaxSlippageBps(500);
        assertEq(burner.maxSlippageBps(), 500);

        vm.prank(address(0x9999));
        vm.expectRevert(BuybackBurner.Unauthorized.selector);
        burner.setCooldown(3600);
    }

    function test_TwoStepOwnershipTransfer() public {
        address newOwner = address(0xBEEF);

        burner.transferOwnership(newOwner);
        assertEq(burner.owner(), address(this));
        assertEq(burner.pendingOwner(), newOwner);

        vm.prank(address(0xDEAD));
        vm.expectRevert(BuybackBurner.NoPendingOwner.selector);
        burner.acceptOwnership();

        vm.prank(newOwner);
        burner.acceptOwnership();
        assertEq(burner.owner(), newOwner);
    }
}
