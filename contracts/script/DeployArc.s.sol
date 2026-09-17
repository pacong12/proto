// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";

/**
 * @title DeployArc
 * @notice Automated deployment script for Circle Arc Network (Chain ID: 5042 Mainnet / 5042002 Testnet).
 * Deploys LaunchpadV2Factory using native USDC gas (18 decimals native msg.value).
 */
contract DeployArc is Script {
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

        address feeRecipient;
        try vm.envAddress("PROTOCOL_FEE_RECIPIENT") returns (address r) {
            feeRecipient = r;
        } catch {
            feeRecipient = deployer;
            console.log("WARNING: PROTOCOL_FEE_RECIPIENT not set. Using deployer address.");
        }

        address lockerAddress;
        try vm.envAddress("LIQUIDITY_LOCKER_ADDRESS") returns (address l) {
            lockerAddress = l;
        } catch {
            lockerAddress = feeRecipient;
            console.log("WARNING: LIQUIDITY_LOCKER_ADDRESS not set. Using fee recipient address.");
        }

        console.log("=== ARC NETWORK PROTOCOL DEPLOYER ===");
        console.log("Deployer Address  :", deployer);
        console.log("Fee Recipient     :", feeRecipient);
        console.log("Locker Address    :", lockerAddress);
        console.log("Balance Wei       :", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        LaunchpadV2Factory factory = new LaunchpadV2Factory(
            payable(feeRecipient),
            lockerAddress,
            address(0),
            address(0)
        );
        factoryAddress = address(factory);

        vm.stopBroadcast();

        console.log("=== ARC PROTO DEPLOYMENT SUCCESSFUL ===");
        console.log("V2 Factory Address:", factoryAddress);
    }
}
