// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VestingVault} from "../../src/core/VestingVault.sol";
import {IVestingVault} from "../../src/interfaces/IVestingVault.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {GotonFeeSplitter} from "../../src/core/GotonFeeSplitter.sol";
import {ILaunchpadToken} from "../../src/interfaces/ILaunchpadToken.sol";

contract VestingVaultTest is Test {
    uint256 constant GRANT = 100_000 ether;
    uint64 constant CLIFF = 30 days;
    uint64 constant DURATION = 100 days;
    address constant POOL_MANAGER = address(0x4444);

    VestingVault vault;
    LaunchpadToken token;
    address launcher = makeAddr("launcher");
    address creator = makeAddr("creator");
    address stranger = makeAddr("stranger");
    uint256 start;

    function setUp() public {
        vault = new VestingVault(address(this));
        vault.setLauncher(launcher, true);
        token = _newToken();
        start = block.timestamp;
    }

    function _newToken() internal returns (LaunchpadToken t) {
        t = new LaunchpadToken();
        ILaunchpadToken.Socials memory s = ILaunchpadToken.Socials("", "", "", "", "");
        t.initialize("Vest", "VEST", "", "", s, creator, address(0), address(this));
    }

    function _fund(LaunchpadToken t, uint256 amount) internal {
        t.transfer(address(vault), amount);
    }

    function _schedule() internal returns (uint256 id) {
        _fund(token, GRANT);
        vm.prank(launcher);
        id = vault.createSchedule(address(token), creator, GRANT, CLIFF, DURATION);
    }

    // ---------------------------------------------------------------------------
    // Opening schedules
    // ---------------------------------------------------------------------------

    function test_CreateScheduleRecordsItAndEmits() public {
        _fund(token, GRANT);
        vm.expectEmit(true, true, true, true, address(vault));
        emit IVestingVault.ScheduleCreated(address(token), creator, 1, GRANT, uint64(start), CLIFF, DURATION);
        vm.prank(launcher);
        uint256 id = vault.createSchedule(address(token), creator, GRANT, CLIFF, DURATION);

        assertEq(id, 1);
        assertEq(vault.scheduleCount(), 1);
        assertEq(vault.scheduleIdOf(address(token)), 1);
        IVestingVault.Schedule memory s = vault.getSchedule(id);
        assertEq(s.token, address(token));
        assertEq(s.beneficiary, creator);
        assertEq(s.start, start);
        assertEq(s.cliff, CLIFF);
        assertEq(s.duration, DURATION);
        assertEq(s.total, GRANT);
        assertEq(s.claimed, 0);
        uint256[] memory ids = vault.schedulesOf(creator);
        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
    }

    function test_OnlyLaunchersOpenSchedules() public {
        _fund(token, GRANT);
        vm.prank(stranger);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.createSchedule(address(token), stranger, GRANT, 0, DURATION);

        vault.setLauncher(launcher, false);
        vm.prank(launcher);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.createSchedule(address(token), creator, GRANT, 0, DURATION);
    }

    function test_CapViolationsRevert() public {
        _fund(token, GRANT);
        uint64 maxDuration = vault.MAX_DURATION();
        uint64 minDuration = vault.MIN_DURATION();
        assertEq(maxDuration, 4 * 365 days);
        assertEq(minDuration, 7 days);

        vm.startPrank(launcher);
        vm.expectRevert(IVestingVault.InvalidSchedule.selector);
        vault.createSchedule(address(token), creator, GRANT, 0, 0);
        vm.expectRevert(IVestingVault.InvalidSchedule.selector);
        vault.createSchedule(address(token), creator, GRANT, 0, minDuration - 1);
        vm.expectRevert(IVestingVault.InvalidSchedule.selector);
        vault.createSchedule(address(token), creator, GRANT, 0, maxDuration + 1);
        vm.expectRevert(IVestingVault.InvalidSchedule.selector);
        vault.createSchedule(address(token), creator, GRANT, DURATION + 1, DURATION);

        // The bounds themselves are allowed, one token at a time.
        vault.createSchedule(address(token), creator, GRANT, minDuration, minDuration);
        vm.stopPrank();

        LaunchpadToken other = _newToken();
        _fund(other, GRANT);
        vm.prank(launcher);
        vault.createSchedule(address(other), creator, GRANT, maxDuration, maxDuration);
    }

    function test_BadInputsRevert() public {
        _fund(token, GRANT);
        vm.startPrank(launcher);
        vm.expectRevert(IVestingVault.ZeroAddress.selector);
        vault.createSchedule(address(0), creator, GRANT, 0, DURATION);
        vm.expectRevert(IVestingVault.ZeroAddress.selector);
        vault.createSchedule(address(token), address(0), GRANT, 0, DURATION);
        vm.expectRevert(IVestingVault.ZeroAmount.selector);
        vault.createSchedule(address(token), creator, 0, 0, DURATION);
        vm.expectRevert(IVestingVault.InvalidSchedule.selector);
        vault.createSchedule(address(token), creator, uint256(type(uint128).max) + 1, 0, DURATION);
        vm.stopPrank();
    }

    function test_ScheduleMustBeBackedByTokensHeld() public {
        _fund(token, GRANT - 1);
        vm.prank(launcher);
        vm.expectRevert(IVestingVault.InsufficientDeposit.selector);
        vault.createSchedule(address(token), creator, GRANT, 0, DURATION);
    }

    /// @dev A second schedule could otherwise claim the first one's tokens.
    function test_OneSchedulePerToken() public {
        _schedule();
        vm.prank(launcher);
        vm.expectRevert(IVestingVault.ScheduleExists.selector);
        vault.createSchedule(address(token), stranger, 1, 0, DURATION);
    }

    function test_UnknownScheduleReverts() public {
        vm.expectRevert(IVestingVault.UnknownSchedule.selector);
        vault.vestedAmount(1);
        vm.expectRevert(IVestingVault.UnknownSchedule.selector);
        vault.releasable(1);
        vm.expectRevert(IVestingVault.UnknownSchedule.selector);
        vault.getSchedule(1);
        vm.expectRevert(IVestingVault.UnknownSchedule.selector);
        vault.claimVested(1);
        vm.expectRevert(IVestingVault.UnknownSchedule.selector);
        vault.claimDividends(1);
    }

    // ---------------------------------------------------------------------------
    // Vesting curve
    // ---------------------------------------------------------------------------

    function test_NothingBeforeCliff() public {
        uint256 id = _schedule();
        assertEq(vault.releasable(id), 0);
        vm.warp(start + CLIFF - 1);
        assertEq(vault.vestedAmount(id), 0);
        assertEq(vault.releasable(id), 0);

        vm.prank(creator);
        assertEq(vault.claimVested(id), 0);
        assertEq(token.balanceOf(creator), 0);
        assertEq(token.balanceOf(address(vault)), GRANT);
    }

    function test_CliffReleasesWhatAccruedThenLinearThenFull() public {
        uint256 id = _schedule();

        vm.warp(start + CLIFF);
        assertEq(vault.releasable(id), (GRANT * CLIFF) / DURATION, "accrued since start vests at the cliff");

        vm.warp(start + 50 days);
        assertEq(vault.vestedAmount(id), GRANT / 2);
        vm.expectEmit(true, true, true, true, address(vault));
        emit IVestingVault.Claimed(id, address(token), creator, GRANT / 2);
        vm.prank(creator);
        assertEq(vault.claimVested(id), GRANT / 2);
        assertEq(token.balanceOf(creator), GRANT / 2);
        assertEq(vault.releasable(id), 0);
        assertEq(vault.vestedAmount(id), GRANT / 2, "vested counts claimed tokens too");

        vm.warp(start + DURATION);
        assertEq(vault.releasable(id), GRANT / 2);
        vm.prank(creator);
        assertEq(vault.claimVested(id), GRANT / 2);
        assertEq(token.balanceOf(creator), GRANT);
        assertEq(token.balanceOf(address(vault)), 0);

        vm.warp(start + 10 * DURATION);
        assertEq(vault.releasable(id), 0);
        vm.prank(creator);
        assertEq(vault.claimVested(id), 0);
    }

    /// @dev Many partial claims add up to the grant exactly, whatever the rounding.
    function testFuzz_ClaimsNeverExceedGrant(uint96 amount, uint64 cliff, uint64 duration, uint32[8] memory steps)
        public
    {
        amount = uint96(bound(amount, 1, 1_000_000_000 ether));
        duration = uint64(bound(duration, vault.MIN_DURATION(), vault.MAX_DURATION()));
        cliff = uint64(bound(cliff, 0, duration));
        _fund(token, amount);
        vm.prank(launcher);
        uint256 id = vault.createSchedule(address(token), creator, amount, cliff, duration);

        uint256 lastVested;
        uint256 total;
        uint256 at = start;
        vm.startPrank(creator);
        for (uint256 i; i < steps.length; i++) {
            at += steps[i];
            vm.warp(at);
            uint256 vested = vault.vestedAmount(id);
            assertGe(vested, lastVested, "monotonic");
            if (at - start < cliff) assertEq(vested, 0, "cliff");
            lastVested = vested;
            total += vault.claimVested(id);
            assertEq(total, vested);
        }
        vm.warp(start + duration);
        total += vault.claimVested(id);
        vm.stopPrank();
        assertEq(total, amount);
        assertEq(token.balanceOf(creator), amount);
    }

    // ---------------------------------------------------------------------------
    // Nobody but the beneficiary benefits
    // ---------------------------------------------------------------------------

    function test_OnlyBeneficiaryClaims() public {
        uint256 id = _schedule();
        vm.warp(start + DURATION);

        address[3] memory others = [stranger, launcher, address(this)];
        for (uint256 i; i < others.length; i++) {
            vm.prank(others[i]);
            vm.expectRevert(IVestingVault.Unauthorized.selector);
            vault.claimVested(id);
            vm.prank(others[i]);
            vm.expectRevert(IVestingVault.Unauthorized.selector);
            vault.claimDividends(id);
        }
        assertEq(token.balanceOf(address(vault)), GRANT);
    }

    /// @dev The launcher allowlist is the owner's only power: dropping a launcher strands nothing.
    function test_RemovingLauncherDoesNotAffectClaims() public {
        uint256 id = _schedule();
        vault.setLauncher(launcher, false);
        vm.warp(start + DURATION);
        vm.prank(creator);
        assertEq(vault.claimVested(id), GRANT);
    }

    /// @dev Tokens sent here outside a launch stay put, and never inflate a schedule.
    function test_DonationsDoNotChangeWhatVests() public {
        uint256 id = _schedule();
        _fund(token, 123 ether);
        vm.warp(start + DURATION);
        vm.prank(creator);
        assertEq(vault.claimVested(id), GRANT);
        assertEq(token.balanceOf(address(vault)), 123 ether);
    }

    // ---------------------------------------------------------------------------
    // Dividends
    // ---------------------------------------------------------------------------

    /// @dev Real splitter on a native quote: the vault holds 100M of 400M circulating.
    function _withDividends() internal returns (uint256 id, GotonFeeSplitter splitter) {
        splitter = new GotonFeeSplitter(
            GotonFeeSplitter.Config({
                token: address(token),
                quoteAsset: address(0),
                hook: address(this),
                factory: address(this),
                poolManager: POOL_MANAGER,
                excluded: address(0),
                treasury: makeAddr("treasury"),
                buybackVault: makeAddr("buyback"),
                liquidityVault: makeAddr("liquidity"),
                creator: creator
            }),
            GotonFeeSplitter.Split({protocolBps: 0, holdersBps: 10_000, burnBps: 0, creatorBps: 0, liquidityBps: 0})
        );
        token.setRewardTracker(address(splitter));
        token.transfer(POOL_MANAGER, 600_000_000 ether);
        token.transfer(stranger, 300_000_000 ether);
        _fund(token, 100_000_000 ether);
        vm.prank(launcher);
        id = vault.createSchedule(address(token), creator, 100_000_000 ether, CLIFF, DURATION);
    }

    function _depositDividends(GotonFeeSplitter splitter, uint256 amount) internal {
        vm.deal(address(splitter), address(splitter).balance + amount);
        splitter.distributeFees(amount);
        vm.warp(block.timestamp + splitter.STREAM_DURATION());
    }

    function test_DividendsAccrueToBeneficiaryOnly() public {
        (uint256 id, GotonFeeSplitter splitter) = _withDividends();
        _depositDividends(splitter, 1 ether);

        uint256 pending = vault.pendingDividends(id);
        assertApproxEqAbs(pending, 0.25 ether, 1e6, "pro-rata share of circulating supply");

        // The vault is the holder of record, and only claimDividends can move its accrual.
        assertEq(splitter.claimable(creator), 0);
        vm.prank(stranger);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.claimDividends(id);

        vm.expectEmit(true, true, true, true, address(vault));
        emit IVestingVault.DividendsClaimed(id, creator, pending);
        vm.prank(creator);
        assertEq(vault.claimDividends(id), pending);
        assertEq(creator.balance, pending);
        assertEq(vault.pendingDividends(id), 0);
        assertEq(address(vault).balance, 0, "vault keeps no quote");

        // The other holder's share is untouched.
        vm.prank(stranger);
        assertApproxEqAbs(splitter.claim(stranger), 0.75 ether, 1e6);
    }

    /// @dev Accrual survives claiming the tokens, so it is not lost when the vault empties out.
    function test_DividendsSurviveFullRelease() public {
        (uint256 id, GotonFeeSplitter splitter) = _withDividends();
        _depositDividends(splitter, 1 ether);
        vm.warp(start + DURATION);

        vm.startPrank(creator);
        assertEq(vault.claimVested(id), 100_000_000 ether);
        uint256 pending = vault.pendingDividends(id);
        assertApproxEqAbs(pending, 0.25 ether, 1e6);
        assertEq(vault.claimDividends(id), pending);
        vm.stopPrank();
        assertEq(creator.balance, pending);

        // From here on the creator earns as a plain holder, and the empty vault earns nothing.
        _depositDividends(splitter, 1 ether);
        assertEq(vault.pendingDividends(id), 0);
        assertApproxEqAbs(splitter.claimable(creator), 0.25 ether, 1e6);
    }

    /// @dev Robinhood tokens have no tracker until they graduate.
    function test_NoDividendsBeforeTrackerExists() public {
        uint256 id = _schedule();
        assertEq(vault.pendingDividends(id), 0);
        vm.prank(creator);
        assertEq(vault.claimDividends(id), 0);
    }

    // ---------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------

    function test_ConstructorRejectsZeroOwner() public {
        vm.expectRevert(IVestingVault.ZeroAddress.selector);
        new VestingVault(address(0));
    }

    function test_OwnerGatesLauncherList() public {
        vm.prank(stranger);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.setLauncher(stranger, true);
        vm.expectRevert(IVestingVault.ZeroAddress.selector);
        vault.setLauncher(address(0), true);
    }

    function test_OwnershipIsTwoStep() public {
        vm.prank(stranger);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.transferOwnership(stranger);
        vm.expectRevert(IVestingVault.ZeroAddress.selector);
        vault.transferOwnership(address(0));

        vault.transferOwnership(creator);
        assertEq(vault.owner(), address(this));
        vm.prank(stranger);
        vm.expectRevert(IVestingVault.NoPendingOwner.selector);
        vault.acceptOwnership();

        vm.prank(creator);
        vault.acceptOwnership();
        assertEq(vault.owner(), creator);
        assertEq(vault.pendingOwner(), address(0));
    }
}
