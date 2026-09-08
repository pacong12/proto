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
 */
contract LaunchpadFactory is ILaunchpadFactory {
    IUniswapV3Factory public immutable uniswapV3Factory;
    INonfungiblePositionManager public immutable positionManager;
    ISwapRouter public immutable swapRouter;
    address public immutable override weth;
    address public override locker;
    address public protocolFeeRecipient;
    address public owner;

    uint24 public constant POOL_FEE = 10000; // 1%
    int24 public constant TICK_LOWER = -887200;
    int24 public constant TICK_UPPER = 887200;

    uint256 public override launchFee = 0.0005 ether;
    uint256 public override graduationThreshold = 4.2 ether;
    uint256 public defaultProtocolFeeShare = 30; // 30%

    mapping(address => LaunchedToken) public launchedTokens;
    address[] public allTokens;

    error Unauthorized();
    error InsufficientLaunchFee();
    error ZeroAddress();
    error PoolCreationFailed();
    error InitialBuyFailed();

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

        // Deploy default locker
        LiquidityLocker newLocker = new LiquidityLocker(
            _positionManager,
            _weth,
            _protocolFeeRecipient
        );
        locker = address(newLocker);
    }

    receive() external payable {}

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

    function launchToken(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        ILaunchpadToken.Socials memory socials,
        uint256 initialBuyAmount
    ) external payable override returns (address tokenAddress, address poolAddress) {
        if (msg.value < launchFee + initialBuyAmount) revert InsufficientLaunchFee();

        // 1. Deploy LaunchpadToken
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

        // 2. Create and Initialize Uniswap V3 Pool
        bool isToken0 = tokenAddress < weth;
        address token0 = isToken0 ? tokenAddress : weth;
        address token1 = isToken0 ? weth : tokenAddress;

        poolAddress = uniswapV3Factory.createPool(token0, token1, POOL_FEE);
        if (poolAddress == address(0)) revert PoolCreationFailed();

        // Target initial sqrtPriceX96: price = 1 token = ~1e-9 WETH
        // sqrtPriceX96 for ratio token1/token0
        uint160 sqrtPriceX96 = isToken0
            ? 2505414483750479299401734 // token1 (WETH) per token0 (Token) ~ 1e-9
            : 2505414483750479299401734000000000;

        IUniswapV3Pool(poolAddress).initialize(sqrtPriceX96);

        // 3. Provide Full Liquidity to Position Manager
        uint256 tokenSupply = token.balanceOf(address(this));
        token.approve(address(positionManager), tokenSupply);

        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: POOL_FEE,
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            amount0Desired: isToken0 ? tokenSupply : 0,
            amount1Desired: isToken0 ? 0 : tokenSupply,
            amount0Min: 0,
            amount1Min: 0,
            recipient: locker,
            deadline: block.timestamp + 1200
        });

        (uint256 positionId, , , ) = positionManager.mint(mintParams);

        // 4. Lock Position in Locker
        ILiquidityLocker(locker).lockPosition(
            tokenAddress,
            positionId,
            msg.sender,
            defaultProtocolFeeShare
        );

        // 5. Connect pool to token for anti-snipe logic
        token.setLiquidityPool(poolAddress);

        // 6. Execute Initial Buy if requested
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

        // 7. Route launch fee to protocol
        if (launchFee > 0) {
            (bool feeSent, ) = protocolFeeRecipient.call{value: launchFee}("");
            if (!feeSent) revert InsufficientLaunchFee();
        }

        // 8. Record state
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
    }

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
