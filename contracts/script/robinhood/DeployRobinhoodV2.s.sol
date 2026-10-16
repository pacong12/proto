// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {ProtoV4Hook} from "../../src/core/ProtoV4Hook.sol";
import {ProtoV4Graduator} from "../../src/core/ProtoV4Graduator.sol";
import {ProtoV4Router} from "../../src/core/ProtoV4Router.sol";
import {ProtoV4Buyback} from "../../src/core/ProtoV4Buyback.sol";
import {ProtoFeeSplitter, ProtoFeeSplitterDeployer} from "../../src/core/ProtoFeeSplitter.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {HookMiner} from "../lib/HookMiner.sol";

/**
 * @title DeployRobinhoodV2
 * @notice Deploys the Robinhood Chain (4663) stack: bonding-curve factory with trustless
 *         graduation into a locked native-ETH Uniswap v4 pool.
 *           1. ProtoV4Hook at a mined CREATE2 address (permission bits 0x20CC)
 *           2. ProtoFeeSplitterDeployer + ProtoV4Graduator (default LP-fee split 30% protocol / 70% creator)
 *           3. LaunchpadV2Factory, wired as the graduator's launcher; graduator wired as the hook's launcher
 *           4. ProtoV4Router for frontend swaps
 *           5. ProtoV4Buyback, set as the graduator's buyback vault (TWAP-guarded buyback-and-burn)
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

        address payable feeRecipient =
            payable(vm.envOr("PROTOCOL_FEE_RECIPIENT", address(0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2)));
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

        ProtoV4Hook hook = new ProtoV4Hook{salt: hookSalt}(poolManager, deployer);
        ProtoV4Graduator graduator = new ProtoV4Graduator(
            poolManager,
            hook,
            new ProtoFeeSplitterDeployer(),
            feeRecipient,
            ProtoFeeSplitter.Split({protocolBps: 3_000, holdersBps: 0, burnBps: 0, creatorBps: 10_000, liquidityBps: 0})
        );
        LaunchpadV2Factory factory = new LaunchpadV2Factory(feeRecipient, graduator);
        graduator.setLauncher(address(factory));
        hook.setFactory(address(graduator));
        ProtoV4Router router = new ProtoV4Router(poolManager, address(0), 0);
        ProtoV4Buyback buyback = new ProtoV4Buyback(poolManager, hook);
        graduator.setRecipients(feeRecipient, address(buyback), feeRecipient);

        vm.stopBroadcast();

        factoryAddress = address(factory);
        graduatorAddress = address(graduator);
        hookAddress = address(hook);
        routerAddress = address(router);

        console.log("=== DEPLOYMENT SUCCESSFUL ===");
        console.log("LaunchpadV2Factory :", factoryAddress);
        console.log("ProtoV4Graduator   :", graduatorAddress);
        console.log("ProtoV4Hook        :", hookAddress);
        console.log("ProtoV4Router      :", routerAddress);
        console.log("ProtoV4Buyback     :", address(buyback));
        console.log("Launch Fee         :", factory.launchFee(), "wei (0.0005 ETH)");
        console.log("Graduation Target  :", factory.GRADUATION_TARGET(), "wei (4.2 ETH)");
    }
}
