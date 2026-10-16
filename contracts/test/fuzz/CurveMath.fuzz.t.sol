// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CurveMath} from "../../src/libraries/CurveMath.sol";

/// @dev Property tests for the bonding-curve math over random reserves and trade sizes.
contract CurveMathFuzzTest is Test {
    uint256 constant BPS = 10_000;
    uint256 constant FEE_BPS = 100;

    /// Realistic ranges: 0.001 to 1M quote units of virtual liquidity, 1M to 1T tokens.
    function _reserves(uint256 vEth, uint256 vTok) internal pure returns (uint256, uint256) {
        return (bound(vEth, 1e15, 1e24), bound(vTok, 1e24, 1e30));
    }

    function testFuzz_Buy_KeepsInvariantAndChargesOnePercent(uint256 vEth, uint256 vTok, uint256 ethIn) public pure {
        (vEth, vTok) = _reserves(vEth, vTok);
        ethIn = bound(ethIn, 1, vEth * 10);
        (uint256 tokenOut, uint256 fee) = CurveMath.getAmountOutBuy(ethIn, vEth, vTok, 0);

        assertEq(fee, (ethIn * FEE_BPS) / BPS, "fee is exactly 1%");
        assertLt(tokenOut, vTok, "never more tokens than the reserve");
        // floor(k / newEth) can leave k short by less than one rounding step (newEth): the buyer
        // gets at most 1 wei of token extra. Bounded here; see CURVE-01 in AUDIT-VERIFICATION.md.
        uint256 newEth = vEth + ethIn - fee;
        assertGe(newEth * (vTok - tokenOut) + newEth, vEth * vTok, "k shortfall below one rounding step");
    }

    function testFuzz_Buy_RespectsCurveCap(uint256 vEth, uint256 vTok, uint256 ethIn, uint256 cap) public pure {
        (vEth, vTok) = _reserves(vEth, vTok);
        ethIn = bound(ethIn, 1, vEth * 10);
        cap = bound(cap, 1, vTok - 1);
        (uint256 tokenOut,) = CurveMath.getAmountOutBuy(ethIn, vEth, vTok, cap);
        assertLe(tokenOut, cap);
    }

    function testFuzz_Sell_KeepsInvariant(uint256 vEth, uint256 vTok, uint256 tokenIn) public pure {
        (vEth, vTok) = _reserves(vEth, vTok);
        tokenIn = bound(tokenIn, 1, vTok * 10);
        (uint256 ethOut, uint256 fee) = CurveMath.getAmountOutSell(tokenIn, vEth, vTok);

        assertLt(ethOut + fee, vEth + 1, "never more quote than the reserve");
        // Same bound as buys: the seller gets at most 1 wei of quote extra (CURVE-01).
        uint256 newTok = vTok + tokenIn;
        assertGe((vEth - ethOut - fee) * newTok + newTok, vEth * vTok, "k shortfall below one rounding step");
    }

    /// Buying and immediately selling the same tokens can never return more than was paid.
    function testFuzz_RoundTrip_NoFreeMoney(uint256 vEth, uint256 vTok, uint256 ethIn) public pure {
        (vEth, vTok) = _reserves(vEth, vTok);
        ethIn = bound(ethIn, 1e9, vEth * 10);
        (uint256 tokenOut, uint256 buyFee) = CurveMath.getAmountOutBuy(ethIn, vEth, vTok, 0);
        vm.assume(tokenOut > 0);

        uint256 newEth = vEth + ethIn - buyFee;
        uint256 newTok = vTok - tokenOut;
        (uint256 ethBack,) = CurveMath.getAmountOutSell(tokenOut, newEth, newTok);
        assertLe(ethBack, ethIn, "round trip is never profitable");
    }

    /// Paying the quoted price always buys at least the requested amount.
    function testFuzz_EthInForTokens_IsSufficient(uint256 vEth, uint256 vTok, uint256 tokensOut) public pure {
        (vEth, vTok) = _reserves(vEth, vTok);
        tokensOut = bound(tokensOut, 1, vTok / 2);
        (uint256 grossEth, uint256 fee) = CurveMath.getEthInForTokens(tokensOut, vEth, vTok);
        vm.assume(grossEth > 0);

        (uint256 bought,) = CurveMath.getAmountOutBuy(grossEth, vEth, vTok, 0);
        assertGe(bought, tokensOut, "quoted price buys the requested tokens");
        assertLe(fee, grossEth / 100 + 1, "fee stays at 1%");
    }
}
