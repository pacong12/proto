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
  const loadFailed = ref(false);
  let requestId = 0;

  async function load() {
    const id = ++requestId;
    let failed = false;
    const perNetwork = await Promise.all(
      Object.values(SUPPORTED_CHAINS).map(async (network) => {
        try {
          const client = getPublicClient(network.chainId);
          const vault = await getChainAdapter(network.chainId).readVestingVault(client);
          if (!vault) return [];
          const held = await readVestingPositions(client, vault, account.value);
          return held.map((position) => ({ ...position, network }));
        } catch {
          // A failed read (a rate-limited RPC, say) says nothing about the schedules, so what was
          // already known stays on screen. It must not hide the ones on the other networks either.
          failed = true;
          return positions.value.filter((known) => known.network.chainId === network.chainId);
        }
      }),
    );
    if (id !== requestId) return;
    positions.value = perNetwork.flat();
    loadFailed.value = failed;
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

  return { positions, busy, error, loadFailed, claim, reload: load };
}
