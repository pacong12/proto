import { type PublicClient, type WalletClient, type Address, erc20Abi, formatEther } from 'viem';
import { buybackBurnerAbi, type NetworkConfig } from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

export interface BuybackKeeperConfig {
  network: NetworkConfig;
  minBalanceWei?: bigint;
  slippageTolerancePercent?: number;
  enabled?: boolean;
}

/**
 * Autonomous keeper service that monitors BuybackBurner contracts
 * and executes buyback-and-burn operations when balance thresholds are reached.
 */
export class BuybackKeeperService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly repository: TokenRepositoryPort,
    private readonly config: BuybackKeeperConfig,
  ) {}

  async checkAndExecute(
    burnerAddress: Address,
    targetTokenAddress: Address,
  ): Promise<{
    executed: boolean;
    txHash?: `0x${string}`;
    wethBalance?: string;
    tokensBurned?: string;
    reason?: string;
  }> {
    if (!this.config.enabled || !this.walletClient) {
      return { executed: false, reason: 'Keeper disabled or walletClient missing' };
    }

    try {
      const minBalance = this.config.minBalanceWei ?? 10_000_000_000_000_000n; // 0.01 ETH/WETH default
      const wethAddress = (await this.publicClient.readContract({
        address: burnerAddress,
        abi: buybackBurnerAbi,
        functionName: 'weth',
      })) as Address;

      const balance = (await this.publicClient.readContract({
        address: wethAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [burnerAddress],
      })) as bigint;

      if (balance < minBalance) {
        return {
          executed: false,
          wethBalance: formatEther(balance),
          reason: `Balance ${formatEther(balance)} below minimum threshold ${formatEther(minBalance)}`,
        };
      }

      // Check cooldown if active
      const [lastTimestamp, cooldown] = await Promise.all([
        this.publicClient.readContract({
          address: burnerAddress,
          abi: buybackBurnerAbi,
          functionName: 'lastBuybackTimestamp',
        }) as Promise<bigint>,
        this.publicClient.readContract({
          address: burnerAddress,
          abi: buybackBurnerAbi,
          functionName: 'cooldown',
        }) as Promise<bigint>,
      ]);

      const now = BigInt(Math.floor(Date.now() / 1000));
      if (lastTimestamp > 0n && now < lastTimestamp + cooldown) {
        return {
          executed: false,
          wethBalance: formatEther(balance),
          reason: 'Cooldown active',
        };
      }

      let lastKnownRate = 0n;
      try {
        lastKnownRate = (await this.publicClient.readContract({
          address: burnerAddress,
          abi: buybackBurnerAbi,
          functionName: 'lastKnownRate',
        })) as bigint;
      } catch {
        // fallback
      }

      // Red-team "Echo": never swap with a 1-wei floor. Without a reference rate (first buyback
      // or after resetReferenceRate) the owner must run it manually with a quoted minimum.
      if (lastKnownRate === 0n) {
        return {
          executed: false,
          wethBalance: formatEther(balance),
          reason: 'No reference rate: run the first buyback manually with a quoted minAmountOut',
        };
      }
      const expected = (balance * lastKnownRate) / 10n ** 18n;
      const slippageBps = BigInt(Math.floor((this.config.slippageTolerancePercent ?? 3) * 100));
      let minAmountOut = (expected * (10_000n - slippageBps)) / 10_000n;
      if (minAmountOut < 1n) minAmountOut = 1n;

      const [account] = await this.walletClient.getAddresses();
      const hash = await this.walletClient.writeContract({
        address: burnerAddress,
        abi: buybackBurnerAbi,
        functionName: 'executeBuyback',
        args: [minAmountOut],
        account,
        chain: this.walletClient.chain,
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      if (this.repository.recordBuybackBurn) {
        await this.repository.recordBuybackBurn({
          tokenAddress: targetTokenAddress,
          network: this.config.network.name,
          wethSpent: balance.toString(),
          tokensBurned: minAmountOut.toString(),
          transactionHash: hash,
          timestamp: Date.now(),
        });
      }

      return {
        executed: receipt.status === 'success',
        txHash: hash,
        wethBalance: formatEther(balance),
      };
    } catch (err) {
      return {
        executed: false,
        reason: (err as Error).message,
      };
    }
  }
}
