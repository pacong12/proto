import { parseAbi } from 'viem';

// ---------------------------------------------------------------------------
// V1: LaunchpadFactory (Uniswap V3 direct pool)
// ---------------------------------------------------------------------------

export const launchpadFactoryAbi = parseAbi([
  'function launchToken(string name, string symbol, string logo, string description, (string twitter, string telegram, string discord, string website, string farcaster) socials, uint256 initialBuyAmount) payable returns (address token, address pool)',
  'function graduationStatus(address token) view returns (uint256 pairedPrincipal, uint256 threshold, bool graduated)',
  'function getLaunchedToken(address token) view returns ((address token, address deployer, address pairedToken, address positionManager, uint256 positionId, uint256 dexId, uint256 launchConfigId, uint256 restrictionsEndBlock, uint256 supply, bool isToken0, uint24 poolFee, bool exists, uint256 initialBuyAmount) launched)',
  'function locker() view returns (address)',
  'function weth() view returns (address)',
  'function launchFee() view returns (uint256)',
  'function graduationThreshold() view returns (uint256)',
  'function totalTokensCount() view returns (uint256)',
  'event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairedToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)',
]);

// ---------------------------------------------------------------------------
// V2: LaunchpadV2Factory (Bonding Curve graduating to Uniswap V4)
// Single source of truth for the V2 ABI. Do not redefine inline in components.
// ---------------------------------------------------------------------------

export const launchpadV2FactoryAbi = parseAbi([
  'function launchTokenV2(string name, string symbol, string logo, string description, string twitter, string telegram, string website, uint256 minInitialTokensOut) payable returns (address tokenAddress, address curveAddress)',
  'function launchTokenV2(string name, string symbol, string logo, string description, string twitter, string telegram, string website) payable returns (address tokenAddress, address curveAddress)',
  'function launches(address token) view returns (address token, address curve, address creator, uint256 createdAt, bool graduated)',
  'function allLaunches(uint256 index) view returns (address token)',
  'function getLaunchCount() view returns (uint256)',
  'function launchFee() view returns (uint256)',
  'function LAUNCH_FEE() view returns (uint256)',
  // The V2 factory emits TokenLaunched (not TokenLaunchedV2) with this exact signature.
  // topic0: 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607
  // Verified on-chain from factory 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e.
  'event TokenLaunched(address indexed token, address indexed curve, address indexed creator, address pairedToken, uint256 positionId, uint256 initialBuyAmount)',
  'event TokenLaunchedV2(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 initialBuy)',
]);

// ---------------------------------------------------------------------------
// V2: Robinhood Chain LaunchpadV2Factory (0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e)
// ---------------------------------------------------------------------------

export const robinhoodLaunchpadV2Abi = parseAbi([
  'function launchToken((string name, string symbol, string logo, string description, (string twitter, string telegram, string discord, string website, string farcaster) socials, address creatorFeeRecipient, uint16 feeConfig, bool isFair, bytes32 b1, bytes32 b2) params, uint256 initialBuyAmount, address referral) payable returns (address token, address curve)',
  'function launchFee() view returns (uint256)',
  'function launchEnabled() view returns (bool)',
  'event TokenLaunched(address indexed token, address indexed curve, address indexed creator, address pairedToken, uint256 positionId, uint256 initialBuyAmount)',
]);

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export const launchpadTokenAbi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
  'function logo() view returns (string)',
  'function description() view returns (string)',
  'function liquidityPool() view returns (address)',
  'function deployer() view returns (address)',
  'function pairedToken() view returns (address)',
  'function restrictionsEndBlock() view returns (uint256)',
  'function launchBlock() view returns (uint256)',
  'function socials() view returns (string twitter, string telegram, string discord, string website, string farcaster)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);

// ---------------------------------------------------------------------------
// Liquidity Locker
// ---------------------------------------------------------------------------

export const liquidityLockerAbi = parseAbi([
  'function lockPosition(address token, uint256 positionId, address deployer, uint256 protocolFeeShare)',
  'function claimFees(address token) returns (uint256 creatorTokenFee, uint256 creatorWethFee)',
  'function setFeeRedirect(address token, address redirect)',
  'function tokenProtocolFeeShares(address token) view returns (uint256)',
  'function feeRedirects(address token) view returns (address)',
  'function tokenPositions(address token) view returns (uint256)',
  'function tokenDeployers(address token) view returns (address)',
  'event PositionLocked(address indexed token, uint256 indexed positionId, address indexed deployer, uint256 protocolFeeShare)',
  'event FeesClaimed(address indexed token, uint256 tokenAmount, uint256 wethAmount, address indexed recipient)',
  'event FeeRedirectUpdated(address indexed token, address indexed redirect)',
]);

// ---------------------------------------------------------------------------
// Uniswap V3
// ---------------------------------------------------------------------------

export const uniswapV3PoolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
]);

export const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
]);

// ---------------------------------------------------------------------------
// Bonding Curve (V2 Launches)
// ---------------------------------------------------------------------------

export const bondingCurveAbi = parseAbi([
  'function buy(uint256 minTokensOut) external payable returns (uint256 tokensOut)',
  'function sell(uint256 tokenIn, uint256 minEthOut) external returns (uint256 ethOut)',
  'function graduated() external view returns (bool)',
  'function virtualEthReserve() external view returns (uint256)',
  'function virtualTokenReserve() external view returns (uint256)',
  'function totalEthRaised() external view returns (uint256)',
  'function graduationTarget() external view returns (uint256)',
  'function creator() external view returns (address)',
  'function getAmountOut(uint256 amountIn, bool isBuy) external view returns (uint256 amountOut, uint256 fee)',
  'event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth)',
  'event Graduated(address indexed token, bytes32 indexed poolId, uint256 ethGraduated, uint256 tokensGraduated)',
]);
