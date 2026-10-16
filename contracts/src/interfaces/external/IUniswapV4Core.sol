// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "./IUniswapV4.sol";

/**
 * @title IUniswapV4Core
 * @notice ABI-exact subset of Uniswap v4-core used by Proto's in-pool launch flow.
 *         Currencies are plain addresses and BalanceDelta / BeforeSwapDelta are packed int256
 *         values (amount0 / specified in the upper 128 bits, amount1 / unspecified in the lower).
 */
struct ModifyLiquidityParams {
    int24 tickLower;
    int24 tickUpper;
    int256 liquidityDelta;
    bytes32 salt;
}

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

interface IPoolManagerV4 {
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
    function unlock(bytes calldata data) external returns (bytes memory);
    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData)
        external
        returns (int256 callerDelta, int256 feesAccrued);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external
        returns (int256 swapDelta);
    function sync(address currency) external;
    function settle() external payable returns (uint256 paid);
    function take(address currency, address to, uint256 amount) external;
    function extsload(bytes32 slot) external view returns (bytes32 value);
}

interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}
