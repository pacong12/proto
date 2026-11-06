// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadV2FactoryArc} from "../../src/chains/arc/LaunchpadV2FactoryArc.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonFeeSplitter, GotonFeeSplitterDeployer} from "../../src/core/GotonFeeSplitter.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {VestingVault} from "../../src/core/VestingVault.sol";
import {EmergencyPause} from "../../src/core/EmergencyPause.sol";
import {IVestingVault} from "../../src/interfaces/IVestingVault.sol";
import {PoolKey} from "../../src/interfaces/IUniswapV4.sol";
import {
    IPoolManagerV4,
    IUnlockCallback,
    ModifyLiquidityParams,
    SwapParams
} from "../../src/interfaces/external/IUniswapV4Core.sol";

contract MockUsdc {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Just enough of the v4 PoolManager for a launch: the position takes the supply minus some
///      dust, and a swap pays out at a fixed rate. Real pool behaviour is in ArcV4Launch.fork.t.sol.
contract MockPoolManager {
    uint256 public constant TOKENS_PER_USDC6 = 393_000e12;
    uint256 public constant DUST = 1_000;

    address public immutable usdc;

    constructor(address _usdc) {
        usdc = _usdc;
    }

    function initialize(PoolKey memory, uint160) external pure returns (int24) {
        return 0;
    }

    function unlock(bytes calldata data) external returns (bytes memory) {
        return IUnlockCallback(msg.sender).unlockCallback(data);
    }

    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory, bytes calldata)
        external
        view
        returns (int256 callerDelta, int256 feesAccrued)
    {
        int128 tokenDelta = -int128(int256(1_000_000_000 ether - DUST));
        callerDelta = _delta(key, tokenDelta, 0);
        feesAccrued = 0;
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes calldata) external view returns (int256) {
        uint256 quoteIn = uint256(-params.amountSpecified);
        return _delta(key, int128(int256(quoteIn * TOKENS_PER_USDC6)), -int128(int256(quoteIn)));
    }

    function sync(address) external {}

    function settle() external payable returns (uint256) {
        return 0;
    }

    function take(address currency, address to, uint256 amount) external {
        MockUsdc(currency).transfer(to, amount);
    }

    function _delta(PoolKey memory key, int128 tokenDelta, int128 quoteDelta) private view returns (int256) {
        (int128 amount0, int128 amount1) = key.currency0 == usdc ? (quoteDelta, tokenDelta) : (tokenDelta, quoteDelta);
        return (int256(amount0) << 128) | int256(uint256(uint128(amount1)));
    }
}

contract MockHook {
    function registerPool(PoolKey calldata, GotonV4Hook.PoolRegistration calldata) external {}
}

/// An Arc creator opting in to vest the prebuy at launch, through a mock PoolManager so this runs
/// without a fork. The splitter, token and vault are the real contracts.
contract ArcVestingLaunchTest is Test {
    uint256 constant PREBUY = 4.5 ether;
    uint256 constant PREBUY_TOKENS = 4_500_000 * 393_000e12;
    uint64 constant CLIFF = 30 days;
    uint64 constant DURATION = 100 days;

    LaunchpadV2FactoryArc factory;
    VestingVault vault;
    MockUsdc usdc;
    MockPoolManager pm;
    MockHook hook;
    address payable treasury = payable(makeAddr("treasury"));
    address creator = makeAddr("creator");
    address stranger = makeAddr("stranger");

    function setUp() public {
        usdc = new MockUsdc();
        pm = new MockPoolManager(address(usdc));
        hook = new MockHook();
        vault = new VestingVault(address(this));
        factory = new LaunchpadV2FactoryArc(
            IPoolManagerV4(address(pm)),
            address(usdc),
            GotonV4Hook(address(hook)),
            new GotonFeeSplitterDeployer(),
            treasury,
            vault
        );
        vault.setLauncher(address(factory), true);
        vm.deal(creator, 1_000 ether);
    }

    function _meta() internal pure returns (LaunchpadV2FactoryArc.TokenMetadata memory) {
        return LaunchpadV2FactoryArc.TokenMetadata("Vest", "VEST", "", "", "", "", "");
    }

    /// @dev Everything to holders, so the dividend tests read cleanly.
    function _tax() internal pure returns (LaunchpadV2FactoryArc.TaxConfig memory) {
        return LaunchpadV2FactoryArc.TaxConfig(100, 100, 10_000, 0, 0, 0);
    }

    /// @dev On Arc the msg.value balance is the factory's USDC; the mock keeps them separate.
    function _fundPrebuy(uint256 valueWei) internal {
        usdc.mint(address(factory), valueWei / 1e12);
    }

    function _launch(uint64 cliff, uint64 duration) internal returns (LaunchpadToken token) {
        _fundPrebuy(PREBUY);
        vm.prank(creator);
        (address t,) = factory.launchTokenWithVesting{value: PREBUY}(_meta(), _tax(), 0, cliff, duration);
        token = LaunchpadToken(t);
    }

    function _expectLaunchRevert(uint64 cliff, uint64 duration, bytes4 error) internal {
        _fundPrebuy(PREBUY);
        vm.prank(creator);
        vm.expectRevert(error);
        factory.launchTokenWithVesting{value: PREBUY}(_meta(), _tax(), 0, cliff, duration);
    }

    /// @dev Finds a creator whose next token sorts after (or before) USDC.
    function _creatorWithOrder(bool tokenAfterUsdc) internal returns (address who) {
        for (uint256 i = 0; i < 200; i++) {
            who = address(uint160(uint256(keccak256(abi.encode("creator", i)))));
            if ((factory.predictTokenAddress(who, factory.nextNonce()) > address(usdc)) == tokenAfterUsdc) {
                vm.deal(who, 1_000 ether);
                return who;
            }
        }
        revert("no candidate");
    }

    // ---------------------------------------------------------------------------
    // Launch with vesting
    // ---------------------------------------------------------------------------

    function test_LaunchWithVestingLocksPrebuy() public {
        LaunchpadToken token = _launch(CLIFF, DURATION);

        assertEq(token.balanceOf(address(vault)), PREBUY_TOKENS);
        assertEq(token.balanceOf(creator), 0, "creator holds nothing yet");
        assertEq(token.balanceOf(address(factory)), 0, "factory keeps nothing");
        assertEq(token.balanceOf(0x000000000000000000000000000000000000dEaD), pm.DUST(), "dust burned");
        assertEq(
            token.balanceOf(address(pm)) + PREBUY_TOKENS + pm.DUST(), token.totalSupply(), "every token accounted for"
        );

        uint256 id = vault.scheduleIdOf(address(token));
        IVestingVault.Schedule memory s = vault.getSchedule(id);
        assertEq(s.token, address(token));
        assertEq(s.beneficiary, creator);
        assertEq(s.start, block.timestamp);
        assertEq(s.cliff, CLIFF);
        assertEq(s.duration, DURATION);
        assertEq(s.total, PREBUY_TOKENS);
        assertEq(vault.schedulesOf(creator)[0], id);
    }

    function test_EventsForTheIndexer() public {
        address predicted = factory.predictTokenAddress(creator, factory.nextNonce());
        _fundPrebuy(PREBUY);

        vm.expectEmit(true, true, true, true, address(vault));
        emit IVestingVault.ScheduleCreated(
            predicted, creator, 1, PREBUY_TOKENS, uint64(block.timestamp), CLIFF, DURATION
        );
        vm.prank(creator);
        (, bytes32 poolId) = factory.launchTokenWithVesting{value: PREBUY}(_meta(), _tax(), 0, CLIFF, DURATION);
        assertTrue(poolId != bytes32(0));
    }

    function test_WorksWhicheverWayTheCurrenciesSort() public {
        bool[2] memory orders = [true, false];
        for (uint256 i; i < orders.length; i++) {
            address who = _creatorWithOrder(orders[i]);
            _fundPrebuy(PREBUY);
            vm.prank(who);
            (address t,) = factory.launchTokenWithVesting{value: PREBUY}(_meta(), _tax(), 0, CLIFF, DURATION);
            assertEq(t > address(usdc), orders[i]);
            assertEq(LaunchpadToken(t).balanceOf(address(vault)), PREBUY_TOKENS);
            assertEq(LaunchpadToken(t).balanceOf(who), 0);
        }
    }

    function test_VestingLifecycleAfterLaunch() public {
        // Not block.timestamp: via-IR may re-read it after a warp instead of keeping this value.
        uint256 start = vm.getBlockTimestamp();
        LaunchpadToken token = _launch(CLIFF, DURATION);
        uint256 id = vault.scheduleIdOf(address(token));

        vm.warp(start + CLIFF - 1);
        assertEq(vault.releasable(id), 0, "nothing before the cliff");
        vm.prank(creator);
        assertEq(vault.claimVested(id), 0);

        vm.warp(start + 50 days);
        assertEq(vault.releasable(id), PREBUY_TOKENS / 2, "linear after the cliff");
        vm.prank(stranger);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.claimVested(id);
        vm.prank(creator);
        vault.claimVested(id);
        assertEq(token.balanceOf(creator), PREBUY_TOKENS / 2);

        vm.warp(start + DURATION);
        vm.prank(creator);
        vault.claimVested(id);
        assertEq(token.balanceOf(creator), PREBUY_TOKENS, "all of it at the end");
        assertEq(token.balanceOf(address(vault)), 0);
        assertEq(token.balanceOf(stranger), 0);
    }

    /// @dev The vault counts as a holder on the real splitter; only the beneficiary collects.
    function test_LockedTokensEarnDividendsForBeneficiary() public {
        LaunchpadToken token = _launch(CLIFF, DURATION);
        uint256 id = vault.scheduleIdOf(address(token));
        (, address splitterAddress,,,) = factory.launches(address(token));
        GotonFeeSplitter splitter = GotonFeeSplitter(payable(splitterAddress));
        assertEq(token.rewardTracker(), splitterAddress);

        // The vault is the whole circulating supply here, so it streams all of the deposit.
        usdc.mint(splitterAddress, 100e6);
        vm.prank(address(hook));
        splitter.distributeFees(100e6);
        vm.warp(block.timestamp + 1 days);

        // 30% protocol cut first, the rest to holders.
        uint256 pending = vault.pendingDividends(id);
        assertApproxEqAbs(pending, 70e6, 1);
        assertEq(splitter.claimable(creator), 0, "the creator's wallet holds nothing");

        vm.prank(stranger);
        vm.expectRevert(IVestingVault.Unauthorized.selector);
        vault.claimDividends(id);

        vm.prank(creator);
        assertEq(vault.claimDividends(id), pending);
        assertEq(usdc.balanceOf(creator), pending);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    // ---------------------------------------------------------------------------
    // Launch without vesting is unchanged
    // ---------------------------------------------------------------------------

    function test_PlainLaunchPaysCreatorAndNeverTouchesVault() public {
        _fundPrebuy(PREBUY);
        vm.prank(creator);
        (address t,) = factory.launchToken{value: PREBUY}(_meta(), _tax(), 0);

        assertEq(LaunchpadToken(t).balanceOf(creator), PREBUY_TOKENS);
        assertEq(LaunchpadToken(t).balanceOf(address(vault)), 0);
        assertEq(vault.scheduleCount(), 0);
    }

    /// @dev A factory the vault has not approved keeps launching, just not with vesting.
    function test_PlainLaunchWorksWithoutLauncherRole() public {
        vault.setLauncher(address(factory), false);
        _fundPrebuy(PREBUY);
        vm.prank(creator);
        (address t,) = factory.launchToken{value: PREBUY}(_meta(), _tax(), 0);
        assertEq(LaunchpadToken(t).balanceOf(creator), PREBUY_TOKENS);

        _expectLaunchRevert(CLIFF, DURATION, IVestingVault.Unauthorized.selector);
    }

    // ---------------------------------------------------------------------------
    // Reverts
    // ---------------------------------------------------------------------------

    function test_CapViolationsRevert() public {
        _expectLaunchRevert(0, 0, IVestingVault.InvalidSchedule.selector);
        _expectLaunchRevert(0, 7 days - 1, IVestingVault.InvalidSchedule.selector);
        _expectLaunchRevert(0, 4 * 365 days + 1, IVestingVault.InvalidSchedule.selector);
        _expectLaunchRevert(DURATION + 1, DURATION, IVestingVault.InvalidSchedule.selector);
        assertEq(factory.getLaunchCount(), 0, "nothing launched");
    }

    function test_LaunchGuardsStillApply() public {
        _fundPrebuy(PREBUY);
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.Slippage.selector);
        factory.launchTokenWithVesting{value: PREBUY}(_meta(), _tax(), type(uint256).max, CLIFF, DURATION);

        // 5% of supply at the mock's rate is about 127 USDC, so a vested prebuy cannot dodge the cap.
        uint256 tooBig = 150 ether;
        _fundPrebuy(tooBig);
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.DevBuyTooLarge.selector);
        factory.launchTokenWithVesting{value: tooBig}(_meta(), _tax(), 0, CLIFF, DURATION);

        vm.prank(creator);
        vm.expectRevert(LaunchpadV2FactoryArc.InvalidPrebuy.selector);
        factory.launchTokenWithVesting{value: 1 ether}(_meta(), _tax(), 0, CLIFF, DURATION);
    }

    function test_PausedFactoryBlocksVestingLaunch() public {
        factory.pause();
        _expectLaunchRevert(CLIFF, DURATION, EmergencyPause.EmergencyPaused.selector);
    }

    function test_ConstructorRejectsZeroVault() public {
        GotonFeeSplitterDeployer deployer = new GotonFeeSplitterDeployer();
        vm.expectRevert(LaunchpadV2FactoryArc.ZeroAddress.selector);
        new LaunchpadV2FactoryArc(
            IPoolManagerV4(address(pm)),
            address(usdc),
            GotonV4Hook(address(hook)),
            deployer,
            treasury,
            IVestingVault(address(0))
        );
    }
}
