// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CurveMath
 * @notice Pure domain math library for constant-product bonding curves.
 *         All functions are internal pure to eliminate external library linking
 *         and preserve identical CREATE2 bytecode prediction.
 */
library CurveMath {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant TRADE_FEE_BPS = 100; // 1%

    error ZeroReserve();
    error Overflow();

    /**
     * @notice Calculate tokens received and platform fee for an incoming ETH/USDC payment.
     * @dev 1% fee is deducted from input before calculating AMM output:
     *      netEth = ethIn - feeEth
     *      k = virtualEthReserve * virtualTokenReserve
     *      newTokenReserve = k / (virtualEthReserve + netEth)
     *      tokenOut = virtualTokenReserve - newTokenReserve
     * @param ethIn Total quote asset paid in wei.
     * @param virtualEthReserve Current virtual quote asset reserve.
     * @param virtualTokenReserve Current virtual token reserve.
     * @param curveAvailableTokens Maximum tokens remaining in curve available for trade.
     * @return tokenOut Tokens to deliver to buyer.
     * @return feeEth Platform fee in quote currency.
     */
    function getAmountOutBuy(
        uint256 ethIn,
        uint256 virtualEthReserve,
        uint256 virtualTokenReserve,
        uint256 curveAvailableTokens
    ) internal pure returns (uint256 tokenOut, uint256 feeEth) {
        if (ethIn == 0 || virtualEthReserve == 0 || virtualTokenReserve == 0) return (0, 0);

        feeEth = (ethIn * TRADE_FEE_BPS) / BPS;
        uint256 netEth = ethIn - feeEth;

        uint256 currentK = virtualEthReserve * virtualTokenReserve;
        uint256 newEthReserve = virtualEthReserve + netEth;
        uint256 newTokenReserve = currentK / newEthReserve;

        tokenOut = virtualTokenReserve - newTokenReserve;

        if (curveAvailableTokens > 0 && tokenOut > curveAvailableTokens) {
            tokenOut = curveAvailableTokens;
        }
    }

    /**
     * @notice Calculate exact gross ETH/USDC required to purchase a specific amount of tokens.
     * @dev Inverts getAmountOutBuy with ceiling division to preserve the constant-product invariant.
     *      k = virtualEthReserve * virtualTokenReserve
     *      newTokenReserve = virtualTokenReserve - tokensOut
     *      newEthReserve = ceil(k / newTokenReserve)
     *      netEth = newEthReserve - virtualEthReserve
     *      grossEth = ceil(netEth / (1 - TRADE_FEE_BPS / BPS))
     * @param tokensOut Amount of tokens desired.
     * @param virtualEthReserve Current virtual quote asset reserve.
     * @param virtualTokenReserve Current virtual token reserve.
     * @return grossEth Total quote asset required including 1% trade fee.
     * @return feeEth Platform fee included in grossEth.
     */
    // slither-disable-next-line divide-before-multiply (intentional rounding; see docs/audit/AUDIT-VERIFICATION.md)
    function getEthInForTokens(
        uint256 tokensOut,
        uint256 virtualEthReserve,
        uint256 virtualTokenReserve
    ) internal pure returns (uint256 grossEth, uint256 feeEth) {
        if (tokensOut == 0 || virtualEthReserve == 0 || virtualTokenReserve == 0) return (0, 0);
        if (tokensOut >= virtualTokenReserve) revert ZeroReserve();

        uint256 currentK = virtualEthReserve * virtualTokenReserve;
        uint256 newTokenReserve = virtualTokenReserve - tokensOut;
        // Ceiling division: ensures the reserve invariant k is strictly maintained
        uint256 newEthReserve = (currentK + newTokenReserve - 1) / newTokenReserve;
        uint256 netEth = newEthReserve > virtualEthReserve ? newEthReserve - virtualEthReserve : 0;

        uint256 netBps = BPS - TRADE_FEE_BPS;
        grossEth = (netEth * BPS + netBps - 1) / netBps;
        feeEth = (grossEth * TRADE_FEE_BPS) / BPS;
    }

    /**
     * @notice Calculate ETH/USDC received and platform fee for tokens sold back to curve.
     * @dev 1% fee is deducted from gross ETH proceeds:
     *      k = virtualEthReserve * virtualTokenReserve
     *      newEthReserve = k / (virtualTokenReserve + tokenIn)
     *      grossEth = virtualEthReserve - newEthReserve
     *      feeEth = grossEth * 1%
     *      ethOut = grossEth - feeEth
     * @param tokenIn Tokens to sell in wei.
     * @param virtualEthReserve Current virtual quote asset reserve.
     * @param virtualTokenReserve Current virtual token reserve.
     * @return ethOut Net quote currency returned to seller.
     * @return feeEth Platform fee in quote currency.
     */
    function getAmountOutSell(
        uint256 tokenIn,
        uint256 virtualEthReserve,
        uint256 virtualTokenReserve
    ) internal pure returns (uint256 ethOut, uint256 feeEth) {
        if (tokenIn == 0 || virtualEthReserve == 0 || virtualTokenReserve == 0) return (0, 0);

        uint256 currentK = virtualEthReserve * virtualTokenReserve;
        uint256 newTokenReserve = virtualTokenReserve + tokenIn;
        uint256 newEthReserve = currentK / newTokenReserve;

        uint256 grossEth = virtualEthReserve > newEthReserve ? virtualEthReserve - newEthReserve : 0;
        feeEth = (grossEth * TRADE_FEE_BPS) / BPS;
        ethOut = grossEth > feeEth ? grossEth - feeEth : 0;
    }

    /**
     * @notice Compute sqrtPriceX96 for Uniswap V3/V4 pool initialization from reserves.
     * @dev Pools pair native ETH (currency0) with the token (currency1), and v4 prices are
     *      currency1 per currency0: sqrtPriceX96 = sqrt(tokenReserve) * 2^96 / sqrt(ethReserve).
     * @param ethReserve Current quote asset reserve.
     * @param tokenReserve Current token reserve.
     * @return uint160 Sqrt price in X96 fixed-point format.
     */
    function computeSqrtPriceX96(
        uint256 ethReserve,
        uint256 tokenReserve
    ) internal pure returns (uint160) {
        if (tokenReserve == 0 || ethReserve == 0) revert ZeroReserve();
        uint256 sqrtNum = sqrt(tokenReserve);
        uint256 sqrtDen = sqrt(ethReserve);
        if (sqrtDen == 0) revert ZeroReserve();
        uint256 result = (sqrtNum << 96) / sqrtDen;
        if (result > type(uint160).max) revert Overflow();
        return uint160(result);
    }

    /**
     * @notice Babylonian integer square root algorithm (floor).
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x <= 0) return 0;
        y = x;
        uint256 z = (x >> 1) + 1;
        while (z < y) {
            y = z;
            z = (x / z + z) >> 1;
        }
    }

    /**
     * @notice Calculate instantaneous spot price in native quote units scaled by 1e18.
     *         spotPrice = (virtualEthReserve * 1e18) / virtualTokenReserve
     */
    function calculateSpotPrice(
        uint256 virtualEthReserve,
        uint256 virtualTokenReserve
    ) internal pure returns (uint256) {
        if (virtualTokenReserve == 0) return 0;
        return (virtualEthReserve * 1e18) / virtualTokenReserve;
    }
}
