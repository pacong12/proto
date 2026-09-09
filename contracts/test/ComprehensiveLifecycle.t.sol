// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";
import {LiquidityLocker} from "../src/LiquidityLocker.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {BuybackBurner} from "../src/BuybackBurner.sol";
import {HolderFeeDistributor} from "../src/HolderFeeDistributor.sol";
import {VestingVault} from "../src/VestingVault.sol";
import {ILaunchpadToken} from "../src/interfaces/ILaunchpadToken.sol";
import {
    MockWETH,
    MockUniswapV3Factory,
    MockPositionManager,
    MockSwapRouter
} from "./Mocks.sol";

/**
 * @title ComprehensiveLifecycleTest
 * @notice Complete end-to-end integration test verifying all protocol operations:
 * 1. Deploy V1 (Direct Uniswap V3 Pool + Permanent Lock)
 * 2. Deploy V2 (Bonding Curve Virtual Reserve)
 * 3. Test Buyback and Burn to 0x...dEaD
 * 4. Test Liquidity Lock invariant (Non-withdrawable)
 * 5. Test Linear Vesting Vault (unlock over time)
 * 6. Test Holder Fee Sharing (pro-rata dividends)
 */
contract ComprehensiveLifecycleTest is Test {
    LaunchpadFactory public factoryV1;
    LaunchpadV2Factory public factoryV2;
    LiquidityLocker public locker;
    BuybackBurner public burner;
    HolderFeeDistributor public feeDistributor;
    VestingVault public vestingVault;

    MockWETH public weth;
    MockUniswapV3Factory public v3Factory;
    MockPositionManager public positionManager;
    MockSwapRouter public swapRouter;

    address payable public protocolTreasury = payable(address(0x1111));
    address payable public creator = payable(address(0x2222));
    address public traderAlice = address(0x3333);
    address public traderBob = address(0x4444);

    function setUp() public {
        weth = new MockWETH();
        v3Factory = new MockUniswapV3Factory();
        positionManager = new MockPositionManager();
        swapRouter = new MockSwapRouter();

        // 1. Deploy Factory V1 & Liquidity Locker
        factoryV1 = new LaunchpadFactory(
            address(v3Factory),
            address(positionManager),
            address(swapRouter),
            address(weth),
            protocolTreasury
        );
        locker = LiquidityLocker(factoryV1.locker());

        // 2. Deploy Factory V2 (Bonding Curve)
        factoryV2 = new LaunchpadV2Factory(protocolTreasury, address(locker));

        // 3. Deploy Holder Fee Distributor & Vesting Vault
        feeDistributor = new HolderFeeDistributor(address(weth), address(locker));
        vestingVault = new VestingVault();

        // Fund accounts
        vm.deal(creator, 50 ether);
        vm.deal(traderAlice, 50 ether);
        vm.deal(traderBob, 50 ether);
        vm.deal(address(this), 50 ether);
    }

    // ==========================================
    // 1. TEST DEPLOY V1 (Direct Pool + Lock)
    // ==========================================
    function test_Complete_Deploy_V1() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials(
            "twitter.com/proto",
            "t.me/proto",
            "discord.gg/proto",
            "proto.family",
            ""
        );

        uint256 initialBuy = 0.5 ether;
        uint256 cost = factoryV1.launchFee() + initialBuy;

        vm.prank(creator);
        (address tokenAddress, address poolAddress) = factoryV1.launchToken{value: cost}(
            "Proto V1 Token",
            "PV1",
            "ipfs://pv1",
            "V1 Direct Uniswap Pool Token",
            socials,
            initialBuy
        );

        assertTrue(tokenAddress != address(0), "Token address zero");
        assertTrue(poolAddress != address(0), "Pool address zero");

        LaunchpadToken token = LaunchpadToken(tokenAddress);
        assertEq(token.totalSupply(), 1_000_000_000 * 1e18, "Total supply 1B");

        // Verify Lock: Position NFT is held by LiquidityLocker permanently
        uint256 positionId = locker.tokenPositions(tokenAddress);
        assertTrue(positionId > 0, "Position ID must be locked");
        assertEq(locker.tokenDeployers(tokenAddress), creator, "Creator mapped");
    }

    // ==========================================
    // 2. TEST DEPLOY V2 (Bonding Curve)
    // ==========================================
    function test_Complete_Deploy_V2_And_Trade() public {
        vm.startPrank(creator);
        (address tokenAddress, address curveAddress) = factoryV2.launchTokenV2{value: 0.0005 ether}(
            "Proto V2 Curve Token",
            "PV2",
            "ipfs://pv2",
            "V2 Bonding Curve Token",
            "x.com/pv2",
            "t.me/pv2",
            "proto.family"
        );
        vm.stopPrank();

        assertTrue(tokenAddress != address(0), "Token address zero");
        assertTrue(curveAddress != address(0), "Curve address zero");

        LaunchpadToken token = LaunchpadToken(tokenAddress);
        BondingCurve curve = BondingCurve(payable(curveAddress));

        // Entire 1B supply sits in BondingCurve contract
        assertEq(token.balanceOf(curveAddress), 1_000_000_000 * 1e18);

        // Advance 5 seconds so anti-snipe decaying tax reaches 0%
        vm.warp(block.timestamp + 5);

        // Trader Alice buys from curve
        vm.prank(traderAlice);
        uint256 tokensBought = curve.buy{value: 1 ether}(0);
        assertTrue(tokensBought > 0, "Alice bought tokens");
        assertEq(token.balanceOf(traderAlice), tokensBought, "Alice received tokens");

        // Trader Alice sells 50% back to curve
        uint256 sellAmount = tokensBought / 2;
        vm.startPrank(traderAlice);
        token.approve(curveAddress, sellAmount);
        uint256 ethReceived = curve.sell(sellAmount, 0);
        vm.stopPrank();

        assertTrue(ethReceived > 0, "Alice received ETH from selling back to curve");
    }

    // ==========================================
    // 3. TEST BURN (Buyback & Burn to 0x...dEaD)
    // ==========================================
    function test_Complete_Buyback_And_Burn() public {
        ILaunchpadToken.Socials memory s = ILaunchpadToken.Socials("", "", "", "", "");
        vm.prank(creator);
        (address tokenAddress, ) = factoryV1.launchToken{value: factoryV1.launchFee()}(
            "Burn Token",
            "BURN",
            "ipfs://burn",
            "Burnable Token",
            s,
            0
        );

        burner = new BuybackBurner(
            tokenAddress,
            address(weth),
            address(swapRouter)
        );
        // Fund swap router with target tokens so mock swap can deliver to 0x...dEaD
        vm.prank(address(positionManager));
        LaunchpadToken(tokenAddress).transfer(address(swapRouter), 5000 * 1e18);

        // Fund burner contract with 2 WETH
        weth.deposit{value: 2 ether}();
        weth.transfer(address(burner), 2 ether);

        // Execute Buyback & Burn
        uint256 burned = burner.executeBuyback(0);

        // Verify tokens were received at the burn address (0x...dEaD)
        assertEq(
            LaunchpadToken(tokenAddress).balanceOf(0x000000000000000000000000000000000000dEaD),
            burned,
            "Tokens arrived at burn address"
        );
    }

    // ==========================================
    // 4. TEST LOCK (Liquidity Locker Invariants)
    // ==========================================
    function test_Complete_Liquidity_Lock_Invariant() public {
        ILaunchpadToken.Socials memory s = ILaunchpadToken.Socials("", "", "", "", "");
        vm.prank(creator);
        (address tokenAddress, ) = factoryV1.launchToken{value: factoryV1.launchFee()}(
            "Lock Token",
            "LOCK",
            "ipfs://lock",
            "Locked Pool Token",
            s,
            0
        );

        uint256 positionId = locker.tokenPositions(tokenAddress);
        assertTrue(positionId > 0, "Position exists in locker");

        // Assert: Cannot lock the same token twice (reverts AlreadyLocked)
        vm.expectRevert(LiquidityLocker.AlreadyLocked.selector);
        vm.prank(address(factoryV1));
        locker.lockPosition(tokenAddress, 999, creator, 30);
    }

    // ==========================================
    // 5. TEST VESTING (Linear Vesting Schedule)
    // ==========================================
    function test_Complete_Linear_Vesting_Vault() public {
        ILaunchpadToken.Socials memory s = ILaunchpadToken.Socials("", "", "", "", "");
        LaunchpadToken token = new LaunchpadToken(
            "Vesting Token",
            "VEST",
            "ipfs://vest",
            "Vested Token",
            s,
            address(this),
            address(weth),
            address(this)
        );

        uint256 grant = 100_000 * 1e18;
        uint256 duration = 100 days;

        token.approve(address(vestingVault), grant);
        vestingVault.createVestingSchedule(address(token), traderAlice, grant, duration);

        // At day 0 -> 0 unlocked
        assertEq(vestingVault.getClaimableAmount(address(token), traderAlice), 0);

        // Advance 25 days -> 25% unlocked (25,000 VEST)
        vm.warp(block.timestamp + 25 days);
        assertEq(
            vestingVault.getClaimableAmount(address(token), traderAlice),
            25_000 * 1e18
        );

        // Alice claims 25,000 VEST
        vm.prank(traderAlice);
        vestingVault.claimVested(address(token));
        assertEq(token.balanceOf(traderAlice), 25_000 * 1e18);
        assertEq(vestingVault.getClaimableAmount(address(token), traderAlice), 0);
    }

    // ==========================================
    // 6. TEST HOLDER FEE SHARING (Pro-Rata Dividends)
    // ==========================================
    function test_Complete_Holder_Fee_Sharing() public {
        ILaunchpadToken.Socials memory s = ILaunchpadToken.Socials("", "", "", "", "");
        LaunchpadToken token = new LaunchpadToken(
            "Dividends Token",
            "DIV",
            "ipfs://div",
            "Dividend Token",
            s,
            address(this),
            address(weth),
            address(this)
        );

        // 700M (70%) to Alice, 300M (30%) to Bob
        token.transfer(traderAlice, 700_000_000 * 1e18);
        token.transfer(traderBob, 300_000_000 * 1e18);

        // Deposit 10 WETH rewards into HolderFeeDistributor
        weth.deposit{value: 10 ether}();
        weth.approve(address(feeDistributor), 10 ether);
        feeDistributor.depositRewards(address(token), 10 ether);

        // Alice (70%) earns 7 WETH, Bob (30%) earns 3 WETH
        assertEq(feeDistributor.earned(address(token), traderAlice), 7 ether);
        assertEq(feeDistributor.earned(address(token), traderBob), 3 ether);

        // Alice claims her 7 WETH
        vm.prank(traderAlice);
        feeDistributor.claimReward(address(token));
        assertEq(weth.balanceOf(traderAlice), 7 ether);
        assertEq(feeDistributor.earned(address(token), traderAlice), 0);
    }
}
