// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GotonFeeSplitter} from "../../src/core/GotonFeeSplitter.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {ILaunchpadToken} from "../../src/interfaces/ILaunchpadToken.sol";

/// @dev Drives the splitter with random fee deposits, holder transfers, time and claims.
contract SplitterHandler is Test {
    GotonFeeSplitter public splitter;
    LaunchpadToken public token;
    address[] public holders;
    uint256 public totalDeposited;
    uint256 public totalClaimed;

    /// Wired after deployment: the splitter's immutable hook must be this handler's address.
    function init(GotonFeeSplitter _splitter, LaunchpadToken _token, address[] memory _holders) external {
        require(address(splitter) == address(0), "init once");
        splitter = _splitter;
        token = _token;
        holders = _holders;
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, 1_000 ether);
        vm.deal(address(this), amount);
        (bool ok,) = address(splitter).call{value: amount}("");
        require(ok);
        splitter.distributeFees(amount);
        totalDeposited += amount;
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = holders[fromSeed % holders.length];
        address to = holders[toSeed % holders.length];
        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;
        amount = bound(amount, 1, balance);
        vm.prank(from);
        token.transfer(to, amount);
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 3 days));
    }

    function claim(uint256 seed) external {
        address holder = holders[seed % holders.length];
        uint256 before = holder.balance;
        vm.prank(holder);
        splitter.claim(address(0));
        totalClaimed += holder.balance - before;
    }

    function holderCount() external view returns (uint256) {
        return holders.length;
    }

    receive() external payable {}
}

/// @dev The splitter must always hold enough quote currency for everything it owes.
contract GotonFeeSplitterInvariantTest is Test {
    GotonFeeSplitter splitter;
    LaunchpadToken token;
    SplitterHandler handler;
    address pool = makeAddr("poolManager");

    function setUp() public {
        address creator = makeAddr("creator");
        token = new LaunchpadToken();
        token.initialize(
            "T", "T", "", "", ILaunchpadToken.Socials("", "", "", "", ""), creator, address(0), address(this)
        );
        address[] memory holders = new address[](4);
        for (uint256 i; i < holders.length; i++) {
            holders[i] = makeAddr(string(abi.encodePacked("holder", vm.toString(i))));
        }
        handler = new SplitterHandler();
        splitter = new GotonFeeSplitter(
            GotonFeeSplitter.Config({
                token: address(token),
                quoteAsset: address(0),
                hook: address(handler),
                factory: address(0xFAC7),
                poolManager: pool,
                excluded: address(0),
                treasury: payable(makeAddr("treasury")),
                buybackVault: makeAddr("buyback"),
                liquidityVault: makeAddr("liquidity"),
                creator: creator
            }),
            GotonFeeSplitter.Split({
                protocolBps: 3_000, holdersBps: 5_000, burnBps: 1_000, creatorBps: 3_000, liquidityBps: 1_000
            })
        );
        token.setRewardTracker(address(splitter));
        handler.init(splitter, token, holders);

        uint256 supply = token.totalSupply();
        token.transfer(pool, (supply * 70) / 100);
        for (uint256 i; i < holders.length; i++) {
            token.transfer(holders[i], (supply * 30) / 100 / holders.length);
        }
        targetContract(address(handler));
    }

    function invariant_SolventForCreatorBuybackAndHolders() public view {
        uint256 owed = splitter.creatorAccrued() + splitter.buybackAccrued();
        for (uint256 i; i < handler.holderCount(); i++) {
            owed += splitter.claimable(handler.holders(i));
        }
        assertGe(address(splitter).balance, owed, "splitter can pay everything it owes");
    }

    function invariant_NeverPaysOutMoreThanDeposited() public view {
        assertLe(handler.totalClaimed(), handler.totalDeposited());
    }
}
