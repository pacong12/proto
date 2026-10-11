import { parseAbi } from 'viem';

/**
 * Verified on-chain ABI for Robinhood Chain LaunchpadV2Factory (0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e)
 * Uses launchToken(params, initialBuyAmount, referral)
 */
export const robinhoodLaunchpadV2Abi = parseAbi([
  'function launchToken((string name, string symbol, string logo, string description, (string twitter, string telegram, string discord, string website, string farcaster) socials, address creatorFeeRecipient, uint16 feeConfig, bool isFair, bytes32 b1, bytes32 b2) params, uint256 initialBuyAmount, address referral) payable returns (address token, address curve)',
  'function launchFee() view returns (uint256)',
  'function launchEnabled() view returns (bool)',
  'event TokenLaunched(address indexed token, address indexed curve, address indexed creator, address pairedToken, uint256 positionId, uint256 initialBuyAmount)',
]);
