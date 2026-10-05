// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../src/LaunchpadV2Factory.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {LaunchpadToken} from "../src/LaunchpadToken.sol";
import {ILaunchpadToken} from "../src/interfaces/ILaunchpadToken.sol";

contract ReentrantAttackerRecipient {
    LaunchpadV2Factory public factory;
    bool public reentrancyBlocked;
    uint256 public countDuringFeeTransfer;
    address public tokenStoredDuringFeeTransfer;

    function setFactory(LaunchpadV2Factory _factory) external {
        factory = _factory;
    }

    receive() external payable {
        if (address(factory) != address(0) && countDuringFeeTransfer == 0) {
            // Check CEI: state is already mutated before fee transfer
            countDuringFeeTransfer = factory.getLaunchCount();
            tokenStoredDuringFeeTransfer = factory.allLaunches(0);

            // Attempt reentrant call to launchTokenV2
            (bool success, bytes memory returnData) = address(factory).call{value: 0.0005 ether}(
                abi.encodeWithSelector(
                    LaunchpadV2Factory.launchTokenV2.selector, "Reentrant", "REENT", "", "", "", "", "", uint256(0)
                )
            );

            // Reentrancy guard should reject with "REENTRANT"
            if (!success) {
                bytes memory expectedRevert = abi.encodeWithSignature("Error(string)", "REENTRANT");
                if (keccak256(returnData) == keccak256(expectedRevert)) {
                    reentrancyBlocked = true;
                }
            }
        }
    }
}

contract RejectingFeeRecipient {
    receive() external payable {
        revert("Reject");
    }
}

contract LaunchpadV2Test is Test {
    LaunchpadV2Factory public factory;
    address payable public feeRecipient = payable(address(0xFA1));
    address public mockLocker = address(0x10C);
    address public creator = address(0xCAFE);
    address public buyer1 = address(0xB0B1);

    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        // C-03 fix: feeRecipient and locker must be non-zero.
        factory = new LaunchpadV2Factory(feeRecipient, mockLocker, address(0), address(0));
        vm.deal(creator, 100 ether);
        vm.deal(buyer1, 100 ether);
    }

    function _launch() internal returns (address tokenAddress, address curveAddress) {
        vm.prank(creator);
        (tokenAddress, curveAddress) = factory.launchTokenV2{value: 0.0005 ether}(
            "V2 Curve Token",
            "CURVE",
            "ipfs://logo",
            "Token on Bonding Curve",
            "twitter.com/curve",
            "t.me/curve",
            "curve.io",
            0
        );
    }

    function test_LaunchTokenV2AndCurveBuy() public {
        (address tokenAddress, address curveAddress) = _launch();

        assertNotEq(tokenAddress, address(0));
        assertNotEq(curveAddress, address(0));

        BondingCurve curve = BondingCurve(payable(curveAddress));
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));

        // Initial token allocations
        assertEq(token.balanceOf(curveAddress), 1_000_000_000 * 1e18);
        assertEq(curve.virtualEthReserve(), 3.0 ether);

        // Buyer1 purchases tokens from the curve after snipe tax window.
        // vm.roll is required: LaunchpadToken's anti-snipe guard uses block.number,
        // not block.timestamp. Advancing only time is insufficient.
        vm.warp(block.timestamp + 10);
        vm.roll(block.number + 3);
        vm.startPrank(buyer1);
        (uint256 expectedTokens, uint256 expectedFee) = curve.getAmountOutBuy(0.5 ether);
        uint256 tokensReceived = curve.buy{value: 0.5 ether}(expectedTokens);
        vm.stopPrank();

        assertEq(tokensReceived, expectedTokens);
        assertEq(token.balanceOf(buyer1), tokensReceived);
        assertEq(feeRecipient.balance, 0.0005 ether + expectedFee);
    }

    function test_SnipeTaxReserveInvariant_C01() public {
        (address tokenAddress, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));

        uint256 initialVirtualTokens = curve.virtualTokenReserve();
        (uint256 grossTokensExpected,) = curve.getAmountOutBuy(0.1 ether);

        // Buy at launchBlock+1: snipe tax (99%) still applies; block restriction only
        // gates launchBlock itself. After H-02 fix, liquidityPool is set post-launch so
        // the deployer-only guard is active at launchBlock. Advancing one block lets
        // buyer1 buy while snipe tax is still at maximum (restrictionsEndBlock = launchBlock+2).
        vm.roll(block.number + 1);
        vm.startPrank(buyer1);
        uint256 tokensReceived = curve.buy{value: 0.1 ether}(0);
        vm.stopPrank();

        // 99% snipe tax applies to buyer1 — use same rounding as contract (gross * snipeBps / BPS)
        uint256 snipeFee = (grossTokensExpected * 9900) / 10000;
        uint256 expectedUserTokens = grossTokensExpected - snipeFee;
        assertEq(tokensReceived, expectedUserTokens, "user receives gross minus snipe fee");
        assertLt(tokensReceived, grossTokensExpected);

        // Token conservation: user + feeRecipient == gross (no tokens created or destroyed)
        assertEq(
            tokensReceived + token.balanceOf(feeRecipient),
            grossTokensExpected,
            "token conservation: user + fee == gross"
        );

        // C-01: virtualTokenReserve decremented by GROSS, not net user amount
        assertEq(
            curve.virtualTokenReserve(),
            initialVirtualTokens - grossTokensExpected,
            "reserve must decrease by gross tokens"
        );

        // feeRecipient received the snipe fee tokens
        assertEq(token.balanceOf(feeRecipient), snipeFee, "feeRecipient must hold snipe fee tokens");
    }

    function test_LaunchTokenV2WithInitialBuy_DirectRecipient_C02() public {
        uint256 feeRecipientBalanceBefore = feeRecipient.balance;
        uint256 initialBuy = 0.1 ether;

        vm.prank(creator);
        (address tokenAddress, address curveAddress) = factory.launchTokenV2{value: 0.0005 ether + initialBuy}(
            "Initial Buy Token", "INIT", "ipfs://logo", "Testing direct initial buy", "", "", "", 0
        );

        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));
        BondingCurve curve = BondingCurve(payable(curveAddress));

        // 1. Fee recipient (owner) receives exact 0.0005 ETH launch fee + 1% curve trading fee on initial buy
        uint256 expectedTradingFee = (initialBuy * 100) / 10000; // 1% of 0.1 ETH = 0.001 ETH
        assertEq(
            feeRecipient.balance,
            feeRecipientBalanceBefore + 0.0005 ether + expectedTradingFee,
            "protocol fee recipient must receive launch fee plus 1% curve trade fee"
        );

        // 2. Creator receives initial buy tokens directly, factory holds 0
        assertGt(token.balanceOf(creator), 0, "creator must receive initial buy tokens");
        assertEq(token.balanceOf(address(factory)), 0, "factory must hold 0 tokens");

        // 3. Curve totalEthRaised reflects ONLY initialBuy minus trading fee, never the launch fee
        assertEq(curve.totalVolumeEth(), initialBuy, "curve volume reflects only initial buy");
        assertEq(curve.totalEthRaised(), initialBuy - expectedTradingFee, "curve net ETH raised excludes launch fee");
    }

    function test_LaunchTokenV2_ZeroInitialBuy_NoTokensBought() public {
        uint256 feeRecipientBalanceBefore = feeRecipient.balance;

        vm.prank(creator);
        (address tokenAddress, address curveAddress) = factory.launchTokenV2{value: 0.0005 ether}(
            "No Prebuy Token", "ZERO", "ipfs://logo", "No initial buy", "", "", "", 0
        );

        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));
        BondingCurve curve = BondingCurve(payable(curveAddress));

        // 1. Fee recipient receives exactly 0.0005 ether
        assertEq(feeRecipient.balance, feeRecipientBalanceBefore + 0.0005 ether);

        // 2. Creator has exactly 0 tokens — NO prebuy occurred
        assertEq(token.balanceOf(creator), 0, "creator balance must be 0 when no initial buy specified");

        // 3. Curve has 0 eth raised and 0 volume
        assertEq(curve.totalEthRaised(), 0, "total ETH raised must be 0");
        assertEq(curve.totalVolumeEth(), 0, "total volume must be 0");
    }

    function test_OwnershipTransfer_TwoStepFlow() public {
        address newOwner = address(0xBEEF);

        // Initial state: deployer (address(this)) is owner, pendingOwner is 0
        assertEq(factory.owner(), address(this));
        assertEq(factory.pendingOwner(), address(0));

        // Step 1: Propose new owner
        vm.expectEmit(true, false, false, false);
        emit OwnershipTransferProposed(newOwner);
        factory.transferOwnership(newOwner);

        assertEq(factory.owner(), address(this));
        assertEq(factory.pendingOwner(), newOwner);

        // Unauthorized address cannot accept ownership
        vm.prank(address(0xDEAD));
        vm.expectRevert(LaunchpadV2Factory.NoPendingOwner.selector);
        factory.acceptOwnership();

        // Current owner cannot accept on behalf of pending owner
        vm.expectRevert(LaunchpadV2Factory.NoPendingOwner.selector);
        factory.acceptOwnership();

        // Step 2: Pending owner accepts ownership
        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(address(this), newOwner);
        vm.prank(newOwner);
        factory.acceptOwnership();

        assertEq(factory.owner(), newOwner);
        assertEq(factory.pendingOwner(), address(0));

        // Previous owner is locked out
        vm.expectRevert(LaunchpadV2Factory.Unauthorized.selector);
        factory.transferOwnership(address(this));

        // New owner can initiate transfer
        vm.prank(newOwner);
        factory.transferOwnership(address(this));
        assertEq(factory.pendingOwner(), address(this));
    }

    function test_OwnershipTransfer_UnauthorizedAccessRejection() public {
        address nonOwner = address(0xDEAD);

        // Non-owner cannot propose transfer
        vm.prank(nonOwner);
        vm.expectRevert(LaunchpadV2Factory.Unauthorized.selector);
        factory.transferOwnership(nonOwner);

        // Non-owner cannot call migrateCurveToV4
        vm.prank(nonOwner);
        vm.expectRevert(LaunchpadV2Factory.Unauthorized.selector);
        factory.migrateCurveToV4(address(0x1), payable(nonOwner));

        // Non-owner cannot call emergencyWithdrawFromCurve
        vm.prank(nonOwner);
        vm.expectRevert(LaunchpadV2Factory.Unauthorized.selector);
        factory.emergencyWithdrawFromCurve(address(0x1), payable(nonOwner));

        // Anyone calling acceptOwnership without pending owner reverts
        vm.prank(nonOwner);
        vm.expectRevert(LaunchpadV2Factory.NoPendingOwner.selector);
        factory.acceptOwnership();
    }

    function test_OwnershipTransfer_ZeroAddressReverts() public {
        vm.expectRevert(LaunchpadV2Factory.ZeroAddress.selector);
        factory.transferOwnership(address(0));
    }

    function test_LaunchTokenV2_ReentrancyGuardAndCEI() public {
        ReentrantAttackerRecipient attacker = new ReentrantAttackerRecipient();
        LaunchpadV2Factory factoryWithAttacker =
            new LaunchpadV2Factory(payable(address(attacker)), mockLocker, address(0), address(0));
        attacker.setFactory(factoryWithAttacker);

        vm.prank(creator);
        (address tokenAddress, address curveAddress) =
            factoryWithAttacker.launchTokenV2{value: 0.0005 ether}("Safe Token", "SAFE", "", "", "", "", "", 0);

        // CEI verification: factory already stored launch state during fee call
        assertEq(attacker.countDuringFeeTransfer(), 1);
        assertEq(attacker.tokenStoredDuringFeeTransfer(), tokenAddress);

        // Reentrancy guard verification: reentrant call was blocked with "REENTRANT"
        assertTrue(attacker.reentrancyBlocked());

        // Only the initial token was launched
        assertEq(factoryWithAttacker.getLaunchCount(), 1);
        assertNotEq(curveAddress, address(0));
    }

    function test_LaunchTokenV2_FeeTransferFailureReverts() public {
        RejectingFeeRecipient rejecter = new RejectingFeeRecipient();
        LaunchpadV2Factory factoryReject =
            new LaunchpadV2Factory(payable(address(rejecter)), mockLocker, address(0), address(0));
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2Factory.TransferFailed.selector);
        factoryReject.launchTokenV2{value: 0.0005 ether}("Fail", "FAIL", "", "", "", "", "", 0);
    }

    function test_SetLaunchFee_OwnerOnlyAndCalibrateArcFee() public {
        // Default launchFee is 0.0005 ether (Robinhood)
        assertEq(factory.launchFee(), 0.0005 ether);
        assertEq(factory.LAUNCH_FEE(), 0.0005 ether);

        // Non-owner cannot change launch fee
        vm.prank(address(0xDEAD));
        vm.expectRevert(LaunchpadV2Factory.Unauthorized.selector);
        factory.setLaunchFee(1.0 ether);

        // Owner changes fee to 1.0 ether (1.00 USDC for Arc Network)
        factory.setLaunchFee(1.0 ether);
        assertEq(factory.launchFee(), 1.0 ether);
        assertEq(factory.LAUNCH_FEE(), 1.0 ether);

        // Launching with less than 1.0 ether reverts
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2Factory.InvalidFee.selector);
        factory.launchTokenV2{value: 0.5 ether}("Arc Token", "ARC", "", "", "", "", "", 0);

        // Launching with 1.0 ether succeeds
        vm.prank(creator);
        (address tokenAddress,) =
            factory.launchTokenV2{value: 1.0 ether}("Arc Token", "ARC", "", "", "", "", "", 0);
        assertNotEq(tokenAddress, address(0));
    }

    // ---------------------------------------------------------------------------
    // Initializer guards
    // ---------------------------------------------------------------------------

    function test_Token_DoubleInitialize_Reverts() public {
        (address tokenAddress,) = _launch();
        LaunchpadToken token = LaunchpadToken(payable(tokenAddress));
        ILaunchpadToken.Socials memory s = ILaunchpadToken.Socials("", "", "", "", "");
        vm.expectRevert(LaunchpadToken.AlreadyInitialized.selector);
        token.initialize("Dup", "DUP", "", "", s, address(this), address(0), address(this));
    }

    function test_Curve_DoubleInitialize_Reverts() public {
        (, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));
        vm.expectRevert(BondingCurve.AlreadyInitialized.selector);
        curve.initialize(
            address(0x1),
            address(0x2),
            payable(address(0x3)),
            payable(address(0x4)),
            1 ether,
            1 ether,
            1 ether,
            address(0),
            address(0)
        );
    }

    function test_CREATE2_AddressPrediction_MatchesDeployed() public {
        // Pre-compute expected salts for creator's first launch (nonce=0).
        bytes32 tokenSalt = keccak256(abi.encode(creator, uint256(0)));
        bytes32 curveSalt = keccak256(abi.encode(creator, uint256(0), uint256(1)));

        address predictedToken = factory.predictTokenAddress(tokenSalt);
        address predictedCurve = factory.predictCurveAddress(curveSalt);

        (address tokenAddress, address curveAddress) = _launch();

        assertEq(tokenAddress, predictedToken, "token address mismatch");
        assertEq(curveAddress, predictedCurve, "curve address mismatch");
    }
}
