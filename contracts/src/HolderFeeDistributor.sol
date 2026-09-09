// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {IWETH} from "./interfaces/IUniswapV3.sol";

/**
 * @title HolderFeeDistributor
 * @notice Distributes accrued trading fees pro-rata to token holders.
 * Uses scalable cumulative reward-per-token math (O(1) gas complexity).
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

    uint256 private _locked;
    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(address _weth, address _locker) {
        if (_weth == address(0) || _locker == address(0)) revert ZeroAddress();
        weth = _weth;
        locker = _locker;
    }

    /**
     * @notice Deposit WETH fees from locker to distribute to token holders.
     */
    function depositRewards(address token, uint256 amount) external nonReentrant {
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
     * @notice View claimable WETH reward for a given holder.
     */
    function earned(address token, address holder) public view returns (uint256) {
        uint256 balance = ILaunchpadToken(token).balanceOf(holder);
        uint256 cum = tokenFeeStates[token].rewardPerTokenCumulative;
        uint256 paid = userRewardPerTokenPaid[token][holder];

        uint256 newlyEarned = (balance * (cum - paid)) / PRECISION;
        return userEarnedWeth[token][holder] + newlyEarned;
    }

    /**
     * @notice Update reward snapshot before changing balances or claiming.
     */
    function _updateReward(address token, address holder) internal {
        userEarnedWeth[token][holder] = earned(token, holder);
        userRewardPerTokenPaid[token][holder] = tokenFeeStates[token].rewardPerTokenCumulative;
    }

    /**
     * @notice Claim accrued WETH dividend rewards.
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
