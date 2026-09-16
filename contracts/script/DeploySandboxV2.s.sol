// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";

/**
 * @title DeploySandboxV2
 * @notice Sandbox deployment script for Robinhood Chain Testnet (Chain ID: 46630).
 * Deploys the V2 Bonding Curve Factory targeting Uniswap v4 Hook graduation.
 *
 * L-06 fix: the fee recipient is read from the PROTOCOL_FEE_RECIPIENT environment
 * variable rather than defaulting to the deployer key address. The deployer key
 * should be a hot key used only for deployment; the fee recipient should be a
 * separate cold wallet or multisig.
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

        // L-06 fix: use a dedicated treasury address, not the deployer key.
        // Set PROTOCOL_FEE_RECIPIENT to a multisig or cold wallet address.
        address feeRecipient;
        try vm.envAddress("PROTOCOL_FEE_RECIPIENT") returns (address r) {
            feeRecipient = r;
        } catch {
            // Fall back to deployer only in development; log a clear warning.
            feeRecipient = deployer;
            console.log("WARNING: PROTOCOL_FEE_RECIPIENT not set. Using deployer address.");
            console.log("Set PROTOCOL_FEE_RECIPIENT to a multisig in production.");
        }

        console.log("=== SANDBOX TESTNET DEPLOYER ===");
        console.log("Deployer Address  :", deployer);
        console.log("Fee Recipient     :", feeRecipient);
        console.log("Balance Wei       :", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        LaunchpadV2Factory factory = new LaunchpadV2Factory(
            payable(feeRecipient),
            address(0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4),
            address(0), // poolManagerV4: set once Uniswap v4 is live on Robinhood Chain
            address(0)  // memeHook: deployed alongside v4
        );

        factoryAddress = address(factory);

        vm.stopBroadcast();

        console.log("=== SANDBOX PROTO V2 FACTORY DEPLOYED ===");
        console.log("V2 Factory Address:", factoryAddress);
        console.log("Protocol Treasury :", feeRecipient);
    }
}
