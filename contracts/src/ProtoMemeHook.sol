// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks, PoolKey, PoolIdLibrary, IPoolManager} from "./interfaces/IUniswapV4.sol";
import {FeeMath} from "./libraries/FeeMath.sol";

/**
 * @title ProtoMemeHook
 * @notice Sovereign Uniswap V4 Custom Hook for Proto Protocol on Robinhood Chain.
 *         Manages dynamic trading fees, creator fee sharing, and buyback routing
 *         independently without third-party multisig dependency.
 */
contract ProtoMemeHook is IHooks {
    using PoolIdLibrary for PoolKey;

    struct PoolConfig {
        address token;
        address creator;
        address locker;
        uint16 creatorFeeShareBps; // BPS out of 10,000 (e.g. 5000 = 50%)
        uint16 buybackShareBps;    // BPS out of 10,000 (e.g. 2000 = 20%)
        bool initialized;
    }

    IPoolManager public immutable poolManager;
    address public protocolFeeRecipient;
    address public buybackVault;
    address public factory;
    address public owner;
    address public pendingOwner;

    mapping(bytes32 => PoolConfig) public poolConfigs;
    mapping(bytes32 => uint256) public pendingEthFees;
    mapping(bytes32 => uint256) public pendingTokenFees;

    event PoolRegistered(bytes32 indexed poolId, address indexed token, address indexed creator);
    event FeesSwept(bytes32 indexed poolId, uint256 creatorEth, uint256 protocolEth);
    event ProtocolFeeRecipientUpdated(address indexed newRecipient);
    event BuybackVaultUpdated(address indexed newVault);
    event PendingOwnershipProposed(address indexed proposedOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error ZeroAddress();
    error PoolAlreadyRegistered();
    error PoolNotRegistered();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert Unauthorized();
        _;
    }

    constructor(
        address _poolManager,
        address _protocolFeeRecipient,
        address _buybackVault
    ) {
        if (_poolManager == address(0) || _protocolFeeRecipient == address(0)) revert ZeroAddress();
        poolManager = IPoolManager(_poolManager);
        protocolFeeRecipient = _protocolFeeRecipient;
        buybackVault = _buybackVault;
        owner = msg.sender;
    }

    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    function registerPool(
        PoolKey calldata key,
        address token,
        address creator,
        address locker,
        uint16 creatorFeeShareBps,
        uint16 buybackShareBps
    ) external {
        if (msg.sender != owner && msg.sender != factory) revert Unauthorized();
        bytes32 poolId = key.toId();
        if (poolConfigs[poolId].initialized) revert PoolAlreadyRegistered();

        poolConfigs[poolId] = PoolConfig({
            token: token,
            creator: creator,
            locker: locker,
            creatorFeeShareBps: creatorFeeShareBps,
            buybackShareBps: buybackShareBps,
            initialized: true
        });

        emit PoolRegistered(poolId, token, creator);
    }

    // ---------------------------------------------------------------------------
    // Uniswap V4 Hook Callbacks
    // ---------------------------------------------------------------------------

    function beforeInitialize(
        address,
        PoolKey calldata,
        uint160
    ) external pure override returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(
        address,
        PoolKey calldata,
        uint160,
        int24
    ) external view override onlyPoolManager returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        bytes calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        bytes calldata,
        int256,
        int256,
        bytes calldata
    ) external pure override returns (bytes4, int256) {
        return (IHooks.afterAddLiquidity.selector, 0);
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        bytes calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        bytes calldata,
        int256,
        int256,
        bytes calldata
    ) external pure override returns (bytes4, int256) {
        return (IHooks.afterRemoveLiquidity.selector, 0);
    }

    function beforeSwap(
        address,
        PoolKey calldata,
        bytes calldata,
        bytes calldata
    ) external view override onlyPoolManager returns (bytes4, int256, uint24) {
        // Return selector with 0 delta and dynamic fee if needed
        return (IHooks.beforeSwap.selector, 0, 0);
    }

    function afterSwap(
        address,
        PoolKey calldata,
        bytes calldata,
        int256,
        bytes calldata
    ) external pure override returns (bytes4, int128) {
        return (IHooks.afterSwap.selector, 0);
    }

    // ---------------------------------------------------------------------------
    // Fee Sweeper & Distribution
    // ---------------------------------------------------------------------------

    function sweepPoolFees(bytes32 poolId) external {
        PoolConfig memory config = poolConfigs[poolId];
        if (!config.initialized) revert PoolNotRegistered();

        uint256 ethAvailable = pendingEthFees[poolId];
        if (ethAvailable > 0) {
            pendingEthFees[poolId] = 0;

            uint256 creatorShare = (ethAvailable * config.creatorFeeShareBps) / 10_000;
            uint256 buybackShare = (ethAvailable * config.buybackShareBps) / 10_000;
            uint256 protocolShare = ethAvailable > (creatorShare + buybackShare)
                ? ethAvailable - creatorShare - buybackShare
                : 0;

            if (creatorShare > 0 && config.creator != address(0)) {
                (bool ok1, ) = config.creator.call{value: creatorShare}("");
                if (!ok1) revert TransferFailed();
            }

            if (buybackShare > 0 && buybackVault != address(0)) {
                (bool ok2, ) = buybackVault.call{value: buybackShare}("");
                if (!ok2) revert TransferFailed();
            }

            if (protocolShare > 0 && protocolFeeRecipient != address(0)) {
                (bool ok3, ) = protocolFeeRecipient.call{value: protocolShare}("");
                if (!ok3) revert TransferFailed();
            }

            emit FeesSwept(poolId, creatorShare, protocolShare);
        }
    }

    function setProtocolFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        protocolFeeRecipient = newRecipient;
        emit ProtocolFeeRecipientUpdated(newRecipient);
    }

    function setBuybackVault(address newVault) external onlyOwner {
        buybackVault = newVault;
        emit BuybackVaultUpdated(newVault);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit PendingOwnershipProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }

    receive() external payable {}
}
