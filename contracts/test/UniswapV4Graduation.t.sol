// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {PoolKey, PoolIdLibrary} from "../src/interfaces/IUniswapV4.sol";

/**
 * @title UniswapV4GraduationTest
 * @notice Verifies V2 bonding curve graduation computes canonical Uniswap v4
 * PoolKey and emits Graduated with the exact PoolId (keccak256(abi.encode(PoolKey))).
 */
contract UniswapV4GraduationTest is Test {
    using PoolIdLibrary for PoolKey;

    LaunchpadV2Factory public factory;
    address payable public feeRecipient = payable(makeAddr("feeRecipient"));
    address public mockLocker = makeAddr("locker");
    address public mockPoolManagerV4 = makeAddr("poolManagerV4");
    address public mockMemeHook = makeAddr("memeHook");
    address public creator = makeAddr("creator");
    address public buyer = makeAddr("buyer");

    function setUp() public {
        factory = new LaunchpadV2Factory(feeRecipient, mockLocker, mockPoolManagerV4, mockMemeHook);
        vm.deal(creator, 100 ether);
        vm.deal(buyer, 1000 ether);
    }

    function _launch() internal returns (address tokenAddress, address curveAddress) {
        vm.startPrank(creator);
        (tokenAddress, curveAddress) = factory.launchTokenV2{value: 0.0005 ether}(
            "V4 Grad Token",
            "V4G",
            "ipfs://logo",
            "Graduates to Uniswap v4",
            "x.com/v4",
            "t.me/v4",
            "v4.io"
        );
        vm.stopPrank();
    }

    function test_GraduationComputesCanonicalV4PoolId() public {
        (address tokenAddress, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));

        // Push curve past 4.2 ETH graduation target
        vm.startPrank(buyer);
        for (uint256 i; i < 20; i++) {
            curve.buy{value: 0.25 ether}(0);
            if (curve.graduated()) break;
        }
        vm.stopPrank();

        assertTrue(curve.graduated(), "curve must graduate after 4.2 ETH");

        // Reconstruct the expected PoolKey according to Uniswap v4 specification:
        // currency0: address(0) for native ETH, currency1: tokenAddress
        // fee: 0 (the hook handles fees), tickSpacing: 200, hooks: memeHook
        PoolKey memory expectedKey = PoolKey({
            currency0: address(0),
            currency1: tokenAddress,
            fee: 0,
            tickSpacing: 200,
            hooks: mockMemeHook
        });
        bytes32 expectedPoolId = expectedKey.toId();

        assertEq(
            curve.graduatedPoolId(),
            expectedPoolId,
            "graduatedPoolId must equal canonical keccak256(abi.encode(PoolKey))"
        );
        assertEq(uint256(expectedPoolId), uint256(keccak256(abi.encode(expectedKey))), "library sanity check");
    }

    function test_PostGraduationTradesRevert() public {
        (, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));

        vm.startPrank(buyer);
        for (uint256 i; i < 20; i++) {
            if (curve.graduated()) break;
            curve.buy{value: 0.25 ether}(0);
        }
        vm.stopPrank();

        assertTrue(curve.graduated());
        vm.expectRevert(BondingCurve.AlreadyGraduated.selector);
        vm.prank(buyer);
        curve.buy{value: 0.1 ether}(0);
    }

    function test_V4ParamsStoredFromFactory() public {
        (, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));

        assertEq(curve.factory(), address(factory), "factory recorded on curve");
        assertEq(curve.poolManagerV4(), mockPoolManagerV4, "poolManager recorded");
        assertEq(curve.memeHook(), mockMemeHook, "memeHook recorded");
    }
}
