// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2FactoryArc} from "../../src/chains/arc/LaunchpadV2FactoryArc.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonFeeSplitterDeployer} from "../../src/core/GotonFeeSplitter.sol";
import {GotonV4Router} from "../../src/core/GotonV4Router.sol";
import {GotonV4Buyback} from "../../src/core/GotonV4Buyback.sol";
import {HookMiner} from "../lib/HookMiner.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";

/**
 * @title DeployArc
 * @notice Deploys Proto's in-pool Uniswap v4 launch stack on Arc Network (Chain ID: 5042):
 *           1. GotonV4Hook via CREATE2 at an address whose low bits equal its permission
 *              flags (0x20CC), mined in this script.
 *           2. GotonFeeSplitterDeployer + LaunchpadV2FactoryArc (Argus portal defaults: open tick 405400, bond tick 376400,
 *              4.50 USDC min prebuy, 5% max dev buy, 30% protocol cut, 0 launch fee).
 *           3. hook.setFactory(factory).
 *           4. GotonV4Router (frontend swaps; accepts native USDC msg.value for buys).
 *           5. GotonV4Buyback, set as the factory's buyback vault (TWAP-guarded buyback-and-burn).
 *
 * Usage:
 *   forge script contracts/script/arc/DeployArc.s.sol \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     --broadcast \
 *     --private-key $PRIVATE_KEY
 *
 * Env vars (optional overrides):
 *   PRIVATE_KEY / MNEMONIC     - deployer key
 *   PROTOCOL_FEE_RECIPIENT     - treasury (also default buyback & liquidity vault)
 *   ARC_POOL_MANAGER_V4        - Uniswap v4 PoolManager
 *   ARC_USDC                   - USDC ERC-20 (6 decimals)
 */
contract DeployArc is Script {
    function run() external returns (address factoryAddress, address hookAddress, address routerAddress) {
        uint256 deployerPrivateKey;
        address deployer;
        bool hasExplicitKey = false;

        string memory mnemonic = vm.envOr("MNEMONIC", string(""));
        if (bytes(mnemonic).length > 0) {
            (deployer, deployerPrivateKey) = deriveRememberKey(mnemonic, 0);
            hasExplicitKey = true;
        } else {
            try vm.envUint("PRIVATE_KEY") returns (uint256 pk) {
                deployerPrivateKey = pk;
                deployer = vm.addr(pk);
                hasExplicitKey = true;
            } catch {
                deployer = msg.sender;
            }
        }

        address payable feeRecipient =
            payable(vm.envOr("PROTOCOL_FEE_RECIPIENT", address(0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2)));
        IPoolManagerV4 poolManager =
            IPoolManagerV4(vm.envOr("ARC_POOL_MANAGER_V4", address(0x8366a39CC670B4001A1121B8F6A443A643e40951)));
        address usdc = vm.envOr("ARC_USDC", address(0x3600000000000000000000000000000000000000));

        (bytes32 hookSalt,) = HookMiner.mine(poolManager, deployer);

        console.log("=== ARC NETWORK PROTO V4 DEPLOYER ===");
        console.log("Chain ID          :", block.chainid);
        console.log("Deployer          :", deployer);
        console.log("Fee Recipient     :", feeRecipient);
        console.log("PoolManager       :", address(poolManager));

        if (hasExplicitKey) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        (factoryAddress, hookAddress, routerAddress) = _deploy(poolManager, usdc, feeRecipient, deployer, hookSalt);

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("LaunchpadV2FactoryArc :", factoryAddress);
        console.log("GotonV4Hook           :", hookAddress);
        console.log("GotonV4Router         :", routerAddress);
        LaunchpadV2FactoryArc factory = LaunchpadV2FactoryArc(factoryAddress);
        console.log("Opening tick          :", uint256(int256(factory.initialTick())), "(~$2,480 FDV)");
        console.log("Bond tick             :", uint256(int256(factory.bondTick())), "(~$45,079 FDV)");
        console.log("Min prebuy (USDC 6dp) :", factory.minPrebuyUsdc6());
    }

    function _deploy(
        IPoolManagerV4 poolManager,
        address usdc,
        address payable feeRecipient,
        address deployer,
        bytes32 hookSalt
    ) internal returns (address factory, address hook, address router) {
        GotonV4Hook gotonHook = new GotonV4Hook{salt: hookSalt}(poolManager, deployer);
        factory = address(
            new LaunchpadV2FactoryArc(poolManager, usdc, gotonHook, new GotonFeeSplitterDeployer(), feeRecipient)
        );
        gotonHook.setFactory(factory);
        hook = address(gotonHook);
        router = address(new GotonV4Router(poolManager, usdc, 1e12));
        GotonV4Buyback buyback = new GotonV4Buyback(poolManager, gotonHook);
        LaunchpadV2FactoryArc(factory).setRecipients(feeRecipient, address(buyback), feeRecipient);
        // DR-01: optional incident-response guardian that can pause launches (unpause stays owner-only).
        address guardian = vm.envOr("EMERGENCY_GUARDIAN", address(0));
        if (guardian != address(0)) LaunchpadV2FactoryArc(factory).setGuardian(guardian);
    }
}
