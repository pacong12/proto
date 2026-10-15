// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IUniswapV4
 * @notice Canonical Uniswap v4 interfaces for PoolKey, PoolId, and PoolManager.
 * In Uniswap v4, all pools are singletons managed by IPoolManager.
 */
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

library PoolIdLibrary {
    function toId(PoolKey memory poolKey) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolKey));
    }
}

interface IPoolManager {
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
    function unlock(bytes calldata data) external returns (bytes memory);
}

interface IHooks {
    function beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96) external returns (bytes4);
    function afterInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96, int24 tick) external returns (bytes4);
    function beforeAddLiquidity(address sender, PoolKey calldata key, bytes calldata params, bytes calldata hookData) external returns (bytes4);
    function afterAddLiquidity(address sender, PoolKey calldata key, bytes calldata params, int256 delta, int256 feesAccrued, bytes calldata hookData) external returns (bytes4, int256);
    function beforeRemoveLiquidity(address sender, PoolKey calldata key, bytes calldata params, bytes calldata hookData) external returns (bytes4);
    function afterRemoveLiquidity(address sender, PoolKey calldata key, bytes calldata params, int256 delta, int256 feesAccrued, bytes calldata hookData) external returns (bytes4, int256);
    function beforeSwap(address sender, PoolKey calldata key, bytes calldata params, bytes calldata hookData) external returns (bytes4, int256, uint24);
    function afterSwap(address sender, PoolKey calldata key, bytes calldata params, int256 delta, bytes calldata hookData) external returns (bytes4, int128);
}

interface IPositionManagerV4 {
    function WETH9() external view returns (address);
    function poolManager() external view returns (address);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}
