// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProtoFeeSplitter} from "../../src/core/ProtoFeeSplitter.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {ILaunchpadToken} from "../../src/interfaces/ILaunchpadToken.sol";

/// @dev Native-quote splitter driven directly by this test (acting as hook and factory).
contract ProtoFeeSplitterTest is Test {
    LaunchpadToken token;
    ProtoFeeSplitter splitter;

    address pool = makeAddr("poolManager");
    address payable treasury = payable(makeAddr("treasury"));
    address buyback = makeAddr("buyback");
    address liquidity = makeAddr("liquidity");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address community = makeAddr("community");

    function setUp() public {
        token = new LaunchpadToken();
        token.initialize("T", "T", "", "", ILaunchpadToken.Socials("", "", "", "", ""), creator, address(0), address(this));
        splitter = new ProtoFeeSplitter(
            ProtoFeeSplitter.Config({
                token: address(token),
                quoteAsset: address(0),
                hook: address(this),
                factory: address(this),
                poolManager: pool,
                excluded: address(0),
                treasury: treasury,
                buybackVault: buyback,
                liquidityVault: liquidity,
                creator: creator
            }),
            ProtoFeeSplitter.Split({protocolBps: 3_000, holdersBps: 5_000, burnBps: 1_000, creatorBps: 3_000, liquidityBps: 1_000})
        );
        token.setRewardTracker(address(splitter));

        // 80% of supply sits in the pool (non-circulating); alice and bob share the rest.
        uint256 supply = token.totalSupply();
        token.transfer(pool, (supply * 80) / 100);
        token.transfer(alice, (supply * 15) / 100);
        token.transfer(bob, (supply * 5) / 100);
    }

    function _distribute(uint256 amount) internal {
        vm.deal(address(this), amount);
        (bool ok,) = address(splitter).call{value: amount}("");
        require(ok);
        splitter.distributeFees(amount);
    }

    function test_SplitsProtocolFirstThenRemainder() public {
        _distribute(10 ether);
        assertEq(treasury.balance, 3 ether, "30% protocol");
        assertEq(splitter.buybackAccrued(), 0.7 ether, "10% of 7 ETH, held for the TWAP buyback");
        assertEq(buyback.balance, 0);
        assertEq(liquidity.balance, 0.7 ether, "10% of 7 ETH");
        assertEq(splitter.creatorAccrued(), 2.1 ether, "30% of 7 ETH, pulled later");
        assertEq(splitter.totalStreamed(), 3.5 ether, "50% of 7 ETH streams to holders");
    }

    function test_DividendsStreamProRataToCirculatingHolders() public {
        _distribute(10 ether);
        assertEq(splitter.claimable(alice), 0, "nothing at t=0");
        vm.warp(block.timestamp + 12 hours);
        assertApproxEqRel(splitter.claimable(alice), 3.5 ether * 75 / 100 / 2, 1e12);
        vm.warp(block.timestamp + 2 days);
        assertApproxEqRel(splitter.claimable(alice), 3.5 ether * 75 / 100, 1e12);
        assertApproxEqRel(splitter.claimable(bob), 3.5 ether * 25 / 100, 1e12);
        assertEq(splitter.claimable(pool), 0, "pool liquidity never earns");

        uint256 owed = splitter.claimable(alice);
        vm.prank(alice);
        splitter.claim(address(0));
        assertEq(alice.balance, owed);
        assertEq(splitter.claimable(alice), 0);
    }

    function test_LateBuyerEarnsOnlyWhileHolding() public {
        _distribute(10 ether);
        vm.warp(block.timestamp + 2 days); // stream fully paid out to alice and bob

        address late = makeAddr("late");
        uint256 aliceBalance = token.balanceOf(alice);
        vm.prank(alice);
        token.transfer(late, aliceBalance);
        assertEq(splitter.claimable(late), 0, "no share of the finished stream");
        assertApproxEqRel(splitter.claimable(alice), 3.5 ether * 75 / 100, 1e12, "seller keeps what it earned");
    }

    function test_CreatorFeesArePulledAndRedirectable() public {
        _distribute(10 ether);

        vm.prank(alice);
        vm.expectRevert(ProtoFeeSplitter.Unauthorized.selector);
        splitter.claimCreatorFees();

        vm.prank(creator);
        splitter.proposeCreatorRecipient(community);
        vm.expectRevert(ProtoFeeSplitter.TimelockActive.selector);
        vm.prank(community);
        splitter.acceptCreatorRecipient();

        vm.warp(block.timestamp + 48 hours);
        vm.prank(community);
        splitter.acceptCreatorRecipient();
        assertEq(splitter.creatorRecipient(), community);

        vm.prank(community);
        splitter.claimCreatorFees();
        assertEq(community.balance, 2.1 ether);
        assertEq(creator.balance, 0);
    }

    function test_CancelOnlyRemovesPendingRedirect() public {
        vm.prank(creator);
        vm.expectRevert(ProtoFeeSplitter.NoPendingRecipient.selector);
        splitter.cancelCreatorRecipient();

        vm.prank(creator);
        splitter.proposeCreatorRecipient(community);
        vm.prank(creator);
        splitter.cancelCreatorRecipient();
        assertEq(splitter.creatorRecipient(), creator);
    }

    function test_OnlyHookOrFactoryDistribute() public {
        vm.prank(alice);
        vm.expectRevert(ProtoFeeSplitter.Unauthorized.selector);
        splitter.distributeFees(1);
    }

    function test_OnlyTokenCheckpoints() public {
        vm.expectRevert(ProtoFeeSplitter.Unauthorized.selector);
        splitter.setShare(alice, bob, 1);
    }

    receive() external payable {}

    function test_OnlyBuybackVaultReleasesBurnShare() public {
        _distribute(10 ether);
        vm.prank(alice);
        vm.expectRevert(ProtoFeeSplitter.Unauthorized.selector);
        splitter.releaseBuyback();

        vm.prank(buyback);
        assertEq(splitter.releaseBuyback(), 0.7 ether);
        assertEq(buyback.balance, 0.7 ether);
        assertEq(splitter.buybackAccrued(), 0);
    }
}
