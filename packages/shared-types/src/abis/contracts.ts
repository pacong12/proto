import { parseAbi } from 'viem';

// ---------------------------------------------------------------------------
// V2 Canonical ABIs re-exported from @proto/contracts-abi
// Single Source of Truth for Foundry-generated contract artifacts
// ---------------------------------------------------------------------------
export * from '@proto/contracts-abi';

// ---------------------------------------------------------------------------
// Legacy V1: LaunchpadFactory (Uniswap V3 direct pool) - kept for backward compat
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
