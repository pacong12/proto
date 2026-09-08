// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";

contract LaunchpadV2Test is Test {
    LaunchpadV2Factory public factory;
    address payable public feeRecipient = payable(address(0xFA1));
    address public mockLocker = address(0x10C);
    address public creator = address(0xCAFE);
    address public buyer1 = address(0xB0B1);

    function setUp() public {
        factory = new LaunchpadV2Factory(feeRecipient, mockLocker);
        vm.deal(creator, 100 ether);
        vm.deal(buyer1, 100 ether);
    }

    function test_LaunchTokenV2AndCurveBuy() public {
        vm.startPrank(creator);
        (address tokenAddress, address curveAddress) = factory.launchTokenV2{value: 0.0005 ether}(
            "V2 Curve Token",
            "CURVE",
            "ipfs://logo",
            "Token on Bonding Curve",
            "twitter.com/curve",
            "t.me/curve",
            "curve.io"
        );
        vm.stopPrank();

        assertNotEq(tokenAddress, address(0));
        assertNotEq(curveAddress, address(0));

        LaunchpadToken token = LaunchpadToken(tokenAddress);
        BondingCurve curve = BondingCurve(payable(curveAddress));

        // 1 Billion supply on curve
        assertEq(token.balanceOf(curveAddress), 1_000_000_000 * 1e18);
        assertEq(curve.totalEthRaised(), 0);

        // Buyer purchases tokens after 6 seconds (anti-snipe decayed)
        vm.warp(block.timestamp + 6);

        vm.startPrank(buyer1);
        uint256 tokensOut = curve.buy{value: 1 ether}(0);
        vm.stopPrank();

        assertTrue(tokensOut > 0);
        assertEq(token.balanceOf(buyer1), tokensOut);
        assertTrue(curve.totalEthRaised() > 0);
    }
}
