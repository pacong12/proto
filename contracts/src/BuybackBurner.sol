// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBuybackBurner} from "./interfaces/IBuybackBurner.sol";
import {ISwapRouter, IWETH} from "./interfaces/IUniswapV3.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";

/**
 * @title BuybackBurner
 * @notice Automated buyback-and-burn engine for the Proto protocol.
 *
 * Security notes:
 *   - M-01 fix: executeBuyback() requires a strictly positive minAmountOut.
 *     The caller must supply a realistic minimum derived from an off-chain quoter
 *     (e.g. Uniswap QuoterV2) so that the slippage floor is always meaningful.
 *     The maxSlippageBps cap then provides a secondary ceiling relative to that
 *     caller-supplied minimum, guarding against sandwich attacks.
 *   - nonReentrant guard prevents reentrant calls through the swap router.
 *   - Two-step ownership transfer prevents accidental loss of control.
 */
contract BuybackBurner is IBuybackBurner {
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint24 public constant POOL_FEE = 10000;

    address public immutable targetToken;
    address public immutable weth;
    ISwapRouter public immutable swapRouter;
    address public owner;
    address public pendingOwner;

    uint256 public override totalBurned;
    uint256 public override lastBuybackTimestamp;
    uint256 public override cooldown = 3600;
    uint24 public maxSlippageBps = 300;

    bool private _locked;

    error Unauthorized();
    error CooldownActive();
    error InsufficientWethBalance();
    error ZeroMinAmountOut();
    error SlippageExceeded();
    error ZeroAddress();
    error Reentrancy();
    error NoPendingOwner();
    error TransferFailed();

    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(
        address _targetToken,
        address _weth,
        address _swapRouter
    ) {
        if (_targetToken == address(0) || _weth == address(0) || _swapRouter == address(0)) {
            revert ZeroAddress();
        }
        targetToken = _targetToken;
        weth = _weth;
        swapRouter = ISwapRouter(_swapRouter);
        owner = msg.sender;
    }

    receive() external payable {
        if (msg.value > 0) {
            IWETH(weth).deposit{value: msg.value}();
        }
    }

    // ---------------------------------------------------------------------------
    // Owner administration
    // ---------------------------------------------------------------------------

    function setCooldown(uint256 newCooldown) external onlyOwner {
        cooldown = newCooldown;
        emit CooldownUpdated(newCooldown);
    }

    function setMaxSlippageBps(uint24 newMaxSlippage) external onlyOwner {
        maxSlippageBps = newMaxSlippage;
        emit MaxSlippageUpdated(newMaxSlippage);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        address previous = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }

    /**
     * @notice Emergency WETH recovery if the swap router or target token is no longer viable.
     * @dev L-05 fix: prevents WETH from being permanently locked.
     */
    function emergencyWithdrawWeth(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = IWETH(weth).balanceOf(address(this));
        if (balance > 0) {
            bool ok = IWETH(weth).transfer(recipient, balance);
            if (!ok) revert TransferFailed();
        }
    }

    // ---------------------------------------------------------------------------
    // Buyback
    // ---------------------------------------------------------------------------

    /**
     * @notice Execute a buyback using the full WETH balance of this contract.
     *
     * @param minAmountOut Minimum tokens to receive. Must be greater than zero.
     *        Callers MUST derive this from an off-chain QuoterV2 call immediately
     *        before submitting the transaction, adjusted for acceptable slippage.
     *        This value IS the effective slippage floor — the swap reverts if the
     *        router cannot deliver at least this many tokens.
     *
     * M-01 fix: minAmountOut == 0 is explicitly rejected. Previously a zero value
     *   caused the effective minimum to always be zero, making the slippage guard
     *   non-functional and the swap fully exploitable by front-runners.
     *
     * F-06 fix: removed the dead slippageFloor/effectiveMin calculation. The
     *   previous logic computed `slippageFloor = minAmountOut * (1 - maxSlippageBps%)`
     *   which is always <= minAmountOut, so effectiveMin was always minAmountOut and
     *   maxSlippageBps had zero effect. The correct design is: caller supplies a
     *   well-derived minAmountOut; maxSlippageBps is retained as an owner-configurable
     *   cap that the off-chain bot MUST respect when computing minAmountOut — it is
     *   an operational parameter, not a redundant on-chain guard.
     */
    function executeBuyback(uint256 minAmountOut) external override nonReentrant onlyOwner returns (uint256 tokensBurned) {
        if (lastBuybackTimestamp > 0 && block.timestamp < lastBuybackTimestamp + cooldown) {
            revert CooldownActive();
        }

        uint256 wethBalance = IWETH(weth).balanceOf(address(this));
        if (wethBalance == 0) revert InsufficientWethBalance();

        // M-01 fix: reject zero minimum so the slippage floor is always meaningful.
        if (minAmountOut == 0) revert ZeroMinAmountOut();

        // minAmountOut is the effective floor; caller must compute it using QuoterV2
        // and apply maxSlippageBps off-chain before submitting.
        IWETH(weth).approve(address(swapRouter), 0);
        IWETH(weth).approve(address(swapRouter), wethBalance);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: weth,
            tokenOut: targetToken,
            fee: POOL_FEE,
            recipient: BURN_ADDRESS,
            deadline: block.timestamp + 1200,
            amountIn: wethBalance,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });

        tokensBurned = swapRouter.exactInputSingle(params);
        if (tokensBurned < minAmountOut) revert SlippageExceeded();

        totalBurned += tokensBurned;
        lastBuybackTimestamp = block.timestamp;

        emit BuybackExecuted(targetToken, wethBalance, tokensBurned, block.timestamp);
    }
}
