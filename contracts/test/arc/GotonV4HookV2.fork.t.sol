// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ArcV4LaunchForkTest} from "./ArcV4Launch.fork.t.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonFeeSplitter} from "../../src/core/GotonFeeSplitter.sol";
import {PoolKey} from "../../src/interfaces/IUniswapV4.sol";
import {V4Lib} from "../../src/libraries/v4/V4Lib.sol";

/**
 * Hook v2 on Arc mainnet's real PoolManager and USDC: tax held as PoolManager claims until
 * flushed, the emergency pause with its expiry, and a TWAP over exactly the last 30 minutes.
 * Run with: ARC_RPC_URL=https://rpc.mainnet.arc.io forge test --match-path test/arc/GotonV4HookV2.fork.t.sol
 */
contract GotonV4HookV2ForkTest is ArcV4LaunchForkTest {
    /// @dev A buy straight through the router, without the helpers' flush.
    function _rawBuy(address token, uint256 usdc6) internal {
        PoolKey memory key = factory.poolKeyOf(token);
        vm.prank(trader);
        router.swapExactIn{value: usdc6 * 1e12}(key, key.currency0 == USDC, usdc6, 0, trader, block.timestamp);
    }

    function _poolId(address token) internal view returns (bytes32 poolId) {
        (,, poolId,,) = factory.launches(token);
    }

    function _spotTick(address token) internal view returns (int24 tick) {
        (, tick) = V4Lib.getSlot0(PM, _poolId(token));
    }

    // --- tax as claims ------------------------------------------------------------------

    function test_TaxIsHeldAsClaimsUntilFlushed() public {
        (address token, bytes32 poolId) = _launch(creator, 4.5 ether);
        GotonFeeSplitter splitter = GotonFeeSplitter(_splitter(token));
        vm.warp(block.timestamp + 10);
        uint256 protocolBefore = splitter.protocolAccrued();

        _rawBuy(token, 100e6); // 1% tax: 1 USDC
        assertEq(hook.pendingTax(poolId), 1e6, "held by the hook as a PoolManager claim");
        assertEq(splitter.protocolAccrued(), protocolBefore, "nothing reached the splitter mid-swap");

        vm.prank(makeAddr("anyone"));
        assertEq(hook.flushTaxes(poolId), 1e6);
        assertEq(hook.pendingTax(poolId), 0);
        assertEq(splitter.protocolAccrued() - protocolBefore, 300_000, "the splitter's 30% protocol cut");
        assertEq(hook.flushTaxes(poolId), 0, "a second flush pays nothing");
    }

    function test_UnlockCallbackOnlyDuringAFlush() public {
        vm.expectRevert(GotonV4Hook.Unauthorized.selector);
        hook.unlockCallback(abi.encode(USDC, address(this), 1));
        vm.prank(address(PM));
        vm.expectRevert(GotonV4Hook.Unauthorized.selector);
        hook.unlockCallback(abi.encode(USDC, address(this), 1));
    }

    // --- emergency pause ----------------------------------------------------------------

    function test_PauseStopsSwapsAndLapsesOnItsOwn() public {
        (address token,) = _launch(creator, 4.5 ether);
        vm.warp(block.timestamp + 10);
        address guardian = makeAddr("guardian");

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(GotonV4Hook.Unauthorized.selector);
        hook.pause();

        hook.setGuardian(guardian);
        vm.prank(guardian);
        hook.pause();
        PoolKey memory key = factory.poolKeyOf(token);
        vm.prank(trader);
        vm.expectRevert(); // the PoolManager wraps the hook's Paused()
        router.swapExactIn{value: 10e18}(key, key.currency0 == USDC, 10e6, 0, trader, block.timestamp);

        vm.prank(guardian);
        vm.expectRevert(GotonV4Hook.Unauthorized.selector);
        hook.unpause();

        // Funds can never be frozen for good: the pause lapses after PAUSE_MAX.
        vm.warp(block.timestamp + hook.PAUSE_MAX());
        _rawBuy(token, 10e6);

        vm.prank(guardian);
        hook.pause();
        hook.unpause(); // the deployer
        _rawBuy(token, 10e6);
    }

    // --- oracle -------------------------------------------------------------------------

    function test_OracleNotReadyForThirtyMinutesAfterTheFirstSwap() public {
        (address token,) = _launch(creator, 4.5 ether);
        bytes32 poolId = _poolId(token);
        vm.expectRevert(GotonV4Hook.OracleNotReady.selector);
        hook.consultTick(poolId);
        vm.warp(vm.getBlockTimestamp() + 29 minutes);
        vm.expectRevert(GotonV4Hook.OracleNotReady.selector);
        hook.consultTick(poolId);
        vm.warp(vm.getBlockTimestamp() + 1 minutes);
        (int24 twap, uint32 window) = hook.consultTick(poolId);
        assertEq(window, 30 minutes);
        assertEq(twap, _spotTick(token), "no swap since launch: the TWAP is the current tick");
    }

    function test_OracleCoversTheLastThirtyMinutesAfterAQuietSpell() public {
        (address token,) = _launch(creator, 4.5 ether);
        bytes32 poolId = _poolId(token);
        // Two hours of trading at the launch price, then a big buy, then nothing for 31 minutes.
        for (uint256 i; i < 8; i++) {
            vm.warp(vm.getBlockTimestamp() + 15 minutes);
            _rawBuy(token, 1e6);
        }
        vm.warp(vm.getBlockTimestamp() + 1 minutes);
        _rawBuy(token, 2_000e6);
        int24 afterPump = _spotTick(token);
        vm.warp(vm.getBlockTimestamp() + 31 minutes);
        (int24 twap, uint32 window) = hook.consultTick(poolId);
        // v1 averaged back to its last checkpoint, up to two hours of the old price.
        assertEq(window, 30 minutes, "exactly the last 30 minutes");
        assertEq(twap, afterPump, "the price that held all of them");
    }

    function test_OracleWindowStaysNearThirtyMinutesWhileTrading() public {
        (address token,) = _launch(creator, 4.5 ether);
        bytes32 poolId = _poolId(token);
        for (uint256 i; i < 90; i++) {
            vm.warp(vm.getBlockTimestamp() + 47);
            _rawBuy(token, 1e6);
        }
        (, uint32 window) = hook.consultTick(poolId);
        assertGe(window, 30 minutes);
        assertLe(window, 30 minutes + hook.SNAPSHOT_SPACING());
    }

    function test_OracleIgnoresAOneBlockPush() public {
        (address token,) = _launch(creator, 4.5 ether);
        bytes32 poolId = _poolId(token);
        for (uint256 i; i < 4; i++) {
            vm.warp(vm.getBlockTimestamp() + 10 minutes);
            _rawBuy(token, 1e6);
        }
        (int24 before,) = hook.consultTick(poolId);
        vm.deal(trader, 1_000_000 ether);
        _rawBuy(token, 20_000e6); // same block: moves spot, not the time-weighted price
        (int24 afterPush,) = hook.consultTick(poolId);
        assertTrue(_spotTick(token) != before, "spot moved");
        assertEq(afterPush, before, "the TWAP did not");
    }
}
