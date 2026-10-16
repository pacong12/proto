// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManagerV4} from "../../interfaces/external/IUniswapV4Core.sol";

/**
 * @title V4Lib
 * @notice Delta unpacking, pool state reads and single-sided liquidity math for Uniswap v4.
 */
library V4Lib {
    uint256 internal constant Q96 = 0x1000000000000000000000000;

    /// @dev `pools` mapping slot in v4-core PoolManager (StateLibrary.POOLS_SLOT).
    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));

    function amount0(int256 delta) internal pure returns (int128) {
        return int128(delta >> 128);
    }

    function amount1(int256 delta) internal pure returns (int128) {
        return int128(delta);
    }

    /// @dev BeforeSwapDelta with only the specified-currency component set.
    function toBeforeSwapDelta(int128 specified) internal pure returns (int256) {
        return int256(specified) << 128;
    }

    function abs(int256 x) internal pure returns (uint256) {
        return x < 0 ? uint256(-x) : uint256(x);
    }

    /// @notice Reads sqrtPriceX96 and tick from PoolManager storage (equivalent to StateLibrary.getSlot0).
    function getSlot0(IPoolManagerV4 manager, bytes32 poolId) internal view returns (uint160 sqrtPriceX96, int24 tick) {
        bytes32 data = manager.extsload(keccak256(abi.encodePacked(poolId, POOLS_SLOT)));
        sqrtPriceX96 = uint160(uint256(data));
        assembly ("memory-safe") {
            tick := signextend(2, shr(160, data))
        }
    }

    /// @notice Liquidity for a position holding only currency1 (current price at or above the range).
    function liquidityForAmount1(uint160 sqrtLower, uint160 sqrtUpper, uint256 amount) internal pure returns (uint128) {
        return _toUint128((amount * Q96) / (sqrtUpper - sqrtLower));
    }

    /// @notice Liquidity for a position holding only currency0 (current price at or below the range). Rounds down.
    // slither-disable-next-line divide-before-multiply (intentional rounding; see docs/audit/AUDIT-VERIFICATION.md)
    function liquidityForAmount0(uint160 sqrtLower, uint160 sqrtUpper, uint256 amount) internal pure returns (uint128) {
        uint256 intermediate = (amount * sqrtLower) / Q96;
        return _toUint128((intermediate * sqrtUpper) / (sqrtUpper - sqrtLower));
    }

    function _toUint128(uint256 x) private pure returns (uint128) {
        require(x <= type(uint128).max, "LIQUIDITY_OVERFLOW");
        return uint128(x);
    }
}
