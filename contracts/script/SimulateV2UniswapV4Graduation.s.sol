// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {PoolKey, PoolIdLibrary} from "../src/interfaces/IUniswapV4.sol";

/**
 * @title SimulateV2UniswapV4Graduation
 * @notice Executes an end-to-end sandbox simulation of a V2 token launch,
 * continuous curve buying until raising 4.2 ETH, triggering graduation,
 * and computing/verifying the canonical Uniswap v4 PoolId.
 */
contract SimulateV2UniswapV4Graduation is Script {
    using PoolIdLibrary for PoolKey;

    function run() external {
        console.log("=================================================");
        console.log(" SIMULATING V2 TOKEN LAUNCH & UNISWAP V4 GRADUATION");
        console.log("=================================================");

        address deployer = address(0xAA11);
        address mockLocker = address(0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952);
        address mockPoolManagerV4 = address(0); // In testnet sandbox
        address mockMemeHook = address(0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044);

        vm.deal(deployer, 100 ether);

        vm.startBroadcast();

        // 1. Deploy Factory with V4 Hook configuration
        LaunchpadV2Factory factory = new LaunchpadV2Factory(
            payable(deployer),
            mockLocker,
            mockPoolManagerV4,
            mockMemeHook
        );
        console.log("1. LaunchpadV2Factory deployed at :", address(factory));

        // 2. Launch V2 Token
        (address tokenAddress, address curveAddress) = factory.launchTokenV2{value: 0.0005 ether}(
            "Robinhood Pepe V4",
            "RPEPE",
            "ipfs://bafybeirpepe",
            "Community token graduating directly into Uniswap v4",
            "x.com/rpepe",
            "t.me/rpepe",
            "rpepe.io"
        );
        console.log("2. Token Launched at              :", tokenAddress);
        console.log("   Bonding Curve deployed at      :", curveAddress);

        BondingCurve curve = BondingCurve(payable(curveAddress));
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));

        console.log("3. Initial Curve Token Reserve   :", token.balanceOf(curveAddress) / 1e18, "RPEPE");
        console.log("   Graduation Target              :", curve.graduationTarget() / 1e18, "ETH");

        // 4. Simulate active trading by multiple buyers
        address buyerAlice = address(0xA11CE);
        address buyerBob = address(0xB0B);
        vm.deal(buyerAlice, 50 ether);
        vm.deal(buyerBob, 50 ether);

        // Buy 1: Alice buys 2.0 ETH
        vm.warp(block.timestamp + 10); // past anti-snipe window
        curve.buy{value: 2.0 ether}(0);
        console.log("4. Buy #1 (2.0 ETH) executed. Total raised:", curve.totalEthRaised() / 1e16, "/ 420 (x0.01 ETH)");

        // Buy 2: Bob buys 2.5 ETH, crossing 4.2 ETH threshold and triggering graduation
        curve.buy{value: 2.5 ether}(0);
        console.log("5. Buy #2 (2.5 ETH) executed. Total raised:", curve.totalEthRaised() / 1e16, "/ 420 (x0.01 ETH)");

        // 5. Verify Graduation State & Uniswap v4 PoolKey
        require(curve.graduated(), "Error: Curve must be graduated!");
        bytes32 poolId = curve.graduatedPoolId();

        PoolKey memory expectedKey = PoolKey({
            currency0: address(0),
            currency1: tokenAddress,
            fee: 0,
            tickSpacing: 200,
            hooks: mockMemeHook
        });
        bytes32 expectedId = expectedKey.toId();

        console.log("6. === GRADUATION TO UNISWAP V4 SUCCESSFUL ===");
        console.log("   Graduation Status              : GRADUATED (true)");
        console.log("   ETH Migrated to DEX            :", address(curve).balance);
        console.log("   Tokens Reserved for v4 Pool    :", token.balanceOf(address(curve)) / 1e18, "RPEPE");
        console.log("   Uniswap v4 PoolId (computed)   :");
        console.logBytes32(poolId);
        require(poolId == expectedId, "Error: PoolId mismatch with canonical v4!");
        console.log("   Matches Canonical PoolId       : VERIFIED");
        console.log("=================================================");

        vm.stopBroadcast();
    }
}
