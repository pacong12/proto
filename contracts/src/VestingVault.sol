// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";

/**
 * @title VestingVault
 * @notice Linear vesting vault for protocol buybacks, team grants, and migration claims.
 * Tokens vest continuously and linearly over a configurable duration (e.g. 5 years or 90 days).
 */
contract VestingVault {
    struct Schedule {
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 duration;
        bool exists;
    }

    // token => beneficiary => Schedule
    mapping(address => mapping(address => Schedule)) public vestingSchedules;

    event VestingCreated(
        address indexed token,
        address indexed beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 duration
    );
    event TokensClaimed(address indexed token, address indexed beneficiary, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error ScheduleExists();
    error TransferFailed();
    error Reentrancy();

    uint256 private _locked;
    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    /**
     * @notice Create a new linear vesting schedule.
     */
    function createVestingSchedule(
        address token,
        address beneficiary,
        uint256 amount,
        uint256 duration
    ) external nonReentrant {
        if (token == address(0) || beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0 || duration == 0) revert ZeroAmount();
        if (vestingSchedules[token][beneficiary].exists) revert ScheduleExists();

        bool success = ILaunchpadToken(token).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        vestingSchedules[token][beneficiary] = Schedule({
            totalAmount: amount,
            claimedAmount: 0,
            startTime: block.timestamp,
            duration: duration,
            exists: true
        });

        emit VestingCreated(token, beneficiary, amount, block.timestamp, duration);
    }

    /**
     * @notice Calculate currently vested (unlocked) tokens for a beneficiary.
     */
    function getVestedAmount(address token, address beneficiary) public view returns (uint256) {
        Schedule memory s = vestingSchedules[token][beneficiary];
        if (!s.exists) return 0;

        if (block.timestamp < s.startTime) return 0;
        uint256 elapsed = block.timestamp - s.startTime;

        if (elapsed >= s.duration) {
            return s.totalAmount;
        }

        return (s.totalAmount * elapsed) / s.duration;
    }

    /**
     * @notice Calculate claimable tokens (vested minus already claimed).
     */
    function getClaimableAmount(address token, address beneficiary) external view returns (uint256) {
        Schedule memory s = vestingSchedules[token][beneficiary];
        if (!s.exists) return 0;
        uint256 vested = getVestedAmount(token, beneficiary);
        return vested > s.claimedAmount ? vested - s.claimedAmount : 0;
    }

    /**
     * @notice Claim unlocked vested tokens.
     */
    function claimVested(address token) external nonReentrant returns (uint256 claimable) {
        Schedule storage s = vestingSchedules[token][msg.sender];
        if (!s.exists) return 0;

        uint256 vested = getVestedAmount(token, msg.sender);
        claimable = vested > s.claimedAmount ? vested - s.claimedAmount : 0;

        if (claimable > 0) {
            s.claimedAmount += claimable;
            bool success = ILaunchpadToken(token).transfer(msg.sender, claimable);
            if (!success) revert TransferFailed();
            emit TokensClaimed(token, msg.sender, claimable);
        }
    }
}
