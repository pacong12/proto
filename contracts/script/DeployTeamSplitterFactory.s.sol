// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GotonTeamSplitterFactory} from "../src/core/GotonTeamSplitter.sol";

/**
 * @title DeployTeamSplitterFactory
 * @notice Deploys GotonTeamSplitterFactory. It has no owner and no constructor arguments, so any
 *         key can deploy it, once per chain.
 *
 * Usage:
 *   PRIVATE_KEY=<hex> forge script script/DeployTeamSplitterFactory.s.sol \
 *     --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
 */
contract DeployTeamSplitterFactory is Script {
    function run() external returns (GotonTeamSplitterFactory factory) {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk != 0) vm.startBroadcast(pk);
        else vm.startBroadcast();
        factory = new GotonTeamSplitterFactory();
        vm.stopBroadcast();
        console.log("GotonTeamSplitterFactory:", address(factory));
    }
}
