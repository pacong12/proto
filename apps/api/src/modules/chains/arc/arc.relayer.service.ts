import { type PublicClient, type WalletClient, type Address, parseAbi } from 'viem';
import { ARC_CHAIN } from '@goton/shared-types';

export interface RelayedLaunchParams {
  name: string;
  symbol: string;
  logo?: string;
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  minInitialTokensOut?: bigint;
  initialBuyUsdc6?: bigint;
  creator: Address;
}

/**
 * Autonomous gas-sponsored launch relayer for Arc Network (Chain ID: 5042).
 * Inspired by Argus World relayer architecture (0x0052A87145f687b8F3AB2b3B63965f0abc6A58Ee).
 * Allows users to deploy tokens without paying L1 native gas directly.
 */
export class ArcLaunchRelayerService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly relayerAddress?: Address,
  ) {}

  get isEnabled(): boolean {
    return Boolean(this.walletClient);
  }

  async relayLaunch(params: RelayedLaunchParams): Promise<{
    success: boolean;
    txHash?: `0x${string}`;
    error?: string;
  }> {
    if (!this.walletClient) {
      return { success: false, error: 'Arc relayer wallet is not configured on server' };
    }

    try {
      const targetFactory = (ARC_CHAIN.contracts.factoryV2 ??
        ARC_CHAIN.contracts.factory) as Address;
      const [relayerAccount] = await this.walletClient.getAddresses();

      const launchAbi = parseAbi([
        'function launchTokenV2(string name, string symbol, string logo, string description, string twitter, string telegram, string website, uint256 minInitialTokensOut) external payable returns (address, address)',
      ]);

      const hash = await this.walletClient.writeContract({
        address: targetFactory,
        abi: launchAbi,
        functionName: 'launchTokenV2',
        args: [
          params.name,
          params.symbol,
          params.logo || '',
          params.description || '',
          params.twitter || '',
          params.telegram || '',
          params.website || '',
          params.minInitialTokensOut ?? 0n,
        ],
        account: relayerAccount,
        chain: this.walletClient.chain,
        value: 0n, // Free launch!
      });

      return {
        success: true,
        txHash: hash,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }
}
