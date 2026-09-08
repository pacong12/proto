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
    address public burnerAddress = address(0x000000000000000000000000000000000000dEaD);

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
        // Fund burner contract with WETH
        vm.prank(deployer);
        weth.deposit{value: 5 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 5 ether);

        assertEq(weth.balanceOf(address(burner)), 5 ether);

        // Execute Buyback
        uint256 burned = burner.executeBuyback(500 * 10**18);
        assertGt(burned, 0);
        assertEq(burner.totalBurned(), burned);
        assertEq(burner.lastBuybackTimestamp(), block.timestamp);

        // Subsequent call before cooldown must revert
        vm.expectRevert(BuybackBurner.CooldownActive.selector);
        burner.executeBuyback(0);

        // After cooldown period (1 hour), subsequent buyback is allowed
        vm.warp(block.timestamp + 3601);
        vm.prank(deployer);
        weth.deposit{value: 2 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 2 ether);

        uint256 burnedSecond = burner.executeBuyback(0);
        assertGt(burnedSecond, 0);
        assertEq(burner.totalBurned(), burned + burnedSecond);
    }

    function test_SlippageProtection() public {
        vm.prank(deployer);
        weth.deposit{value: 1 ether}();
        vm.prank(deployer);
        weth.transfer(address(burner), 1 ether);

        // Request impossible minimum output (> mock router output 1000)
        vm.expectRevert(BuybackBurner.SlippageExceeded.selector);
        burner.executeBuyback(50_000 * 10**18);
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
}
