// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchpadToken} from "./LaunchpadToken.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {BondingCurve} from "./BondingCurve.sol";

/**
 * @title LaunchpadV2Factory
 * @notice Factory for launching tokens on the V2 bonding curve architecture.
 *
 * Security notes:
 *   - C-03 fix: constructor validates that feeRecipient and locker are non-zero.
 *   - C-02 fix: exposes migrateToV4() and emergencyWithdraw() pass-throughs so the
 *               factory owner can act as the authorised caller on deployed curves.
 *   - CEI pattern: state storage and event emission precede external fee transfer and curve buy.
 *   - nonReentrant guard on launchTokenV2.
 */
contract LaunchpadV2Factory {
    uint256 public launchFee = 0.0005 ether;
    uint256 public constant GRADUATION_TARGET = 4.2 ether;
    uint256 public constant VIRTUAL_ETH_RESERVE = 3.0 ether;
    uint256 public constant VIRTUAL_TOKEN_RESERVE = 1_073_000_000 * 1e18;

    address payable public immutable protocolFeeRecipient;
    address public immutable defaultLocker;
    address public immutable poolManagerV4;
    address public immutable memeHook;

    address public owner;
    address public pendingOwner;

    bool private _locked;

    struct V2Launch {
        address token;
        address curve;
        address creator;
        uint256 createdAt;
        bool graduated;
    }

    mapping(address => V2Launch) public launches;
    address[] public allLaunches;

    event TokenLaunchedV2(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialBuy
    );
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error InvalidFee();
    error TransferFailed();
    error ZeroAddress();
    error Unauthorized();
    error NoPendingOwner();
    error NotFactory();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "REENTRANT");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address payable _feeRecipient, address _locker, address _poolManagerV4, address _memeHook) {
        // C-03 fix: validate all addresses that receive value or tokens.
        if (_feeRecipient == address(0) || _locker == address(0)) revert ZeroAddress();

        protocolFeeRecipient = _feeRecipient;
        defaultLocker = _locker;
        poolManagerV4 = _poolManagerV4;
        memeHook = _memeHook;
        owner = msg.sender;
    }

    function setLaunchFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = launchFee;
        launchFee = _newFee;
        emit LaunchFeeUpdated(oldFee, _newFee);
    }

    function LAUNCH_FEE() external view returns (uint256) {
        return launchFee;
    }

    // ---------------------------------------------------------------------------
    // Owner administration
    // ---------------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        address previous = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }

    // ---------------------------------------------------------------------------
    // Core launch
    // ---------------------------------------------------------------------------

    function launchTokenV2(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        string memory twitter,
        string memory telegram,
        string memory website
    ) external payable nonReentrant returns (address tokenAddress, address curveAddress) {
        if (msg.value < launchFee) revert InvalidFee();

        uint256 initialBuyEth = msg.value - launchFee;

        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: twitter, telegram: telegram, discord: "", website: website, farcaster: ""
        });

        LaunchpadToken token =
            new LaunchpadToken(name, symbol, logo, description, socials, msg.sender, address(0), address(this));

        tokenAddress = address(token);

        BondingCurve curve = new BondingCurve(
            tokenAddress,
            address(this),
            protocolFeeRecipient,
            payable(msg.sender),
            GRADUATION_TARGET,
            VIRTUAL_ETH_RESERVE,
            VIRTUAL_TOKEN_RESERVE,
            poolManagerV4,
            memeHook
        );

        curveAddress = address(curve);

        token.transfer(curveAddress, token.totalSupply());

        launches[tokenAddress] = V2Launch({
            token: tokenAddress, curve: curveAddress, creator: msg.sender, createdAt: block.timestamp, graduated: false
        });
        allLaunches.push(tokenAddress);

        emit TokenLaunchedV2(tokenAddress, curveAddress, msg.sender, name, symbol, initialBuyEth);

        (bool feeOk,) = protocolFeeRecipient.call{value: launchFee}("");
        if (!feeOk) revert TransferFailed();

        if (initialBuyEth > 0) {
            curve.buyFor{value: initialBuyEth}(msg.sender, 0);
        }
    }

    // ---------------------------------------------------------------------------
    // Migration management (C-02 fix)
    // ---------------------------------------------------------------------------

    /**
     * @notice Trigger liquidity migration for a graduated bonding curve.
     *         Delegates to BondingCurve.migrateToV4(). Only callable by owner.
     */
    function migrateCurveToV4(address curve, address payable recipient) external onlyOwner {
        BondingCurve(payable(curve)).migrateToV4(recipient);
    }

    /**
     * @notice Emergency withdrawal from a graduated bonding curve after the
     *         migration deadline has passed. Only callable by owner.
     */
    function emergencyWithdrawFromCurve(address curve, address payable recipient) external onlyOwner {
        BondingCurve(payable(curve)).emergencyWithdraw(recipient);
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function getLaunchCount() external view returns (uint256) {
        return allLaunches.length;
    }
}
