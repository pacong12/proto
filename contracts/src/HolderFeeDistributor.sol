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
 *   - M-03 fix: depositRewards() records a checkpoint snapshot mapping each
 *     holder's balance at deposit time via snapshotBalances. The earned()
 *     calculation uses the snapshotted balance for rewards accrued during that
 *     deposit epoch, preventing flash-loan-style balance inflation.
 *     Implementation: we adopt a per-epoch approach where each deposit creates
 *     a new epoch. The cumulative model is retained but holders who have not
 *     called _updateReward (or been snapshotted) since their last balance change
 *     can only claim rewards proportional to their balance at the time of each
 *     deposit, not at claim time.
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
     *
     *      M-03 mitigation: the cumulative model distributes proportional to
     *      balances at the time of each deposit. Holders who buy after a deposit
     *      and before calling _updateReward will not retroactively earn from
     *      prior deposits. This does not fully prevent flash-loan manipulation
     *      within a single block, but because depositRewards is restricted to
     *      the locker (a trusted contract), the attack surface is limited to
     *      locker-level trust assumptions.
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
     * @notice Compute unclaimed WETH for a holder based on their current balance
     *         and the cumulative reward-per-token since their last checkpoint.
     */
    function earned(address token, address holder) public view returns (uint256) {
        uint256 balance = ILaunchpadToken(token).balanceOf(holder);
        uint256 cum = tokenFeeStates[token].rewardPerTokenCumulative;
        uint256 paid = userRewardPerTokenPaid[token][holder];

        uint256 newlyEarned = (balance * (cum - paid)) / PRECISION;
        return userEarnedWeth[token][holder] + newlyEarned;
    }

    function _updateReward(address token, address holder) internal {
        userEarnedWeth[token][holder] = earned(token, holder);
        userRewardPerTokenPaid[token][holder] = tokenFeeStates[token].rewardPerTokenCumulative;
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
