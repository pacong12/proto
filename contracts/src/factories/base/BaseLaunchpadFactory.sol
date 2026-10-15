// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadV2Factory} from "../../interfaces/core/ILaunchpadV2Factory.sol";
import {ILaunchpadToken} from "../../interfaces/core/ILaunchpadToken.sol";
import {IBondingCurve} from "../../interfaces/core/IBondingCurve.sol";
import {LaunchpadToken} from "../../LaunchpadToken.sol";
import {BondingCurve} from "../../BondingCurve.sol";

/**
 * @title BaseLaunchpadFactory
 * @notice Clean Architecture abstract base factory for V2 launchpads.
 *         Consolidates state variables, ownership, CREATE2 prediction,
 *         launch token orchestration, and administrative pass-throughs.
 */
abstract contract BaseLaunchpadFactory is ILaunchpadV2Factory {
    uint256 public launchFee;

    address payable public protocolFeeRecipient;
    address public defaultLocker;
    address public poolManagerV4;
    address public memeHook;
    address public owner;
    address public pendingOwner;

    bool private _locked;
    uint256 internal _nonce;

    struct V2Launch {
        address token;
        address curve;
        address creator;
        uint256 createdAt;
        bool graduated;
    }

    mapping(address => V2Launch) public launches;
    mapping(address => address) public curveToToken;
    address[] public allLaunches;

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

    function _initBaseFactory(
        address payable _feeRecipient,
        address _locker,
        address _poolManagerV4,
        address _memeHook
    ) internal {
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
    // CREATE2 helpers
    // ---------------------------------------------------------------------------

    function predictTokenAddress(bytes32 salt) external view override returns (address) {
        return _predict(type(LaunchpadToken).creationCode, salt);
    }

    function predictCurveAddress(bytes32 salt) external view override returns (address) {
        return _predict(type(BondingCurve).creationCode, salt);
    }

    function _predict(bytes memory creationCode, bytes32 salt) internal view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creationCode))
        );
        return address(uint160(uint256(hash)));
    }

    function getLaunchCount() external view override returns (uint256) {
        return allLaunches.length;
    }

    // ---------------------------------------------------------------------------
    // Launch Orchestration
    // ---------------------------------------------------------------------------

    function _executeLaunchTokenV2(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        string memory twitter,
        string memory telegram,
        string memory website,
        uint256 minInitialTokensOut,
        uint256 graduationTarget,
        uint256 virtualQuoteReserve,
        uint256 virtualTokenReserve
    ) internal returns (address tokenAddress, address curveAddress) {
        if (msg.value < launchFee) revert InvalidFee();

        uint256 initialBuyQuote = msg.value - launchFee;

        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: twitter,
            telegram: telegram,
            discord: "",
            website: website,
            farcaster: ""
        });

        bytes32 tokenSalt = keccak256(abi.encode(msg.sender, _nonce));
        bytes32 curveSalt = keccak256(abi.encode(msg.sender, _nonce, uint256(1)));
        _nonce++;

        LaunchpadToken token = new LaunchpadToken{salt: tokenSalt}();
        BondingCurve curve = new BondingCurve{salt: curveSalt}();
        tokenAddress = address(token);
        curveAddress = address(curve);

        token.initialize(
            name,
            symbol,
            logo,
            description,
            socials,
            msg.sender,
            address(0),
            address(this)
        );

        curve.initialize(
            tokenAddress,
            address(this),
            protocolFeeRecipient,
            payable(msg.sender),
            graduationTarget,
            virtualQuoteReserve,
            virtualTokenReserve,
            poolManagerV4,
            memeHook
        );

        bool tokenSent = token.transfer(curveAddress, token.totalSupply());
        if (!tokenSent) revert TransferFailed();


        launches[tokenAddress] = V2Launch({
            token: tokenAddress,
            curve: curveAddress,
            creator: msg.sender,
            createdAt: block.timestamp,
            graduated: false
        });
        curveToToken[curveAddress] = tokenAddress;
        allLaunches.push(tokenAddress);

        emit TokenLaunchedV2(tokenAddress, curveAddress, msg.sender, name, symbol, initialBuyQuote);

        (bool feeOk, ) = protocolFeeRecipient.call{value: launchFee}("");
        if (!feeOk) revert TransferFailed();

        if (initialBuyQuote > 0) {
            uint256 tokensBought = curve.buyFor{value: initialBuyQuote}(
                msg.sender,
                minInitialTokensOut
            );
            require(tokensBought >= minInitialTokensOut, "Slippage");
        }

        // M-02 fix: register the curve as the liquidity pool AFTER the initial buy
        // so creator initial buy is not blocked by anti-snipe restrictions.
        token.setLiquidityPool(curveAddress);
    }

    // ---------------------------------------------------------------------------
    // Administrative pass-throughs
    // ---------------------------------------------------------------------------

    function migrateCurveToV4(address curveAddress, address payable recipient) external onlyOwner {
        IBondingCurve(curveAddress).migrateToV4(recipient);
        address tokenAddress = curveToToken[curveAddress];
        if (tokenAddress != address(0)) {
            launches[tokenAddress].graduated = true;
        }
    }

    function emergencyWithdrawFromCurve(address curveAddress, address payable recipient) external onlyOwner {
        IBondingCurve(curveAddress).emergencyWithdraw(recipient);
        address tokenAddress = curveToToken[curveAddress];
        if (tokenAddress != address(0)) {
            launches[tokenAddress].graduated = true;
        }
    }
}
