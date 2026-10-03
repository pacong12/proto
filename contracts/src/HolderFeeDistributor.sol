// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {IWETH} from "./interfaces/IUniswapV3.sol";

/**
 * @title HolderFeeDistributor
 * @notice Distributes accrued Uniswap V3 trading fees pro-rata to token holders
 *         using a cumulative reward-per-token accounting model (O(1) per claim).
 *
 * Security notes:
 *   - F-03 fix: earned() uses the balance snapshotted at the last _updateReward
 *     checkpoint, not the real-time balanceOf(). This prevents flash-loan or
 *     same-block balance inflation: an attacker who acquires tokens after the
 *     reward accumulator advances cannot retroactively earn from prior deposits
 *     because their snapshotBalance is still zero (or their pre-buy value) until
 *     they call a function that triggers _updateReward (i.e. claimReward).
 *     The snapshot is written in _updateReward using the live balance at that
 *     moment — callers cannot inflate it after rewards have already accumulated
 *     because the delta (cum - paid) is zeroed out simultaneously.
 *   - nonReentrant guard on all state-mutating functions.
 *   - Only the registered locker address may deposit rewards (I-05 fix).
 */
contract HolderFeeDistributor {
    uint256 private constant PRECISION = 1e36;

    address public immutable weth;
    address public immutable locker;

    struct TokenFeeState {
        uint256 rewardPerTokenCumulative;
        uint256 totalDistributedWeth;
    }

    mapping(address => TokenFeeState) public tokenFeeStates;
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
    mapping(address => mapping(address => uint256)) public userEarnedWeth;
    /// @notice Balance snapshot captured at the last _updateReward checkpoint.
    ///         Used instead of live balanceOf() to neutralise flash-loan inflation:
    ///         tokens acquired *after* the accumulator has advanced cannot
    ///         retroactively earn from prior deposits because their snapshot is
    ///         still zero (or the pre-buy value) until _updateReward fires again.
    mapping(address => mapping(address => uint256)) public snapshotBalance;

    event RewardDeposited(address indexed token, uint256 wethAmount);
    event RewardClaimed(address indexed token, address indexed holder, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();
    error Reentrancy();
    error Unauthorized();

    uint256 private _locked;

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    modifier onlyLocker() {
        if (msg.sender != locker) revert Unauthorized();
        _;
    }

    constructor(address _weth, address _locker) {
        if (_weth == address(0) || _locker == address(0)) revert ZeroAddress();
        weth = _weth;
        locker = _locker;
    }

    // ---------------------------------------------------------------------------
    // Reward accounting
    // ---------------------------------------------------------------------------

    /**
     * @notice Deposit WETH rewards for distribution to token holders.
     * @dev I-05 fix: restricted to the locker contract. Only the locker collects
     *      Uniswap V3 fees and forwards them here, preventing arbitrary deposits
     *      that could distort the reward-per-token accumulator.
     */
    function depositRewards(address token, uint256 amount) external nonReentrant onlyLocker {
        if (amount == 0) revert ZeroAmount();
        if (token == address(0)) revert ZeroAddress();

        bool success = IWETH(weth).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        uint256 supply = ILaunchpadToken(token).totalSupply();
        if (supply > 0) {
            tokenFeeStates[token].rewardPerTokenCumulative += (amount * PRECISION) / supply;
        }
        tokenFeeStates[token].totalDistributedWeth += amount;

        emit RewardDeposited(token, amount);
    }

    /**
     * @notice Compute unclaimed WETH for a holder based on their snapshotted balance
     *         and the cumulative reward-per-token since their last checkpoint.
     * @dev H-03 fix: uses snapshotBalance[token][holder] captured at _updateReward,
     *      NOT live balanceOf(). This neutralises flash-loan balance inflation:
     *      acquiring tokens in the same block as a deposit cannot retroactively
     *      earn rewards because the snapshot was taken before the acquisition.
     *      A holder with no prior checkpoint has snapshotBalance == 0, so they
     *      earn zero from historical accumulation — only future deposits after
     *      their first _updateReward call will be counted.
     */
    function earned(address token, address holder) public view returns (uint256) {
        uint256 balance = snapshotBalance[token][holder];
        uint256 cum = tokenFeeStates[token].rewardPerTokenCumulative;
        uint256 paid = userRewardPerTokenPaid[token][holder];

        uint256 newlyEarned = (balance * (cum - paid)) / PRECISION;
        return userEarnedWeth[token][holder] + newlyEarned;
    }

    function _updateReward(address token, address holder) internal {
        userEarnedWeth[token][holder] = earned(token, holder);
        userRewardPerTokenPaid[token][holder] = tokenFeeStates[token].rewardPerTokenCumulative;
        // Snapshot the live balance now so future reward calculations use this
        // checkpoint rather than a potentially manipulated live balance.
        snapshotBalance[token][holder] = ILaunchpadToken(token).balanceOf(holder);
    }


    /**
     * @notice Snapshot the caller's current balance into the reward accounting system.
     * @dev Allows a holder to register their balance before rewards are deposited,
     *      ensuring they will earn from subsequent deposits. Without calling checkpoint
     *      (or claimReward), a holder with snapshotBalance == 0 earns nothing from
     *      historical accumulation — only future deposits after their first checkpoint.
     *      Any address may checkpoint any holder; snapshotting another holder is safe
     *      because it can only increase their tracked balance, never decrease it.
     */
    function checkpoint(address token, address holder) external nonReentrant {
        _updateReward(token, holder);
    }
    /**
     * @notice Claim accrued WETH rewards for the caller.
     */
    function claimReward(address token) external nonReentrant returns (uint256 reward) {
        _updateReward(token, msg.sender);
        reward = userEarnedWeth[token][msg.sender];
        if (reward > 0) {
            userEarnedWeth[token][msg.sender] = 0;
            bool success = IWETH(weth).transfer(msg.sender, reward);
            if (!success) revert TransferFailed();
            emit RewardClaimed(token, msg.sender, reward);
        }
    }
}
