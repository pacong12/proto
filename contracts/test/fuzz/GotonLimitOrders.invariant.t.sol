// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PoolKey} from "../../src/interfaces/external/IUniswapV4.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {GotonLimitOrders, IBondingCurveLO, IGotonV4RouterLO} from "../../src/core/GotonLimitOrders.sol";
import {LOToken, LOFactory, LOCurve, LORouter, LOHook} from "../core/GotonLimitOrders.t.sol";

/// @dev Random creates, cancels, fills, price moves and time jumps from several owners.
contract LimitOrdersHandler is Test {
    GotonLimitOrders public lo;
    LOToken public token;
    LOCurve public curve;
    LORouter public router;
    LOHook public hook;
    PoolKey public key;
    address[] public owners;
    uint256[] public ids;

    constructor(GotonLimitOrders _lo, LOToken _token, LOCurve _curve, LORouter _router, LOHook _hook) {
        lo = _lo;
        token = _token;
        curve = _curve;
        router = _router;
        hook = _hook;
        key = PoolKey(address(0), address(token), 10_000, 200, address(hook));
        for (uint256 i; i < 3; i++) {
            address o = makeAddr(string(abi.encodePacked("owner", i)));
            owners.push(o);
            vm.deal(o, 1_000 ether);
        }
    }

    receive() external payable {}

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    function buy(uint256 who, uint256 amount, uint256 minOut) external {
        address o = owners[who % owners.length];
        amount = bound(amount, 1e9, 5 ether);
        minOut = bound(minOut, 1, amount * 3_000_000);
        vm.prank(o);
        ids.push(lo.createBuyOrder{value: amount}(address(token), minOut, uint64(block.timestamp + 1 days)));
    }

    function sell(uint256 who, uint256 amount, uint256 tp, uint256 sl) external {
        address o = owners[who % owners.length];
        amount = bound(amount, 1e12, 1e30);
        token.mint(o, amount);
        tp = bound(tp, 0, 10 ether);
        sl = bound(sl, 0, 1e36);
        if (tp == 0 && sl == 0) tp = 1;
        vm.startPrank(o);
        token.approve(address(lo), amount);
        ids.push(lo.createSellOrder(address(token), amount, tp, sl, sl == 0 ? 0 : 1, uint64(block.timestamp + 1 days)));
        vm.stopPrank();
    }

    function cancel(uint256 i) external {
        if (ids.length == 0) return;
        uint256 id = ids[i % ids.length];
        (address o,,,,,,,) = lo.orders(id);
        if (o == address(0)) return;
        vm.prank(o);
        lo.cancel(id);
    }

    function fill(uint256 i, uint8 how) external {
        if (ids.length == 0) return;
        uint256 id = ids[i % ids.length];
        (address o,, bool isBuy,,,,,) = lo.orders(id);
        if (o == address(0)) return;
        if (isBuy) {
            try lo.executeBuyOnCurve(id, IBondingCurveLO(address(curve))) {} catch {}
            try lo.executeBuyOnPool(id, key) {} catch {}
        } else {
            GotonLimitOrders.Leg leg = how % 2 == 0 ? GotonLimitOrders.Leg.TakeProfit : GotonLimitOrders.Leg.StopLoss;
            try lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), leg) {} catch {}
            try lo.executeSellOnPool(id, key, leg) {} catch {}
        }
    }

    function move(uint256 rate, uint256 maxIn, int24 tick) external {
        curve.setRate(bound(rate, 1, 10_000_000));
        router.setMaxIn(bound(maxIn, 1, type(uint128).max));
        hook.setTick(int24(bound(tick, -200_000, 200_000)));
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 0, 2 days));
    }
}

contract GotonLimitOrdersInvariantTest is Test {
    GotonLimitOrders lo;
    LOToken token;
    LimitOrdersHandler handler;

    function setUp() public {
        token = new LOToken();
        LOFactory factory = new LOFactory();
        LOCurve curve = new LOCurve(token, 1_000_000);
        factory.register(address(curve), address(token));
        LORouter router = new LORouter(token, 1_000_000);
        LOHook hook = new LOHook();
        vm.deal(address(curve), 1e30);
        vm.deal(address(router), 1e30);
        lo = new GotonLimitOrders(
            address(factory),
            IGotonV4RouterLO(address(router)),
            IPoolManagerV4(address(hook)),
            address(hook),
            address(0),
            1
        );
        handler = new LimitOrdersHandler(lo, token, curve, router, hook);
        targetContract(address(handler));
    }

    /// Every open order can always be returned in full: escrow covers all open deposits.
    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 60
    function invariant_EscrowCoversEveryOpenOrder() public view {
        uint256 nativeOwed;
        uint256 tokensOwed;
        for (uint256 i; i < handler.idCount(); i++) {
            (address o,, bool isBuy,, uint256 amount,,,) = lo.orders(handler.ids(i));
            if (o == address(0)) continue;
            if (isBuy) nativeOwed += amount;
            else tokensOwed += amount;
        }
        assertGe(address(lo).balance, nativeOwed, "native escrow");
        assertGe(token.balanceOf(address(lo)), tokensOwed, "token escrow");
    }

    /// The escrow never keeps value of closed orders (no stuck refunds or leftovers).
    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 60
    function invariant_NothingStuckAfterClosing() public view {
        uint256 nativeOwed;
        uint256 tokensOwed;
        for (uint256 i; i < handler.idCount(); i++) {
            (address o,, bool isBuy,, uint256 amount,,,) = lo.orders(handler.ids(i));
            if (o == address(0)) continue;
            if (isBuy) nativeOwed += amount;
            else tokensOwed += amount;
        }
        assertEq(address(lo).balance, nativeOwed, "no stray native");
        assertEq(token.balanceOf(address(lo)), tokensOwed, "no stray tokens");
    }
}
