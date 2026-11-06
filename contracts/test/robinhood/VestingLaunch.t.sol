// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {TestGraduator} from "../utils/TestGraduator.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {BondingCurve} from "../../src/core/BondingCurve.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {VestingVault} from "../../src/core/VestingVault.sol";
import {EmergencyPause} from "../../src/core/EmergencyPause.sol";
import {GotonV4Graduator} from "../../src/core/GotonV4Graduator.sol";
import {IVestingVault} from "../../src/interfaces/IVestingVault.sol";

/// A Robinhood creator opting in to vest the initial buy at launch.
contract RobinhoodVestingLaunchTest is Test {
    uint256 constant FEE = 0.0005 ether;
    uint256 constant BUY = 0.1 ether;
    uint64 constant CLIFF = 30 days;
    uint64 constant DURATION = 100 days;

    LaunchpadV2Factory factory;
    GotonV4Graduator graduator;
    VestingVault vault;
    address payable treasury = payable(makeAddr("treasury"));
    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");

    function setUp() public {
        graduator = TestGraduator.deploy(treasury);
        vault = new VestingVault(address(this));
        factory = new LaunchpadV2Factory(treasury, graduator, vault);
        vault.setLauncher(address(factory), true);
        graduator.setLauncher(address(factory));
        vm.deal(creator, 200 ether);
        vm.deal(buyer, 10 ether);
    }

    function _noTax() internal pure returns (LaunchpadV2Factory.LaunchTax memory) {
        return LaunchpadV2Factory.LaunchTax(0, 0, address(0));
    }

    function _noSplit() internal pure returns (LaunchpadV2Factory.LaunchSplit memory) {
        return LaunchpadV2Factory.LaunchSplit(0, 0, 0, 0);
    }

    function _launch(uint256 value, uint64 cliff, uint64 duration) internal returns (address token, address curve) {
        vm.prank(creator);
        (token, curve) = factory.launchTokenV2WithVesting{value: value}(
            "Vest", "VEST", "", "", "", "", "", 0, _noTax(), _noSplit(), cliff, duration
        );
    }

    function _expectLaunchRevert(uint256 value, uint64 cliff, uint64 duration, bytes4 error) internal {
        vm.prank(creator);
        vm.expectRevert(error);
        factory.launchTokenV2WithVesting{value: value}(
            "Vest", "VEST", "", "", "", "", "", 0, _noTax(), _noSplit(), cliff, duration
        );
    }

    // ---------------------------------------------------------------------------
    // Launch with vesting
    // ---------------------------------------------------------------------------

    function test_LaunchWithVestingLocksInitialBuy() public {
        (address tokenAddress, address curveAddress) = _launch(FEE + BUY, CLIFF, DURATION);
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        uint256 locked = token.balanceOf(address(vault));

        assertGt(locked, 0);
        assertEq(token.balanceOf(creator), 0, "creator holds nothing yet");
        assertEq(token.balanceOf(address(factory)), 0, "factory keeps nothing");
        assertEq(locked + token.balanceOf(curveAddress), token.totalSupply());

        uint256 id = vault.scheduleIdOf(tokenAddress);
        IVestingVault.Schedule memory s = vault.getSchedule(id);
        assertEq(s.token, tokenAddress);
        assertEq(s.beneficiary, creator);
        assertEq(s.start, block.timestamp);
        assertEq(s.cliff, CLIFF);
        assertEq(s.duration, DURATION);
        assertEq(s.total, locked);
        assertEq(vault.schedulesOf(creator)[0], id);
    }

    function test_VestedBuyMatchesAPlainBuy() public {
        (address vested,) = _launch(FEE + BUY, CLIFF, DURATION);
        vm.prank(creator);
        (address plain,) = factory.launchTokenV2{value: FEE + BUY}("Plain", "PLN", "", "", "", "", "", 0);
        assertEq(LaunchpadToken(vested).balanceOf(address(vault)), LaunchpadToken(plain).balanceOf(creator));
    }

    function test_ScheduleCreatedEmittedForTheIndexer() public {
        vm.recordLogs();
        (address token,) = _launch(FEE + BUY, CLIFF, DURATION);
        uint256 locked = LaunchpadToken(token).balanceOf(address(vault));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter != address(vault) || logs[i].topics[0] != IVestingVault.ScheduleCreated.selector) {
                continue;
            }
            found = true;
            assertEq(logs[i].topics[1], bytes32(uint256(uint160(token))));
            assertEq(logs[i].topics[2], bytes32(uint256(uint160(creator))));
            assertEq(logs[i].topics[3], bytes32(vault.scheduleIdOf(token)));
            assertEq(logs[i].data, abi.encode(locked, uint64(block.timestamp), CLIFF, DURATION));
        }
        assertTrue(found);
    }

    function test_VestingLifecycleAfterLaunch() public {
        // Not block.timestamp: via-IR may re-read it after a warp instead of keeping this value.
        uint256 start = vm.getBlockTimestamp();
        (address tokenAddress,) = _launch(FEE + BUY, CLIFF, DURATION);
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        uint256 id = vault.scheduleIdOf(tokenAddress);
        uint256 locked = token.balanceOf(address(vault));

        // Trading goes on while the buy is locked.
        vm.roll(block.number + 3);
        vm.warp(start + CLIFF - 1);
        (, address curveAddress,,,) = factory.launches(tokenAddress);
        BondingCurve curve = BondingCurve(payable(curveAddress));
        vm.prank(buyer);
        curve.buy{value: 0.01 ether}(0);
        assertEq(token.balanceOf(address(vault)), locked, "buys do not touch the lock");

        assertEq(vault.releasable(id), 0, "nothing before the cliff");
        vm.prank(creator);
        assertEq(vault.claimVested(id), 0);

        vm.warp(start + 50 days);
        assertEq(vault.releasable(id), locked / 2, "linear after the cliff");
        vm.prank(buyer);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.claimVested(id);
        vm.prank(creator);
        vault.claimVested(id);
        assertEq(token.balanceOf(creator), locked / 2);

        vm.warp(start + DURATION);
        vm.prank(creator);
        vault.claimVested(id);
        assertEq(token.balanceOf(creator), locked, "all of it at the end");
        assertEq(token.balanceOf(address(vault)), 0);

        // Claimed tokens are ordinary tokens: the creator can sell them on the curve.
        vm.startPrank(creator);
        token.approve(curveAddress, 1 ether);
        assertGt(curve.sell(1 ether, 0), 0);
        vm.stopPrank();
    }

    /// @dev Tax and split still set atomically, and the vault's buy does not count as a third-party buy.
    function test_VestingWithConfigKeepsLaunchWindowOpen() public {
        vm.prank(creator);
        (address tokenAddress, address curveAddress) = factory.launchTokenV2WithVesting{value: FEE + BUY}(
            "Vest",
            "VEST",
            "",
            "",
            "",
            "",
            "",
            0,
            LaunchpadV2Factory.LaunchTax(300, 500, address(0)),
            LaunchpadV2Factory.LaunchSplit(5_000, 0, 5_000, 0),
            CLIFF,
            DURATION
        );
        LaunchpadToken token = LaunchpadToken(tokenAddress);

        assertFalse(token.publicTradingStarted());
        assertEq(token.liquidityPool(), curveAddress);
        (uint16 buyTax, uint16 sellTax, address recipient) = token.taxConfig();
        assertEq(buyTax, 300);
        assertEq(sellTax, 500);
        assertEq(recipient, creator);
        assertGt(token.balanceOf(address(vault)), 0);
        assertEq(token.balanceOf(creator), 0, "no untaxed side path to the creator");

        // The claim is a plain transfer out of the vault, not a taxed buy or sell.
        vm.warp(block.timestamp + DURATION);
        uint256 locked = token.balanceOf(address(vault));
        uint256 id = vault.scheduleIdOf(tokenAddress);
        vm.prank(creator);
        vault.claimVested(id);
        assertEq(token.balanceOf(creator), locked);
    }

    /// @dev A buy that fills the curve is locked in full, and the excess ETH still returns to the creator.
    function test_CurveCapRefundReachesCreatorAndLockIsExact() public {
        uint256 before = creator.balance;
        (address tokenAddress, address curveAddress) = _launch(FEE + 100 ether, CLIFF, DURATION);
        LaunchpadToken token = LaunchpadToken(tokenAddress);

        assertTrue(BondingCurve(payable(curveAddress)).graduated());
        assertGt(creator.balance, before - FEE - 100 ether, "refund came back");
        assertEq(address(factory).balance, 0, "factory keeps no ETH");
        IVestingVault.Schedule memory s = vault.getSchedule(vault.scheduleIdOf(tokenAddress));
        assertEq(s.total, token.balanceOf(address(vault)));
        assertEq(token.balanceOf(creator), 0);
    }

    // ---------------------------------------------------------------------------
    // Launch without vesting is unchanged
    // ---------------------------------------------------------------------------

    function test_PlainLaunchesPayCreatorAndNeverTouchVault() public {
        vm.startPrank(creator);
        (address plain,) = factory.launchTokenV2{value: FEE + BUY}("Plain", "PLN", "", "", "", "", "", 0);
        (address configured,) = factory.launchTokenV2WithConfig{value: FEE + BUY}(
            "Conf", "CNF", "", "", "", "", "", 0, _noTax(), _noSplit()
        );
        vm.stopPrank();

        assertGt(LaunchpadToken(plain).balanceOf(creator), 0);
        assertGt(LaunchpadToken(configured).balanceOf(creator), 0);
        assertEq(LaunchpadToken(plain).balanceOf(address(vault)), 0);
        assertEq(LaunchpadToken(configured).balanceOf(address(vault)), 0);
        assertEq(vault.scheduleCount(), 0);
    }

    /// @dev A factory the vault has not approved keeps launching, just not with vesting.
    function test_PlainLaunchWorksWithoutLauncherRole() public {
        vault.setLauncher(address(factory), false);
        vm.prank(creator);
        (address token,) = factory.launchTokenV2{value: FEE + BUY}("Plain", "PLN", "", "", "", "", "", 0);
        assertGt(LaunchpadToken(token).balanceOf(creator), 0);

        _expectLaunchRevert(FEE + BUY, CLIFF, DURATION, IVestingVault.Unauthorized.selector);
    }

    // ---------------------------------------------------------------------------
    // Reverts
    // ---------------------------------------------------------------------------

    function test_CapViolationsRevert() public {
        _expectLaunchRevert(FEE + BUY, 0, 0, IVestingVault.InvalidSchedule.selector);
        _expectLaunchRevert(FEE + BUY, 0, 7 days - 1, IVestingVault.InvalidSchedule.selector);
        _expectLaunchRevert(FEE + BUY, 0, 4 * 365 days + 1, IVestingVault.InvalidSchedule.selector);
        _expectLaunchRevert(FEE + BUY, DURATION + 1, DURATION, IVestingVault.InvalidSchedule.selector);
        assertEq(factory.getLaunchCount(), 0, "nothing launched");
    }

    function test_VestingRequiresAnInitialBuy() public {
        _expectLaunchRevert(FEE, CLIFF, DURATION, IVestingVault.ZeroAmount.selector);
    }

    function test_SlippageStillApplies() public {
        vm.prank(creator);
        vm.expectRevert(BondingCurve.InsufficientOutput.selector);
        factory.launchTokenV2WithVesting{value: FEE + BUY}(
            "Vest", "VEST", "", "", "", "", "", type(uint256).max, _noTax(), _noSplit(), CLIFF, DURATION
        );
    }

    function test_PausedFactoryBlocksVestingLaunch() public {
        factory.pause();
        _expectLaunchRevert(FEE + BUY, CLIFF, DURATION, EmergencyPause.EmergencyPaused.selector);
    }

    function test_ConstructorRejectsZeroVault() public {
        vm.expectRevert(LaunchpadV2Factory.ZeroAddress.selector);
        new LaunchpadV2Factory(treasury, graduator, IVestingVault(address(0)));
    }
}
