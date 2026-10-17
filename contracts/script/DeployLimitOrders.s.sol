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
 *         Defaults target the live Robinhood stack (factory 0x9f1f…0748, native ETH quote). That
 *         chain has no GotonV4Router / GotonV4Hook yet, so ROUTER and HOOK default to 0x…dEaD:
 *         every pool route then fails `InvalidRoute` and only bonding-curve orders can fill.
 *         Graduated tokens get pool routes once a stack with a real router and hook is deployed.
 *
 * Env (all optional): CURVE_FACTORY, ROUTER, POOL_MANAGER, HOOK, QUOTE_ASSET, NATIVE_SCALE
 *
 * Usage:
 *   PRIVATE_KEY=<hex> forge script script/DeployLimitOrders.s.sol \
 *     --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
 */
contract DeployLimitOrders is Script {
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    function run() external returns (GotonLimitOrders lo) {
        address curveFactory = vm.envOr("CURVE_FACTORY", address(0x9f1fAf78adE92C994AB188452338b45c52800748));
        address router = vm.envOr("ROUTER", DEAD);
        address poolManager = vm.envOr("POOL_MANAGER", address(0x8366a39CC670B4001A1121B8F6A443A643e40951));
        address hook = vm.envOr("HOOK", DEAD);
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
