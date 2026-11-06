// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVestingVault
 * @notice Interface boundary for VestingVault, the shared lock for creator launch buys.
 *         Launchers create schedules; the vault never lets anyone but the beneficiary take tokens.
 */
interface IVestingVault {
    /// @dev `cliff` and `duration` are seconds counted from `start` (the launch).
    struct Schedule {
        address token;
        uint64 start;
        address beneficiary;
        uint64 cliff;
        uint64 duration;
        uint128 total;
        uint128 claimed;
    }

    event ScheduleCreated(
        address indexed token,
        address indexed beneficiary,
        uint256 indexed id,
        uint256 amount,
        uint64 start,
        uint64 cliff,
        uint64 duration
    );
    event Claimed(uint256 indexed id, address indexed token, address indexed beneficiary, uint256 amount);
    event DividendsClaimed(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event LauncherSet(address indexed launcher, bool allowed);
    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidSchedule();
    error ScheduleExists();
    error UnknownSchedule();
    error InsufficientDeposit();
    error Unauthorized();
    error NoPendingOwner();
    error TransferFailed();
    error Reentrancy();

    function createSchedule(address token, address beneficiary, uint256 amount, uint64 cliff, uint64 duration)
        external
        returns (uint256 id);

    function claimVested(uint256 id) external returns (uint256 amount);

    function claimDividends(uint256 id) external returns (uint256 amount);

    function vestedAmount(uint256 id) external view returns (uint256);

    function releasable(uint256 id) external view returns (uint256);

    function pendingDividends(uint256 id) external view returns (uint256);

    function getSchedule(uint256 id) external view returns (Schedule memory);

    function schedulesOf(address beneficiary) external view returns (uint256[] memory);

    function scheduleIdOf(address token) external view returns (uint256);
}
