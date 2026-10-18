// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ArcV4LaunchForkTest} from "./ArcV4Launch.fork.t.sol";
import {GotonLimitOrders, IBondingCurveLO, IGotonV4RouterLO} from "../../src/core/GotonLimitOrders.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {PoolKey} from "../../src/interfaces/IUniswapV4.sol";

/**
 * Limit orders on Arc mainnet's real v4 PoolManager and USDC, with the constructor wiring
 * script/DeployLimitOrders.s.sol uses on Arc: no curve factory, USDC ERC-20 quote, nativeScale 1e12.
 * Run with: ARC_RPC_URL=https://rpc.mainnet.arc.io forge test --match-path test/arc/ArcLimitOrders.fork.t.sol
 */
contract ArcLimitOrdersForkTest is ArcV4LaunchForkTest {
    GotonLimitOrders lo;
    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");

    function setUp() public override {
        super.setUp();
        if (address(factory) == address(0)) return; // skipped: no ARC_RPC_URL
        lo = new GotonLimitOrders(address(0), IGotonV4RouterLO(address(router)), PM, address(hook), USDC, 1e12);
        vm.deal(alice, 1_000 ether);
    }

    function _token() internal returns (address token, PoolKey memory key) {
        (token,) = _launch(_creatorWithOrder(true), 4.5 ether);
        key = factory.poolKeyOf(token);
    }

    function test_LimitBuyThenTakeProfitOnArcPool() public {
        (address token, PoolKey memory key) = _token();

        // Buy with 10 native USDC (18 decimals); the executor fee is 0.1% in whole 6-decimal units.
        vm.prank(alice);
        uint256 buyId = lo.createBuyOrder{value: 10 ether}(token, 1, uint64(block.timestamp + 1 days));
        vm.prank(keeper);
        lo.executeBuyOnPool(buyId, key);
        uint256 bought = LaunchpadToken(token).balanceOf(alice);
        assertGt(bought, 0, "tokens delivered to the owner");
        assertEq(keeper.balance, 0.01 ether, "executor fee");
        assertEq(address(lo).balance, 0, "nothing left in escrow");

        // Take profit with a floor the pool already pays: the owner receives USDC ERC-20.
        vm.startPrank(alice);
        LaunchpadToken(token).approve(address(lo), bought);
        uint256 sellId = lo.createSellOrder(token, bought, 1, 0, 0, uint64(block.timestamp + 1 days));
        vm.stopPrank();
        uint256 usdcBefore = _usdc(alice);
        vm.prank(keeper);
        lo.executeSellOnPool(sellId, key, GotonLimitOrders.Leg.TakeProfit);
        assertGt(_usdc(alice), usdcBefore, "owner paid in USDC");
        assertGt(_usdc(keeper), 0, "executor fee in USDC");
        assertEq(LaunchpadToken(token).balanceOf(address(lo)), 0, "no tokens left in escrow");
    }

    function test_TakeProfitAboveMarketWaitsAndCancelRefunds() public {
        (address token, PoolKey memory key) = _token();
        vm.prank(alice);
        uint256 buyId = lo.createBuyOrder{value: 10 ether}(token, 1, uint64(block.timestamp + 1 days));
        vm.prank(keeper);
        lo.executeBuyOnPool(buyId, key);
        uint256 bought = LaunchpadToken(token).balanceOf(alice);

        vm.startPrank(alice);
        LaunchpadToken(token).approve(address(lo), bought);
        uint256 id = lo.createSellOrder(token, bought, 1_000_000e6, 0, 0, uint64(block.timestamp + 1 days));
        vm.stopPrank();
        vm.expectRevert(GotonLimitOrders.InsufficientOutput.selector);
        lo.executeSellOnPool(id, key, GotonLimitOrders.Leg.TakeProfit);

        vm.prank(alice);
        lo.cancel(id);
        assertEq(LaunchpadToken(token).balanceOf(alice), bought, "tokens back to the owner");
    }

    function test_RejectsCurveRoutesOnArc() public {
        (address token,) = _token();
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(token, 1, uint64(block.timestamp + 1 days));
        vm.expectRevert(GotonLimitOrders.InvalidRoute.selector);
        lo.executeBuyOnCurve(id, IBondingCurveLO(address(0xbeef)));
    }
}
