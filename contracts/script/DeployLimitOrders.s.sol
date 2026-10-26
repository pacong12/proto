// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GotonLimitOrders, IGotonV4RouterLO} from "../src/core/GotonLimitOrders.sol";
import {IPoolManagerV4} from "../src/interfaces/external/IUniswapV4Core.sol";

/**
 * @title DeployLimitOrders
 * @notice Deploys GotonLimitOrders against an existing stack. The contract has no admin, so any key
 *         can deploy it; only the constructor wiring matters, and it cannot be changed afterwards.
 *
 *         ROUTER and HOOK are required, and so is CURVE_FACTORY on Robinhood Chain: defaults would
 *         silently wire a new release to the previous stack. The quote asset and its native scale
 *         follow the chain (native ETH on Robinhood Chain, 6-decimal USDC on Arc) unless overridden.
 *
 * Env: ROUTER, HOOK, CURVE_FACTORY (Robinhood Chain only); optional POOL_MANAGER, QUOTE_ASSET,
 *      NATIVE_SCALE
 *
 * Usage:
 *   CURVE_FACTORY=0x... ROUTER=0x... HOOK=0x... PRIVATE_KEY=<hex> \
 *     forge script script/DeployLimitOrders.s.sol --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
 */
contract DeployLimitOrders is Script {
    uint256 private constant ROBINHOOD = 4663;
    uint256 private constant ARC = 5042;
    address private constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (GotonLimitOrders lo) {
        address router = vm.envAddress("ROUTER");
        address hook = vm.envAddress("HOOK");
        // Arc has no bonding curves, so no curve factory.
        address curveFactory = block.chainid == ARC ? address(0) : vm.envAddress("CURVE_FACTORY");
        address poolManager = vm.envOr("POOL_MANAGER", address(0x8366a39CC670B4001A1121B8F6A443A643e40951));
        address quoteAsset = vm.envOr("QUOTE_ASSET", block.chainid == ARC ? ARC_USDC : address(0));
        uint256 nativeScale = vm.envOr("NATIVE_SCALE", block.chainid == ARC ? uint256(1e12) : uint256(1));
        if (block.chainid != ROBINHOOD && block.chainid != ARC && !vm.envOr("ALLOW_OTHER_CHAIN", false)) {
            revert("Unknown chain: set QUOTE_ASSET and NATIVE_SCALE, then ALLOW_OTHER_CHAIN=true");
        }

        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        if (pk != 0) vm.startBroadcast(pk);
        else vm.startBroadcast();
        lo = new GotonLimitOrders(
            curveFactory, IGotonV4RouterLO(router), IPoolManagerV4(poolManager), hook, quoteAsset, nativeScale
        );
        vm.stopBroadcast();

        console.log("GotonLimitOrders:", address(lo));
        console.log("  curveFactory:", curveFactory);
        console.log("  router:", router);
        console.log("  hook:", hook);
        console.log("  quoteAsset:", quoteAsset);
        console.log("  nativeScale:", nativeScale);
    }
}
