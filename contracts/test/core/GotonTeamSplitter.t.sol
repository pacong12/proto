// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GotonTeamSplitter, GotonTeamSplitterFactory} from "../../src/core/GotonTeamSplitter.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev USDT-style ERC-20 that returns nothing from transfer.
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }
}

contract RejectsEth {
    receive() external payable {
        revert("no");
    }
}

contract GotonTeamSplitterTest is Test {
    GotonTeamSplitterFactory factory;
    MockToken token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        factory = new GotonTeamSplitterFactory();
        token = new MockToken();
    }

    function _team(address[] memory p, uint16[] memory s) internal returns (GotonTeamSplitter) {
        return factory.create(p, s, bytes32(0));
    }

    function _three() internal returns (GotonTeamSplitter) {
        address[] memory p = new address[](3);
        (p[0], p[1], p[2]) = (alice, bob, carol);
        uint16[] memory s = new uint16[](3);
        (s[0], s[1], s[2]) = (5_000, 3_000, 2_000);
        return _team(p, s);
    }

    function test_SplitsNativeAndTokensByShare() public {
        GotonTeamSplitter team = _three();
        vm.deal(address(team), 10 ether);
        token.mint(address(team), 1_000e18);

        team.releaseAll(address(0));
        team.releaseAll(address(token));

        assertEq(alice.balance, 5 ether);
        assertEq(bob.balance, 3 ether);
        assertEq(carol.balance, 2 ether);
        assertEq(token.balanceOf(alice), 500e18);
        assertEq(token.balanceOf(bob), 300e18);
        assertEq(token.balanceOf(carol), 200e18);
    }

    function test_PayeesReleaseAtDifferentTimes() public {
        GotonTeamSplitter team = _three();
        vm.deal(address(team), 10 ether);
        team.release(address(0), alice); // 5 of the first 10
        vm.deal(address(team), address(team).balance + 10 ether); // 10 more arrive
        team.release(address(0), alice); // 5 of the next 10
        team.releaseAll(address(0));
        assertEq(alice.balance, 10 ether);
        assertEq(bob.balance, 6 ether);
        assertEq(carol.balance, 4 ether);
        assertEq(address(team).balance, 0);
    }

    function test_ReleasePaysThePayeeNotTheCaller() public {
        GotonTeamSplitter team = _three();
        vm.deal(address(team), 1 ether);
        vm.prank(makeAddr("stranger"));
        team.release(address(0), bob);
        assertEq(bob.balance, 0.3 ether);
    }

    function test_AcceptsTokensThatReturnNothing() public {
        GotonTeamSplitter team = _three();
        NoReturnToken usdt = new NoReturnToken();
        usdt.mint(address(team), 100);
        team.release(address(usdt), alice);
        assertEq(usdt.balanceOf(alice), 50);
    }

    function test_APayeeThatRejectsEthOnlyBlocksItself() public {
        address rejector = address(new RejectsEth());
        address[] memory p = new address[](2);
        (p[0], p[1]) = (rejector, alice);
        uint16[] memory s = new uint16[](2);
        (s[0], s[1]) = (5_000, 5_000);
        GotonTeamSplitter team = _team(p, s);
        vm.deal(address(team), 2 ether);
        vm.expectRevert(GotonTeamSplitter.TransferFailed.selector);
        team.release(address(0), rejector);
        team.release(address(0), alice);
        assertEq(alice.balance, 1 ether);
    }

    function test_RevertWhen_TeamIsInvalid() public {
        address[] memory p = new address[](2);
        uint16[] memory s = new uint16[](2);
        (p[0], p[1]) = (alice, bob);
        (s[0], s[1]) = (5_000, 4_000); // does not sum to 100%
        vm.expectRevert(GotonTeamSplitter.InvalidTeam.selector);
        _team(p, s);

        (p[0], p[1]) = (alice, alice); // duplicate
        (s[0], s[1]) = (5_000, 5_000);
        vm.expectRevert(GotonTeamSplitter.InvalidTeam.selector);
        _team(p, s);

        (p[0], p[1]) = (alice, address(0)); // zero address
        vm.expectRevert(GotonTeamSplitter.InvalidTeam.selector);
        _team(p, s);
    }

    function test_RevertWhen_NotAPayeeOrNothingDue() public {
        GotonTeamSplitter team = _three();
        vm.expectRevert(GotonTeamSplitter.NotPayee.selector);
        team.release(address(0), makeAddr("x"));
        vm.expectRevert(GotonTeamSplitter.NothingDue.selector);
        team.release(address(0), alice);
    }

    function test_PredictMatchesDeployment() public {
        address[] memory p = new address[](2);
        (p[0], p[1]) = (alice, bob);
        uint16[] memory s = new uint16[](2);
        (s[0], s[1]) = (6_000, 4_000);
        address predicted = factory.predict(p, s, bytes32("x"));
        assertEq(address(factory.create(p, s, bytes32("x"))), predicted);
        assertEq(GotonTeamSplitter(payable(predicted)).payees().length, 2);
    }

    /// Whatever arrives and in whatever order payees release, nobody is paid more than its share
    /// and the contract never pays out more than it received.
    function testFuzz_NeverOverpays(uint96 a, uint96 b, uint8 order) public {
        GotonTeamSplitter team = _three();
        vm.deal(address(team), a);
        if (order & 1 == 1 && team.releasable(address(0), alice) > 0) team.release(address(0), alice);
        vm.deal(address(team), address(team).balance + b);
        if (order & 2 == 2 && team.releasable(address(0), bob) > 0) team.release(address(0), bob);
        team.releaseAll(address(0));
        uint256 total = uint256(a) + b;
        assertLe(alice.balance, (total * 5_000) / 10_000);
        assertLe(bob.balance, (total * 3_000) / 10_000);
        assertLe(carol.balance, (total * 2_000) / 10_000);
        assertLe(alice.balance + bob.balance + carol.balance, total);
        assertLe(address(team).balance, 3); // only rounding dust stays
    }
}
