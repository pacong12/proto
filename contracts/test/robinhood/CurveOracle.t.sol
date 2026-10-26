// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestGraduator} from "../utils/TestGraduator.sol";
import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {BondingCurve} from "../../src/core/BondingCurve.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {GotonLimitOrders, IBondingCurveLO, IGotonV4RouterLO} from "../../src/core/GotonLimitOrders.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";

/// @notice The bonding curve's TWAP oracle, the curve stop-loss built on it, and launch-window limits.
contract CurveOracleTest is Test {
    LaunchpadV2Factory factory;
    GotonLimitOrders lo;
    address payable fee = payable(address(0xFA1));
    address creator = address(0xCAFE);
    address alice = address(0xA11CE);
    address attacker = address(0xBAD);
    address keeper = address(0x6EE);

    function setUp() public {
        factory = new LaunchpadV2Factory(fee, TestGraduator.deploy(fee));
        // No v4 pools here; router and hook only have to be non-zero.
        lo = new GotonLimitOrders(
            address(factory), IGotonV4RouterLO(address(0xdead)), IPoolManagerV4(address(0xdead)), address(0xdead), address(0), 1
        );
        vm.deal(creator, 10 ether);
        vm.deal(alice, 10 ether);
        vm.deal(attacker, 10 ether);
        vm.deal(keeper, 1 ether);
    }

    function _launch() internal returns (LaunchpadToken token, BondingCurve curve) {
        vm.prank(creator);
        (address t, address c) = factory.launchTokenV2{value: 0.0005 ether}("T", "T", "", "", "", "", "", 0);
        return (LaunchpadToken(t), BondingCurve(payable(c)));
    }

    /// @dev Moves past the launch limits and gives the oracle one full period of history.
    function _warmUp(BondingCurve curve) internal {
        vm.roll(block.number + 5);
        vm.warp(block.timestamp + 10);
        vm.prank(alice);
        curve.buy{value: 0.5 ether}(0);
        vm.warp(block.timestamp + curve.ORACLE_PERIOD());
        vm.roll(block.number + 1);
        vm.prank(alice);
        curve.buy{value: 0.01 ether}(0);
    }

    /// @dev Holds the current price for two oracle periods, so the TWAP window sits at it.
    function _hold(BondingCurve curve) internal {
        for (uint256 i; i < 2; i++) {
            vm.warp(block.timestamp + curve.ORACLE_PERIOD() + 1);
            vm.roll(block.number + 1);
            vm.prank(keeper);
            curve.buy{value: 0.0001 ether}(0); // any trade rolls the oracle checkpoints
        }
    }

    function _sell(address who, LaunchpadToken token, BondingCurve curve, uint256 amount) internal {
        vm.startPrank(who);
        token.approve(address(curve), amount);
        curve.sell(amount, 0);
        vm.stopPrank();
    }

    function test_OracleNeedsOnePeriodOfHistory() public {
        (, BondingCurve curve) = _launch();
        vm.expectRevert(BondingCurve.OracleNotReady.selector);
        curve.consultPriceX36();
        _warmUp(curve);
        (uint256 twap, uint32 window) = curve.consultPriceX36();
        assertGe(window, curve.ORACLE_PERIOD());
        assertGt(twap, 0);
    }

    function test_SameBlockPushDoesNotMoveTheTwap() public {
        (LaunchpadToken token, BondingCurve curve) = _launch();
        _warmUp(curve);
        vm.prank(attacker);
        curve.buy{value: 1 ether}(0);
        _hold(curve);
        (uint256 twapBefore,) = curve.consultPriceX36();
        uint256 spotBefore = curve.spotPriceX36();

        _sell(attacker, token, curve, token.balanceOf(attacker));
        (uint256 twapAfter,) = curve.consultPriceX36();
        assertLt(curve.spotPriceX36(), (spotBefore * 70) / 100, "spot was dumped");
        assertEq(twapAfter, twapBefore, "the dump has no weight in this block");
    }

    function test_SandwichCannotTriggerACurveStopLoss() public {
        (LaunchpadToken token, BondingCurve curve) = _launch();
        _warmUp(curve);
        vm.prank(attacker);
        curve.buy{value: 2 ether}(0);
        _hold(curve);

        // Alice stops out 10% below the current price.
        uint256 aliceTokens = token.balanceOf(alice);
        uint256 trigger = (curve.spotPriceX36() * 90) / 100;
        vm.startPrank(alice);
        token.approve(address(lo), aliceTokens);
        uint256 id = lo.createSellOrder(address(token), aliceTokens, 0, trigger, 1, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        // Dump below the trigger and try to fill in the same block.
        _sell(attacker, token, curve, token.balanceOf(attacker));
        assertLt(curve.spotPriceX36(), trigger, "spot is below the trigger");
        vm.prank(attacker);
        vm.expectRevert(GotonLimitOrders.NotTriggered.selector);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);

        // A drop that holds for a full period does fire the stop.
        _hold(curve);
        uint256 before = alice.balance;
        vm.prank(keeper);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);
        assertGt(alice.balance, before, "stop filled");
    }

    function test_TaxRecipientCannotBuyAtTheLaunchBlock() public {
        (LaunchpadToken token, BondingCurve curve) = _launch();
        address taxWallet = address(0x7A7);
        vm.deal(taxWallet, 1 ether);
        vm.prank(creator);
        token.setInitialTaxConfig(100, 100, taxWallet);

        vm.prank(taxWallet);
        vm.expectRevert(LaunchpadToken.OnlyDeployerCanBuyAtLaunchBlock.selector);
        curve.buy{value: 1 ether}(0);
    }

    function test_TaxRecipientAndDeployerKeepTheLaunchBuyCap() public {
        (LaunchpadToken token, BondingCurve curve) = _launch();
        address taxWallet = address(0x7A7);
        vm.deal(taxWallet, 1 ether);
        vm.prank(creator);
        token.setInitialTaxConfig(100, 100, taxWallet);
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 10); // past the curve's anti-snipe tax, still in the token's window

        vm.prank(taxWallet);
        vm.expectRevert(LaunchpadToken.MaxBuyExceeded.selector);
        curve.buy{value: 1 ether}(0);
        vm.prank(creator);
        vm.expectRevert(LaunchpadToken.MaxBuyExceeded.selector);
        curve.buy{value: 1 ether}(0);
    }
}
