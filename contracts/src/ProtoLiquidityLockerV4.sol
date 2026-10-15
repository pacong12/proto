// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILiquidityLocker} from "./interfaces/ILiquidityLocker.sol";
import {IPositionManagerV4} from "./interfaces/IUniswapV4.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {IHolderFeeDistributor} from "./interfaces/IHolderFeeDistributor.sol";
import {FeeMath} from "./libraries/FeeMath.sol";

/**
 * @title ProtoLiquidityLockerV4
 * @notice Sovereign Liquidity Locker for Uniswap V4 on Robinhood Chain.
 *         Permanently locks Uniswap V4 LP NFT positions (UNI-V4-POSM)
 *         and manages protocol/creator fee distributions without third-party dependency.
 */
contract ProtoLiquidityLockerV4 is ILiquidityLocker {
    struct FeeDistribution {
        uint256 totalTokenFee;
        uint256 totalWethFee;
        uint256 protocolTokenFee;
        uint256 protocolWethFee;
        uint256 creatorTokenFee;
        uint256 creatorWethFee;
        address creatorRecipient;
    }

    struct PendingRedirect {
        address pendingAddress;
        uint256 validAfter;
    }

    uint256 public constant REDIRECT_TIMELOCK = 48 hours;

    IPositionManagerV4 public immutable positionManager;
    address public immutable factory;
    address public immutable weth;
    address public protocolFeeRecipient;
    address public holderFeeDistributor;
    address public owner;
    address public pendingOwner;

    mapping(address => uint256) public override tokenPositions;
    mapping(address => address) public override tokenDeployers;
    mapping(address => uint256) public override tokenProtocolFeeShares;
    mapping(address => address) public override feeRedirects;
    mapping(address => PendingRedirect) public pendingFeeRedirects;

    error Unauthorized();
    error AlreadyLocked();
    error NotLocked();
    error ZeroAddress();
    error InvalidShare();
    error TransferFailed();
    error Reentrancy();
    error TimelockNotExpired();
    error NoPendingRedirect();

    bool private _locked;

    event PendingFeeRedirectProposed(address indexed token, address indexed redirect, uint256 validAfter);
    event PendingOwnershipProposed(address indexed proposedOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(
        address _positionManager,
        address _weth,
        address _protocolFeeRecipient
    ) {
        if (_positionManager == address(0) || _weth == address(0) || _protocolFeeRecipient == address(0)) {
            revert ZeroAddress();
        }
        positionManager = IPositionManagerV4(_positionManager);
        weth = _weth;
        protocolFeeRecipient = _protocolFeeRecipient;
        factory = msg.sender;
        owner = msg.sender;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function lockPosition(
        address token,
        uint256 positionId,
        address deployer,
        uint256 protocolFeeShare
    ) external override onlyFactory {
        if (token == address(0) || deployer == address(0)) revert ZeroAddress();
        if (tokenPositions[token] != 0) revert AlreadyLocked();
        if (protocolFeeShare > 100) revert InvalidShare();

        tokenPositions[token] = positionId;
        tokenDeployers[token] = deployer;
        tokenProtocolFeeShares[token] = protocolFeeShare;

        emit PositionLocked(token, positionId, deployer, protocolFeeShare);
    }

    function isLocked(address token) external view returns (bool) {
        return tokenPositions[token] != 0;
    }

    function setFeeRedirect(address token, address redirect) external override {
        address deployer = tokenDeployers[token];
        if (msg.sender != deployer) revert Unauthorized();
        if (redirect == address(0)) revert ZeroAddress();
        uint256 validAfter = block.timestamp + REDIRECT_TIMELOCK;
        pendingFeeRedirects[token] = PendingRedirect({pendingAddress: redirect, validAfter: validAfter});
        emit PendingFeeRedirectProposed(token, redirect, validAfter);
    }

    function acceptFeeRedirect(address token) external {
        PendingRedirect memory pr = pendingFeeRedirects[token];
        if (pr.pendingAddress == address(0)) revert NoPendingRedirect();
        if (block.timestamp < pr.validAfter) revert TimelockNotExpired();
        address deployer = tokenDeployers[token];
        if (msg.sender != deployer && msg.sender != pr.pendingAddress) revert Unauthorized();
        feeRedirects[token] = pr.pendingAddress;
        delete pendingFeeRedirects[token];
        emit FeeRedirectUpdated(token, pr.pendingAddress);
    }

    function cancelFeeRedirect(address token) external override {
        address deployer = tokenDeployers[token];
        if (msg.sender != deployer) revert Unauthorized();
        delete pendingFeeRedirects[token];
        feeRedirects[token] = address(0);
        emit FeeRedirectCancelled(token);
    }

    function claimFees(address token) external override nonReentrant returns (uint256 creatorTokenFee, uint256 creatorWethFee) {
        address redirect = feeRedirects[token];
        if (msg.sender != tokenDeployers[token] && (redirect == address(0) || msg.sender != redirect)) {
            revert Unauthorized();
        }
        uint256 positionId = tokenPositions[token];
        if (positionId == 0) revert NotLocked();

        // Accumulate pending balance held by the locker
        uint256 tokenBal = ILaunchpadToken(token).balanceOf(address(this));
        uint256 wethBal = address(this).balance;

        uint256 protocolSharePercent = tokenProtocolFeeShares[token];
        (creatorTokenFee, ) = FeeMath.calculateLockerSplit(tokenBal, protocolSharePercent);
        (creatorWethFee, ) = FeeMath.calculateLockerSplit(wethBal, protocolSharePercent);

        address recipient = redirect != address(0) ? redirect : tokenDeployers[token];

        if (creatorTokenFee > 0) {
            bool ok = ILaunchpadToken(token).transfer(recipient, creatorTokenFee);
            if (!ok) revert TransferFailed();
        }

        if (creatorWethFee > 0) {
            (bool ok, ) = recipient.call{value: creatorWethFee}("");
            if (!ok) revert TransferFailed();
        }

        emit FeesClaimed(token, creatorTokenFee, creatorWethFee, recipient);
        return (creatorTokenFee, creatorWethFee);
    }

    function setProtocolFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        protocolFeeRecipient = newRecipient;
    }

    function setHolderFeeDistributor(address _distributor) external onlyOwner {
        holderFeeDistributor = _distributor;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit PendingOwnershipProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    receive() external payable {}
}
