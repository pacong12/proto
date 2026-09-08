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

    function test_AntiSnipeProtection() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");

        vm.prank(deployer);
        LaunchpadToken token = new LaunchpadToken(
            "Test Token",
            "TEST",
            "",
            "",
            socials,
            deployer,
            address(weth),
            deployer
        );

        address pool = address(0x5555);
        vm.prank(deployer);
        token.setLiquidityPool(pool);

        // Fund pool with supply
        vm.prank(deployer);
        token.transfer(pool, 500_000_000 * 10**18);

        // Block 0: Launch Block -> Only deployer can buy from pool
        vm.prank(pool);
        vm.expectRevert(LaunchpadToken.OnlyDeployerCanBuyAtLaunchBlock.selector);
        token.transfer(buyer1, 1000 * 10**18);

        // Deployer buy is allowed
        vm.prank(pool);
        token.transfer(deployer, 1000 * 10**18);

        // Block 1: Restrictions apply (Max buy 5.5%, Max wallet 5%)
        vm.roll(block.number + 1);

        // Try to buy 6% -> Revert MaxBuyExceeded
        uint256 sixPercent = 60_000_000 * 10**18;
        vm.prank(pool);
        vm.expectRevert(LaunchpadToken.MaxBuyExceeded.selector);
        token.transfer(buyer1, sixPercent);

        // Buy 4.5% -> Success
        uint256 fourPointFivePercent = 45_000_000 * 10**18;
        vm.prank(pool);
        token.transfer(buyer1, fourPointFivePercent);
        assertEq(token.balanceOf(buyer1), fourPointFivePercent);

        // Try to buy another 1% -> Total becomes 5.5% (> 5% max wallet) -> Revert MaxWalletExceeded
        uint256 onePercent = 10_000_000 * 10**18;
        vm.prank(pool);
        vm.expectRevert(LaunchpadToken.MaxWalletExceeded.selector);
        token.transfer(buyer1, onePercent);

        // Peer-to-peer transfer is NOT restricted
        vm.prank(buyer1);
        token.transfer(buyer2, 5_000_000 * 10**18);
        assertEq(token.balanceOf(buyer2), 5_000_000 * 10**18);

        // Selling back to pool is NOT restricted
        vm.prank(buyer1);
        token.transfer(pool, 10_000_000 * 10**18);

        // Block 3: Restrictions end
        vm.roll(block.number + 3);
        vm.prank(pool);
        token.transfer(buyer1, 100_000_000 * 10**18);
        assertGt(token.balanceOf(buyer1), token.MAX_HOLD_AMOUNT());
    }

    function test_AtomicLaunchToken() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: "https://x.com/protolaunch",
            telegram: "https://t.me/protolaunch",
            discord: "https://discord.gg/proto",
            website: "https://proto.fun",
            farcaster: "https://warpcast.com/proto"
        });

        uint256 launchFee = factory.launchFee();
        uint256 initialBuy = 0.05 ether;

        vm.prank(deployer);
        (address tokenAddress, address poolAddress) = factory.launchToken{
            value: launchFee + initialBuy
        }(
            "Proto Rocket",
            "ROCKET",
            "ipfs://RocketLogo",
            "First atomic launch token",
            socials,
            initialBuy
        );

        assertTrue(tokenAddress != address(0));
        assertTrue(poolAddress != address(0));

        ILaunchpadFactory.LaunchedToken memory tokenData = factory.getLaunchedToken(tokenAddress);
        assertTrue(tokenData.exists);
        assertEq(tokenData.deployer, deployer);
        assertEq(tokenData.pairedToken, address(weth));
        assertEq(tokenData.supply, 1_000_000_000 * 10**18);

        // Check locker has recorded position
        assertEq(locker.tokenPositions(tokenAddress), tokenData.positionId);
        assertEq(locker.tokenDeployers(tokenAddress), deployer);
        assertEq(locker.tokenProtocolFeeShares(tokenAddress), 30);
    }

    function test_FeeClaimAndSplitDistribution() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");
        uint256 fee = factory.launchFee();
        vm.prank(deployer);
        (address tokenAddress, ) = factory.launchToken{value: fee}(
            "Fee Test",
            "FEES",
            "",
            "",
            socials,
            0
        );

        // Fund positionManager with WETH so collect can return WETH fees
        weth.deposit{value: 10 ether}();
        weth.transfer(address(positionManager), 10 ether);
        uint256 protocolWethBefore = weth.balanceOf(protocolFeeRecipient);
        uint256 deployerWethBefore = weth.balanceOf(deployer);

        // Claim fees from locker
        (uint256 creatorTokenFee, uint256 creatorWethFee) = locker.claimFees(tokenAddress);

        assertGt(creatorTokenFee, 0);
        assertGt(creatorWethFee, 0);

        // Protocol got 30%, Creator got 70%
        assertEq(weth.balanceOf(protocolFeeRecipient) - protocolWethBefore, 0.3 ether);
        assertEq(weth.balanceOf(deployer) - deployerWethBefore, 0.7 ether);
    }

    function test_GraduationStatus() public {
        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials("", "", "", "", "");

        uint256 fee = factory.launchFee();
        vm.prank(deployer);
        (address tokenAddress, address poolAddress) = factory.launchToken{value: fee}(
            "Graduation Token",
            "GRAD",
            "",
            "",
            socials,
            0
        );

        (uint256 paired, uint256 threshold, bool graduated) = factory.graduationStatus(tokenAddress);
        assertEq(paired, 0);
        assertEq(threshold, 4.2 ether);
        assertFalse(graduated);

        // Deposit WETH to pool to reach graduation threshold
        weth.deposit{value: 5 ether}();
        weth.transfer(poolAddress, 5 ether);

        (paired, threshold, graduated) = factory.graduationStatus(tokenAddress);
        assertEq(paired, 5 ether);
        assertTrue(graduated);
    }
}
