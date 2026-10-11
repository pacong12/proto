// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FeeMath} from "../src/libraries/FeeMath.sol";

contract FeeMathTest is Test {
    function test_FeeMath_CalculateFee() public pure {
        assertEq(FeeMath.calculateFee(0, 100), 0);
        // 1% of 1000 = 10
        assertEq(FeeMath.calculateFee(1000, 100), 10);
        // 5% of 1000 = 50
        assertEq(FeeMath.calculateFee(1000, 500), 50);
    }

    function test_FeeMath_LockerSplit7030() public pure {
        uint256 total = 1 ether;
        (uint256 creatorFee, uint256 protocolFee) = FeeMath.calculateLockerSplit(total, 30);

        assertEq(creatorFee, 0.7 ether);
        assertEq(protocolFee, 0.3 ether);
        assertEq(creatorFee + protocolFee, total);
    }

    function test_FeeMath_EffectiveBalance() public pure {
        // Normal case: snapshot == live
        assertEq(FeeMath.calculateEffectiveBalance(100, 100), 100);
        // Sold tokens: snapshot > live -> use live
        assertEq(FeeMath.calculateEffectiveBalance(100, 20), 20);
        // Flash loan: snapshot < live -> use snapshot
        assertEq(FeeMath.calculateEffectiveBalance(0, 1_000_000), 0);
    }
}
