// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILiquidityLocker} from "./interfaces/ILiquidityLocker.sol";
import {INonfungiblePositionManager, IWETH} from "./interfaces/IUniswapV3.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";

/**
 * @title LiquidityLocker
 * @notice Permanently locks Uniswap V3 LP positions and handles fee distribution between creator and protocol.
 */
contract LiquidityLocker is ILiquidityLocker {
    struct FeeDistribution {
        uint256 totalTokenFee;
        uint256 totalWethFee;
        uint256 protocolTokenFee;
        uint256 protocolWethFee;
        uint256 creatorTokenFee;
        uint256 creatorWethFee;
        address creatorRecipient;
    }

    INonfungiblePositionManager public immutable positionManager;
    address public immutable factory;
    address public immutable weth;
    address public protocolFeeRecipient;
    address public owner;

    mapping(address => uint256) public override tokenPositions;
    mapping(address => address) public override tokenDeployers;
    mapping(address => uint256) public override tokenProtocolFeeShares;
    mapping(address => address) public override feeRedirects;

    error Unauthorized();
    error AlreadyLocked();
    error NotLocked();
    error ZeroAddress();
    error InvalidShare();
    error TransferFailed();
    error Reentrancy();

    bool private _locked;

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
        positionManager = INonfungiblePositionManager(_positionManager);
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

    function setFeeRedirect(address token, address redirect) external override {
        address deployer = tokenDeployers[token];
        if (msg.sender != deployer && msg.sender != owner) revert Unauthorized();
        feeRedirects[token] = redirect;
        emit FeeRedirectUpdated(token, redirect);
    }

    function setProtocolFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        protocolFeeRecipient = recipient;
    }

    function claimFees(address token) external override nonReentrant returns (uint256 creatorTokenFee, uint256 creatorWethFee) {
        uint256 positionId = tokenPositions[token];
        if (positionId == 0) revert NotLocked();

        (uint256 amount0, uint256 amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: positionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        (, , address token0, , , , , , , , , ) = positionManager.positions(positionId);

        FeeDistribution memory dist;
        dist.totalTokenFee = token == token0 ? amount0 : amount1;
        dist.totalWethFee = token == token0 ? amount1 : amount0;

        uint256 protocolSharePercent = tokenProtocolFeeShares[token];
        dist.protocolTokenFee = (dist.totalTokenFee * protocolSharePercent) / 100;
        dist.protocolWethFee = (dist.totalWethFee * protocolSharePercent) / 100;

        dist.creatorTokenFee = dist.totalTokenFee - dist.protocolTokenFee;
        dist.creatorWethFee = dist.totalWethFee - dist.protocolWethFee;

        address redirect = feeRedirects[token];
        dist.creatorRecipient = redirect != address(0) ? redirect : tokenDeployers[token];

        _routeFees(token, dist);

        emit FeesClaimed(token, dist.creatorTokenFee, dist.creatorWethFee, dist.creatorRecipient);
        return (dist.creatorTokenFee, dist.creatorWethFee);
    }

    function _routeFees(address token, FeeDistribution memory dist) internal {
        if (dist.protocolTokenFee > 0) {
            ILaunchpadToken(token).transfer(protocolFeeRecipient, dist.protocolTokenFee);
        }
        if (dist.protocolWethFee > 0) {
            IWETH(weth).transfer(protocolFeeRecipient, dist.protocolWethFee);
        }
        if (dist.creatorTokenFee > 0) {
            ILaunchpadToken(token).transfer(dist.creatorRecipient, dist.creatorTokenFee);
        }
        if (dist.creatorWethFee > 0) {
            IWETH(weth).transfer(dist.creatorRecipient, dist.creatorWethFee);
        }
    }
}
