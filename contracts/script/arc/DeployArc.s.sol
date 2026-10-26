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
 * @notice Deploys Goton's in-pool Uniswap v4 launch stack on Arc Network (Chain ID: 5042):
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
 *   ARC_PROTOCOL_FEE_BPS       - protocol cut of each tax payment (default 2000 = 20%, max 3000)
 *   OWNER_SAFE                 - Safe multisig that takes ownership (required on mainnet unless
 *                                ALLOW_EOA_OWNER=true); also the default fee recipient
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

        // Mainnet admin goes to a Safe multisig (docs/KEY-CUSTODY.md); fees default to it too.
        address ownerSafe = vm.envOr("OWNER_SAFE", address(0));
        if (ownerSafe == address(0) && block.chainid == 5042 && !vm.envOr("ALLOW_EOA_OWNER", false)) {
            revert("Set OWNER_SAFE (Safe multisig) for mainnet, or ALLOW_EOA_OWNER=true");
        }
        // No hardcoded fallback: a forgotten env var must stop the deploy, not route fees to an old wallet.
        address payable feeRecipient = payable(vm.envOr("PROTOCOL_FEE_RECIPIENT", ownerSafe));
        if (feeRecipient == address(0)) revert("Set PROTOCOL_FEE_RECIPIENT or OWNER_SAFE");
        IPoolManagerV4 poolManager =
            IPoolManagerV4(vm.envOr("ARC_POOL_MANAGER_V4", address(0x8366a39CC670B4001A1121B8F6A443A643e40951)));
        address usdc = vm.envOr("ARC_USDC", address(0x3600000000000000000000000000000000000000));

        (bytes32 hookSalt,) = HookMiner.mine(poolManager, deployer);

        console.log("=== ARC NETWORK GOTON V4 DEPLOYER ===");
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
        console.log("Protocol cut (bps)    :", factory.protocolFeeBps());
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
        _setProtocolFee(LaunchpadV2FactoryArc(factory));
        // Two-step: the Safe completes each handover with acceptOwnership().
        address ownerSafe = vm.envOr("OWNER_SAFE", address(0));
        if (ownerSafe != address(0)) {
            LaunchpadV2FactoryArc(factory).transferOwnership(ownerSafe);
            buyback.transferOwnership(ownerSafe);
        }
    }

    /// @dev Protocol cut for new launches; the factory enforces the 30% cap.
    function _setProtocolFee(LaunchpadV2FactoryArc f) internal {
        uint16 protocolFeeBps = uint16(vm.envOr("ARC_PROTOCOL_FEE_BPS", uint256(2_000)));
        if (protocolFeeBps == f.protocolFeeBps()) return;
        f.setLaunchParams(f.initialTick(), f.bondTick(), f.minPrebuyUsdc6(), f.maxDevBuyBps(), protocolFeeBps);
    }
}
