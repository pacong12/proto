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
        factory = new LaunchpadV2Factory(feeRecipient, mockLocker, address(0), address(0));
        vm.deal(creator, 100 ether);
        vm.deal(buyer1, 100 ether);
    }

    function _launch() internal returns (address tokenAddress, address curveAddress) {
        vm.prank(creator);
        (tokenAddress, curveAddress) = factory.launchTokenV2{value: 0.0005 ether}(
            "V2 Curve Token",
            "CURVE",
            "ipfs://logo",
            "Token on Bonding Curve",
            "twitter.com/curve",
            "t.me/curve",
            "curve.io"
        );
    }

    function test_LaunchTokenV2AndCurveBuy() public {
        (address tokenAddress, address curveAddress) = _launch();

        assertNotEq(tokenAddress, address(0));
        assertNotEq(curveAddress, address(0));

        BondingCurve curve = BondingCurve(payable(curveAddress));
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));

        // Initial token allocations
        assertEq(token.balanceOf(curveAddress), 1_000_000_000 * 1e18);
        assertEq(curve.virtualEthReserve(), 3.0 ether);

        // Buyer1 purchases tokens from the curve after snipe tax window
        vm.warp(block.timestamp + 10);
        vm.startPrank(buyer1);
        (uint256 expectedTokens, uint256 expectedFee) = curve.getAmountOutBuy(0.5 ether);
        uint256 tokensReceived = curve.buy{value: 0.5 ether}(expectedTokens);
        vm.stopPrank();

        assertEq(tokensReceived, expectedTokens);
        assertEq(token.balanceOf(buyer1), tokensReceived);
        assertEq(feeRecipient.balance, 0.0005 ether + expectedFee);
    }
}
