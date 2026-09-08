// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBuybackBurner {
    event BuybackExecuted(
        address indexed token,
        uint256 wethAmountIn,
        uint256 tokenAmountBurned,
        uint256 timestamp
    );

    event CooldownUpdated(uint256 newCooldown);
    event MaxSlippageUpdated(uint24 newMaxSlippage);

    function executeBuyback(uint256 minAmountOut) external returns (uint256 tokensBurned);
    function totalBurned() external view returns (uint256);
    function lastBuybackTimestamp() external view returns (uint256);
    function cooldown() external view returns (uint256);
}
