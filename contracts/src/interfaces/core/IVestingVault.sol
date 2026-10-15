// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVestingVault
 * @notice Clean Architecture interface boundary for VestingVault linear grant contract.
 */
interface IVestingVault {
    struct Schedule {
        address creator;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 duration;
        bool exists;
        bool revoked;
    }

    event VestingCreated(
        address indexed token,
        address indexed beneficiary,
        address indexed creator,
        uint256 amount,
        uint256 startTime,
        uint256 duration
    );
    event TokensClaimed(address indexed token, address indexed beneficiary, uint256 amount);
    event VestingRevoked(
        address indexed token,
        address indexed beneficiary,
        uint256 vestedToHolder,
        uint256 returnedToCreator
    );

    function createVestingSchedule(
        address token,
        address beneficiary,
        uint256 amount,
        uint256 duration
    ) external;

    function claimVestedTokens(address token) external returns (uint256 claimable);

    function revokeVesting(address token, address beneficiary) external;

    function getClaimableAmount(
        address token,
        address beneficiary
    ) external view returns (uint256);
}
