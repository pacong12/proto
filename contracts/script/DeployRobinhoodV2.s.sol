// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";

contract DeployRobinhoodV2 is Script {
    function run() external returns (address factoryAddress) {
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

        address feeRecipient = vm.envOr("PROTOCOL_FEE_RECIPIENT", 0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2);
        address locker = vm.envOr("ROBINHOOD_LOCKER_ADDRESS", 0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4);

        console.log("=== ROBINHOOD V2 FACTORY DEPLOYMENT ===");
        console.log("Chain ID     :", block.chainid);
        console.log("Deployer     :", deployer);
        console.log("Fee Recipient:", feeRecipient);
        console.log("Locker       :", locker);

        if (hasExplicitKey) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        LaunchpadV2Factory factory = new LaunchpadV2Factory(
            payable(feeRecipient),
            locker,
            address(0),
            address(0)
        );

        factoryAddress = address(factory);

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT SUCCESSFUL ===");
        console.log("LaunchpadV2Factory:", factoryAddress);
        console.log("Launch Fee        :", factory.launchFee(), "wei (0.0005 ETH)");
        console.log("Graduation Target :", factory.GRADUATION_TARGET(), "wei (4.2 ETH)");
        console.log("Virtual ETH       :", factory.VIRTUAL_ETH_RESERVE(), "wei (3.0 ETH)");
    }
}
