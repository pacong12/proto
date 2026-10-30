import { ref } from 'vue';
import type { WalletClient } from 'viem';
import {
  gotonLimitOrdersAbi,
  type LimitOrderEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import { apiFetch } from '@/lib/api-client';
import { getPublicClient } from '@/lib/viem-client';
import { ensureAllowance, runWalletAction, sendWalletTransaction } from '@/lib/wallet-tx';
import { isDeployed } from '@/chains/shared/utils';

/** Contract address of GotonLimitOrders on a network, or null where it is not deployed. */
export function limitOrdersAddress(network: NetworkConfig): `0x${string}` | null {
  const a = network.contracts.limitOrders;
  return isDeployed(a) ? a : null;
}

/**
 * Creates and cancels escrowed limit / take-profit / stop-loss orders (GotonLimitOrders) and lists
 * them from the API. Every write goes through the wallet client, so the terms gate applies.
 */
export function useLimitOrders() {
  const busy = ref(false);
  const error = ref<string | null>(null);

  function send(
    network: NetworkConfig,
    write: (wallet: WalletClient, account: `0x${string}`) => Promise<`0x${string}`>,
  ): Promise<`0x${string}` | null> {
    return runWalletAction({ busy, error }, () =>
      sendWalletTransaction(network, ({ walletClient, account }) => write(walletClient, account)),
    );
  }

  /** Limit buy: escrow `valueWei` of native quote; fill when at least `minTokensOut` arrives. */
  function createBuy(
    network: NetworkConfig,
    token: `0x${string}`,
    valueWei: bigint,
    minTokensOut: bigint,
    deadline: number,
  ) {
    const contract = limitOrdersAddress(network);
    if (!contract) return Promise.resolve(null);
    return send(network, (wallet, account) =>
      wallet.writeContract({
        address: contract,
        abi: gotonLimitOrdersAbi,
        functionName: 'createBuyOrder',
        args: [token, minTokensOut, BigInt(deadline)],
        value: valueWei,
        account,
        chain: wallet.chain,
      }),
    );
  }

  /** Take-profit and/or stop-loss on `amount` tokens (exact approval, then the order). */
  function createSell(
    network: NetworkConfig,
    token: `0x${string}`,
    amount: bigint,
    tpMinOut: bigint,
    slPriceX36: bigint,
    slMinOut: bigint,
    deadline: number,
  ) {
    const contract = limitOrdersAddress(network);
    if (!contract) return Promise.resolve(null);
    return send(network, async (wallet, account) => {
      await ensureAllowance({
        publicClient: getPublicClient(network.chainId),
        walletClient: wallet,
        account,
        token,
        spender: contract,
        amount,
      });
      return wallet.writeContract({
        address: contract,
        abi: gotonLimitOrdersAbi,
        functionName: 'createSellOrder',
        args: [token, amount, tpMinOut, slPriceX36, slMinOut, BigInt(deadline)],
        account,
        chain: wallet.chain,
      });
    });
  }

  function cancel(network: NetworkConfig, orderId: string) {
    const contract = limitOrdersAddress(network);
    if (!contract) return Promise.resolve(null);
    return send(network, (wallet, account) =>
      wallet.writeContract({
        address: contract,
        abi: gotonLimitOrdersAbi,
        functionName: 'cancel',
        args: [BigInt(orderId)],
        account,
        chain: wallet.chain,
      }),
    );
  }

  async function listOpen(owner: string, token: string): Promise<LimitOrderEntity[]> {
    try {
      const res = await apiFetch<{ success: boolean; data: LimitOrderEntity[] }>(
        `/api/orders?owner=${owner}&token=${token}&status=open`,
      );
      return res?.success ? res.data : [];
    } catch {
      return [];
    }
  }

  /** Every order of an owner (optionally one token), newest first. */
  async function listByOwner(owner: string, token?: string): Promise<LimitOrderEntity[]> {
    try {
      const q = token ? `&token=${token}` : '';
      const res = await apiFetch<{ success: boolean; data: LimitOrderEntity[] }>(
        `/api/orders?owner=${owner}${q}`,
      );
      return res?.success ? res.data : [];
    } catch {
      return [];
    }
  }

  return { busy, error, createBuy, createSell, cancel, listOpen, listByOwner };
}
