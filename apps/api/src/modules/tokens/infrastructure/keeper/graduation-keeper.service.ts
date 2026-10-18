import type { PublicClient, WalletClient } from 'viem';
import {
  UNDEPLOYED,
  bondingCurveAbi,
  launchpadV2FactoryAbi,
  type LaunchedTokenEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

export interface GraduationResult {
  token: string;
  executed: boolean;
  reason?: string;
  txHash?: `0x${string}`;
}

/**
 * Moves finished bonding curves into their locked v4 pools. `factory.graduate(token)` is
 * permissionless, and until someone calls it a finished curve cannot trade at all, so the keeper
 * does it instead of waiting for the next trader. It only reads each live curve's `graduated` flag
 * and simulates before sending; curves of an older factory fail the simulation and are skipped.
 */
export class GraduationKeeperService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly repository: TokenRepositoryPort,
    private readonly network: NetworkConfig,
  ) {}

  private get factory(): `0x${string}` | null {
    const a = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    const graduator = this.network.contracts.graduator;
    if (!a || a === UNDEPLOYED || !graduator || graduator === UNDEPLOYED) return null;
    return a;
  }

  private isLiveCurve(token: LaunchedTokenEntity): boolean {
    const onChain = token.chainId === undefined || token.chainId === this.network.chainId;
    return onChain && token.version === 'v2' && !token.isGraduated && !!token.curveAddress;
  }

  async runOnce(): Promise<GraduationResult[]> {
    const factory = this.factory;
    if (!factory || !this.walletClient) return [];
    const [account] = await this.walletClient.getAddresses();
    if (!account) return [];

    const curves = (await this.repository.findAll(500, 0)).filter((t) => this.isLiveCurve(t));
    const results: GraduationResult[] = [];
    for (const token of curves) {
      const finished = await this.publicClient
        .readContract({
          address: token.curveAddress as `0x${string}`,
          abi: bondingCurveAbi,
          functionName: 'graduated',
        })
        .catch(() => false);
      if (!finished) continue;

      try {
        const { request } = await this.publicClient.simulateContract({
          address: factory,
          abi: launchpadV2FactoryAbi,
          functionName: 'graduate',
          args: [token.address],
          account,
        });
        const txHash = await this.walletClient.writeContract(request);
        try {
          await this.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
        } catch {
          results.push({ token: token.address, executed: true, txHash, reason: 'Receipt pending' });
          return results;
        }
        results.push({ token: token.address, executed: true, txHash });
      } catch (e) {
        // Already graduated by a trader, or a curve from an older factory.
        results.push({
          token: token.address,
          executed: false,
          reason: ((e as Error).message ?? String(e)).split('\n')[0],
        });
      }
    }
    return results;
  }
}
