// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";

contract LaunchpadV2Test is Test {
    LaunchpadV2Factory public factory;
    address payable public feeRecipient = payable(address(0xFA1));
    address public mockLocker = address(0x10C);
    address public creator = address(0xCAFE);
    address public buyer1 = address(0xB0B1);

    function setUp() public {
        factory = new LaunchpadV2Factory(feeRecipient, mockLocker, address(0), address(0));
        vm.deal(creator, 100 ether);
        vm.deal(buyer1, 100 ether);
    }

    function _launch() internal returns (address tokenAddress, address curveAddress) {
        vm.prank(creator);
        (tokenAddress, curveAddress) = factory.launchTokenV2{value: 0.0005 ether}(
            "V2 Curve Token",
            "CURVE",
            "ipfs://logo",
            "Token on Bonding Curve",
            "twitter.com/curve",
            "t.me/curve",
            "curve.io"
        );
    }

    function test_LaunchTokenV2AndCurveBuy() public {
        (address tokenAddress, address curveAddress) = _launch();

        assertNotEq(tokenAddress, address(0));
        assertNotEq(curveAddress, address(0));

        BondingCurve curve = BondingCurve(payable(curveAddress));
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));

        // Initial token allocations
        assertEq(token.balanceOf(curveAddress), 1_000_000_000 * 1e18);
        assertEq(curve.virtualEthReserve(), 3.0 ether);

        // Buyer1 purchases tokens from the curve after snipe tax window
        vm.warp(block.timestamp + 10);
        vm.startPrank(buyer1);
        (uint256 expectedTokens, uint256 expectedFee) = curve.getAmountOutBuy(0.5 ether);
        uint256 tokensReceived = curve.buy{value: 0.5 ether}(expectedTokens);
        vm.stopPrank();

        assertEq(tokensReceived, expectedTokens);
        assertEq(token.balanceOf(buyer1), tokensReceived);
        assertEq(feeRecipient.balance, 0.0005 ether + expectedFee);
    }

    function test_SnipeTaxReserveInvariant_C01() public {
        (address tokenAddress, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));

        uint256 initialVirtualTokens = curve.virtualTokenReserve();
        (uint256 grossTokensExpected, ) = curve.getAmountOutBuy(0.1 ether);

        // Buy at t=0 (snipe tax 99%)
        vm.startPrank(buyer1);
        uint256 tokensReceived = curve.buy{value: 0.1 ether}(0);
        vm.stopPrank();

        // 99% snipe tax applies to buyer1 — use same rounding as contract (gross * snipeBps / BPS)
        uint256 snipeFee = (grossTokensExpected * 9900) / 10000;
        uint256 expectedUserTokens = grossTokensExpected - snipeFee;
        assertEq(tokensReceived, expectedUserTokens, "user receives gross minus snipe fee");
        assertLt(tokensReceived, grossTokensExpected);

        // Token conservation: user + feeRecipient == gross (no tokens created or destroyed)
        assertEq(
            tokensReceived + token.balanceOf(feeRecipient),
            grossTokensExpected,
            "token conservation: user + fee == gross"
        );

        // C-01: virtualTokenReserve decremented by GROSS, not net user amount
        assertEq(
            curve.virtualTokenReserve(),
            initialVirtualTokens - grossTokensExpected,
            "reserve must decrease by gross tokens"
        );

        // feeRecipient received the snipe fee tokens
        assertEq(token.balanceOf(feeRecipient), snipeFee, "feeRecipient must hold snipe fee tokens");
    }

    function test_LaunchTokenV2WithInitialBuy_DirectRecipient_C02() public {
        vm.prank(creator);
        (address tokenAddress, address curveAddress) = factory.launchTokenV2{value: 0.0005 ether + 0.1 ether}(
            "Initial Buy Token",
            "INIT",
            "ipfs://logo",
            "Testing direct initial buy",
            "",
            "",
            ""
        );

        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));

        // C-02 Verification: Creator must receive initial buy tokens directly, factory holds 0
        assertGt(token.balanceOf(creator), 0, "creator must receive initial buy tokens");
        assertEq(token.balanceOf(address(factory)), 0, "factory must hold 0 tokens");
    }
}
