import { parseAbi } from 'viem';

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
