// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchpadToken} from "./LaunchpadToken.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {BondingCurve} from "./BondingCurve.sol";

/**
 * @title LaunchpadV2FactoryArc
 * @notice Factory for launching tokens on Arc Network (Chain ID: 5042).
 *
 * Arc Network Standard (Minara-compatible):
 *   - Native gas asset:    USDC (18 decimals, msg.value = USDC amount in wei)
 *   - Launch fee:          1.00 USDC  (1e18 wei)
 *   - Opening FDV:         $4,200 USDC (virtualUsdcReserve = 4_200e18)
 *   - Graduation target:   $69,000 USDC raised on curve
 *   - Curve allocation:    73.86% of total supply (738_600_000 tokens of 1B)
 *   - Trading fee:         1% (set on BondingCurve)
 *
 * Token Supply breakdown (1,000,000,000 total):
 *   - Bonding curve:       738_600_000 (73.86%)
 *   - LP at graduation:    Remaining after curve sales
 *
 * Virtual reserve calibration:
 *   - At launch: spot price = virtualUsdcReserve / virtualTokenReserve
 *   - = 4_200e18 / (1_000_000_000e18) = $0.0000042 per token
 *   - Opening FDV = 0.0000042 * 1,000,000,000 = $4,200
 *
 * Security notes:
 *   - C-03: constructor validates feeRecipient and locker are non-zero.
 *   - C-02: exposes migrateToV4() and emergencyWithdraw() pass-throughs.
 *   - CEI pattern: state then events then external calls.
 *   - nonReentrant guard on launchTokenV2.
 */
contract LaunchpadV2FactoryArc {
    // Arc Standard: 1.00 USDC launch fee (1 ether in native USDC wei)
    uint256 public launchFee = 1 ether;

    // $69,000 USDC graduation target (native USDC wei, 18 decimals)
    uint256 public constant GRADUATION_TARGET = 69_000 ether;

    // Virtual USDC reserve: calibrated so opening price = $0.0000042
    // spotPrice = virtualUsdcReserve / virtualTokenReserve
    // = 4_200e18 / (1_000_000_000e18) = 0.0000042 USDC per token
    // Opening FDV = 0.0000042 * 1,000,000,000 = $4,200
    uint256 public constant VIRTUAL_USDC_RESERVE = 4_200 ether;

    // 1,000,000,000 tokens virtual reserve denominator
    uint256 public constant VIRTUAL_TOKEN_RESERVE = 1_000_000_000 * 1e18;

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
    // F-11 fix: reverse lookup curve → token so migration functions can update graduated flag.
    mapping(address => address) public curveToToken;
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

    constructor(
        address payable _feeRecipient,
        address _locker,
        address _poolManagerV4,
        address _memeHook
    ) {
        if (_feeRecipient == address(0) || _locker == address(0)) revert ZeroAddress();
        protocolFeeRecipient = _feeRecipient;
        defaultLocker = _locker;
        poolManagerV4 = _poolManagerV4;
        memeHook = _memeHook;
        owner = msg.sender;
    }

    // ---------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------

    function setLaunchFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = launchFee;
        launchFee = _newFee;
        emit LaunchFeeUpdated(oldFee, _newFee);
    }

    function LAUNCH_FEE() external view returns (uint256) {
        return launchFee;
    }

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

    /**
     * @notice Launch a new token on the Arc Network bonding curve.
     * @dev msg.value must be >= launchFee (in native USDC wei).
     *      Any amount above launchFee is used as the creator's initial buy.
     */
    function launchTokenV2(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        string memory twitter,
        string memory telegram,
        string memory website,
        uint256 minInitialTokensOut
    ) external payable nonReentrant returns (address tokenAddress, address curveAddress) {
        if (msg.value < launchFee) revert InvalidFee();

        uint256 initialBuyUsdc = msg.value - launchFee;

        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: twitter,
            telegram: telegram,
            discord: "",
            website: website,
            farcaster: ""
        });

        LaunchpadToken token = new LaunchpadToken(
            name, symbol, logo, description, socials, msg.sender, address(0), address(this)
        );

        tokenAddress = address(token);

        BondingCurve curve = new BondingCurve(
            tokenAddress,
            address(this),
            protocolFeeRecipient,
            payable(msg.sender),
            GRADUATION_TARGET,
            VIRTUAL_USDC_RESERVE,
            VIRTUAL_TOKEN_RESERVE,
            poolManagerV4,
            memeHook
        );

        curveAddress = address(curve);

        // Transfer full supply to bonding curve; curve distributes on buy/sell
        bool tokenSent = token.transfer(curveAddress, token.totalSupply());
        if (!tokenSent) revert TransferFailed();

        // CEI: write state before external calls
        launches[tokenAddress] = V2Launch({
            token: tokenAddress,
            curve: curveAddress,
            creator: msg.sender,
            createdAt: block.timestamp,
            graduated: false
        });
        curveToToken[curveAddress] = tokenAddress; // F-11: reverse mapping for flag update
        allLaunches.push(tokenAddress);

        emit TokenLaunchedV2(tokenAddress, curveAddress, msg.sender, name, symbol, initialBuyUsdc);

        // Forward protocol fee
        (bool feeOk,) = protocolFeeRecipient.call{value: launchFee}("");
        if (!feeOk) revert TransferFailed();

        // Optional creator initial buy — protected by minInitialTokensOut (F-01 fix)
        if (initialBuyUsdc > 0) {
            curve.buyFor{value: initialBuyUsdc}(msg.sender, minInitialTokensOut);
        }
    }

    // ---------------------------------------------------------------------------
    // Migration management (C-02 fix)
    // ---------------------------------------------------------------------------

    function migrateCurveToV4(address curve, address payable recipient) external onlyOwner {
        BondingCurve(payable(curve)).migrateToV4(recipient);
        address token = curveToToken[curve];
        if (token != address(0)) {
            launches[token].graduated = true; // F-11 fix
        }
    }

    function emergencyWithdrawFromCurve(address curve, address payable recipient) external onlyOwner {
        BondingCurve(payable(curve)).emergencyWithdraw(recipient);
        address token = curveToToken[curve];
        if (token != address(0)) {
            launches[token].graduated = true; // F-11 fix
        }
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function getLaunchCount() external view returns (uint256) {
        return allLaunches.length;
    }
}
