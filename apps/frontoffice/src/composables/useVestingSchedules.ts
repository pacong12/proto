import { ref, watch, type Ref } from 'vue';
import { SUPPORTED_CHAINS, vestingVaultAbi, type NetworkConfig } from '@goton/shared-types';
import { getChainAdapter } from '@/chains';
import { getPublicClient } from '@/lib/viem-client';
import { readVestingPositions, type VestingPosition } from '@/lib/vesting';
import { runWalletAction, sendWalletTransaction } from '@/lib/wallet-tx';

export interface NetworkVestingPosition extends VestingPosition {
  network: NetworkConfig;
}

/** The wallet's vesting schedules on every network, and the two claims a beneficiary can make. */
export function useVestingSchedules(account: Ref<`0x${string}`>) {
  const positions = ref<NetworkVestingPosition[]>([]);
  const busy = ref(false);
  const error = ref<string | null>(null);
  let requestId = 0;

  async function load() {
    const id = ++requestId;
    const perNetwork = await Promise.all(
      Object.values(SUPPORTED_CHAINS).map(async (network) => {
        try {
          const client = getPublicClient(network.chainId);
          const vault = await getChainAdapter(network.chainId).readVestingVault(client);
          if (!vault) return [];
          const held = await readVestingPositions(client, vault, account.value);
          return held.map((position) => ({ ...position, network }));
        } catch {
          // A network that cannot be read must not hide the schedules on the others.
          return [];
        }
      }),
    );
    if (id === requestId) positions.value = perNetwork.flat();
  }

  function claim(position: NetworkVestingPosition, functionName: 'claimVested' | 'claimDividends') {
    return runWalletAction({ busy, error }, async () => {
      const hash = await sendWalletTransaction(position.network, ({ walletClient, account }) =>
        walletClient.writeContract({
          address: position.vault,
          abi: vestingVaultAbi,
          functionName,
          args: [position.id],
          account,
          chain: walletClient.chain,
        }),
      );
      await load();
      return hash;
    });
  }

  watch(account, () => void load(), { immediate: true });

  return { positions, busy, error, claim };
}
