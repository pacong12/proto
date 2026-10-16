// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "../interfaces/IUniswapV4.sol";
import {IPoolManagerV4, IUnlockCallback, SwapParams} from "../interfaces/external/IUniswapV4Core.sol";
import {TickMath} from "../libraries/v4/TickMath.sol";
import {V4Lib} from "../libraries/v4/V4Lib.sol";

interface IERC20Router {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title ProtoV4Router
 * @notice Minimal exact-input single-pool swap router for Proto v4 pools, deployable on any chain
 *         (Uniswap's Universal Router is not deployed everywhere).
 *
 *         Payment for the input currency:
 *           - native currency (address(0)): msg.value == amountIn;
 *           - `nativeErc20` (an ERC-20 view of the native balance, e.g. Arc USDC with 6 decimals):
 *             either msg.value == amountIn * nativeErc20Scale, spent from this router's native-backed
 *             balance, or an ERC-20 approval like any other token;
 *           - any other ERC-20: exact approval to this router (no Permit2, no unlimited allowance).
 *         The router never holds funds between transactions; unspent value is refunded.
 */
contract ProtoV4Router is IUnlockCallback {
    IPoolManagerV4 public immutable poolManager;
    address public immutable nativeErc20;
    uint256 public immutable nativeErc20Scale;

    struct SwapData {
        PoolKey key;
        bool zeroForOne;
        uint256 amountIn;
        address payer;
        bool paidWithValue;
        address recipient;
    }

    error Unauthorized();
    error Expired();
    error InvalidValue();
    error Slippage();
    error TransferFailed();

    constructor(IPoolManagerV4 _poolManager, address _nativeErc20, uint256 _nativeErc20Scale) {
        poolManager = _poolManager;
        nativeErc20 = _nativeErc20;
        nativeErc20Scale = _nativeErc20Scale;
    }

    /**
     * @param key Pool to trade in.
     * @param zeroForOne True to sell currency0 for currency1.
     * @param amountIn Exact input amount in the input currency's own units.
     * @param minAmountOut Slippage floor in the output currency's own units.
     * @param recipient Receiver of the output (defaults to msg.sender when zero).
     */
    function swapExactIn(
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external payable returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert Expired();
        address currencyIn = zeroForOne ? key.currency0 : key.currency1;

        bool paidWithValue = msg.value > 0;
        if (currencyIn == address(0)) {
            if (msg.value != amountIn) revert InvalidValue();
        } else if (paidWithValue) {
            if (currencyIn != nativeErc20 || msg.value != amountIn * nativeErc20Scale) revert InvalidValue();
        }

        uint256 paid;
        (amountOut, paid) = abi.decode(
            poolManager.unlock(
                abi.encode(
                    SwapData({
                        key: key,
                        zeroForOne: zeroForOne,
                        amountIn: amountIn,
                        payer: msg.sender,
                        paidWithValue: paidWithValue,
                        recipient: recipient == address(0) ? msg.sender : recipient
                    })
                )
            ),
            (uint256, uint256)
        );
        if (amountOut < minAmountOut) revert Slippage();

        // Refund value not consumed by a partially filled swap.
        if (paidWithValue && paid < amountIn) {
            if (currencyIn == address(0)) {
                (bool ok,) = msg.sender.call{value: amountIn - paid}("");
                if (!ok) revert TransferFailed();
            } else if (!IERC20Router(currencyIn).transfer(msg.sender, amountIn - paid)) {
                revert TransferFailed();
            }
        }
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert Unauthorized();
        SwapData memory s = abi.decode(data, (SwapData));

        int256 delta = poolManager.swap(
            s.key,
            SwapParams({
                zeroForOne: s.zeroForOne,
                amountSpecified: -int256(s.amountIn),
                sqrtPriceLimitX96: s.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        (address currencyIn, address currencyOut) =
            s.zeroForOne ? (s.key.currency0, s.key.currency1) : (s.key.currency1, s.key.currency0);
        uint256 owed = V4Lib.abs(s.zeroForOne ? V4Lib.amount0(delta) : V4Lib.amount1(delta));
        uint256 out = V4Lib.abs(s.zeroForOne ? V4Lib.amount1(delta) : V4Lib.amount0(delta));

        if (currencyIn == address(0)) {
            poolManager.settle{value: owed}();
        } else {
            poolManager.sync(currencyIn);
            // slither-disable-next-line arbitrary-send-erc20 (payer is always the msg.sender of swapExactIn; only PoolManager can call back)
            bool ok = s.paidWithValue
                ? IERC20Router(currencyIn).transfer(address(poolManager), owed)
                : IERC20Router(currencyIn).transferFrom(s.payer, address(poolManager), owed);
            if (!ok) revert TransferFailed();
            poolManager.settle();
        }
        poolManager.take(currencyOut, s.recipient, out);
        return abi.encode(out, owed);
    }
}
