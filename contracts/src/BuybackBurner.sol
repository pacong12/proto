// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBuybackBurner} from "./interfaces/IBuybackBurner.sol";
import {ISwapRouter, IWETH} from "./interfaces/IUniswapV3.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";

/**
 * @title BuybackBurner
 * @notice Automated TWAP buyback and burn engine for Proto protocol.
 * Executes regular market buybacks of native token using protocol WETH fees and permanently burns them.
 */
contract BuybackBurner is IBuybackBurner {
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint24 public constant POOL_FEE = 10000; // 1%

    address public immutable targetToken;
    address public immutable weth;
    ISwapRouter public immutable swapRouter;
    address public owner;

    uint256 public override totalBurned;
    uint256 public override lastBuybackTimestamp;
    uint256 public override cooldown = 3600; // 1 hour TWAP interval
    uint24 public maxSlippageBps = 300;     // 3% max slippage

    bool private _locked;

    error Unauthorized();
    error CooldownActive();
    error InsufficientWethBalance();
    error SlippageExceeded();
    error ZeroAddress();
    error Reentrancy();

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

    function setCooldown(uint256 newCooldown) external onlyOwner {
        cooldown = newCooldown;
        emit CooldownUpdated(newCooldown);
    }

    function setMaxSlippageBps(uint24 newMaxSlippage) external onlyOwner {
        maxSlippageBps = newMaxSlippage;
        emit MaxSlippageUpdated(newMaxSlippage);
    }

    function executeBuyback(uint256 minAmountOut) external override nonReentrant returns (uint256 tokensBurned) {
        if (lastBuybackTimestamp > 0 && block.timestamp < lastBuybackTimestamp + cooldown) {
            revert CooldownActive();
        }

        uint256 wethBalance = IWETH(weth).balanceOf(address(this));
        if (wethBalance == 0) revert InsufficientWethBalance();

        // Approve WETH to SwapRouter
        IWETH(weth).approve(address(swapRouter), wethBalance);

        // Execute Swap WETH -> targetToken routed directly to BURN_ADDRESS
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
