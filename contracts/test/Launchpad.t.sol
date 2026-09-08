// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {LiquidityLocker} from "../src/LiquidityLocker.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {ILaunchpadToken} from "../src/interfaces/ILaunchpadToken.sol";
import {ILaunchpadFactory} from "../src/interfaces/ILaunchpadFactory.sol";
import {
    MockWETH,
    MockUniswapV3Factory,
    MockPositionManager,
    MockSwapRouter
} from "./Mocks.sol";

contract LaunchpadTest is Test {
    MockWETH public weth;
    MockUniswapV3Factory public v3Factory;
    MockPositionManager public positionManager;
    MockSwapRouter public swapRouter;
    LaunchpadFactory public factory;
    LiquidityLocker public locker;

    address public deployer = address(0x1111);
    address public buyer1 = address(0x2222);
    address public buyer2 = address(0x3333);
    address public protocolFeeRecipient = address(0x9999);

    function setUp() public {
        weth = new MockWETH();
        v3Factory = new MockUniswapV3Factory();
        positionManager = new MockPositionManager();
        swapRouter = new MockSwapRouter();

        vm.deal(deployer, 100 ether);
        vm.deal(buyer1, 100 ether);
        vm.deal(buyer2, 100 ether);

        factory = new LaunchpadFactory(
            address(v3Factory),
            address(positionManager),
            address(swapRouter),
            address(weth),
            protocolFeeRecipient
        );

        locker = LiquidityLocker(factory.locker());
    }

    function test_TokenMetadataAndFixedSupply() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: "https://x.com/protolaunch",
            telegram: "https://t.me/protolaunch",
            discord: "https://discord.gg/proto",
            website: "https://proto.fun",
            farcaster: "https://warpcast.com/proto"
        });

        vm.prank(deployer);
        LaunchpadToken token = new LaunchpadToken(
            "Proto Token",
            "PROTO",
            "ipfs://QmLogoHash",
            "Institutional launchpad token",
            socials,
            deployer,
            address(weth),
            deployer
        );

        assertEq(token.name(), "Proto Token");
        assertEq(token.symbol(), "PROTO");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000_000 * 10**18);
        assertEq(token.balanceOf(deployer), 1_000_000_000 * 10**18);
        assertEq(token.logo(), "ipfs://QmLogoHash");
        assertEq(token.description(), "Institutional launchpad token");
        assertEq(token.deployer(), deployer);
        assertEq(token.pairedToken(), address(weth));

        (
            string memory tw,
            string memory tg,
            string memory dc,
            string memory web,
            string memory fc
        ) = token.socials();
        assertEq(tw, "https://x.com/protolaunch");
        assertEq(tg, "https://t.me/protolaunch");
        assertEq(dc, "https://discord.gg/proto");
        assertEq(web, "https://proto.fun");
        assertEq(fc, "https://warpcast.com/proto");
    }

    function test_TokenCreatorTaxes() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");

        vm.prank(deployer);
        LaunchpadToken token = new LaunchpadToken(
            "Tax Token",
            "TAX",
            "ipfs://tax",
            "Token with creator buy/sell taxes",
            socials,
            deployer,
            address(weth),
            deployer
        );

        address taxRecipient = address(0x5555);
        address mockPool = address(0x6666);

        // Configure 5% buy tax (500 bps) and 10% sell tax (1000 bps)
        vm.prank(deployer);
        token.setTaxConfig(500, 1000, taxRecipient);

        vm.prank(deployer);
        token.setLiquidityPool(mockPool);

        (uint16 buyBps, uint16 sellBps, address recipient) = token.taxConfig();
        assertEq(buyBps, 500);
        assertEq(sellBps, 1000);
        assertEq(recipient, taxRecipient);

        // Transfer some tokens to mock pool and forward past anti-snipe block
        vm.prank(deployer);
        token.transfer(mockPool, 10_000_000 * 10**18);

        vm.roll(block.number + 5);

        // 1. Test Buy Tax (from mockPool to buyer1): 5% tax should be deducted
        uint256 buyAmount = 100_000 * 10**18;
        vm.prank(mockPool);
        token.transfer(buyer1, buyAmount);

        uint256 expectedTax = (buyAmount * 500) / 10000;
        uint256 expectedReceived = buyAmount - expectedTax;

        assertEq(token.balanceOf(taxRecipient), expectedTax);
        assertEq(token.balanceOf(buyer1), expectedReceived);

        // 2. Test Sell Tax (from buyer1 to mockPool): 10% tax should be deducted
        uint256 sellAmount = 50_000 * 10**18;
        vm.prank(buyer1);
        token.transfer(mockPool, sellAmount);

        uint256 expectedSellTax = (sellAmount * 1000) / 10000;
        assertEq(token.balanceOf(taxRecipient), expectedTax + expectedSellTax);
    }

    function test_AntiSnipeProtection() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");

        vm.prank(deployer);
        LaunchpadToken token = new LaunchpadToken(
            "AntiSnipe",
            "SNIPE",
            "ipfs://snipe",
            "Anti-snipe test",
            socials,
            deployer,
            address(weth),
            deployer
        );

        address mockPool = address(0x9999);
        vm.prank(deployer);
        token.setLiquidityPool(mockPool);

        // Fund mock pool with 200M tokens
        vm.prank(deployer);
        token.transfer(mockPool, 200_000_000 * 10**18);

        // Block 0 (launchBlock): Only deployer can buy from pool
        vm.prank(mockPool);
        vm.expectRevert(LaunchpadToken.OnlyDeployerCanBuyAtLaunchBlock.selector);
        token.transfer(buyer1, 1_000 * 10**18);

        // Deployer can buy at launch block
        vm.prank(mockPool);
        token.transfer(deployer, 1_000 * 10**18);

        // Block 1 (launchBlock + 1): Max buy is 5.5% (55M), Max wallet is 5% (50M)
        vm.roll(block.number + 1);

        // Exceed max wallet: 51M tokens (> 50M max wallet)
        vm.prank(mockPool);
        vm.expectRevert(LaunchpadToken.MaxWalletExceeded.selector);
        token.transfer(buyer1, 51_000_000 * 10**18);

        // Valid buy within limits: 40M tokens
        vm.prank(mockPool);
        token.transfer(buyer1, 40_000_000 * 10**18);
        assertEq(token.balanceOf(buyer1), 40_000_000 * 10**18);

        // Second buy exceeding max wallet cumulative: +15M = 55M > 50M
        vm.prank(mockPool);
        vm.expectRevert(LaunchpadToken.MaxWalletExceeded.selector);
        token.transfer(buyer1, 15_000_000 * 10**18);

        // Block 3 (restrictionsEndBlock + 1): All restrictions lifted
        vm.roll(block.number + 2);
        vm.prank(mockPool);
        token.transfer(buyer2, 60_000_000 * 10**18);
        assertEq(token.balanceOf(buyer2), 60_000_000 * 10**18);
    }

    function test_AtomicLaunchToken() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: "https://x.com/atomic",
            telegram: "https://t.me/atomic",
            discord: "",
            website: "https://atomic.fun",
            farcaster: ""
        });

        uint256 initialBuyEth = 0.5 ether;
        uint256 totalCost = factory.launchFee() + initialBuyEth;

        vm.prank(deployer);
        (address tokenAddress, address poolAddress) = factory.launchToken{value: totalCost}(
            "Atomic Token",
            "ATOMIC",
            "ipfs://atomicLogo",
            "Atomic launch test token",
            socials,
            initialBuyEth
        );

        assertTrue(tokenAddress != address(0));
        assertTrue(poolAddress != address(0));

        ILaunchpadFactory.LaunchedToken memory launchData = factory.getLaunchedToken(tokenAddress);
        assertTrue(launchData.exists);
        assertEq(launchData.token, tokenAddress);
        assertEq(launchData.deployer, deployer);
        assertEq(launchData.initialBuyAmount, initialBuyEth);
        assertEq(launchData.supply, 1_000_000_000 * 10**18);

        // Liquidity locker verification
        assertEq(locker.tokenPositions(tokenAddress), launchData.positionId);
        assertEq(locker.tokenDeployers(tokenAddress), deployer);
    }

    function test_GraduationStatus() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");

        vm.deal(deployer, 10 ether);
        vm.prank(deployer);
        (address tokenAddress, address poolAddress) = factory.launchToken{value: factory.launchFee()}(
            "Graduation Token",
            "GRAD",
            "ipfs://grad",
            "Graduation test",
            socials,
            0
        );

        (uint256 paired, uint256 threshold, bool graduated) = factory.graduationStatus(tokenAddress);
        assertEq(paired, 0);
        assertEq(threshold, 4.2 ether);
        assertFalse(graduated);

        // Simulate trades pairing 5 WETH into the pool (> 4.2 ETH threshold)
        weth.deposit{value: 5 ether}();
        weth.transfer(poolAddress, 5 ether);

        (paired, threshold, graduated) = factory.graduationStatus(tokenAddress);
        assertEq(paired, 5 ether);
        assertTrue(graduated);
    }

    function test_FeeClaimAndSplitDistribution() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");

        vm.deal(deployer, 10 ether);
        vm.startPrank(deployer);
        (address tokenAddress, ) = factory.launchToken{value: factory.launchFee()}(
            "Fee Token",
            "FEE",
            "ipfs://fee",
            "Fee description",
            socials,
            0
        );
        address creatorFeeRecipient = address(0x8888);
        locker.setFeeRedirect(tokenAddress, creatorFeeRecipient);

        // Fund positionManager with 1 WETH so mock collect transfer succeeds
        weth.deposit{value: 1 ether}();
        weth.transfer(address(positionManager), 1 ether);

        uint256 prevProtocolBal = weth.balanceOf(protocolFeeRecipient);
        (uint256 creatorTokenFee, uint256 creatorWethFee) = locker.claimFees(tokenAddress);
        vm.stopPrank();
        assertEq(creatorTokenFee, 700 * 10**18);
        assertEq(creatorWethFee, 0.7 ether);
        assertEq(weth.balanceOf(protocolFeeRecipient) - prevProtocolBal, 0.3 ether);
        assertEq(weth.balanceOf(creatorFeeRecipient), 0.7 ether);
    }
}
