// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchpadToken} from "../../core/LaunchpadToken.sol";
import {ILaunchpadToken} from "../../interfaces/ILaunchpadToken.sol";
import {PoolKey, PoolIdLibrary} from "../../interfaces/IUniswapV4.sol";
import {
    IPoolManagerV4,
    IUnlockCallback,
    ModifyLiquidityParams,
    SwapParams
} from "../../interfaces/external/IUniswapV4Core.sol";
import {TickMath} from "../../libraries/v4/TickMath.sol";
import {V4Lib} from "../../libraries/v4/V4Lib.sol";
import {ProtoFeeSplitter, ProtoFeeSplitterDeployer} from "../../core/ProtoFeeSplitter.sol";
import {ProtoV4Hook} from "../../core/ProtoV4Hook.sol";

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title LaunchpadV2FactoryArc
 * @notice In-pool Uniswap v4 launch portal for Arc Network (Chain ID: 5042), aligned with the
 *         current Argus portal. There is no bonding-curve contract and no migration:
 *
 *   1. The token is deployed and 100% of supply is added as single-sided liquidity to a
 *      USDC/token v4 pool over [-887200, initialTick] (mirrored when the token sorts first).
 *      The position is owned by this factory, which has no way to remove it (locked forever).
 *   2. The creator's mandatory prebuy (>= 4.50 USDC, <= 5% of supply) is swapped atomically.
 *   3. Trading continues in the same pool forever; ProtoV4Hook charges the token's fixed
 *      buy/sell tax in USDC and flags graduation when price crosses `bondTick`.
 *
 * Defaults (Argus portal): opening tick 405400 (~$2,480 FDV), bondTick 376400 (~$45,079 FDV),
 * 1% pool fee, tickSpacing 200, 0 launch fee, 30% protocol cut of tax, tax 0–10% per side.
 *
 * Payment: the prebuy is sent as native USDC in msg.value (18 decimals); on Arc the same balance
 * is spendable through the USDC ERC-20 at 0x3600… (6 decimals).
 */
contract LaunchpadV2FactoryArc is IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    struct TokenMetadata {
        string name;
        string symbol;
        string logo;
        string description;
        string twitter;
        string telegram;
        string website;
    }

    /// @notice Fixed-forever tax: buy/sell bps plus how the post-protocol remainder is split.
    struct TaxConfig {
        uint16 buyTaxBps;
        uint16 sellTaxBps;
        uint16 holdersBps;
        uint16 burnBps;
        uint16 creatorBps;
        uint16 liquidityBps;
    }

    struct Launch {
        address creator;
        address splitter;
        bytes32 poolId;
        uint64 createdAt;
        bool quoteIsCurrency0;
    }

    uint256 private constant BPS = 10_000;
    uint256 private constant NATIVE_TO_USDC6 = 1e12;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    uint24 public constant POOL_FEE = 10_000;
    int24 public constant TICK_SPACING = 200;
    int24 public constant FULL_RANGE_TICK = 887_200;
    uint16 public constant MAX_TAX_BPS = 1_000;

    IPoolManagerV4 public immutable poolManager;
    address public immutable quoteAsset;
    ProtoV4Hook public immutable hook;
    ProtoFeeSplitterDeployer public immutable splitterDeployer;

    // Owner-tunable launch parameters (Argus portal defaults).
    int24 public initialTick = 405_400;
    int24 public bondTick = 376_400;
    uint256 public minPrebuyUsdc6 = 4_500_000;
    uint16 public maxDevBuyBps = 500;
    uint16 public protocolFeeBps = 3_000;
    uint256 public launchFee;

    address payable public protocolFeeRecipient;
    address public buybackVault;
    address public liquidityVault;
    address public owner;
    address public pendingOwner;

    bool private _locked;
    uint256 private _nonce;

    mapping(address => Launch) public launches;
    address[] public allLaunches;

    enum Action {
        Launch,
        CollectFees
    }

    event TokenLaunchedV4(
        address indexed token,
        bytes32 indexed poolId,
        address indexed creator,
        address splitter,
        string name,
        string symbol,
        uint256 prebuyUsdc6,
        uint256 creatorTokens
    );
    event LpFeesCollected(address indexed token, uint256 quoteFees, uint256 tokenFeesBurned);
    event LaunchParamsUpdated(
        int24 initialTick, int24 bondTick, uint256 minPrebuyUsdc6, uint16 maxDevBuyBps, uint16 protocolFeeBps
    );
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event RecipientsUpdated(address protocolFeeRecipient, address buybackVault, address liquidityVault);
    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error InvalidFee();
    error InvalidPrebuy();
    error InvalidTax();
    error InvalidParams();
    error DevBuyTooLarge();
    error Slippage();
    error UnknownToken();
    error TransferFailed();
    error ZeroAddress();
    error Unauthorized();
    error NoPendingOwner();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(
        IPoolManagerV4 _poolManager,
        address _quoteAsset,
        ProtoV4Hook _hook,
        ProtoFeeSplitterDeployer _splitterDeployer,
        address payable _feeRecipient
    ) {
        if (
            address(_poolManager) == address(0) || _quoteAsset == address(0) || address(_hook) == address(0)
                || address(_splitterDeployer) == address(0) || _feeRecipient == address(0)
        ) revert ZeroAddress();
        poolManager = _poolManager;
        quoteAsset = _quoteAsset;
        hook = _hook;
        splitterDeployer = _splitterDeployer;
        protocolFeeRecipient = _feeRecipient;
        buybackVault = _feeRecipient;
        liquidityVault = _feeRecipient;
        owner = msg.sender;
    }

    // ---------------------------------------------------------------------------
    // Launch
    // ---------------------------------------------------------------------------

    /**
     * @notice Launch a token directly into its Uniswap v4 pool.
     * @dev msg.value = launchFee + prebuy, in native USDC wei (18 decimals); the prebuy must be a
     *      whole number of 6-decimal USDC units.
     * @param minTokensOut Slippage floor for the creator prebuy.
     */
    function launchToken(TokenMetadata calldata meta, TaxConfig calldata tax, uint256 minTokensOut)
        external
        payable
        nonReentrant
        returns (address tokenAddress, bytes32 poolId)
    {
        if (msg.value < launchFee) revert InvalidFee();
        uint256 prebuyWei = msg.value - launchFee;
        if (prebuyWei % NATIVE_TO_USDC6 != 0) revert InvalidPrebuy();
        uint256 prebuyUsdc6 = prebuyWei / NATIVE_TO_USDC6;
        if (prebuyUsdc6 < minPrebuyUsdc6) revert InvalidPrebuy();
        _validateTax(tax);

        LaunchpadToken token = new LaunchpadToken{salt: _tokenSalt(msg.sender, _nonce++)}();
        tokenAddress = address(token);
        // liquidityPool is intentionally never set: LaunchpadToken's own transfer tax and
        // block restrictions would break v4 settlement. Taxes live in the hook instead.
        token.initialize(
            meta.name,
            meta.symbol,
            meta.logo,
            meta.description,
            ILaunchpadToken.Socials({
                twitter: meta.twitter, telegram: meta.telegram, discord: "", website: meta.website, farcaster: ""
            }),
            msg.sender,
            quoteAsset,
            address(this)
        );

        ProtoFeeSplitter splitter = ProtoFeeSplitter(
            payable(splitterDeployer.deploy(
                    ProtoFeeSplitter.Config({
                        token: tokenAddress,
                        quoteAsset: quoteAsset,
                        hook: address(hook),
                        factory: address(this),
                        poolManager: address(poolManager),
                        excluded: address(0),
                        treasury: protocolFeeRecipient,
                        buybackVault: buybackVault,
                        liquidityVault: liquidityVault,
                        creator: msg.sender
                    }),
                    ProtoFeeSplitter.Split({
                        protocolBps: protocolFeeBps,
                        holdersBps: tax.holdersBps,
                        burnBps: tax.burnBps,
                        creatorBps: tax.creatorBps,
                        liquidityBps: tax.liquidityBps
                    })
                ))
        );
        token.setRewardTracker(address(splitter));

        bool quoteIsCurrency0 = quoteAsset < tokenAddress;
        PoolKey memory key = _poolKey(tokenAddress, quoteIsCurrency0);
        poolId = key.toId();

        launches[tokenAddress] = Launch({
            creator: msg.sender,
            splitter: address(splitter),
            poolId: poolId,
            createdAt: uint64(block.timestamp),
            quoteIsCurrency0: quoteIsCurrency0
        });
        allLaunches.push(tokenAddress);

        hook.registerPool(
            key,
            ProtoV4Hook.PoolRegistration({
                token: tokenAddress,
                splitter: address(splitter),
                buyTaxBps: tax.buyTaxBps,
                sellTaxBps: tax.sellTaxBps,
                bondTick: quoteIsCurrency0 ? bondTick : -bondTick,
                bonded: true,
                antiSnipe: true
            })
        );

        (int24 tickLower, int24 tickUpper) = _range(quoteIsCurrency0);
        poolManager.initialize(key, TickMath.getSqrtPriceAtTick(quoteIsCurrency0 ? tickUpper : tickLower));

        if (launchFee > 0) {
            (bool feeOk,) = protocolFeeRecipient.call{value: launchFee}("");
            if (!feeOk) revert TransferFailed();
        }

        uint256 creatorTokens = abi.decode(
            poolManager.unlock(abi.encode(Action.Launch, abi.encode(key, quoteIsCurrency0, prebuyUsdc6, msg.sender))),
            (uint256)
        );
        if (creatorTokens < minTokensOut) revert Slippage();
        if (creatorTokens > (token.totalSupply() * maxDevBuyBps) / BPS) revert DevBuyTooLarge();

        // Rounding dust left over from the liquidity calculation is burned.
        uint256 dust = token.balanceOf(address(this));
        if (dust > 0 && !token.transfer(DEAD, dust)) revert TransferFailed();

        emit TokenLaunchedV4(
            tokenAddress, poolId, msg.sender, address(splitter), meta.name, meta.symbol, prebuyUsdc6, creatorTokens
        );
    }

    /**
     * @notice Collects the locked position's LP fees: USDC is distributed through the token's
     *         splitter, token-side fees are burned. Callable by anyone.
     */
    function collectFees(address token) external nonReentrant returns (uint256 quoteFees, uint256 tokenFees) {
        Launch memory l = launches[token];
        if (l.splitter == address(0)) revert UnknownToken();
        (quoteFees, tokenFees) = abi.decode(
            poolManager.unlock(
                abi.encode(
                    Action.CollectFees, abi.encode(_poolKey(token, l.quoteIsCurrency0), l.quoteIsCurrency0, l.splitter)
                )
            ),
            (uint256, uint256)
        );
        if (quoteFees > 0) ProtoFeeSplitter(payable(l.splitter)).distributeFees(quoteFees);
        emit LpFeesCollected(token, quoteFees, tokenFees);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert Unauthorized();
        (Action action, bytes memory payload) = abi.decode(data, (Action, bytes));
        if (action == Action.Launch) return _launchCallback(payload);
        return _collectCallback(payload);
    }

    function _launchCallback(bytes memory payload) private returns (bytes memory) {
        (PoolKey memory key, bool quoteIsCurrency0, uint256 prebuyUsdc6, address creator) =
            abi.decode(payload, (PoolKey, bool, uint256, address));
        address token = quoteIsCurrency0 ? key.currency1 : key.currency0;
        (int24 tickLower, int24 tickUpper) = _range(quoteIsCurrency0);

        uint160 sqrtLower = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtPriceAtTick(tickUpper);
        uint256 supply = LaunchpadToken(token).totalSupply();
        uint128 liquidity = quoteIsCurrency0
            ? V4Lib.liquidityForAmount1(sqrtLower, sqrtUpper, supply)
            : V4Lib.liquidityForAmount0(sqrtLower, sqrtUpper, supply);

        (int256 callerDelta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: int256(uint256(liquidity)), salt: bytes32(0)
            }),
            ""
        );
        _settle(token, V4Lib.abs(quoteIsCurrency0 ? V4Lib.amount1(callerDelta) : V4Lib.amount0(callerDelta)));

        // Pay the prebuy up front, then swap it (hook tax included) for the creator's tokens.
        _settle(quoteAsset, prebuyUsdc6);
        int256 swapDelta = poolManager.swap(
            key,
            SwapParams({
                zeroForOne: quoteIsCurrency0,
                amountSpecified: -int256(prebuyUsdc6),
                sqrtPriceLimitX96: quoteIsCurrency0 ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );
        uint256 tokensOut = V4Lib.abs(quoteIsCurrency0 ? V4Lib.amount1(swapDelta) : V4Lib.amount0(swapDelta));
        poolManager.take(token, creator, tokensOut);
        return abi.encode(tokensOut);
    }

    function _collectCallback(bytes memory payload) private returns (bytes memory) {
        (PoolKey memory key, bool quoteIsCurrency0, address splitter) = abi.decode(payload, (PoolKey, bool, address));
        (int24 tickLower, int24 tickUpper) = _range(quoteIsCurrency0);
        (int256 callerDelta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: 0, salt: bytes32(0)}),
            ""
        );
        uint256 fees0 = uint256(int256(V4Lib.amount0(callerDelta)));
        uint256 fees1 = uint256(int256(V4Lib.amount1(callerDelta)));
        (uint256 quoteFees, uint256 tokenFees) = quoteIsCurrency0 ? (fees0, fees1) : (fees1, fees0);
        if (quoteFees > 0) poolManager.take(quoteAsset, splitter, quoteFees);
        if (tokenFees > 0) poolManager.take(quoteIsCurrency0 ? key.currency1 : key.currency0, DEAD, tokenFees);
        return abi.encode(quoteFees, tokenFees);
    }

    function _settle(address currency, uint256 amount) private {
        if (amount == 0) return;
        poolManager.sync(currency);
        if (!IERC20Transfer(currency).transfer(address(poolManager), amount)) revert TransferFailed();
        poolManager.settle();
    }

    // ---------------------------------------------------------------------------
    // Views & helpers
    // ---------------------------------------------------------------------------

    function getLaunchCount() external view returns (uint256) {
        return allLaunches.length;
    }

    function predictTokenAddress(address creator, uint256 nonce) external view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff), address(this), _tokenSalt(creator, nonce), keccak256(type(LaunchpadToken).creationCode)
            )
        );
        return address(uint160(uint256(hash)));
    }

    function nextNonce() external view returns (uint256) {
        return _nonce;
    }

    function poolKeyOf(address token) external view returns (PoolKey memory) {
        Launch memory l = launches[token];
        if (l.splitter == address(0)) revert UnknownToken();
        return _poolKey(token, l.quoteIsCurrency0);
    }

    function _poolKey(address token, bool quoteIsCurrency0) private view returns (PoolKey memory) {
        return PoolKey({
            currency0: quoteIsCurrency0 ? quoteAsset : token,
            currency1: quoteIsCurrency0 ? token : quoteAsset,
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: address(hook)
        });
    }

    /// @dev Range holding only the token at the opening price, mirrored when the token is currency0.
    function _range(bool quoteIsCurrency0) private view returns (int24 tickLower, int24 tickUpper) {
        return quoteIsCurrency0 ? (-FULL_RANGE_TICK, initialTick) : (-initialTick, FULL_RANGE_TICK);
    }

    function _tokenSalt(address creator, uint256 nonce) private pure returns (bytes32) {
        return keccak256(abi.encode(creator, nonce));
    }

    function _validateTax(TaxConfig calldata tax) private pure {
        if (tax.buyTaxBps > MAX_TAX_BPS || tax.sellTaxBps > MAX_TAX_BPS) revert InvalidTax();
        if (tax.buyTaxBps == 0 && tax.sellTaxBps == 0) revert InvalidTax();
        if (uint256(tax.holdersBps) + tax.burnBps + tax.creatorBps + tax.liquidityBps != BPS) revert InvalidTax();
    }

    // ---------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------

    function setLaunchParams(
        int24 _initialTick,
        int24 _bondTick,
        uint256 _minPrebuyUsdc6,
        uint16 _maxDevBuyBps,
        uint16 _protocolFeeBps
    ) external onlyOwner {
        if (
            _initialTick <= 0 || _initialTick % TICK_SPACING != 0 || _initialTick >= FULL_RANGE_TICK
                || _bondTick >= _initialTick || _maxDevBuyBps > BPS || _protocolFeeBps > BPS
        ) revert InvalidParams();
        initialTick = _initialTick;
        bondTick = _bondTick;
        minPrebuyUsdc6 = _minPrebuyUsdc6;
        maxDevBuyBps = _maxDevBuyBps;
        protocolFeeBps = _protocolFeeBps;
        emit LaunchParamsUpdated(_initialTick, _bondTick, _minPrebuyUsdc6, _maxDevBuyBps, _protocolFeeBps);
    }

    function setLaunchFee(uint256 newFee) external onlyOwner {
        emit LaunchFeeUpdated(launchFee, newFee);
        launchFee = newFee;
    }

    function setRecipients(address payable _protocolFeeRecipient, address _buybackVault, address _liquidityVault)
        external
        onlyOwner
    {
        if (_protocolFeeRecipient == address(0) || _buybackVault == address(0) || _liquidityVault == address(0)) {
            revert ZeroAddress();
        }
        protocolFeeRecipient = _protocolFeeRecipient;
        buybackVault = _buybackVault;
        liquidityVault = _liquidityVault;
        emit RecipientsUpdated(_protocolFeeRecipient, _buybackVault, _liquidityVault);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
