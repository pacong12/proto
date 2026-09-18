// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2FactoryArc} from "../src/LaunchpadV2FactoryArc.sol";
import {LiquidityLocker} from "../src/LiquidityLocker.sol";

/**
 * @title DeployArc
 * @notice Deployment script for Arc Network (Chain ID: 5042).
 *
 * Arc Network Standard:
 *   - Native gas: USDC (18 decimals native msg.value)
 *   - Launch fee: 1.00 USDC (1 ether)
 *   - Opening FDV: $4,200 USDC
 *   - Graduation target: $69,000 USDC
 *   - Virtual USDC reserve: 4,200 ether
 *   - Virtual token reserve: 1,000,000,000 * 1e18
 *
 * Usage:
 *   forge script contracts/script/DeployArc.s.sol \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     --broadcast \
 *     --private-key $PRIVATE_KEY
 *
 * Env vars (optional overrides):
 *   PRIVATE_KEY               - hex private key (no 0x prefix)
 *   MNEMONIC                  - BIP-39 mnemonic (alternative to PRIVATE_KEY)
 *   PROTOCOL_FEE_RECIPIENT    - override fee recipient address
 *   LIQUIDITY_LOCKER_ADDRESS  - use existing locker (skips LiquidityLocker deploy)
 */
contract DeployArc is Script {
    function run() external returns (address factoryAddress, address lockerAddress) {
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

        address feeRecipient;
        try vm.envAddress("PROTOCOL_FEE_RECIPIENT") returns (address r) {
            feeRecipient = r;
        } catch {
            feeRecipient = 0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2;
        }

        address positionManager;
        try vm.envAddress("POSITION_MANAGER") returns (address pm) {
            positionManager = pm;
        } catch {
            positionManager = 0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377;
        }

        address weth;
        try vm.envAddress("WETH_ADDRESS") returns (address w) {
            weth = w;
        } catch {
            // Native USDC standard on Arc Network
            weth = 0x3600000000000000000000000000000000000000;
        }

        address existingLocker;
        bool hasExistingLocker = false;
        try vm.envAddress("LIQUIDITY_LOCKER_ADDRESS") returns (address l) {
            existingLocker = l;
            hasExistingLocker = true;
        } catch {}

        console.log("=== ARC NETWORK PROTO DEPLOYER ===");
        console.log("Chain ID          :", block.chainid);
        console.log("Deployer          :", deployer);
        console.log("Fee Recipient     :", feeRecipient);
        console.log("Has existing locker:", hasExistingLocker);

        if (hasExplicitKey) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        // 1. Deploy LiquidityLocker if not provided
        if (hasExistingLocker) {
            lockerAddress = existingLocker;
            console.log("Reusing locker    :", lockerAddress);
        } else {
            LiquidityLocker locker = new LiquidityLocker(positionManager, weth, feeRecipient);
            lockerAddress = address(locker);
            console.log("LiquidityLocker   :", lockerAddress);
        }

        // 2. Deploy LaunchpadV2FactoryArc with Arc Standard constants
        LaunchpadV2FactoryArc factory = new LaunchpadV2FactoryArc(
            payable(feeRecipient),
            lockerAddress,
            address(0), // poolManagerV4: not yet deployed on Arc
            address(0)  // memeHook: not yet deployed on Arc
        );
        factoryAddress = address(factory);

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("LaunchpadV2FactoryArc :", factoryAddress);
        console.log("LiquidityLocker       :", lockerAddress);
        console.log("Fee Recipient         :", feeRecipient);
        console.log("Launch Fee            :", factory.launchFee(), "wei (1.00 USDC)");
        console.log("Graduation Target     :", factory.GRADUATION_TARGET(), "wei (69,000 USDC)");
        console.log("Virtual USDC Reserve  :", factory.VIRTUAL_USDC_RESERVE(), "wei (4,200 USDC)");
    }
}
