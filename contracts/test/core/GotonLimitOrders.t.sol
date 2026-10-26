// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PoolKey} from "../../src/interfaces/external/IUniswapV4.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {GotonLimitOrders, IBondingCurveLO, IGotonV4RouterLO} from "../../src/core/GotonLimitOrders.sol";

contract LOToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract LOFactory {
    mapping(address => address) public curveToToken;

    function register(address curve, address token) external {
        curveToToken[curve] = token;
    }
}

/// @dev Constant-price curve: 1 wei of ETH buys `rate` token units; reserves set the spot price.
contract LOCurve {
    LOToken public immutable token;
    uint256 public rate;
    uint256 public virtualEthReserve = 1 ether;
    uint256 public virtualTokenReserve;

    constructor(LOToken _token, uint256 _rate) {
        token = _token;
        rate = _rate;
        virtualTokenReserve = _rate * 1 ether;
    }

    receive() external payable {}

    /// @dev 0 = the TWAP follows the spot price.
    uint256 public twapX36;

    function setRate(uint256 _rate) external {
        rate = _rate;
        virtualTokenReserve = _rate * 1 ether;
    }

    function setTwap(uint256 _twapX36) external {
        twapX36 = _twapX36;
    }

    function consultPriceX36() external view returns (uint256, uint32) {
        return (twapX36 != 0 ? twapX36 : (virtualEthReserve * 1e36) / virtualTokenReserve, 10 minutes);
    }

    function buyFor(address recipient, uint256) external payable returns (uint256 out) {
        out = msg.value * rate;
        token.mint(recipient, out);
    }

    function sell(uint256 tokenIn, uint256) external returns (uint256 ethOut) {
        token.transferFrom(msg.sender, address(this), tokenIn);
        ethOut = tokenIn / rate;
        (bool ok,) = msg.sender.call{value: ethOut}("");
        require(ok);
    }
}

/// @dev Router with a fixed rate and an optional cap on how much input it consumes (partial fill).
contract LORouter {
    LOToken public immutable token;
    uint256 public rate; // token units per quote unit
    uint256 public maxIn = type(uint256).max;

    constructor(LOToken _token, uint256 _rate) {
        token = _token;
        rate = _rate;
    }

    receive() external payable {}

    function setMaxIn(uint256 v) external {
        maxIn = v;
    }

    function swapExactIn(PoolKey calldata, bool zeroForOne, uint256 amountIn, uint256, address recipient, uint256)
        external
        payable
        returns (uint256 out)
    {
        uint256 used = amountIn < maxIn ? amountIn : maxIn;
        if (zeroForOne) {
            // quote (ETH, currency0) -> token
            out = used * rate;
            token.mint(recipient, out);
            if (used < amountIn) {
                (bool ok,) = msg.sender.call{value: amountIn - used}("");
                require(ok);
            }
        } else {
            token.transferFrom(msg.sender, address(this), used);
            out = used / rate;
            (bool ok,) = recipient.call{value: out}("");
            require(ok);
        }
    }
}

contract LOHook {
    int24 public tick;

    function setTick(int24 t) external {
        tick = t;
    }

    function consultTick(bytes32) external view returns (int24, uint32) {
        return (tick, 1800);
    }
}

contract GotonLimitOrdersTest is Test {
    LOToken token;
    LOFactory factory;
    LOCurve curve;
    LORouter router;
    LOHook hook;
    GotonLimitOrders lo;
    PoolKey key;

    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");
    uint64 deadline;

    uint256 constant RATE = 1_000_000; // tokens per wei

    /// @dev This test contract also acts as an executor and receives the fee.
    receive() external payable {}

    function setUp() public {
        token = new LOToken();
        factory = new LOFactory();
        curve = new LOCurve(token, RATE);
        factory.register(address(curve), address(token));
        router = new LORouter(token, RATE);
        hook = new LOHook();
        lo = new GotonLimitOrders(
            address(factory),
            IGotonV4RouterLO(address(router)),
            IPoolManagerV4(address(0x1)),
            address(hook),
            address(0),
            1
        );
        key = PoolKey(address(0), address(token), 10_000, 200, address(hook));
        deadline = uint64(block.timestamp + 1 days);
        vm.deal(alice, 100 ether);
        vm.deal(address(curve), 100 ether);
        vm.deal(address(router), 100 ether);
    }

    // --- buy ---------------------------------------------------------------

    function test_BuyFillsAtLimitAndPaysExecutor() public {
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(address(token), 900_000 ether, deadline);

        vm.prank(keeper);
        lo.executeBuyOnCurve(id, IBondingCurveLO(address(curve)));

        uint256 fee = 1 ether * 10 / 10_000;
        assertEq(token.balanceOf(alice), (1 ether - fee) * RATE, "tokens to the owner");
        assertEq(keeper.balance, fee, "0.1% to the executor");
        assertEq(address(lo).balance, 0, "nothing left in escrow");
        (address owner,,,,,,,) = lo.orders(id);
        assertEq(owner, address(0), "order closed");
    }

    function test_BuyWaitsUntilThePriceReachesTheLimit() public {
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(address(token), 1_500_000 ether, deadline);

        vm.expectRevert(GotonLimitOrders.InsufficientOutput.selector);
        lo.executeBuyOnCurve(id, IBondingCurveLO(address(curve)));

        curve.setRate(2_000_000); // price halves
        lo.executeBuyOnCurve(id, IBondingCurveLO(address(curve)));
        assertGt(token.balanceOf(alice), 1_500_000 ether);
    }

    function test_FakeCurveIsRejectedEvenIfItClaimsTheToken() public {
        LOCurve fake = new LOCurve(token, RATE * 2);
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(address(token), 1, deadline);
        vm.expectRevert(GotonLimitOrders.InvalidRoute.selector);
        lo.executeBuyOnCurve(id, IBondingCurveLO(address(fake)));
    }

    function test_BuyOnPoolRefundsAPartialFillToTheOwner() public {
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(address(token), 1, deadline);
        router.setMaxIn(0.4 ether);
        uint256 before = alice.balance;

        lo.executeBuyOnPool(id, key);

        uint256 fee = 1 ether * 10 / 10_000;
        assertEq(alice.balance - before, 1 ether - fee - 0.4 ether, "unused input refunded");
        assertEq(address(lo).balance, 0);
    }

    function test_PoolWithAnotherHookIsRejected() public {
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(address(token), 1, deadline);
        PoolKey memory bad = PoolKey(address(0), address(token), 10_000, 200, address(0xBAD));
        vm.expectRevert(GotonLimitOrders.InvalidRoute.selector);
        lo.executeBuyOnPool(id, bad);
    }

    // --- sell / take profit / stop loss --------------------------------------

    function _sellOrder(uint256 amount, uint256 tpMinOut, uint256 slPriceX36, uint256 slMinOut)
        internal
        returns (uint256 id)
    {
        token.mint(alice, amount);
        vm.startPrank(alice);
        token.approve(address(lo), amount);
        id = lo.createSellOrder(address(token), amount, tpMinOut, slPriceX36, slMinOut, deadline);
        vm.stopPrank();
    }

    function test_TakeProfitFillsAtTarget() public {
        uint256 id = _sellOrder(2_000_000 ether, 3 ether, 0, 0);

        vm.expectRevert(GotonLimitOrders.InsufficientOutput.selector);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.TakeProfit);

        curve.setRate(RATE / 2); // price doubles: 2 ETH out
        uint256 before = alice.balance;
        vm.prank(keeper);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.TakeProfit);
        assertEq(alice.balance - before, 4 ether - 4 ether * 10 / 10_000);
        assertEq(keeper.balance, 4 ether * 10 / 10_000);
    }

    function test_StopLossOnlyFiresBelowTheTrigger() public {
        // Spot = 1e36 / RATE (quote per token, x1e36). Trigger at half of it.
        uint256 spot = 1e36 / RATE;
        uint256 id = _sellOrder(1_000_000 ether, 0, spot / 2, 0.4 ether);

        vm.expectRevert(GotonLimitOrders.NotTriggered.selector);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);

        curve.setRate(RATE * 2); // price halves -> at the trigger
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);
        assertGt(alice.balance, 100 ether);
    }

    /// @dev A spot price pushed below the trigger (e.g. a sandwich) does not fire while the TWAP disagrees.
    function test_StopLossOnCurveNeedsTheTwapBelowTheTrigger() public {
        uint256 spot = 1e36 / RATE;
        uint256 id = _sellOrder(1_000_000 ether, 0, spot / 2, 0.4 ether);

        curve.setRate(RATE * 2); // spot at the trigger...
        curve.setTwap(spot); // ...but the price held above it until now
        vm.expectRevert(GotonLimitOrders.NotTriggered.selector);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);

        curve.setTwap(spot / 2); // the drop held long enough
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);
        assertGt(alice.balance, 100 ether);
    }

    function test_StopLossFloorHoldsInACrash() public {
        uint256 spot = 1e36 / RATE;
        uint256 id = _sellOrder(1_000_000 ether, 0, spot / 2, 0.45 ether);
        curve.setRate(RATE * 4); // price falls to a quarter: 0.25 ETH < 0.45 floor
        vm.expectRevert(GotonLimitOrders.InsufficientOutput.selector);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);
    }

    function test_OcoClosesAfterTheFirstLeg() public {
        uint256 spot = 1e36 / RATE;
        uint256 id = _sellOrder(1_000_000 ether, 3 ether, spot / 2, 0.4 ether);
        curve.setRate(RATE * 2);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.StopLoss);

        curve.setRate(RATE / 10);
        vm.expectRevert(GotonLimitOrders.UnknownOrder.selector);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.TakeProfit);
    }

    function test_StopLossOnlyOrderCannotBeDumpedThroughTheTakeProfitLeg() public {
        uint256 id = _sellOrder(1_000_000 ether, 0, 1e36 / RATE / 2, 0.4 ether);
        vm.expectRevert(GotonLimitOrders.InsufficientOutput.selector);
        lo.executeSellOnCurve(id, IBondingCurveLO(address(curve)), GotonLimitOrders.Leg.TakeProfit);
    }

    function test_PoolStopLossUsesTheTwap() public {
        // quote is currency0: the token price falls as the tick rises.
        uint256 trigger = lo.priceX36AtTick(1000, true);
        uint256 id = _sellOrder(1_000_000 ether, 0, trigger, 0.1 ether);

        hook.setTick(999);
        vm.expectRevert(GotonLimitOrders.NotTriggered.selector);
        lo.executeSellOnPool(id, key, GotonLimitOrders.Leg.StopLoss);

        hook.setTick(1001);
        lo.executeSellOnPool(id, key, GotonLimitOrders.Leg.StopLoss);
        assertEq(token.allowance(address(lo), address(router)), 0, "allowance cleared");
    }

    function test_PartialSellReturnsUnsoldTokens() public {
        uint256 id = _sellOrder(2_000_000 ether, 0.5 ether, 0, 0);
        router.setMaxIn(1_000_000 ether);
        lo.executeSellOnPool(id, key, GotonLimitOrders.Leg.TakeProfit);
        assertEq(token.balanceOf(alice), 1_000_000 ether, "unsold half returned");
        assertEq(token.balanceOf(address(lo)), 0);
    }

    // --- cancel / expiry -----------------------------------------------------

    function test_OnlyTheOwnerCancelsAndGetsEverythingBack() public {
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(address(token), 1, deadline);
        vm.expectRevert(GotonLimitOrders.NotOwner.selector);
        lo.cancel(id);

        uint256 before = alice.balance;
        vm.prank(alice);
        lo.cancel(id);
        assertEq(alice.balance - before, 1 ether);

        uint256 sid = _sellOrder(5 ether, 1, 0, 0);
        vm.prank(alice);
        lo.cancel(sid);
        assertEq(token.balanceOf(alice), 5 ether);
    }

    function test_ExpiredOrdersCannotFillButCanBeCancelled() public {
        vm.prank(alice);
        uint256 id = lo.createBuyOrder{value: 1 ether}(address(token), 1, deadline);
        vm.warp(deadline + 1);
        vm.expectRevert(GotonLimitOrders.Expired.selector);
        lo.executeBuyOnCurve(id, IBondingCurveLO(address(curve)));
        vm.prank(alice);
        lo.cancel(id);
    }

    function test_RejectsInvalidOrders() public {
        vm.startPrank(alice);
        vm.expectRevert(GotonLimitOrders.InvalidOrder.selector);
        lo.createBuyOrder{value: 0}(address(token), 1, deadline);
        vm.expectRevert(GotonLimitOrders.InvalidOrder.selector);
        lo.createBuyOrder{value: 1}(address(token), 1, uint64(block.timestamp));
        token.mint(alice, 10);
        token.approve(address(lo), 10);
        vm.expectRevert(GotonLimitOrders.InvalidOrder.selector);
        lo.createSellOrder(address(token), 10, 0, 0, 0, deadline); // no leg
        vm.expectRevert(GotonLimitOrders.InvalidOrder.selector);
        lo.createSellOrder(address(token), 10, 0, 1, 0, deadline); // stop without a floor
        vm.stopPrank();
    }

    // --- price math ----------------------------------------------------------

    function test_PriceAtTickZeroIsOne() public view {
        assertApproxEqRel(lo.priceX36AtTick(0, true), 1e36, 1e10);
        assertApproxEqRel(lo.priceX36AtTick(0, false), 1e36, 1e10);
    }

    function testFuzz_PriceDirectionFollowsTheQuoteSide(int24 a, int24 b) public view {
        a = int24(bound(a, -400_000, 400_000));
        b = int24(bound(b, -400_000, 400_000));
        vm.assume(a < b);
        // quote = currency0: higher tick, cheaper token. quote = currency1: higher tick, dearer token.
        assertGe(lo.priceX36AtTick(a, true), lo.priceX36AtTick(b, true));
        assertLe(lo.priceX36AtTick(a, false), lo.priceX36AtTick(b, false));
    }
}
