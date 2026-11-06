// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {LaunchpadV2FactoryArc} from "../../src/chains/arc/LaunchpadV2FactoryArc.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonFeeSplitter, GotonFeeSplitterDeployer} from "../../src/core/GotonFeeSplitter.sol";
import {GotonV4Router} from "../../src/core/GotonV4Router.sol";
import {GotonV4Buyback} from "../../src/core/GotonV4Buyback.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {PoolKey} from "../../src/interfaces/IUniswapV4.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {TickMath} from "../../src/libraries/v4/TickMath.sol";
import {V4Lib} from "../../src/libraries/v4/V4Lib.sol";

interface IERC20Full {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

/// @dev Arc routes USDC ERC-20 transfers through a native precompile at 0x1800… that revm does
///      not implement. This stand-in moves native balance (18 decimals) exactly like the chain.
contract MockArcNativeTransferPrecompile {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function transfer(address from, address to, uint256 amount) external returns (bool) {
        require(from.balance >= amount, "native balance");
        VM.deal(from, from.balance - amount);
        VM.deal(to, to.balance + amount);
        return true;
    }
}

/// @dev Stand-in for Arc's USDC blocklist precompile at 0x1800…01 (nobody is blocklisted).
contract MockArcBlocklistPrecompile {
    function isBlocklisted(address) external pure returns (bool) {
        return false;
    }
}

/**
 * Fork tests against Arc mainnet's real Uniswap v4 PoolManager, USDC, Permit2 and Universal Router.
 * Trader swaps go through GotonV4Router (buys paid with native USDC msg.value).
 * Run with: ARC_RPC_URL=https://rpc.mainnet.arc.io forge test --match-path test/arc/ArcV4Launch.fork.t.sol
 */
contract ArcV4LaunchForkTest is Test {
    IPoolManagerV4 constant PM = IPoolManagerV4(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant UNIVERSAL_ROUTER = 0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1;
    address constant NATIVE_PRECOMPILE = 0x1800000000000000000000000000000000000000;
    address constant BLOCKLIST_PRECOMPILE = 0x1800000000000000000000000000000000000001;
    address constant HOOK_ADDRESS = 0xC0fFEE00000000000000000000000000000020cc;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    LaunchpadV2FactoryArc factory;
    GotonV4Hook hook;
    GotonV4Router router;
    address payable treasury = payable(makeAddr("treasury"));
    address buyback = makeAddr("buyback");
    address liquidityVault = makeAddr("liquidityVault");
    address creator = makeAddr("creator");
    address trader = makeAddr("trader");

    function setUp() public virtual {
        string memory rpc = vm.envOr("ARC_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        vm.etch(NATIVE_PRECOMPILE, type(MockArcNativeTransferPrecompile).runtimeCode);
        vm.allowCheatcodes(NATIVE_PRECOMPILE);
        vm.etch(BLOCKLIST_PRECOMPILE, type(MockArcBlocklistPrecompile).runtimeCode);

        deployCodeTo("GotonV4Hook.sol:GotonV4Hook", abi.encode(PM, address(this)), HOOK_ADDRESS);
        hook = GotonV4Hook(HOOK_ADDRESS);
        factory = new LaunchpadV2FactoryArc(PM, USDC, hook, new GotonFeeSplitterDeployer(), treasury);
        hook.setFactory(address(factory));
        factory.setRecipients(treasury, buyback, liquidityVault);
        router = new GotonV4Router(PM, USDC, 1e12);

        vm.deal(creator, 100_000 ether);
        vm.deal(trader, 100_000 ether);
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    function _meta() internal pure returns (LaunchpadV2FactoryArc.TokenMetadata memory) {
        return LaunchpadV2FactoryArc.TokenMetadata("Proto Arc", "PARC", "ipfs://logo", "desc", "", "", "");
    }

    /// @dev IDEA-like split: 1%/1% tax, remainder 80% holders / 10% burn / 10% liquidity.
    function _tax() internal pure returns (LaunchpadV2FactoryArc.TaxConfig memory) {
        return LaunchpadV2FactoryArc.TaxConfig(100, 100, 8_000, 1_000, 0, 1_000);
    }

    function _launch(address who, uint256 prebuyWei) internal returns (address token, bytes32 poolId) {
        vm.prank(who);
        return factory.launchToken{value: prebuyWei}(_meta(), _tax(), 0);
    }

    function _usdc(address a) internal view returns (uint256) {
        return IERC20Full(USDC).balanceOf(a);
    }

    /// @dev Buy paid with native USDC (msg.value, 18 decimals) through GotonV4Router.
    function _buy(address token, uint256 usdc6) internal returns (uint256) {
        return _buyAs(trader, token, usdc6);
    }

    function _buyAs(address who, address token, uint256 usdc6) internal returns (uint256) {
        PoolKey memory key = factory.poolKeyOf(token);
        vm.prank(who);
        return router.swapExactIn{value: usdc6 * 1e12}(key, key.currency0 == USDC, usdc6, 0, who, block.timestamp);
    }

    /// @dev Sell with an exact token approval to the router.
    function _sell(address token, uint256 amount) internal returns (uint256) {
        return _sellAs(trader, token, amount);
    }

    function _sellAs(address who, address token, uint256 amount) internal returns (uint256 out) {
        PoolKey memory key = factory.poolKeyOf(token);
        vm.startPrank(who);
        LaunchpadToken(token).approve(address(router), amount);
        out = router.swapExactIn(key, key.currency0 != USDC, amount, 0, who, block.timestamp);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------------
    // Launch
    // ---------------------------------------------------------------------------

    /// @dev Finds a creator whose next token sorts after (or before) USDC.
    function _creatorWithOrder(bool tokenAfterUsdc) internal returns (address who) {
        for (uint256 i = 0; i < 200; i++) {
            who = address(uint160(uint256(keccak256(abi.encode("creator", i)))));
            if ((factory.predictTokenAddress(who, factory.nextNonce()) > USDC) == tokenAfterUsdc) {
                vm.deal(who, 1_000 ether);
                return who;
            }
        }
        revert("no candidate");
    }

    function test_LaunchCreatesLockedPoolAndPrebuys() public {
        creator = _creatorWithOrder(true);
        uint256 treasuryBefore = _usdc(treasury);
        (address token, bytes32 poolId) = _launch(creator, 4.5 ether);
        LaunchpadToken t = LaunchpadToken(token);
        assertGt(uint160(token), uint160(USDC));

        (uint160 sqrtP, int24 tick) = V4Lib.getSlot0(PM, poolId);
        assertGt(sqrtP, 0, "pool initialized");
        assertLt(tick, 405_400, "prebuy moved price up from the opening tick");
        assertGt(tick, 405_300);

        uint256 creatorTokens = t.balanceOf(creator);
        // Argus $GOLDETTF: 4.50 USDC at tick 405400 with no fee on the prebuy bought 1,810,687 tokens.
        // Proto charges 1% tax + 1% LP fee: 1,810,687 * 4.41 / 4.5 ~= 1,774,473 -> same liquidity curve.
        assertGt(creatorTokens, 1_770_000 ether);
        assertLt(creatorTokens, 1_780_000 ether);
        assertEq(t.balanceOf(address(factory)), 0, "factory keeps nothing");
        assertEq(t.balanceOf(address(PM)) + creatorTokens + t.balanceOf(DEAD), t.totalSupply());

        // 1% buy tax = 45,000 units: 30% protocol, then 10% burn / 10% liquidity of the remaining 31,500.
        // Shares are booked during the swap and released to their vaults afterwards.
        GotonFeeSplitter launchSplitter = GotonFeeSplitter(_splitter(token));
        assertEq(launchSplitter.protocolAccrued(), 13_500, "protocol cut booked");
        assertEq(_usdc(treasury), treasuryBefore, "nothing pushed during the swap");
        launchSplitter.releaseProtocolFees();
        launchSplitter.releaseLiquidityFees();
        assertEq(_usdc(treasury) - treasuryBefore, 13_500, "protocol cut");
        assertEq(launchSplitter.buybackAccrued(), 3_150, "burn share held for buyback");
        assertEq(_usdc(liquidityVault), 3_150, "liquidity share");
        assertEq(GotonFeeSplitter(_splitter(token)).totalStreamed(), 45_000 - 13_500 - 3_150 - 3_150, "holders");
        assertTrue(hook.bonded(poolId));
        assertEq(factory.getLaunchCount(), 1);
    }

    function test_LaunchWhenTokenSortsBeforeUsdc() public {
        address who = _creatorWithOrder(false);

        (address token, bytes32 poolId) = _launch(who, 10 ether);
        assertLt(uint160(token), uint160(USDC));
        (, int24 tick) = V4Lib.getSlot0(PM, poolId);
        assertGt(tick, -405_400, "price rose from the mirrored opening tick");
        assertGt(LaunchpadToken(token).balanceOf(who), 0);

        vm.warp(block.timestamp + 10);
        uint256 got = _buy(token, 100e6);
        assertGt(got, 0);
        assertGt(_sell(token, got / 2), 0);
    }

    function test_RevertWhen_PrebuyBelowMinimum() public {
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.InvalidPrebuy.selector);
        factory.launchToken{value: 4.49 ether}(_meta(), _tax(), 0);
    }

    function test_RevertWhen_PrebuyNotWholeUsdcUnit() public {
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.InvalidPrebuy.selector);
        factory.launchToken{value: 4.5 ether + 1}(_meta(), _tax(), 0);
    }

    function test_RevertWhen_DevBuyAboveFivePercent() public {
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.DevBuyTooLarge.selector);
        factory.launchToken{value: 1_000 ether}(_meta(), _tax(), 0);
    }

    function test_RevertWhen_TaxInvalid() public {
        LaunchpadV2FactoryArc.TaxConfig memory tax = _tax();
        tax.buyTaxBps = 1_001;
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.InvalidTax.selector);
        factory.launchToken{value: 4.5 ether}(_meta(), tax, 0);

        tax = LaunchpadV2FactoryArc.TaxConfig(0, 0, 10_000, 0, 0, 0);
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.InvalidTax.selector);
        factory.launchToken{value: 4.5 ether}(_meta(), tax, 0);

        tax = LaunchpadV2FactoryArc.TaxConfig(100, 100, 5_000, 0, 0, 0);
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.InvalidTax.selector);
        factory.launchToken{value: 4.5 ether}(_meta(), tax, 0);
    }

    function test_OnlyFactoryCanInitializePoolsWithHook() public {
        PoolKey memory key =
            PoolKey(USDC, address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF), 10_000, 200, address(hook));
        vm.expectRevert();
        IPoolManagerV4(PM).initialize(key, TickMath.getSqrtPriceAtTick(405_400));
    }

    // ---------------------------------------------------------------------------
    // Trading, tax & dividends
    // ---------------------------------------------------------------------------

    function test_BuyAndSellChargeUsdcTaxAndPayHolders() public {
        (address token,) = _launch(creator, 4.5 ether);
        GotonFeeSplitter splitter = GotonFeeSplitter(_splitter(token));
        vm.warp(block.timestamp + 10);
        splitter.releaseProtocolFees(); // the prebuy's share, so only this trade is measured

        uint256 treasuryBefore = _usdc(treasury);
        uint256 bought = _buy(token, 100e6); // 1 USDC tax
        assertGt(bought, 0);
        // 1 USDC tax: 30% protocol, then 10% burn / 10% liquidity / 80% holders of the remaining 0.7.
        splitter.releaseProtocolFees();
        assertEq(_usdc(treasury) - treasuryBefore, 300_000);
        uint256 claimableNow = splitter.claimable(creator);
        vm.warp(block.timestamp + 1 days);
        assertGt(splitter.claimable(creator), claimableNow * 100, "dividends stream over a day, not instantly");

        uint256 usdcBefore = _usdc(trader);
        uint256 out = _sell(token, bought);
        assertEq(_usdc(trader) - usdcBefore, out);
        assertLt(out, 100e6, "round trip pays taxes and LP fees");
        assertGt(out, 95e6);

        uint256 owed = splitter.claimable(creator);
        vm.prank(creator);
        assertEq(splitter.claim(address(0)), owed);
        assertEq(splitter.claimable(creator), 0);
        assertEq(splitter.claimable(address(PM)), 0, "pool liquidity never earns");
    }

    /// @dev The Robinhood dividend scenario on Arc: holders earn in proportion to their balance,
    ///      a seller stops earning, a buyer who leaves in the same block earns nothing, and every
    ///      claim pays exactly what was owed, in USDC.
    function test_DividendsFollowHoldingsStopAfterSellingAndPayInUsdc() public {
        // 1% tax; after the protocol cut: holders 60%, burn 20%, creator 20%.
        vm.prank(creator);
        (address token,) = factory.launchToken{value: 4.5 ether}(
            _meta(), LaunchpadV2FactoryArc.TaxConfig(100, 100, 6_000, 2_000, 2_000, 0), 0
        );
        GotonFeeSplitter splitter = GotonFeeSplitter(_splitter(token));
        vm.warp(block.timestamp + 10); // past the anti-snipe tax

        address a = makeAddr("holderA");
        address b = makeAddr("holderB");
        address c = makeAddr("holderC");
        address flash = makeAddr("flashBuyer");
        for (uint256 i = 0; i < 4; i++) {
            vm.deal([a, b, c, flash][i], 10_000 ether);
        }
        _buyAs(a, token, 200e6);
        _buyAs(b, token, 100e6);
        _buyAs(c, token, 50e6);

        // Pool volume: the 1% buy and sell tax streams to holders over a day.
        for (uint256 i = 0; i < 20; i++) {
            uint256 got = _buy(token, 50e6);
            _sell(token, got);
        }

        vm.warp(block.timestamp + 12 hours);
        _sellAs(b, token, LaunchpadToken(token).balanceOf(b));
        uint256 bAtSale = splitter.claimable(b);
        _sellAs(flash, token, _buyAs(flash, token, 300e6));
        vm.warp(block.timestamp + 12 hours + 60);

        uint256 owedA = splitter.claimable(a);
        uint256 owedC = splitter.claimable(c);
        assertGt(bAtSale, 0, "B earned while holding");
        assertEq(splitter.claimable(b), bAtSale, "B stops earning once sold out");
        assertEq(splitter.claimable(flash), 0, "a same-block round trip earns nothing");
        // A and C held throughout: dividends in the ratio of their balances.
        uint256 balA = LaunchpadToken(token).balanceOf(a);
        uint256 balC = LaunchpadToken(token).balanceOf(c);
        assertApproxEqRel(owedA * balC, owedC * balA, 1e12, "A/C dividends = A/C balances");

        address[3] memory holders = [a, b, c];
        uint256[3] memory owed = [owedA, bAtSale, owedC];
        for (uint256 i = 0; i < 3; i++) {
            uint256 before = _usdc(holders[i]);
            vm.prank(holders[i]);
            assertEq(splitter.claim(holders[i]), owed[i]);
            assertEq(_usdc(holders[i]) - before, owed[i], "paid in USDC");
            assertEq(splitter.claimable(holders[i]), 0);
            vm.prank(holders[i]);
            assertEq(splitter.claim(holders[i]), 0, "a second claim pays nothing");
        }

        uint256 creatorOwed = splitter.creatorAccrued();
        assertGt(creatorOwed, 0);
        vm.prank(a);
        vm.expectRevert();
        splitter.claimCreatorFees();
        uint256 creatorBefore = _usdc(creator);
        vm.prank(creator);
        splitter.claimCreatorFees();
        assertEq(_usdc(creator) - creatorBefore, creatorOwed, "creator paid in USDC");
    }

    function test_AntiSnipeTaxAppliesToTradersAtLaunch() public {
        (address token, bytes32 poolId) = _launch(creator, 4.5 ether);
        assertEq(hook.currentTaxBps(poolId, true), 9_900);
        uint256 got = _buy(token, 100e6);

        vm.warp(block.timestamp + 10);
        assertEq(hook.currentTaxBps(poolId, true), 100);
        uint256 later = _buy(token, 100e6);
        assertGt(later, got * 50, "99% snipe tax at t=0");
    }

    function test_GraduatesInPlaceAroundFortyFiveThousandFdv() public {
        creator = _creatorWithOrder(true);
        (address token, bytes32 poolId) = _launch(creator, 4.5 ether);
        vm.warp(block.timestamp + 10);
        _buy(token, 5_000e6);
        assertTrue(hook.bonded(poolId), "below bond tick");
        _buy(token, 5_000e6);
        assertFalse(hook.bonded(poolId), "crossed bond tick 376400");
        (, int24 tick) = V4Lib.getSlot0(PM, poolId);
        assertLe(tick, 376_400);

        // Trading continues in the same pool after graduation.
        assertGt(_sell(token, LaunchpadToken(token).balanceOf(trader) / 10), 0);
    }

    function test_CollectFeesDistributesUsdcAndBurnsTokens() public {
        (address token,) = _launch(creator, 4.5 ether);
        vm.warp(block.timestamp + 10);
        uint256 bought = _buy(token, 1_000e6);
        _sell(token, bought / 2);

        uint256 burnedBefore = LaunchpadToken(token).balanceOf(DEAD);
        (uint256 quoteFees, uint256 tokenFees) = factory.collectFees(token);
        assertGt(quoteFees, 9e6, "~1% LP fee on the buy");
        assertGt(tokenFees, 0, "LP fee on the sell");
        assertEq(LaunchpadToken(token).balanceOf(DEAD) - burnedBefore, tokenFees);
    }

    // ---------------------------------------------------------------------------
    // Universal Router (frontend path)
    // ---------------------------------------------------------------------------

    /// @dev Layout of the Universal Router deployed on Arc (decoded from a live swap, tx
    ///      0x0044c8a8…da34): an extra uint256 price-limit word precedes hookData (0 = none).
    struct ExactInputSingleParams {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        uint256 priceLimit;
        bytes hookData;
    }

    function test_BuyThroughUniversalRouterWithPermit2() public {
        (address token,) = _launch(creator, 4.5 ether);
        vm.warp(block.timestamp + 10);
        PoolKey memory key = factory.poolKeyOf(token);
        bool zeroForOne = key.currency0 == USDC;
        uint128 amountIn = 50e6;

        vm.startPrank(trader);
        IERC20Full(USDC).approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(USDC, UNIVERSAL_ROUTER, type(uint160).max, uint48(block.timestamp + 1 days));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(ExactInputSingleParams(key, zeroForOne, amountIn, 1, 0, ""));
        params[1] = abi.encode(USDC, uint256(amountIn)); // SETTLE_ALL
        params[2] = abi.encode(token, uint256(1)); // TAKE_ALL
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(abi.encodePacked(uint8(0x06), uint8(0x0c), uint8(0x0f)), params);

        uint256 usdcBefore = _usdc(trader);
        IUniversalRouter(UNIVERSAL_ROUTER).execute(abi.encodePacked(uint8(0x10)), inputs, block.timestamp + 60);
        vm.stopPrank();

        assertEq(usdcBefore - _usdc(trader), amountIn);
        assertGt(LaunchpadToken(token).balanceOf(trader), 0);
    }

    function _splitter(address token) internal view returns (address payable) {
        (, address splitter,,,) = factory.launches(token);
        return payable(splitter);
    }

    function test_RouterBuyWithErc20Approval() public {
        (address token,) = _launch(creator, 4.5 ether);
        vm.warp(block.timestamp + 10);
        PoolKey memory key = factory.poolKeyOf(token);
        vm.startPrank(trader);
        IERC20Full(USDC).approve(address(router), 25e6);
        uint256 usdcBefore = _usdc(trader);
        uint256 out = router.swapExactIn(key, key.currency0 == USDC, 25e6, 1, trader, block.timestamp);
        vm.stopPrank();
        assertEq(usdcBefore - _usdc(trader), 25e6);
        assertEq(LaunchpadToken(token).balanceOf(trader), out);
        assertEq(_usdc(address(router)), 0, "router keeps nothing");
    }

    function test_RouterRejectsWrongValue() public {
        (address token,) = _launch(creator, 4.5 ether);
        PoolKey memory key = factory.poolKeyOf(token);
        vm.prank(trader);
        vm.expectRevert(GotonV4Router.InvalidValue.selector);
        router.swapExactIn{value: 1 ether}(key, key.currency0 == USDC, 2e6, 0, trader, block.timestamp);
    }

    function test_CreatorSharePulledByCreator() public {
        LaunchpadV2FactoryArc.TaxConfig memory tax = LaunchpadV2FactoryArc.TaxConfig(500, 500, 0, 0, 10_000, 0);
        vm.prank(creator);
        (address token,) = factory.launchToken{value: 4.5 ether}(_meta(), tax, 0);
        GotonFeeSplitter splitter = GotonFeeSplitter(_splitter(token));
        vm.warp(block.timestamp + 10);
        _buy(token, 100e6); // 5 USDC tax: 30% protocol, 70% creator

        uint256 accrued = splitter.creatorAccrued();
        assertEq(accrued, 157_500 + 3_500_000, "70% of prebuy tax (225,000) + trade tax (5,000,000)");
        vm.prank(trader);
        vm.expectRevert(GotonFeeSplitter.Unauthorized.selector);
        splitter.claimCreatorFees();
        uint256 before = _usdc(creator);
        vm.prank(creator);
        splitter.claimCreatorFees();
        assertEq(_usdc(creator) - before, accrued);
    }

    // ---------------------------------------------------------------------------
    // TWAP-guarded buyback (AUD-HIGH-05 / TKT-06)
    // ---------------------------------------------------------------------------

    /// @dev Launch with a burn share routed to a real GotonV4Buyback, then build oracle history.
    function _launchWithBuyback() internal returns (address token, PoolKey memory key, GotonV4Buyback bb) {
        bb = new GotonV4Buyback(PM, hook);
        factory.setRecipients(treasury, address(bb), liquidityVault);
        creator = _creatorWithOrder(true);
        vm.prank(creator);
        (token,) = factory.launchToken{value: 4.5 ether}(
            _meta(), LaunchpadV2FactoryArc.TaxConfig(500, 500, 0, 5_000, 5_000, 0), 0
        );
        key = factory.poolKeyOf(token);
    }

    /// @dev Buys spread over time, then a quiet oracle period closed by a tiny swap, so the TWAP
    ///      window covers a stable price (the guard rightly refuses to buy right after a pump).
    function _tradeOverTime(address token) internal {
        // vm.getBlockTimestamp(): with via-ir, block.timestamp is cached inside a function.
        for (uint256 i; i < 3; i++) {
            vm.warp(vm.getBlockTimestamp() + 31 minutes);
            _buy(token, 200e6);
        }
        vm.warp(vm.getBlockTimestamp() + 31 minutes);
        _buy(token, 1e6);
        vm.warp(vm.getBlockTimestamp() + 1 minutes);
    }

    function test_BuybackNeedsOracleHistory() public {
        (, PoolKey memory key, GotonV4Buyback bb) = _launchWithBuyback();
        vm.expectRevert(GotonV4Hook.OracleNotReady.selector);
        bb.buyback(key);
    }

    function test_BuybackBurnsTokensWithinTwapGuard() public {
        (address token, PoolKey memory key, GotonV4Buyback bb) = _launchWithBuyback();
        _tradeOverTime(token);
        uint256 accrued = GotonFeeSplitter(_splitter(token)).buybackAccrued();
        assertGt(accrued, 0);

        uint256 deadBefore = LaunchpadToken(token).balanceOf(DEAD);
        vm.prank(makeAddr("keeper"));
        (uint256 spent, uint256 burned) = bb.buyback(key);
        assertEq(spent, accrued, "small buyback fills completely inside the guard");
        assertGt(burned, 0);
        assertEq(LaunchpadToken(token).balanceOf(DEAD) - deadBefore, burned);
        assertEq(bb.pending(token), 0);
        assertEq(_usdc(address(bb)), 0);
    }

    function test_BuybackSkipsManipulatedPrice() public {
        (address token, PoolKey memory key, GotonV4Buyback bb) = _launchWithBuyback();
        _tradeOverTime(token);
        // Attacker pumps the price in the same block, hoping the buyback buys the top.
        vm.deal(trader, 1_000_000 ether);
        _buy(token, 20_000e6);

        (uint256 spent, uint256 burned) = bb.buyback(key);
        assertEq(spent, 0, "spot is beyond TWAP + 2%: nothing bought");
        assertEq(burned, 0);
        assertGt(bb.pending(token), 0, "funds kept for a later, fair buyback");
    }
}
