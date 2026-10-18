// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GotonLimitOrders, IGotonV4RouterLO} from "../src/core/GotonLimitOrders.sol";
import {IPoolManagerV4} from "../src/interfaces/external/IUniswapV4Core.sol";

/**
 * @title DeployLimitOrders
 * @notice Deploys GotonLimitOrders against an existing stack. The contract has no admin, so any key
 *         can deploy it; only the constructor wiring matters.
 *
 *         Defaults target the Robinhood v4 stack deployed 2026-10-18 (factory 0x0b85…3Fc18, router
 *         0x5F88…A2dc, hook 0xb5C8…60Cc, native ETH quote). On a chain without a v4 router and hook,
 *         set ROUTER and HOOK to any non-zero placeholder: pool routes then fail `InvalidRoute` and
 *         only bonding-curve orders fill.
 *
 * Env (all optional): CURVE_FACTORY, ROUTER, POOL_MANAGER, HOOK, QUOTE_ASSET, NATIVE_SCALE
 *
 * Usage:
 *   PRIVATE_KEY=<hex> forge script script/DeployLimitOrders.s.sol \
 *     --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
 */
contract DeployLimitOrders is Script {
    function run() external returns (GotonLimitOrders lo) {
        address curveFactory = vm.envOr("CURVE_FACTORY", address(0x0b85876120e797Ca19655C0B81a0C25573f3Fc18));
        address router = vm.envOr("ROUTER", address(0x5F88CE2BeD0f2639133b5EeB8b8fFE1fD50BA2dc));
        address poolManager = vm.envOr("POOL_MANAGER", address(0x8366a39CC670B4001A1121B8F6A443A643e40951));
        address hook = vm.envOr("HOOK", address(0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc));
        address quoteAsset = vm.envOr("QUOTE_ASSET", address(0));
        uint256 nativeScale = vm.envOr("NATIVE_SCALE", uint256(1));

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
