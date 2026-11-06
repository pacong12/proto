// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVestingVault} from "../interfaces/core/IVestingVault.sol";

interface IVestedToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    /// @dev LaunchpadToken's dividend tracker (its GotonFeeSplitter); address(0) before one exists.
    function rewardTracker() external view returns (address);
}

interface IDividendTracker {
    function claim(address recipient) external returns (uint256);
    function claimable(address holder) external view returns (uint256);
}

/**
 * @title VestingVault
 * @notice One vault per chain that locks creators' launch buys under linear vesting with a cliff.
 *         A launcher (LaunchpadV2Factory / LaunchpadV2FactoryArc) sends the creator's prebuy
 *         tokens here and opens a schedule in the same transaction; the creator then claims them
 *         as they vest:
 *           - nothing before `start + cliff`;
 *           - `total * elapsed / duration` from the cliff on (the cliff releases what accrued
 *             since `start` at once);
 *           - everything from `start + duration`.
 *
 *         Trust model:
 *           - No revoke, no sweep, no admin withdrawal: locked tokens only ever leave to the
 *             schedule's beneficiary. The owner's only power is choosing which launchers may open
 *             schedules, and a schedule must be backed by tokens already held here, so even a
 *             rogue launcher can never touch tokens that are already locked.
 *           - At most one schedule per token (the creator's launch buy), so every token of a
 *             given kind held here belongs to that one beneficiary. Tokens sent here outside a
 *             launch back no schedule and stay put: nobody can take them out.
 *
 *         Dividends: locked tokens stay in the token's circulating supply and keep earning
 *         GotonFeeSplitter holder dividends, as they would in the creator's wallet. The vault is
 *         the holder of record, so it accrues them; `claimDividends` pulls the vault's accrual
 *         straight to the beneficiary (one schedule per token makes all of it theirs). Nobody
 *         else can claim it, and nothing is lost when the schedule is fully released: the
 *         accrual stays claimable.
 */
contract VestingVault is IVestingVault {
    /// @notice Bounds on every schedule: cliff <= duration, MIN_DURATION <= duration <= MAX_DURATION.
    uint64 public constant MIN_DURATION = 7 days;
    uint64 public constant MAX_DURATION = 4 * 365 days;

    address public owner;
    address public pendingOwner;
    /// @notice Launchers allowed to open schedules.
    mapping(address => bool) public isLauncher;

    /// @notice Number of schedules; ids run from 1 to scheduleCount.
    uint256 public scheduleCount;
    mapping(uint256 => Schedule) private _schedules;
    /// @inheritdoc IVestingVault
    mapping(address => uint256) public scheduleIdOf;
    mapping(address => uint256[]) private _beneficiarySchedules;

    uint256 private _locked;

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
    }

    // ---------------------------------------------------------------------------
    // Schedules
    // ---------------------------------------------------------------------------

    /**
     * @notice Locks `amount` of `token`, already transferred here, for `beneficiary`, vesting
     *         linearly from now over `duration` seconds with nothing claimable for `cliff` seconds.
     * @dev Launcher-only; the launcher sends the tokens first (no approval round-trip).
     */
    function createSchedule(address token, address beneficiary, uint256 amount, uint64 cliff, uint64 duration)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (!isLauncher[msg.sender]) revert Unauthorized();
        if (token == address(0) || beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint128).max) revert InvalidSchedule();
        if (duration < MIN_DURATION || duration > MAX_DURATION || cliff > duration) revert InvalidSchedule();
        if (scheduleIdOf[token] != 0) revert ScheduleExists();
        // One schedule per token, so the whole balance must be this deposit.
        if (IVestedToken(token).balanceOf(address(this)) < amount) revert InsufficientDeposit();

        id = ++scheduleCount;
        _schedules[id] = Schedule({
            token: token,
            start: uint64(block.timestamp),
            beneficiary: beneficiary,
            cliff: cliff,
            duration: duration,
            total: uint128(amount),
            claimed: 0
        });
        scheduleIdOf[token] = id;
        _beneficiarySchedules[beneficiary].push(id);

        emit ScheduleCreated(token, beneficiary, id, amount, uint64(block.timestamp), cliff, duration);
    }

    /// @notice Sends the beneficiary everything vested and not yet claimed.
    function claimVested(uint256 id) external nonReentrant returns (uint256 amount) {
        Schedule storage s = _beneficiarySchedule(id);
        amount = _vested(s) - s.claimed;
        if (amount > 0) {
            s.claimed += uint128(amount);
            if (!IVestedToken(s.token).transfer(msg.sender, amount)) revert TransferFailed();
            emit Claimed(id, s.token, msg.sender, amount);
        }
    }

    /// @notice Pays the holder dividends the locked tokens earned to the beneficiary.
    function claimDividends(uint256 id) external nonReentrant returns (uint256 amount) {
        Schedule storage s = _beneficiarySchedule(id);
        address tracker = IVestedToken(s.token).rewardTracker();
        if (tracker == address(0)) return 0;
        amount = IDividendTracker(tracker).claim(msg.sender);
        if (amount > 0) emit DividendsClaimed(id, msg.sender, amount);
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    /// @notice Tokens vested so far, claimed or not.
    function vestedAmount(uint256 id) external view returns (uint256) {
        return _vested(_schedule(id));
    }

    /// @notice Tokens the beneficiary can claim now.
    function releasable(uint256 id) external view returns (uint256) {
        Schedule storage s = _schedule(id);
        return _vested(s) - s.claimed;
    }

    /// @notice Holder dividends (quote currency) waiting for the beneficiary.
    function pendingDividends(uint256 id) external view returns (uint256) {
        address tracker = IVestedToken(_schedule(id).token).rewardTracker();
        return tracker == address(0) ? 0 : IDividendTracker(tracker).claimable(address(this));
    }

    function getSchedule(uint256 id) external view returns (Schedule memory) {
        return _schedule(id);
    }

    /// @notice Every schedule id held by `beneficiary` (for the Profile page).
    function schedulesOf(address beneficiary) external view returns (uint256[] memory) {
        return _beneficiarySchedules[beneficiary];
    }

    // ---------------------------------------------------------------------------
    // Admin (launcher allowlist only; never touches locked tokens)
    // ---------------------------------------------------------------------------

    function setLauncher(address launcher, bool allowed) external onlyOwner {
        if (launcher == address(0)) revert ZeroAddress();
        isLauncher[launcher] = allowed;
        emit LauncherSet(launcher, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    // ---------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------

    function _schedule(uint256 id) private view returns (Schedule storage s) {
        s = _schedules[id];
        if (s.token == address(0)) revert UnknownSchedule();
    }

    function _beneficiarySchedule(uint256 id) private view returns (Schedule storage s) {
        s = _schedule(id);
        if (msg.sender != s.beneficiary) revert Unauthorized();
    }

    function _vested(Schedule storage s) private view returns (uint256) {
        uint256 elapsed = block.timestamp - s.start;
        if (elapsed < s.cliff) return 0;
        if (elapsed >= s.duration) return s.total;
        return (uint256(s.total) * elapsed) / s.duration;
    }
}
