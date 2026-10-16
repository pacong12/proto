// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TickMath} from "../../src/libraries/v4/TickMath.sol";
import {V4Lib} from "../../src/libraries/v4/V4Lib.sol";

/// @dev Pins the v4 math to values observed on Arc mainnet (Argus launches decoded on-chain).
contract ArcV4MathTest is Test {
    function test_SqrtPriceMatchesArgusInitializeEvents() public pure {
        // $GOLDETTF / $YouTube Initialize: tick 405400
        assertEq(TickMath.getSqrtPriceAtTick(405_400), 50302388120867331857465247907496697271);
        // $IDEA Initialize: tick 398400
        assertEq(TickMath.getSqrtPriceAtTick(398_400), 35448114088399581424138291910903211366);
        assertEq(TickMath.getSqrtPriceAtTick(TickMath.MIN_TICK), TickMath.MIN_SQRT_PRICE);
        assertEq(TickMath.getSqrtPriceAtTick(TickMath.MAX_TICK), TickMath.MAX_SQRT_PRICE);
    }

    function test_SingleSidedLiquidityMatchesArgusModifyLiquidity() public pure {
        uint128 liquidity = V4Lib.liquidityForAmount1(
            TickMath.getSqrtPriceAtTick(-887_200), TickMath.getSqrtPriceAtTick(405_400), 1_000_000_000 ether
        );
        // $GOLDETTF ModifyLiquidity over [-887200, 405400]
        assertEq(liquidity, 1575037795897358225);
    }

    function test_MirroredRangeHoldsSameSupply() public pure {
        uint160 lower = TickMath.getSqrtPriceAtTick(-405_400);
        uint160 upper = TickMath.getSqrtPriceAtTick(887_200);
        uint128 liquidity = V4Lib.liquidityForAmount0(lower, upper, 1_000_000_000 ether);
        // amount0 = L * (upper - lower) / (lower * upper / Q96) must not exceed the supply.
        uint256 amount0 = (uint256(liquidity) * V4Lib.Q96 / lower) * (upper - lower) / upper;
        assertLe(amount0, 1_000_000_000 ether);
        assertApproxEqRel(amount0, 1_000_000_000 ether, 1e12); // within 0.0001%
    }

    function test_DeltaUnpacking() public pure {
        int256 delta = (int256(int128(-5)) << 128) | int256(uint256(uint128(int128(7))));
        assertEq(V4Lib.amount0(delta), -5);
        assertEq(V4Lib.amount1(delta), 7);
        assertEq(V4Lib.amount0(V4Lib.toBeforeSwapDelta(42)), 42);
    }
}
