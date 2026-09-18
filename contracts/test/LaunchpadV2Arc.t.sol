// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadV2FactoryArc} from "../src/LaunchpadV2FactoryArc.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";

contract LaunchpadV2ArcTest is Test {
    LaunchpadV2FactoryArc public factory;
    address payable public feeRecipient = payable(address(0xFA1));
    address public mockLocker = address(0x10C);
    address public creator = address(0xCAFE);
    address public buyer1 = address(0xB0B1);

    function setUp() public {
        factory = new LaunchpadV2FactoryArc(feeRecipient, mockLocker, address(0), address(0));
        vm.deal(creator, 100_000 ether);
        vm.deal(buyer1, 100_000 ether);
    }

    function test_ArcConstants() public view {
        // Launch fee: 1.00 USDC (1 ether in native 18-decimal msg.value)
        assertEq(factory.launchFee(), 1 ether);
        assertEq(factory.LAUNCH_FEE(), 1 ether);

        // Graduation target: 69,000 USDC
        assertEq(factory.GRADUATION_TARGET(), 69_000 ether);

        // Virtual reserves calibrated for opening FDV $4,200
        assertEq(factory.VIRTUAL_USDC_RESERVE(), 4_200 ether);
        assertEq(factory.VIRTUAL_TOKEN_RESERVE(), 1_000_000_000 * 1e18);
    }

    function test_LaunchTokenArc() public {
        vm.prank(creator);
        (address tokenAddress, address curveAddress) = factory.launchTokenV2{value: 1 ether}(
            "Proto Arc Token",
            "PARC",
            "https://proto.fun/parc.png",
            "First Arc Token",
            "https://x.com/parc",
            "https://t.me/parc",
            "https://proto.fun"
        );

        assertTrue(tokenAddress != address(0));
        assertTrue(curveAddress != address(0));

        LaunchpadToken token = LaunchpadToken(tokenAddress);
        BondingCurve curve = BondingCurve(payable(curveAddress));

        assertEq(token.name(), "Proto Arc Token");
        assertEq(token.symbol(), "PARC");
        assertEq(token.totalSupply(), 1_000_000_000 * 1e18);

        // Entire supply transferred to bonding curve
        assertEq(token.balanceOf(curveAddress), 1_000_000_000 * 1e18);

        // Protocol fee forwarded to fee recipient (1.00 USDC)
        assertEq(feeRecipient.balance, 1 ether);

        // Curve configuration verification
        assertEq(curve.graduationTarget(), 69_000 ether);
        assertEq(curve.virtualEthReserve(), 4_200 ether);
        assertEq(curve.virtualTokenReserve(), 1_000_000_000 * 1e18);

        // Check launch tracking
        assertEq(factory.getLaunchCount(), 1);
        (address t, address c, address cr, , bool grad) = factory.launches(tokenAddress);
        assertEq(t, tokenAddress);
        assertEq(c, curveAddress);
        assertEq(cr, creator);
        assertFalse(grad);
    }

    function test_LaunchWithInitialBuyArc() public {
        uint256 initialBuy = 50 ether; // 50 USDC initial buy + 1 USDC fee
        vm.prank(creator);
        (address tokenAddress, address curveAddress) = factory.launchTokenV2{value: 1 ether + initialBuy}(
            "Proto Arc Token", "PARC", "", "", "", "", ""
        );

        LaunchpadToken token = LaunchpadToken(tokenAddress);
        BondingCurve curve = BondingCurve(payable(curveAddress));

        // Fee recipient got: 1 USDC launch fee + 1% trading fee on 50 USDC buy
        // Trading fee = 50 ether * 100 / 10000 = 0.5 ether
        // Total = 1.5 USDC
        assertEq(feeRecipient.balance, 1.5 ether);

        // Curve received initial buy (net after fee)
        assertEq(curve.totalEthRaised(), initialBuy - (initialBuy * 100 / 10000));

        // Creator received purchased tokens
        assertTrue(token.balanceOf(creator) > 0);
    }

    function test_RevertInsufficientFeeArc() public {
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.InvalidFee.selector);
        factory.launchTokenV2{value: 0.5 ether}("Fail", "FAIL", "", "", "", "", "");
    }

    function test_UpdateLaunchFeeArc() public {
        factory.setLaunchFee(2 ether);
        assertEq(factory.launchFee(), 2 ether);
    }

    function test_SpotPriceArc() public {
        vm.prank(creator);
        (, address curveAddress) = factory.launchTokenV2{value: 1 ether}(
            "Proto Arc Token", "PARC", "", "", "", "", ""
        );

        BondingCurve curve = BondingCurve(payable(curveAddress));
        // spotPrice = virtualEthReserve * 1e18 / virtualTokenReserve
        // = 4_200e18 * 1e18 / 1_000_000_000e18
        // = 4_200 * 1e18 / 1_000_000_000
        // = 4_200_000_000_000 (4.2e12 wei per token)
        // Expressed as USD: 4.2e12 / 1e18 = $0.0000042
        uint256 expectedSpotPrice = (curve.virtualEthReserve() * 1e18) / curve.virtualTokenReserve();
        assertEq(expectedSpotPrice, 4_200_000_000_000);
    }
}
