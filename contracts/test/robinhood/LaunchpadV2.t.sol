// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestGraduator} from "../utils/TestGraduator.sol";
import {Test} from "forge-std/Test.sol";
import {LaunchpadV2Factory} from "../../src/chains/robinhood/LaunchpadV2Factory.sol";
import {BondingCurve} from "../../src/core/BondingCurve.sol";
import {LaunchpadToken} from "../../src/core/LaunchpadToken.sol";
import {EmergencyPause} from "../../src/core/EmergencyPause.sol";
import {ILaunchpadToken} from "../../src/interfaces/ILaunchpadToken.sol";

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
        factory = new LaunchpadV2Factory(feeRecipient, TestGraduator.deploy(feeRecipient));
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
        assertEq(curve.virtualEthReserve(), 1.68 ether);

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
            new LaunchpadV2Factory(payable(address(attacker)), TestGraduator.deploy(payable(address(attacker))));
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
            new LaunchpadV2Factory(payable(address(rejecter)), TestGraduator.deploy(payable(address(rejecter))));
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2Factory.TransferFailed.selector);
        factoryReject.launchTokenV2{value: 0.0005 ether}("Fail", "FAIL", "", "", "", "", "", 0);
    }

    function test_SetLaunchFee_OwnerOnlyAndCapped() public {
        // Default launchFee is 0.0005 ether (Robinhood)
        assertEq(factory.launchFee(), 0.0005 ether);
        assertEq(factory.launchFee(), 0.0005 ether);

        // Non-owner cannot change launch fee
        vm.prank(address(0xDEAD));
        vm.expectRevert(LaunchpadV2Factory.Unauthorized.selector);
        factory.setLaunchFee(0.001 ether);

        // The owner cannot raise it above the hard cap
        uint256 aboveCap = factory.MAX_LAUNCH_FEE() + 1;
        vm.expectRevert(LaunchpadV2Factory.InvalidFee.selector);
        factory.setLaunchFee(aboveCap);

        factory.setLaunchFee(0.01 ether);
        assertEq(factory.launchFee(), 0.01 ether);

        // Launching with less than the fee reverts
        vm.prank(creator);
        vm.expectRevert(LaunchpadV2Factory.InvalidFee.selector);
        factory.launchTokenV2{value: 0.005 ether}("Fee Token", "FEE", "", "", "", "", "", 0);

        vm.prank(creator);
        (address tokenAddress,) = factory.launchTokenV2{value: 0.01 ether}("Fee Token", "FEE", "", "", "", "", "", 0);
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

    function test_CurveBuy_RefundsExcessEthAtGraduation() public {
        (, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));

        // Advance beyond anti-snipe window
        vm.warp(block.timestamp + 10);
        vm.roll(block.number + 5);

        uint256 buyerBalanceBefore = buyer1.balance;
        // Target is 4.2 ETH. Buyer sends 10 ETH.
        vm.startPrank(buyer1);
        uint256 tokensBought = curve.buy{value: 10 ether}(0);
        vm.stopPrank();

        uint256 buyerBalanceAfter = buyer1.balance;
        uint256 ethSpent = buyerBalanceBefore - buyerBalanceAfter;

        assertTrue(curve.graduated(), "Curve must be graduated");
        assertTrue(tokensBought > 700_000_000 * 1e18, "Buyer receives all curve tokens");
        // Spent amount should be ~4.24 ETH (4.2 ETH net + 1% fee), not 10 ETH!
        assertLt(ethSpent, 5 ether, "Excess ETH must be refunded to buyer");
        assertGt(ethSpent, 4 ether, "Curve target must be fully paid");
    }

    /// @dev S4: a creator initial buy that hits the curve cap is refunded instead of reverting.
    function test_InitialBuyReachingCapRefundsCreator() public {
        uint256 before = creator.balance;
        vm.prank(creator);
        (, address curveAddress) =
            factory.launchTokenV2{value: 0.0005 ether + 10 ether}("Cap", "CAP", "", "", "", "", "", 0);
        BondingCurve curve = BondingCurve(payable(curveAddress));
        assertTrue(curve.graduated());
        uint256 spent = before - creator.balance;
        assertLt(spent, 6 ether, "excess over the cap was refunded");
        assertEq(address(factory).balance, 0);
    }

    /// @dev Active curves can never be emptied by the owner, even after the deadline.
    function test_EmergencyWithdrawRejectsActiveCurve() public {
        vm.prank(creator);
        (, address curveAddress) =
            factory.launchTokenV2{value: 0.0005 ether + 0.1 ether}("A", "A", "", "", "", "", "", 0);
        vm.warp(block.timestamp + 400 days);
        vm.expectRevert(BondingCurve.NotGraduated.selector);
        factory.emergencyWithdrawFromCurve(curveAddress, payable(address(this)));
    }

    /// @dev The emergency path detaches the curve too, so the creator's buy tax cannot skim it.
    function test_EmergencyWithdrawDoesNotPayCreatorBuyTax() public {
        vm.prank(creator);
        (address tokenAddress, address curveAddress) =
            factory.launchTokenV2{value: 0.0005 ether}("T", "T", "", "", "", "", "", 0);
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        address taxWallet = address(0x7A7);
        vm.prank(creator);
        token.setInitialTaxConfig(1_000, 0, taxWallet);
        vm.warp(block.timestamp + 10);
        vm.roll(block.number + 5);
        vm.prank(buyer1);
        BondingCurve(payable(curveAddress)).buy{value: 10 ether}(0);
        uint256 taxBefore = token.balanceOf(taxWallet);
        uint256 curveTokens = token.balanceOf(curveAddress);

        vm.warp(block.timestamp + 180 days);
        address payable recovery = payable(address(0x2EC0));
        factory.emergencyWithdrawFromCurve(curveAddress, recovery);

        assertEq(token.balanceOf(taxWallet), taxBefore, "no tax on emergency withdrawal");
        assertEq(token.balanceOf(recovery), curveTokens, "every curve token recovered");
    }

    function test_GraduateRejectsUnknownAndActiveTokens() public {
        vm.expectRevert(LaunchpadV2Factory.UnknownToken.selector);
        factory.graduate(address(0xBEEF));
        vm.prank(creator);
        (address tokenAddress,) = factory.launchTokenV2{value: 0.0005 ether}("B", "B", "", "", "", "", "", 0);
        vm.expectRevert(LaunchpadV2Factory.NotGraduated.selector);
        factory.graduate(tokenAddress);
    }

    /// @dev S18: the instant initial tax is locked once a third party has bought.
    function test_InitialTaxLockedAfterFirstPublicBuy() public {
        vm.prank(creator);
        (address tokenAddress, address curveAddress) =
            factory.launchTokenV2{value: 0.0005 ether}("T", "T", "", "", "", "", "", 0);
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 10);
        vm.deal(buyer1, 1 ether);
        vm.prank(buyer1);
        BondingCurve(payable(curveAddress)).buy{value: 0.01 ether}(0);

        vm.prank(creator);
        vm.expectRevert(LaunchpadToken.TimelockNotExpired.selector);
        LaunchpadToken(tokenAddress).setInitialTaxConfig(0, 1_000, creator);
    }

    // DR-01: circuit breaker stops new money entering, never exits.
    function test_EmergencyPause_BlocksEntriesButNotExits() public {
        (address tokenAddress, address curveAddress) = _launch();
        BondingCurve curve = BondingCurve(payable(curveAddress));
        vm.warp(block.timestamp + 10);
        vm.roll(block.number + 3);
        vm.prank(buyer1);
        uint256 bought = curve.buy{value: 0.5 ether}(0);

        address guardian = address(0x6A4D);
        factory.setGuardian(guardian);
        vm.prank(guardian);
        factory.pause();

        vm.prank(buyer1);
        vm.expectRevert(BondingCurve.Paused.selector);
        curve.buy{value: 0.1 ether}(0);

        vm.prank(creator);
        vm.expectRevert(EmergencyPause.EmergencyPaused.selector);
        factory.launchTokenV2{value: 0.0005 ether}("X", "X", "", "", "", "", "", 0);

        // Graduation is an exit, not an entry: the pause does not block it (only the curve state does).
        vm.expectRevert(LaunchpadV2Factory.NotGraduated.selector);
        factory.graduate(tokenAddress);

        // Holders can always exit.
        vm.startPrank(buyer1);
        LaunchpadToken(payable(tokenAddress)).approve(curveAddress, bought);
        assertGt(curve.sell(bought, 0), 0);
        vm.stopPrank();

        // Only the owner can resume.
        vm.prank(guardian);
        vm.expectRevert(EmergencyPause.NotGuardian.selector);
        factory.unpause();
        factory.unpause();
        vm.prank(buyer1);
        curve.buy{value: 0.1 ether}(0);
    }

    function test_EmergencyPause_OnlyOwnerOrGuardian() public {
        vm.prank(buyer1);
        vm.expectRevert(EmergencyPause.NotGuardian.selector);
        factory.pause();
        vm.prank(buyer1);
        vm.expectRevert(EmergencyPause.NotGuardian.selector);
        factory.setGuardian(buyer1);
    }
}
