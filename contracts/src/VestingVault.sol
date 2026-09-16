// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";

/**
 * @title VestingVault
 * @notice Linear vesting vault for team grants and protocol allocations.
 *
 * Security notes:
 *   - L-03 fix: the schedule creator may revoke an unvested schedule via
 *     revokeVesting(). The vested portion is transferred to the beneficiary
 *     immediately; the remaining unvested amount is returned to the creator.
 *   - nonReentrant guard on all state-mutating functions.
 *   - CEI pattern: state mutations precede all token transfers.
 */
contract VestingVault {
    struct Schedule {
        address creator;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 duration;
        bool exists;
        bool revoked;
    }

    // token => beneficiary => Schedule
    mapping(address => mapping(address => Schedule)) public vestingSchedules;

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

    error ZeroAddress();
    error ZeroAmount();
    error ScheduleExists();
    error TransferFailed();
    error Reentrancy();
    error Unauthorized();
    error ScheduleNotFound();
    error AlreadyRevoked();

    uint256 private _locked;

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    // ---------------------------------------------------------------------------
    // Schedule management
    // ---------------------------------------------------------------------------

    /**
     * @notice Create a linear vesting schedule for a beneficiary.
     * @param token   ERC-20 token address.
     * @param beneficiary Address that will receive vested tokens.
     * @param amount  Total tokens to vest.
     * @param duration Vesting duration in seconds.
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
            creator: msg.sender,
            totalAmount: amount,
            claimedAmount: 0,
            startTime: block.timestamp,
            duration: duration,
            exists: true,
            revoked: false
        });

        emit VestingCreated(token, beneficiary, msg.sender, amount, block.timestamp, duration);
    }

    /**
     * @notice Revoke an unvested schedule.
     * @dev L-03 fix: the schedule creator may revoke at any time before the
     *      schedule is fully claimed. Tokens vested up to this point are sent to
     *      the beneficiary; the remainder is returned to the creator.
     */
    function revokeVesting(address token, address beneficiary) external nonReentrant {
        Schedule storage s = vestingSchedules[token][beneficiary];
        if (!s.exists) revert ScheduleNotFound();
        if (msg.sender != s.creator) revert Unauthorized();
        if (s.revoked) revert AlreadyRevoked();

        s.revoked = true;

        uint256 vested = _computeVested(s);
        uint256 claimableNow = vested > s.claimedAmount ? vested - s.claimedAmount : 0;
        uint256 unvested = s.totalAmount - vested;

        // State update before transfers (CEI).
        s.claimedAmount += claimableNow;

        if (claimableNow > 0) {
            bool sent = ILaunchpadToken(token).transfer(beneficiary, claimableNow);
            if (!sent) revert TransferFailed();
        }

        if (unvested > 0) {
            bool returned = ILaunchpadToken(token).transfer(s.creator, unvested);
            if (!returned) revert TransferFailed();
        }

        emit VestingRevoked(token, beneficiary, claimableNow, unvested);
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function getVestedAmount(address token, address beneficiary) public view returns (uint256) {
        Schedule memory s = vestingSchedules[token][beneficiary];
        if (!s.exists) return 0;
        return _computeVested(s);
    }

    function getClaimableAmount(address token, address beneficiary) external view returns (uint256) {
        Schedule memory s = vestingSchedules[token][beneficiary];
        if (!s.exists || s.revoked) return 0;
        uint256 vested = _computeVested(s);
        return vested > s.claimedAmount ? vested - s.claimedAmount : 0;
    }

    // ---------------------------------------------------------------------------
    // Claiming
    // ---------------------------------------------------------------------------

    function claimVested(address token) external nonReentrant returns (uint256 claimable) {
        Schedule storage s = vestingSchedules[token][msg.sender];
        if (!s.exists || s.revoked) return 0;

        uint256 vested = _computeVested(s);
        claimable = vested > s.claimedAmount ? vested - s.claimedAmount : 0;

        if (claimable > 0) {
            s.claimedAmount += claimable;
            bool success = ILaunchpadToken(token).transfer(msg.sender, claimable);
            if (!success) revert TransferFailed();
            emit TokensClaimed(token, msg.sender, claimable);
        }
    }

    // ---------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------

    function _computeVested(Schedule memory s) internal view returns (uint256) {
        if (block.timestamp < s.startTime) return 0;
        uint256 elapsed = block.timestamp - s.startTime;
        if (elapsed >= s.duration) return s.totalAmount;
        return (s.totalAmount * elapsed) / s.duration;
    }
}
