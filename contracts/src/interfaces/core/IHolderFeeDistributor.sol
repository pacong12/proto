// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IHolderFeeDistributor
 * @notice Clean Architecture interface boundary for HolderFeeDistributor contract.
 */
interface IHolderFeeDistributor {
    event RewardDeposited(address indexed token, uint256 wethAmount);
    event RewardClaimed(address indexed token, address indexed holder, uint256 amount);

    function depositRewards(address token, uint256 amount) external;

    function earned(address token, address holder) external view returns (uint256);

    function claimReward(address token) external returns (uint256 reward);

    function checkpoint(address token, address holder) external;

    function weth() external view returns (address);

    function locker() external view returns (address);

    function snapshotBalance(address token, address holder) external view returns (uint256);
}
