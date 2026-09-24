// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILaunchpadFactory} from "./interfaces/ILaunchpadFactory.sol";
import {ILaunchpadToken} from "./interfaces/ILaunchpadToken.sol";
import {ILiquidityLocker} from "./interfaces/ILiquidityLocker.sol";
import {
    IUniswapV3Factory,
    IUniswapV3Pool,
    INonfungiblePositionManager,
    ISwapRouter,
    IWETH
} from "./interfaces/IUniswapV3.sol";
import {LaunchpadToken} from "./LaunchpadToken.sol";
import {LiquidityLocker} from "./LiquidityLocker.sol";

/**
 * @title LaunchpadFactory
 * @notice Atomic deployment factory for fixed-supply tokens with Uniswap V3 locked liquidity.
 *
 * Security model:
 *   - Ownership follows a two-step transfer pattern: propose then accept.
 *   - All ETH transfers use CEI ordering with explicit success checks.
 *   - The launch fee is forwarded to treasury before any token or pool is created.
 */
contract LaunchpadFactory is ILaunchpadFactory {
    IUniswapV3Factory public immutable uniswapV3Factory;
    INonfungiblePositionManager public immutable positionManager;
    ISwapRouter public immutable swapRouter;
    address public immutable override weth;
    address public override locker;
    address public protocolFeeRecipient;
    address public owner;

    // C-01 fix: pending owner for two-step ownership transfer.
    address public pendingOwner;

    uint24 public constant POOL_FEE = 10000;
    int24 public constant TICK_LOWER = -887200;
    int24 public constant TICK_UPPER = 887200;

    uint256 public override launchFee = 0.0005 ether;
    uint256 public override graduationThreshold = 4.2 ether;
    uint256 public defaultProtocolFeeShare = 30;

    mapping(address => LaunchedToken) public launchedTokens;
    address[] public allTokens;

    error Unauthorized();
    error InsufficientLaunchFee();
    error ZeroAddress();
    error InvalidFee();
    error PoolCreationFailed();
    error NoPendingOwner();
    error TransferFailed();

    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(
        address _v3Factory,
        address _positionManager,
        address _swapRouter,
        address _weth,
        address _protocolFeeRecipient
    ) {
        if (
            _v3Factory == address(0) ||
            _positionManager == address(0) ||
            _swapRouter == address(0) ||
            _weth == address(0) ||
            _protocolFeeRecipient == address(0)
        ) {
            revert ZeroAddress();
        }

        uniswapV3Factory = IUniswapV3Factory(_v3Factory);
        positionManager = INonfungiblePositionManager(_positionManager);
        swapRouter = ISwapRouter(_swapRouter);
        weth = _weth;
        protocolFeeRecipient = _protocolFeeRecipient;
        owner = msg.sender;

        LiquidityLocker newLocker = new LiquidityLocker(
            _positionManager,
            _weth,
            _protocolFeeRecipient
        );
        locker = address(newLocker);
    }

    receive() external payable {}

    // ---------------------------------------------------------------------------
    // Owner administration
    // ---------------------------------------------------------------------------

    function setLocker(address _locker) external onlyOwner {
        if (_locker == address(0)) revert ZeroAddress();
        locker = _locker;
    }

    function setLaunchFee(uint256 _fee) external onlyOwner {
        launchFee = _fee;
    }

    function setGraduationThreshold(uint256 _threshold) external onlyOwner {
        graduationThreshold = _threshold;
    }

    function setProtocolFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        protocolFeeRecipient = _recipient;
    }

    function setDefaultProtocolFeeShare(uint256 newShare) external onlyOwner {
        if (newShare > 100) revert InvalidFee();
        defaultProtocolFeeShare = newShare;
    }

    /**
     * @notice Step 1 of two-step ownership transfer. Proposes a new owner.
     * @dev C-01 fix: ownership is not transferred immediately. The candidate
     *      must call acceptOwnership() to complete the transfer, preventing
     *      accidental permanent loss of control to an invalid address.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(newOwner);
    }

    /**
     * @notice Step 2 of two-step ownership transfer. Must be called by the
     *         proposed owner to finalise the transfer.
     */
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

    function launchToken(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        ILaunchpadToken.Socials memory socials,
        uint256 initialBuyAmount
    ) external payable override returns (address tokenAddress, address poolAddress) {
        if (msg.value < launchFee + initialBuyAmount) revert InsufficientLaunchFee();

        // 1. Route launch fee to protocol treasury before any other action (CEI).
        if (launchFee > 0) {
            (bool feeSent, ) = protocolFeeRecipient.call{value: launchFee}("");
            if (!feeSent) revert InsufficientLaunchFee();
        }

        // 2. Deploy token; factory is initial recipient so it can seed the pool.
        LaunchpadToken token = new LaunchpadToken(
            name,
            symbol,
            logo,
            description,
            socials,
            msg.sender,
            weth,
            address(this)
        );
        tokenAddress = address(token);

        // 3. Determine token ordering and create the Uniswap V3 pool.
        bool isToken0 = tokenAddress < weth;
        address token0 = isToken0 ? tokenAddress : weth;
        address token1 = isToken0 ? weth : tokenAddress;

        poolAddress = uniswapV3Factory.createPool(token0, token1, POOL_FEE);
        if (poolAddress == address(0)) revert PoolCreationFailed();

        // Target initial price: 1 token ~= 1e-9 WETH.
        // sqrtPriceX96 = sqrt(price) * 2^96
        uint160 sqrtPriceX96 = isToken0
            ? 2505414483750479299401734
            : 2505414483750479299401734000000000;

        IUniswapV3Pool(poolAddress).initialize(sqrtPriceX96);

        // 4. Provide full token supply as single-sided liquidity.
        uint256 tokenSupply = token.balanceOf(address(this));
        token.approve(address(positionManager), tokenSupply);

        // F-10 fix: supply realistic minimum token amounts to guard against
        // price manipulation between pool initialisation and mint. For single-sided
        // liquidity (only the token side is non-zero), we protect the non-zero leg
        // with a 99% floor (1% tolerance). The zero-desired leg remains at 0 because
        // no ETH/WETH is expected to be placed at this price point.
        uint256 amount0MinGuard = isToken0 ? (tokenSupply * 9900) / 10000 : 0;
        uint256 amount1MinGuard = isToken0 ? 0 : (tokenSupply * 9900) / 10000;

        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: POOL_FEE,
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            amount0Desired: isToken0 ? tokenSupply : 0,
            amount1Desired: isToken0 ? 0 : tokenSupply,
            amount0Min: amount0MinGuard,
            amount1Min: amount1MinGuard,
            recipient: locker,
            deadline: block.timestamp + 1200
        });

        (uint256 positionId, , , ) = positionManager.mint(mintParams);

        // 5. Permanently lock the LP position.
        ILiquidityLocker(locker).lockPosition(
            tokenAddress,
            positionId,
            msg.sender,
            defaultProtocolFeeShare
        );

        // 6. Register the pool on the token for anti-snipe enforcement.
        token.setLiquidityPool(poolAddress);

        // 7. Execute optional creator initial buy.
        if (initialBuyAmount > 0) {
            IWETH(weth).deposit{value: initialBuyAmount}();
            IWETH(weth).approve(address(swapRouter), initialBuyAmount);

            ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: tokenAddress,
                fee: POOL_FEE,
                recipient: msg.sender,
                deadline: block.timestamp + 1200,
                amountIn: initialBuyAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

            swapRouter.exactInputSingle(swapParams);
        }

        // 8. Record state.
        LaunchedToken memory launched = LaunchedToken({
            token: tokenAddress,
            deployer: msg.sender,
            pairedToken: weth,
            positionManager: address(positionManager),
            positionId: positionId,
            dexId: 1,
            launchConfigId: 1,
            restrictionsEndBlock: token.restrictionsEndBlock(),
            supply: token.totalSupply(),
            isToken0: isToken0,
            poolFee: POOL_FEE,
            exists: true,
            initialBuyAmount: initialBuyAmount
        });

        launchedTokens[tokenAddress] = launched;
        allTokens.push(tokenAddress);

        emit TokenLaunched(
            tokenAddress,
            msg.sender,
            address(uniswapV3Factory),
            weth,
            poolAddress,
            1,
            1,
            positionId,
            launched.restrictionsEndBlock,
            initialBuyAmount
        );

        // 9. Refund excess ETH to caller (BUG-10 fix).
        uint256 excess = msg.value - (launchFee + initialBuyAmount);
        if (excess > 0) {
            (bool refundOk, ) = msg.sender.call{value: excess}("");
            if (!refundOk) revert TransferFailed();
        }
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function graduationStatus(address token) external view override returns (
        uint256 pairedPrincipal,
        uint256 threshold,
        bool graduated
    ) {
        LaunchedToken memory launched = launchedTokens[token];
        if (!launched.exists) return (0, graduationThreshold, false);

        address pool = uniswapV3Factory.getPool(
            launched.token,
            launched.pairedToken,
            launched.poolFee
        );

        if (pool == address(0)) return (0, graduationThreshold, false);

        pairedPrincipal = IWETH(weth).balanceOf(pool);
        threshold = graduationThreshold;
        graduated = pairedPrincipal >= threshold;
    }

    function getLaunchedToken(address token) external view override returns (LaunchedToken memory) {
        return launchedTokens[token];
    }

    function totalTokensCount() external view returns (uint256) {
        return allTokens.length;
    }
}
