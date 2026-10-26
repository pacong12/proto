// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonV4Graduator} from "../../src/core/GotonV4Graduator.sol";
import {GotonV4Router} from "../../src/core/GotonV4Router.sol";
import {GotonV4Buyback} from "../../src/core/GotonV4Buyback.sol";
import {GotonFeeSplitter, GotonFeeSplitterDeployer} from "../../src/core/GotonFeeSplitter.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {HookMiner} from "../lib/HookMiner.sol";

/**
 * @title DeployRobinhoodV2
 * @notice Deploys the Robinhood Chain (4663) stack: bonding-curve factory with trustless
 *         graduation into a locked native-ETH Uniswap v4 pool.
 *           1. GotonV4Hook at a mined CREATE2 address (permission bits 0x20CC)
 *           2. GotonFeeSplitterDeployer + GotonV4Graduator (default LP-fee split 30% protocol / 70% creator)
 *           3. LaunchpadV2Factory, wired as the graduator's launcher; graduator wired as the hook's launcher
 *           4. GotonV4Router for frontend swaps
 *           5. GotonV4Buyback, set as the graduator's buyback vault (TWAP-guarded buyback-and-burn)
 *
 * Usage:
 *   PRIVATE_KEY=<hex> forge script script/robinhood/DeployRobinhoodV2.s.sol \
 *     --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
 */
contract DeployRobinhoodV2 is Script {
    function run()
        external
        returns (address factoryAddress, address graduatorAddress, address hookAddress, address routerAddress)
    {
        uint256 deployerPrivateKey;
        address deployer;
        bool hasExplicitKey = false;

        try vm.envUint("PRIVATE_KEY") returns (uint256 pk) {
            deployerPrivateKey = pk;
            deployer = vm.addr(pk);
            hasExplicitKey = true;
        } catch {
            deployer = msg.sender;
        }

        // Mainnet admin goes to a Safe multisig (docs/KEY-CUSTODY.md); fees default to it too.
        address ownerSafe = vm.envOr("OWNER_SAFE", address(0));
        if (ownerSafe == address(0) && block.chainid == 4663 && !vm.envOr("ALLOW_EOA_OWNER", false)) {
            revert("Set OWNER_SAFE (Safe multisig) for mainnet, or ALLOW_EOA_OWNER=true");
        }
        // No hardcoded fallback: a forgotten env var must stop the deploy, not route fees to an old wallet.
        address payable feeRecipient = payable(vm.envOr("PROTOCOL_FEE_RECIPIENT", ownerSafe));
        if (feeRecipient == address(0)) revert("Set PROTOCOL_FEE_RECIPIENT or OWNER_SAFE");
        IPoolManagerV4 poolManager =
            IPoolManagerV4(vm.envOr("POOL_MANAGER_V4", address(0x8366a39CC670B4001A1121B8F6A443A643e40951)));

        (bytes32 hookSalt,) = HookMiner.mine(poolManager, deployer);

        console.log("=== ROBINHOOD V2 + UNISWAP V4 GRADUATION DEPLOYMENT ===");
        console.log("Chain ID     :", block.chainid);
        console.log("Deployer     :", deployer);
        console.log("Fee Recipient:", feeRecipient);

        if (hasExplicitKey) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        GotonV4Hook hook = new GotonV4Hook{salt: hookSalt}(poolManager, deployer);
        GotonV4Graduator graduator = new GotonV4Graduator(
            poolManager,
            hook,
            new GotonFeeSplitterDeployer(),
            feeRecipient,
            GotonFeeSplitter.Split({protocolBps: 3_000, holdersBps: 0, burnBps: 0, creatorBps: 10_000, liquidityBps: 0})
        );
        LaunchpadV2Factory factory = new LaunchpadV2Factory(feeRecipient, graduator);
        graduator.setLauncher(address(factory));
        hook.setFactory(address(graduator));
        GotonV4Router router = new GotonV4Router(poolManager, address(0), 0);
        GotonV4Buyback buyback = new GotonV4Buyback(poolManager, hook);
        graduator.setRecipients(feeRecipient, address(buyback), feeRecipient);
        // DR-01: optional incident-response guardian that can pause launches and curve buys.
        address guardian = vm.envOr("EMERGENCY_GUARDIAN", address(0));
        if (guardian != address(0)) factory.setGuardian(guardian);
        // Two-step: the Safe completes each handover with acceptOwnership().
        if (ownerSafe != address(0)) {
            factory.transferOwnership(ownerSafe);
            graduator.transferOwnership(ownerSafe);
            buyback.transferOwnership(ownerSafe);
        }

        vm.stopBroadcast();

        factoryAddress = address(factory);
        graduatorAddress = address(graduator);
        hookAddress = address(hook);
        routerAddress = address(router);

        console.log("=== DEPLOYMENT SUCCESSFUL ===");
        console.log("LaunchpadV2Factory :", factoryAddress);
        console.log("GotonV4Graduator   :", graduatorAddress);
        console.log("GotonV4Hook        :", hookAddress);
        console.log("GotonV4Router      :", routerAddress);
        console.log("GotonV4Buyback     :", address(buyback));
        console.log("Launch Fee         :", factory.launchFee(), "wei (0.0005 ETH)");
        console.log("Graduation Target  :", factory.GRADUATION_TARGET(), "wei (4.2 ETH)");
        if (ownerSafe != address(0)) {
            console.log("Pending owner      :", ownerSafe, "(Safe must call acceptOwnership on 3 contracts)");
        }
    }
}
