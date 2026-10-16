// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {ProtoLiquidityLockerV4} from "../../src/legacy/ProtoLiquidityLockerV4.sol";
import {ProtoMemeHook} from "../../src/legacy/ProtoMemeHook.sol";

contract DeployRobinhoodV2 is Script {
    function run() external returns (address factoryAddress, address lockerV4Address, address hookAddress) {
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
        address poolManagerV4 = vm.envOr("POOL_MANAGER_V4", 0x8366a39CC670B4001A1121B8F6A443A643e40951);
        address positionManagerV4 = vm.envOr("POSITION_MANAGER_V4", 0x58daec3116aae6D93017bAAea7749052E8a04fA7);
        address weth = vm.envOr("WETH_ADDRESS", 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73);

        console.log("=== ROBINHOOD V2 SOVEREIGN V4 DEPLOYMENT ===");
        console.log("Chain ID     :", block.chainid);
        console.log("Deployer     :", deployer);
        console.log("Fee Recipient:", feeRecipient);

        if (hasExplicitKey) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        // 1. Deploy Proto Sovereign V4 Liquidity Locker
        ProtoLiquidityLockerV4 lockerV4 = new ProtoLiquidityLockerV4(
            positionManagerV4,
            weth,
            feeRecipient
        );
        lockerV4Address = address(lockerV4);

        // 2. Deploy Proto Sovereign V4 MemeHook
        ProtoMemeHook hook = new ProtoMemeHook(
            poolManagerV4,
            feeRecipient,
            address(0) // buybackVault
        );
        hookAddress = address(hook);

        // 3. Deploy LaunchpadV2Factory with Proto Sovereign V4 Stack
        LaunchpadV2Factory factory = new LaunchpadV2Factory(
            payable(feeRecipient),
            lockerV4Address,
            poolManagerV4,
            hookAddress
        );

        hook.setFactory(address(factory));
        factoryAddress = address(factory);

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT SUCCESSFUL ===");
        console.log("LaunchpadV2Factory  :", factoryAddress);
        console.log("ProtoLiquidityLockerV4:", lockerV4Address);
        console.log("ProtoMemeHook       :", hookAddress);
        console.log("PoolManager V4      :", poolManagerV4);
        console.log("Launch Fee          :", factory.launchFee(), "wei (0.0005 ETH)");
        console.log("Graduation Target   :", factory.GRADUATION_TARGET(), "wei (4.2 ETH)");
        console.log("Virtual ETH         :", factory.VIRTUAL_ETH_RESERVE(), "wei (1.68 ETH)");
    }
}
