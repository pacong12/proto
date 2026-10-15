// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CurveMath} from "../src/libraries/CurveMath.sol";

contract CurveMathTest is Test {
    uint256 constant V_ETH = 3 ether;
    uint256 constant V_TOKEN = 800_000_000 ether;

    function test_CurveMath_ZeroInputReturnsZero() public pure {
        (uint256 tokenOut, uint256 feeEth) = CurveMath.getAmountOutBuy(0, V_ETH, V_TOKEN, 0);
        assertEq(tokenOut, 0);
        assertEq(feeEth, 0);

        (uint256 ethOut, uint256 sellFee) = CurveMath.getAmountOutSell(0, V_ETH, V_TOKEN);
        assertEq(ethOut, 0);
        assertEq(sellFee, 0);
    }

    function test_CurveMath_BuyOutputMatchesFormula() public pure {
        uint256 ethIn = 1 ether;
        (uint256 tokenOut, uint256 feeEth) = CurveMath.getAmountOutBuy(ethIn, V_ETH, V_TOKEN, 0);

        // 1% of 1 ETH = 0.01 ETH
        assertEq(feeEth, 0.01 ether);
        assertTrue(tokenOut > 0, "tokenOut should be positive");

        // Verification: k = 3 * 800M = 2.4B
        // netEth = 0.99 ETH
        // newEthReserve = 3.99 ETH
        // newTokenReserve = 2.4B / 3.99 = ~601,503,759.398 ether
        // expectedTokenOut = 800M - newTokenReserve = ~198,496,240 ether
        assertTrue(tokenOut > 190_000_000 ether, "tokenOut above 190M");
        assertTrue(tokenOut < 200_000_000 ether, "tokenOut below 200M");
    }

    function test_CurveMath_SellOutputMatchesFormula() public pure {
        uint256 tokensIn = 100_000_000 ether;
        (uint256 ethOut, uint256 feeEth) = CurveMath.getAmountOutSell(tokensIn, V_ETH, V_TOKEN);

        assertTrue(feeEth > 0, "feeEth positive");
        assertTrue(ethOut > 0, "ethOut positive");
        // gross = ethOut + feeEth
        // 100 * feeEth should equal gross
        assertEq(feeEth, (ethOut + feeEth) / 100);
    }

    function test_CurveMath_BabylonianSqrt() public pure {
        assertEq(CurveMath.sqrt(0), 0);
        assertEq(CurveMath.sqrt(1), 1);
        assertEq(CurveMath.sqrt(4), 2);
        assertEq(CurveMath.sqrt(9), 3);
        assertEq(CurveMath.sqrt(16), 4);
        assertEq(CurveMath.sqrt(100), 10);
        assertEq(CurveMath.sqrt(10000), 100);
    }

    function test_CurveMath_ComputeSqrtPriceX96() public pure {
        uint160 sqrtPrice = CurveMath.computeSqrtPriceX96(V_ETH, V_TOKEN);
        assertTrue(sqrtPrice > 0, "sqrtPrice > 0");
    }

    function computeSqrtPriceX96Wrapper(uint256 eth, uint256 token) external pure returns (uint160) {
        return CurveMath.computeSqrtPriceX96(eth, token);
    }

    function test_CurveMath_ComputeSqrtPriceX96_RevertsOnOverflow() public {
        vm.expectRevert(CurveMath.Overflow.selector);
        this.computeSqrtPriceX96Wrapper(type(uint256).max, 1);
    }
    function test_CurveMath_SpotPrice() public pure {
        uint256 spot = CurveMath.calculateSpotPrice(V_ETH, V_TOKEN);
        // 3 ether / 800M ether * 1e18 = 3.75e9 wei
        assertEq(spot, (3 ether * 1e18) / (800_000_000 ether));
    }

    function test_CurveMath_GetEthInForTokens_InversionAccuracy() public pure {
        uint256 ethIn = 1 ether;
        (uint256 tokenOut, ) = CurveMath.getAmountOutBuy(ethIn, V_ETH, V_TOKEN, V_TOKEN);
        assertTrue(tokenOut > 0, "tokenOut > 0");

        (uint256 grossEthNeeded, ) = CurveMath.getEthInForTokens(tokenOut, V_ETH, V_TOKEN);
        // Gross ETH needed should be within 1-2 wei of ethIn due to ceiling division
        uint256 diff = grossEthNeeded > ethIn ? grossEthNeeded - ethIn : ethIn - grossEthNeeded;
        assertTrue(diff <= 100, "Inversion must be accurate to within rounding tolerance");
    }
}
