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
    /// @notice Hard cap on maxSlippageBps. 1000 bps = 10% — beyond this the
    ///         buyback becomes trivially sandwichable regardless of minAmountOut.
    uint24 public constant MAX_SLIPPAGE_CAP_BPS = 1000;

    address public immutable targetToken;
    address public immutable weth;
    ISwapRouter public immutable swapRouter;
    address public owner;
    address public pendingOwner;

    uint256 public override totalBurned;
    uint256 public override lastBuybackTimestamp;
    uint256 public override cooldown = 3600;
    uint24 public maxSlippageBps = 300;
    /// @notice Tokens received per 1e18 WETH in the last successful buyback.
    ///         Used as reference price for enforcing the maxSlippageBps floor.
    ///         Zero until the first buyback executes (no floor applied on first call).
    uint256 public lastKnownRate;

    bool private _locked;

    error Unauthorized();
    error CooldownActive();
    error InsufficientWethBalance();
    error ZeroMinAmountOut();
    error InvalidSlippage();
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

    /**
     * @notice Set the maximum permitted slippage for buyback swaps.
     * @dev M-02 fix: enforce that slippage cap is non-zero (a zero cap makes
     *      minAmountOut meaningless because any value would satisfy it) and that
     *      it cannot exceed MAX_SLIPPAGE_CAP_BPS (1000 bps = 10%). Values above
     *      10% make the buyback trivially front-runnable regardless of minAmountOut.
     */
    function setMaxSlippageBps(uint24 newMaxSlippage) external onlyOwner {
        if (newMaxSlippage == 0 || newMaxSlippage > MAX_SLIPPAGE_CAP_BPS) revert InvalidSlippage();
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
    // slither-disable-next-line reentrancy-balance
    function executeBuyback(uint256 minAmountOut) external override nonReentrant onlyOwner returns (uint256 tokensBurned) {
        if (lastBuybackTimestamp > 0 && block.timestamp < lastBuybackTimestamp + cooldown) {
            revert CooldownActive();
        }

        uint256 wethBalance = IWETH(weth).balanceOf(address(this));
        if (wethBalance < 1) revert InsufficientWethBalance();

        // M-01 fix: reject zero minimum so the slippage floor is always meaningful.
        if (minAmountOut == 0) revert ZeroMinAmountOut();

        // M-02 fix: enforce maxSlippageBps on-chain using lastKnownRate as a reference
        // price. After the first buyback, the caller's minAmountOut must be at least
        // wethBalance * lastKnownRate * (BPS - maxSlippageBps) / BPS / 1e18.
        // This prevents a compromised or careless owner from passing a trivially small
        // minAmountOut that ignores the configured slippage cap.
        // On the very first call (lastKnownRate == 0) the only guard is minAmountOut > 0;
        // the actual swap outcome seeds lastKnownRate for all future calls.
        if (lastKnownRate > 0) {
            uint256 expectedOut = (wethBalance * lastKnownRate) / 1e18;
            uint256 requiredMin = expectedOut * (10_000 - maxSlippageBps) / 10_000;
            if (minAmountOut < requiredMin) revert SlippageExceeded();
        }

        // Update state before external swap interaction (CEI pattern)
        lastBuybackTimestamp = block.timestamp;

        // minAmountOut is the effective floor; caller must derive it from an off-chain
        // QuoterV2 call and apply maxSlippageBps before submitting.
        bool okZero = IWETH(weth).approve(address(swapRouter), 0);
        if (!okZero) revert TransferFailed();
        bool okApprove = IWETH(weth).approve(address(swapRouter), wethBalance);
        if (!okApprove) revert TransferFailed();

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

        // Update reference rate: tokens per 1e18 WETH, used to floor the next call.
        lastKnownRate = (tokensBurned * 1e18) / wethBalance;

        totalBurned += tokensBurned;

        emit BuybackExecuted(targetToken, wethBalance, tokensBurned, block.timestamp);
    }
}
