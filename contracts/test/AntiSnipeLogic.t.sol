// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AntiSnipeLogic} from "../src/libraries/AntiSnipeLogic.sol";

contract AntiSnipeLogicTest is Test {
    uint256 constant LAUNCH_TIME = 1_000_000;

    function test_AntiSnipe_DecayingSchedule() public pure {
        // t = 0s: 99%
        assertEq(AntiSnipeLogic.calculateSnipeTaxBps(LAUNCH_TIME, LAUNCH_TIME), 9900);
        assertTrue(AntiSnipeLogic.isSnipeTaxActive(LAUNCH_TIME, LAUNCH_TIME));

        // t = 1s: 25%
        assertEq(AntiSnipeLogic.calculateSnipeTaxBps(LAUNCH_TIME, LAUNCH_TIME + 1), 2500);
        assertTrue(AntiSnipeLogic.isSnipeTaxActive(LAUNCH_TIME, LAUNCH_TIME + 1));

        // t = 2s: 3%
        assertEq(AntiSnipeLogic.calculateSnipeTaxBps(LAUNCH_TIME, LAUNCH_TIME + 2), 300);
        assertTrue(AntiSnipeLogic.isSnipeTaxActive(LAUNCH_TIME, LAUNCH_TIME + 2));

        // t = 3s: 0%
        assertEq(AntiSnipeLogic.calculateSnipeTaxBps(LAUNCH_TIME, LAUNCH_TIME + 3), 0);
        assertFalse(AntiSnipeLogic.isSnipeTaxActive(LAUNCH_TIME, LAUNCH_TIME + 3));

        // t > 3s: 0%
        assertEq(AntiSnipeLogic.calculateSnipeTaxBps(LAUNCH_TIME, LAUNCH_TIME + 100), 0);
        assertFalse(AntiSnipeLogic.isSnipeTaxActive(LAUNCH_TIME, LAUNCH_TIME + 100));
    }
}
