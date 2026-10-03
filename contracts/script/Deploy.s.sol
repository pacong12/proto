// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LiquidityLocker} from "../src/LiquidityLocker.sol";

contract DeployScript is Script {
    // Official Robinhood Chain (ID: 4663) Uniswap V3 & WETH Addresses
    address public constant RH_V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address public constant RH_POSITION_MANAGER = 0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address public constant RH_SWAP_ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address public constant RH_WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    function run() external returns (address factoryAddress, address lockerAddress) {
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

        address feeRecipient;
        try vm.envAddress("PROTOCOL_FEE_RECIPIENT") returns (address recipient) {
            feeRecipient = recipient;
        } catch {
            feeRecipient = 0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2;
        }

        address v3Factory = vm.envOr("V3_FACTORY", RH_V3_FACTORY);
        address positionManager = vm.envOr("POSITION_MANAGER", RH_POSITION_MANAGER);
        address swapRouter = vm.envOr("SWAP_ROUTER", RH_SWAP_ROUTER);
        address weth = vm.envOr("WETH_ADDRESS", RH_WETH);

        console.log("=== ROBINHOOD V1 FACTORY DEPLOYMENT ===");
        console.log("Deployer Address:", deployer);
        console.log("Fee Recipient   :", feeRecipient);

        if (hasExplicitKey) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        LaunchpadFactory factory = new LaunchpadFactory(
            v3Factory,
            positionManager,
            swapRouter,
            weth,
            feeRecipient
        );

        factoryAddress = address(factory);
        lockerAddress = factory.locker();

        vm.stopBroadcast();

        console.log("=== PROTO V1 DEPLOYED SUCCESSFULLY ===");
        console.log("LaunchpadFactory:", factoryAddress);
        console.log("LiquidityLocker :", lockerAddress);
        console.log("WETH Address    :", weth);
        console.log("Fee Recipient   :", feeRecipient);
    }
}
