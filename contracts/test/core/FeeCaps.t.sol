// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPoolManagerV4} from "../../src/interfaces/external/IUniswapV4Core.sol";
import {LaunchpadV2FactoryArc} from "../../src/chains/arc/LaunchpadV2FactoryArc.sol";
import {GotonV4Graduator} from "../../src/core/GotonV4Graduator.sol";
import {GotonV4Hook} from "../../src/core/GotonV4Hook.sol";
import {GotonFeeSplitter, GotonFeeSplitterDeployer} from "../../src/core/GotonFeeSplitter.sol";

/// @dev The owner can tune fees only within hard caps that creators can rely on.
contract FeeCapsTest is Test {
    IPoolManagerV4 constant PM = IPoolManagerV4(address(0x1001));
    GotonV4Hook constant HOOK = GotonV4Hook(address(0x1002));
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address payable treasury = payable(makeAddr("treasury"));

    function test_ArcFactory_LaunchFeeCappedAtTenUsdc() public {
        LaunchpadV2FactoryArc factory =
            new LaunchpadV2FactoryArc(PM, USDC, HOOK, new GotonFeeSplitterDeployer(), treasury);
        assertEq(factory.launchFee(), 0, "no launch fee by default");

        factory.setLaunchFee(10 ether);
        assertEq(factory.launchFee(), 10 ether);

        vm.expectRevert(LaunchpadV2FactoryArc.InvalidFee.selector);
        factory.setLaunchFee(10 ether + 1);
    }

    function test_ArcFactory_ProtocolCutCappedAtThirtyPercent() public {
        LaunchpadV2FactoryArc factory =
            new LaunchpadV2FactoryArc(PM, USDC, HOOK, new GotonFeeSplitterDeployer(), treasury);
        int24 initialTick = factory.initialTick();
        int24 bondTick = factory.bondTick();
        uint256 minPrebuy = factory.minPrebuyUsdc6();
        uint16 maxDevBuy = factory.maxDevBuyBps();

        factory.setLaunchParams(initialTick, bondTick, minPrebuy, maxDevBuy, 2_000);
        assertEq(factory.protocolFeeBps(), 2_000);

        vm.expectRevert(LaunchpadV2FactoryArc.InvalidParams.selector);
        factory.setLaunchParams(initialTick, bondTick, minPrebuy, maxDevBuy, 3_001);
    }

    function test_Graduator_ProtocolCutCappedAtThirtyPercent() public {
        GotonFeeSplitter.Split memory split =
            GotonFeeSplitter.Split({protocolBps: 3_000, holdersBps: 5_000, burnBps: 0, creatorBps: 5_000, liquidityBps: 0});
        GotonV4Graduator graduator = new GotonV4Graduator(PM, HOOK, new GotonFeeSplitterDeployer(), treasury, split);

        split.protocolBps = 3_001;
        vm.expectRevert(GotonV4Graduator.InvalidSplit.selector);
        graduator.setDefaultSplit(split);

        GotonFeeSplitterDeployer deployer = new GotonFeeSplitterDeployer();
        vm.expectRevert(GotonV4Graduator.InvalidSplit.selector);
        new GotonV4Graduator(PM, HOOK, deployer, treasury, split);
    }
}
