// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestGraduator} from "../utils/TestGraduator.sol";
import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {BondingCurve} from "../../src/core/BondingCurve.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {GotonTeamSplitter, GotonTeamSplitterFactory} from "../../src/core/GotonTeamSplitter.sol";

/// A team splitter as a Robinhood token's tax recipient: the tax lands in the splitter and each
/// team member releases its share.
contract TeamTaxRecipientTest is Test {
    LaunchpadV2Factory factory;
    GotonTeamSplitterFactory teams;
    address creator = makeAddr("creator");
    address teammate = makeAddr("teammate");
    address buyer = makeAddr("buyer");

    function setUp() public {
        factory =
            new LaunchpadV2Factory(payable(makeAddr("treasury")), TestGraduator.deploy(payable(makeAddr("treasury"))));
        teams = new GotonTeamSplitterFactory();
        vm.deal(creator, 10 ether);
        vm.deal(buyer, 10 ether);
    }

    function test_TaxGoesToTheTeamAndSplits() public {
        address[] memory payees = new address[](2);
        (payees[0], payees[1]) = (creator, teammate);
        uint16[] memory shares = new uint16[](2);
        (shares[0], shares[1]) = (7_000, 3_000);
        address predicted = teams.predict(payees, shares, bytes32(0));

        vm.startPrank(creator);
        (address tokenAddress, address curveAddress) =
            factory.launchTokenV2{value: 0.0005 ether}("Team", "TEAM", "", "", "", "", "", 0);
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));
        // The splitter does not need to exist yet: the tax recipient is just an address.
        token.setInitialTaxConfig(500, 500, predicted);
        vm.stopPrank();
        teams.create(payees, shares, bytes32(0));

        vm.roll(block.number + 1); // public buys open after the launch block
        vm.prank(buyer);
        BondingCurve(payable(curveAddress)).buy{value: 1 ether}(0);

        uint256 taxed = token.balanceOf(predicted);
        assertGt(taxed, 0, "buy tax reached the team");
        GotonTeamSplitter(payable(predicted)).releaseAll(tokenAddress);
        assertEq(token.balanceOf(creator), (taxed * 7_000) / 10_000);
        assertEq(token.balanceOf(teammate), (taxed * 3_000) / 10_000);
    }
}
