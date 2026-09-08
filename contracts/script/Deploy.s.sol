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
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(1));

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer Address:", deployer);

        address feeRecipient;
        try vm.envAddress("PROTOCOL_FEE_RECIPIENT") returns (address recipient) {
            feeRecipient = recipient;
        } catch {
            feeRecipient = deployer;
        }

        address v3Factory = vm.envOr("V3_FACTORY", RH_V3_FACTORY);
        address positionManager = vm.envOr("POSITION_MANAGER", RH_POSITION_MANAGER);
        address swapRouter = vm.envOr("SWAP_ROUTER", RH_SWAP_ROUTER);
        address weth = vm.envOr("WETH_ADDRESS", RH_WETH);

        vm.startBroadcast(deployerPrivateKey);

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

        console.log("=== PROTO PROTOCOL DEPLOYED ===");
        console.log("LaunchpadFactory:", factoryAddress);
        console.log("LiquidityLocker :", lockerAddress);
        console.log("WETH Address    :", weth);
        console.log("Fee Recipient   :", feeRecipient);
    }
}
