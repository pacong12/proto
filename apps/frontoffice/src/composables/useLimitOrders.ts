import { ref } from 'vue';
import { erc20Abi } from 'viem';
import {
  gotonLimitOrdersAbi,
  type LimitOrderEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import { apiFetch } from '@/lib/api-client';
import { getPublicClient, getWalletClient, waitForReceiptWithFallback } from '@/lib/viem-client';
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

  async function send(
    network: NetworkConfig,
    write: (
      wallet: NonNullable<Awaited<ReturnType<typeof getWalletClient>>>,
      account: `0x${string}`,
    ) => Promise<`0x${string}`>,
  ): Promise<`0x${string}` | null> {
    busy.value = true;
    error.value = null;
    try {
      const wallet = await getWalletClient();
      if (!wallet) throw new Error('Connect your wallet first');
      const [account] = await wallet.getAddresses();
      if (!account) throw new Error('Connect your wallet first');
      if ((await wallet.getChainId()) !== network.chainId) {
        throw new Error(`Switch your wallet to ${network.name} and retry.`);
      }
      const hash = await write(wallet, account);
      const receipt = await waitForReceiptWithFallback(
        getPublicClient(network.chainId),
        hash,
        wallet,
      );
      if (receipt?.status === 'reverted') throw new Error(`Transaction reverted: ${hash}`);
      return hash;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (!/user rejected|denied/i.test(msg)) error.value = msg.split('\n')[0];
      return null;
    } finally {
      busy.value = false;
    }
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
      const publicClient = getPublicClient(network.chainId);
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, contract],
      });
      if (allowance < amount) {
        const approveHash = await wallet.writeContract({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [contract, amount],
          account,
          chain: wallet.chain,
        });
        await waitForReceiptWithFallback(publicClient, approveHash, wallet);
      }
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
