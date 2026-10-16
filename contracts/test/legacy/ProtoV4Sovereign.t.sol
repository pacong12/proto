// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProtoLiquidityLockerV4} from "../../src/legacy/ProtoLiquidityLockerV4.sol";
import {ProtoMemeHook} from "../../src/legacy/ProtoMemeHook.sol";
import {PoolKey, PoolIdLibrary, IPoolManager} from "../../src/interfaces/IUniswapV4.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {ILaunchpadToken} from "../../src/interfaces/ILaunchpadToken.sol";

contract ProtoV4SovereignTest is Test {
    using PoolIdLibrary for PoolKey;

    ProtoLiquidityLockerV4 public lockerV4;
    ProtoMemeHook public hook;
    LaunchpadToken public token;

    address public mockPositionManager = makeAddr("mockPositionManager");
    address public mockPoolManager = makeAddr("mockPoolManager");
    address public weth = makeAddr("weth");
    address payable public protocolTreasury = payable(makeAddr("protocolTreasury"));
    address public creator = makeAddr("creator");
    address public redirectUser = makeAddr("redirectUser");

    function setUp() public {
        vm.deal(creator, 10 ether);
        vm.deal(protocolTreasury, 10 ether);

        // 1. Deploy ProtoLiquidityLockerV4
        lockerV4 = new ProtoLiquidityLockerV4(mockPositionManager, weth, protocolTreasury);

        // 2. Deploy ProtoMemeHook
        hook = new ProtoMemeHook(mockPoolManager, protocolTreasury, address(0));

        // 3. Deploy Token
        token = new LaunchpadToken();
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: "x.com",
            telegram: "t.me",
            discord: "",
            website: "proto.fun",
            farcaster: ""
        });
        token.initialize("Proto Token", "PROTO", "logo", "desc", socials, creator, address(0), address(this));
    }

    function test_ProtoLiquidityLockerV4_LockAndInvariants() public {
        uint256 positionId = 42;
        lockerV4.lockPosition(address(token), positionId, creator, 30);

        assertTrue(lockerV4.isLocked(address(token)), "Position must be marked locked");
        assertEq(lockerV4.tokenPositions(address(token)), positionId);
        assertEq(lockerV4.tokenDeployers(address(token)), creator);
        assertEq(lockerV4.tokenProtocolFeeShares(address(token)), 30);

        // Cannot double lock
        vm.expectRevert(ProtoLiquidityLockerV4.AlreadyLocked.selector);
        lockerV4.lockPosition(address(token), 999, creator, 30);
    }

    function test_ProtoLiquidityLockerV4_FeeRedirectTimelock() public {
        lockerV4.lockPosition(address(token), 1, creator, 30);

        // Only deployer can propose redirect
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(ProtoLiquidityLockerV4.Unauthorized.selector);
        lockerV4.setFeeRedirect(address(token), redirectUser);

        // Deployer proposes redirect
        vm.prank(creator);
        lockerV4.setFeeRedirect(address(token), redirectUser);

        // Cannot accept before 48h
        vm.prank(creator);
        vm.expectRevert(ProtoLiquidityLockerV4.TimelockNotExpired.selector);
        lockerV4.acceptFeeRedirect(address(token));

        // Warp past timelock (48 hours + 1)
        vm.warp(block.timestamp + 48 hours + 1);

        vm.prank(creator);
        lockerV4.acceptFeeRedirect(address(token));

        assertEq(lockerV4.feeRedirects(address(token)), redirectUser);
    }

    function test_ProtoMemeHook_RegisterAndSweeper() public {
        hook.setFactory(address(this));

        PoolKey memory key = PoolKey({
            currency0: address(0),
            currency1: address(token),
            fee: 0,
            tickSpacing: 200,
            hooks: address(hook)
        });

        bytes32 poolId = key.toId();

        hook.registerPool(key, address(token), creator, address(lockerV4), 7000, 0);

        (address poolToken, address poolCreator, , uint16 creatorBps, , bool initialized) = hook.poolConfigs(poolId);
        assertEq(poolToken, address(token));
        assertEq(poolCreator, creator);
        assertEq(creatorBps, 7000);
        assertTrue(initialized);

        // Fund hook with ETH fee accumulation
        vm.deal(address(hook), 1 ether);
        // Set pending ETH via storage or mock simulate
        // Non-pool manager cannot call afterInitialize
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(ProtoMemeHook.Unauthorized.selector);
        hook.afterInitialize(address(this), key, 0, 0);

        // Only PoolManager can invoke afterInitialize
        vm.prank(mockPoolManager);
        bytes4 sel = hook.afterInitialize(address(this), key, 0, 0);
        assertEq(sel, hook.afterInitialize.selector);
    }
}
