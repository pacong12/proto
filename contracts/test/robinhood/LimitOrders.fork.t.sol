// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {GotonLimitOrders, IBondingCurveLO, IGotonV4RouterLO} from "../../src/core/GotonLimitOrders.sol";

interface IERC20Fork {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function taxConfig() external view returns (uint16 buyTaxBps, uint16 sellTaxBps, address recipient);
}

interface ICurveQuote {
    function getAmountOutBuy(uint256 ethIn) external view returns (uint256 tokenOut, uint256 feeEth);
}

/**
 * Limit orders against the live Robinhood Chain factory and one of its bonding curves.
 * Run with: ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com forge test --match-path test/robinhood/LimitOrders.fork.t.sol
 */
contract RobinhoodLimitOrdersForkTest is Test {
    address constant FACTORY = 0x9f1fAf78adE92C994AB188452338b45c52800748;
    address constant TOKEN = 0x269952038d26a7822f57e4Dfa4dde23BEE642085;
    IBondingCurveLO constant CURVE = IBondingCurveLO(0xA15581279d5E82A7Fa6439704162528FEe2e917f);

    GotonLimitOrders lo;
    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");

    function setUp() public {
        string memory rpc = vm.envOr("ROBINHOOD_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        // No v4 pools are needed here; router and hook only have to be non-zero.
        lo = new GotonLimitOrders(
            FACTORY, IGotonV4RouterLO(address(0xdead)), IPoolManagerV4(address(0xdead)), address(0xdead), address(0), 1
        );
        vm.deal(alice, 10 ether);
    }

    function _spot() internal view returns (uint256) {
        return (CURVE.virtualEthReserve() * 1e36) / CURVE.virtualTokenReserve();
    }

    function test_LimitBuyThenTakeProfitOnTheLiveCurve() public {
        // Limit buy at (slightly worse than) the current price fills right away. The floor is what
        // the owner receives: curve quote for the amount after the executor fee, minus the token's
        // creator buy tax (10% on this token), minus 1%.
        uint256 amount = 0.01 ether;
        (uint256 quoted,) = ICurveQuote(address(CURVE)).getAmountOutBuy(amount - amount * 10 / 10_000);
        (uint16 buyTax,,) = IERC20Fork(TOKEN).taxConfig();
        uint256 expected = (quoted * (10_000 - buyTax)) / 10_000;
        vm.prank(alice);
        uint256 buyId = lo.createBuyOrder{value: amount}(TOKEN, (expected * 99) / 100, uint64(block.timestamp + 1 days));
        vm.prank(keeper);
        lo.executeBuyOnCurve(buyId, CURVE);
        uint256 bought = IERC20Fork(TOKEN).balanceOf(alice);
        assertGe(bought, (expected * 99) / 100, "bought at the limit or better");
        assertEq(keeper.balance, amount * 10 / 10_000, "executor fee");

        // Take profit at 2x the entry does not fill now.
        vm.startPrank(alice);
        IERC20Fork(TOKEN).approve(address(lo), bought);
        uint256 sellId = lo.createSellOrder(TOKEN, bought, amount * 2, 0, 0, uint64(block.timestamp + 1 days));
        vm.stopPrank();
        vm.expectRevert(GotonLimitOrders.InsufficientOutput.selector);
        lo.executeSellOnCurve(sellId, CURVE, GotonLimitOrders.Leg.TakeProfit);

        // The owner can always take the tokens back.
        vm.prank(alice);
        lo.cancel(sellId);
        assertEq(IERC20Fork(TOKEN).balanceOf(alice), bought);
    }

    function test_StopLossTriggersOnTheLiveCurveSpotPrice() public {
        vm.prank(alice);
        uint256 buyId = lo.createBuyOrder{value: 0.01 ether}(TOKEN, 1, uint64(block.timestamp + 1 days));
        lo.executeBuyOnCurve(buyId, CURVE);
        uint256 bought = IERC20Fork(TOKEN).balanceOf(alice);

        // Stop at the current spot: already triggered, floor well below what the curve pays.
        uint256 stop = _spot();
        vm.startPrank(alice);
        IERC20Fork(TOKEN).approve(address(lo), bought);
        uint256 id = lo.createSellOrder(TOKEN, bought, 0, stop, 0.005 ether, uint64(block.timestamp + 1 days));
        vm.stopPrank();

        uint256 before = alice.balance;
        lo.executeSellOnCurve(id, CURVE, GotonLimitOrders.Leg.StopLoss);
        assertGt(alice.balance - before, 0.005 ether, "sold above the stop floor");
        assertEq(IERC20Fork(TOKEN).balanceOf(address(lo)), 0, "nothing left in escrow");
    }

    receive() external payable {}
}
