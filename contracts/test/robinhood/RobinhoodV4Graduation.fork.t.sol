// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {BondingCurve} from "../../src/core/BondingCurve.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonV4Graduator} from "../../src/core/GotonV4Graduator.sol";
import {GotonV4Router} from "../../src/core/GotonV4Router.sol";
import {GotonV4Buyback} from "../../src/core/GotonV4Buyback.sol";
import {GotonFeeSplitter, GotonFeeSplitterDeployer} from "../../src/core/GotonFeeSplitter.sol";
import {PoolKey, PoolIdLibrary} from "../../src/interfaces/IUniswapV4.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {V4Lib} from "../../src/libraries/v4/V4Lib.sol";

/**
 * Fork tests against Robinhood Chain's real Uniswap v4 PoolManager (same bytecode as Arc).
 * Run with: ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com \
 *           forge test --match-path test/robinhood/RobinhoodV4Graduation.fork.t.sol
 */
contract RobinhoodV4GraduationForkTest is Test {
    using PoolIdLibrary for PoolKey;

    IPoolManagerV4 constant PM = IPoolManagerV4(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    address constant HOOK_ADDRESS = 0xC0fFEE00000000000000000000000000000020cc;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    LaunchpadV2Factory factory;
    GotonV4Graduator graduator;
    GotonV4Hook hook;
    GotonV4Router router;

    address payable treasury = payable(makeAddr("treasury"));
    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");
    address trader = makeAddr("trader");
    address keeper = makeAddr("keeper");

    function setUp() public {
        string memory rpc = vm.envOr("ROBINHOOD_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);

        deployCodeTo("GotonV4Hook.sol:GotonV4Hook", abi.encode(PM, address(this)), HOOK_ADDRESS);
        hook = GotonV4Hook(HOOK_ADDRESS);
        // 30% protocol, then 50% holders / 50% creator so dividend streaming is exercised.
        graduator = new GotonV4Graduator(
            PM,
            hook,
            new GotonFeeSplitterDeployer(),
            treasury,
            GotonFeeSplitter.Split({protocolBps: 3_000, holdersBps: 5_000, burnBps: 0, creatorBps: 5_000, liquidityBps: 0})
        );
        factory = new LaunchpadV2Factory(treasury, graduator);
        graduator.setLauncher(address(factory));
        hook.setFactory(address(graduator));
        router = new GotonV4Router(PM, address(0), 0);

        vm.deal(creator, 100 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(trader, 100 ether);
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    function _launch() internal returns (address token, BondingCurve curve) {
        vm.prank(creator);
        (address t, address c) =
            factory.launchTokenV2{value: 0.0005 ether + 0.1 ether}("Grad", "GRAD", "", "", "", "", "", 0);
        return (t, BondingCurve(payable(c)));
    }

    /// @dev Buys on the curve until it graduates (past anti-snipe blocks / seconds).
    function _fillCurve(BondingCurve curve) internal {
        vm.roll(block.number + 3);
        vm.warp(block.timestamp + 10);
        vm.startPrank(buyer);
        for (uint256 i; i < 40 && !curve.graduated(); i++) {
            curve.buy{value: 0.25 ether}(0);
        }
        vm.stopPrank();
        assertTrue(curve.graduated(), "curve graduated");
    }

    function _splitter(address token) internal view returns (GotonFeeSplitter) {
        (address s,,) = graduator.graduations(token);
        return GotonFeeSplitter(payable(s));
    }

    function _buy(address token, uint256 ethIn) internal returns (uint256) {
        PoolKey memory key = graduator.poolKeyOf(token);
        vm.prank(trader);
        return router.swapExactIn{value: ethIn}(key, true, ethIn, 0, trader, block.timestamp);
    }

    function _sell(address who, address token, uint256 amount) internal returns (uint256) {
        PoolKey memory key = graduator.poolKeyOf(token);
        vm.startPrank(who);
        LaunchpadToken(token).approve(address(router), amount);
        uint256 out = router.swapExactIn(key, false, amount, 0, who, block.timestamp);
        vm.stopPrank();
        return out;
    }

    // ---------------------------------------------------------------------------
    // Graduation
    // ---------------------------------------------------------------------------

    /// @dev The curve -> graduator transfer must not pay the creator's buy tax.
    function test_GraduationDoesNotPayCreatorBuyTax() public {
        (address token, BondingCurve curve) = _launch();
        address taxWallet = makeAddr("taxWallet");
        vm.prank(creator);
        LaunchpadToken(token).setInitialTaxConfig(1_000, 1_000, taxWallet);
        _fillCurve(curve);
        uint256 taxBefore = LaunchpadToken(token).balanceOf(taxWallet);
        uint256 pmTokensBefore = LaunchpadToken(token).balanceOf(address(PM));
        uint256 curveTokens = LaunchpadToken(token).balanceOf(address(curve));

        factory.graduate(token);

        assertEq(LaunchpadToken(token).balanceOf(taxWallet), taxBefore, "no tax on migration");
        assertEq(LaunchpadToken(token).liquidityPool(), address(0), "curve detached");
        assertApproxEqAbs(
            LaunchpadToken(token).balanceOf(address(PM)) - pmTokensBefore,
            curveTokens,
            curveTokens / 1e9,
            "every curve token reaches the pool"
        );
    }

    /// @dev A pause stops new money, but never the only exit of a graduated curve.
    function test_GraduationWorksWhilePaused() public {
        (address token, BondingCurve curve) = _launch();
        _fillCurve(curve);
        factory.pause();
        factory.graduate(token);
        assertTrue(curve.migrationExecuted());
    }

    function test_GraduationIsPermissionlessAndLocksAllLiquidity() public {
        (address token, BondingCurve curve) = _launch();
        vm.expectRevert(LaunchpadV2Factory.NotGraduated.selector);
        factory.graduate(token);

        _fillCurve(curve);
        uint256 curveEth = address(curve).balance;
        uint256 curveTokens = LaunchpadToken(token).balanceOf(address(curve));
        uint160 expectedSqrtPrice = curve.graduationSqrtPriceX96();
        uint256 pmEthBefore = address(PM).balance;
        uint256 pmTokensBefore = LaunchpadToken(token).balanceOf(address(PM));

        vm.prank(keeper); // anyone can graduate
        (bytes32 poolId, address splitter) = factory.graduate(token);

        assertEq(poolId, curve.graduatedPoolId(), "curve announced the same pool");
        assertEq(address(curve).balance, 0);
        assertEq(LaunchpadToken(token).balanceOf(address(curve)), 0);
        assertEq(address(graduator).balance, 0, "graduator keeps no ETH");
        assertEq(LaunchpadToken(token).balanceOf(address(graduator)), 0, "graduator keeps no tokens");

        uint256 ethToPool = address(PM).balance - pmEthBefore;
        uint256 tokensToPool = LaunchpadToken(token).balanceOf(address(PM)) - pmTokensBefore;
        assertApproxEqAbs(ethToPool, curveEth, 1e6, "all curve ETH is pool liquidity");
        assertApproxEqRel(tokensToPool, curveTokens, 1e9, "all curve tokens are pool liquidity, none burned");

        (uint160 sqrtPrice,) = V4Lib.getSlot0(PM, poolId);
        assertEq(sqrtPrice, expectedSqrtPrice, "pool opens at the curve's final price");
        assertEq(LaunchpadToken(token).rewardTracker(), splitter);
        (,,,, bool graduated) = factory.launches(token);
        assertTrue(graduated);

        vm.expectRevert(BondingCurve.MigrationAlreadyExecuted.selector);
        factory.emergencyWithdrawFromCurve(address(curve), treasury); // owner cannot touch migrated funds
    }

    function test_PoolInitializationCannotBeFrontRun() public {
        (address token,) = _launch();
        PoolKey memory key = graduator.poolKeyOf(token);
        vm.expectRevert();
        PM.initialize(key, 79228162514264337593543950336);
    }

    function test_PriceIsContinuousAcrossGraduation() public {
        (address token, BondingCurve curve) = _launch();
        _fillCurve(curve);
        uint256 curveSpot = (curve.virtualEthReserve() * 1e18) / curve.virtualTokenReserve(); // wei per token
        factory.graduate(token);

        uint256 ethIn = 0.001 ether;
        uint256 tokensOut = _buy(token, ethIn);
        uint256 poolPrice = (ethIn * 1e18) / tokensOut;
        // 1% pool fee, no tax: effective price within ~1.2% of the curve's final spot price.
        assertApproxEqRel(poolPrice, curveSpot, 0.012e18);
    }

    // ---------------------------------------------------------------------------
    // Trading & fees
    // ---------------------------------------------------------------------------

    function test_TradeCollectFeesAndClaim() public {
        (address token, BondingCurve curve) = _launch();
        _fillCurve(curve);
        factory.graduate(token);
        GotonFeeSplitter splitter = _splitter(token);

        uint256 bought = _buy(token, 1 ether);
        assertGt(_sell(trader, token, bought / 2), 0);

        uint256 treasuryBefore = treasury.balance;
        (uint256 ethFees, uint256 tokenFees) = graduator.collectFees(token);
        assertApproxEqRel(ethFees, 0.01 ether, 0.05e18, "~1% LP fee on the 1 ETH buy");
        assertGt(tokenFees, 0, "LP fee on the sell, burned");
        splitter.releaseProtocolFees();
        assertEq(treasury.balance - treasuryBefore, ethFees * 3_000 / 10_000, "protocol 30%");

        uint256 rest = ethFees - ethFees * 3_000 / 10_000;
        assertEq(splitter.creatorAccrued(), rest / 2);
        uint256 creatorBefore = creator.balance;
        vm.prank(creator);
        splitter.claimCreatorFees();
        assertEq(creator.balance - creatorBefore, rest / 2);

        // Holders (buyer holds most of the circulating supply) earn as the stream runs.
        vm.warp(block.timestamp + 1 days);
        uint256 owed = splitter.claimable(buyer);
        assertGt(owed, 0);
        uint256 buyerBefore = buyer.balance;
        vm.prank(buyer);
        splitter.claim(address(0));
        assertEq(buyer.balance - buyerBefore, owed);
    }

    function test_FlashHolderCannotCaptureCollectedFees() public {
        (address token, BondingCurve curve) = _launch();
        _fillCurve(curve);
        factory.graduate(token);
        GotonFeeSplitter splitter = _splitter(token);

        _buy(token, 2 ether);
        vm.warp(block.timestamp + 2 days); // fees from that trade have accrued in the position

        // Attacker: buy a large stake, trigger fee collection, sell — all at the same timestamp.
        address attacker = makeAddr("attacker");
        vm.deal(attacker, 50 ether);
        PoolKey memory key = graduator.poolKeyOf(token);
        vm.prank(attacker);
        uint256 stake = router.swapExactIn{value: 20 ether}(key, true, 20 ether, 0, attacker, block.timestamp);
        graduator.collectFees(token);
        _sell(attacker, token, stake);

        assertLe(splitter.claimable(attacker), 1, "nothing streamed while the attacker held");
    }

    function test_RouterRefusesWrongValue() public {
        (address token, BondingCurve curve) = _launch();
        _fillCurve(curve);
        factory.graduate(token);
        PoolKey memory key = graduator.poolKeyOf(token);
        vm.prank(trader);
        vm.expectRevert(GotonV4Router.InvalidValue.selector);
        router.swapExactIn{value: 1 ether}(key, true, 2 ether, 0, trader, block.timestamp);
    }

    // ---------------------------------------------------------------------------
    // Per-token revenue split
    // ---------------------------------------------------------------------------

    function test_CreatorSplitIsUsedAtGraduation() public {
        (address token, BondingCurve curve) = _launch();
        vm.prank(creator);
        graduator.setRevenueSplit(token, 2_000, 1_000, 6_000, 1_000);

        _fillCurve(curve);
        factory.graduate(token);
        GotonFeeSplitter splitter = _splitter(token);
        assertEq(splitter.protocolBps(), 3_000, "protocol cut stays the default");
        assertEq(splitter.holdersBps(), 2_000);
        assertEq(splitter.burnBps(), 1_000);
        assertEq(splitter.creatorBps(), 6_000);
        assertEq(splitter.liquidityBps(), 1_000);
    }

    function test_SplitOnlyByCreatorOnceAndBeforePublicTrading() public {
        (address token, BondingCurve curve) = _launch();

        vm.prank(buyer);
        vm.expectRevert(GotonV4Graduator.Unauthorized.selector);
        graduator.setRevenueSplit(token, 0, 0, 10_000, 0);

        vm.prank(creator);
        vm.expectRevert(GotonV4Graduator.InvalidSplit.selector);
        graduator.setRevenueSplit(token, 5_000, 0, 4_000, 0);

        vm.prank(creator);
        graduator.setRevenueSplit(token, 5_000, 0, 5_000, 0);
        vm.prank(creator);
        vm.expectRevert(GotonV4Graduator.SplitLocked.selector);
        graduator.setRevenueSplit(token, 0, 0, 10_000, 0);

        // A fresh token whose curve already sold to a third party is locked too.
        (address token2, BondingCurve curve2) = _launch();
        vm.roll(block.number + 3);
        vm.warp(block.timestamp + 10);
        vm.prank(buyer);
        curve2.buy{value: 0.01 ether}(0);
        vm.prank(creator);
        vm.expectRevert(GotonV4Graduator.SplitLocked.selector);
        graduator.setRevenueSplit(token2, 0, 0, 10_000, 0);
        curve;
    }

    // ---------------------------------------------------------------------------
    // TWAP-guarded buyback with native ETH
    // ---------------------------------------------------------------------------

    function test_BuybackBurnsWithNativeEth() public {
        GotonV4Buyback bb = new GotonV4Buyback(PM, hook);
        graduator.setRecipients(treasury, address(bb), treasury);

        (address token, BondingCurve curve) = _launch();
        vm.prank(creator);
        graduator.setRevenueSplit(token, 0, 5_000, 5_000, 0);
        _fillCurve(curve);
        factory.graduate(token);
        PoolKey memory key = graduator.poolKeyOf(token);

        for (uint256 i; i < 3; i++) {
            vm.warp(vm.getBlockTimestamp() + 31 minutes);
            _buy(token, 0.2 ether);
        }
        vm.warp(vm.getBlockTimestamp() + 31 minutes);
        _buy(token, 0.0001 ether);
        vm.warp(vm.getBlockTimestamp() + 1 minutes);

        graduator.collectFees(token); // LP fees → splitter → burn share accrues
        GotonFeeSplitter splitter = _splitter(token);
        uint256 accrued = splitter.buybackAccrued();
        assertGt(accrued, 0);

        uint256 deadBefore = LaunchpadToken(token).balanceOf(DEAD);
        (uint256 spent, uint256 burned) = bb.buyback(key);
        assertEq(spent, accrued);
        assertGt(burned, 0);
        assertEq(LaunchpadToken(token).balanceOf(DEAD) - deadBefore, burned);
        assertEq(address(bb).balance, 0);
    }
}
