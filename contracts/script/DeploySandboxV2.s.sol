// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";

/**
 * @title DeploySandboxV2
 * @notice Sandbox deployment script for Robinhood Chain Testnet (Chain ID: 46630).
 * Deploys the V2 Bonding Curve Factory targeting Uniswap v4 Hook graduation.
 */
contract DeploySandboxV2 is Script {
    function run() external returns (address factoryAddress) {
        string memory mnemonic = vm.envOr("MNEMONIC", string(""));
        uint256 deployerPrivateKey;
        address deployer;

        if (bytes(mnemonic).length > 0) {
            (deployer, deployerPrivateKey) = deriveRememberKey(mnemonic, 0);
        } else {
            deployerPrivateKey = vm.envUint("PRIVATE_KEY");
            deployer = vm.addr(deployerPrivateKey);
        }

        console.log("=== SANDBOX TESTNET DEPLOYER ===");
        console.log("Deployer Address:", deployer);
        console.log("Balance Wei     :", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy LaunchpadV2Factory on Testnet with deployer as fee recipient & locker
        // Uniswap v4 PoolManager and MemeHook placeholders (mainnet v4 references)
        LaunchpadV2Factory factory = new LaunchpadV2Factory(
            payable(deployer),
            address(0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4),
            address(0), // poolManagerV4: set once Uniswap v4 is live on Robinhood Chain
            address(0)  // memeHook: pons-style meme hook, deployed alongside v4
        );

        factoryAddress = address(factory);

        vm.stopBroadcast();

        console.log("=== SANDBOX PROTO V2 FACTORY DEPLOYED ===");
        console.log("V2 Factory Address:", factoryAddress);
        console.log("Protocol Treasury :", deployer);
    }
}
