<template>
  <div v-if="team" class="rounded-2xl border border-border bg-card p-4 space-y-3 text-sm">
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-bold text-foreground">{{ t('teamPayouts') }}</h3>
      <a
        :href="`${network.blockExplorer}/address/${team.address}`"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-muted-foreground hover:text-foreground"
        >{{ shortenAddress(team.address) }}</a
      >
    </div>
    <p class="text-xs text-muted-foreground">{{ t('teamPayoutsHint') }}</p>

    <ul class="space-y-1.5">
      <li
        v-for="m in team.members"
        :key="m.address"
        class="flex items-center justify-between gap-2 text-xs"
      >
        <span class="min-w-0 truncate">
          <span class="font-semibold text-foreground">{{
            getUserIdentity(m.address).displayName
          }}</span>
          <span class="text-muted-foreground"> · {{ (m.shareBps / 100).toFixed(2) }}%</span>
        </span>
        <span class="text-right tabular-nums text-muted-foreground shrink-0">
          <span v-for="(a, i) in team.assets" :key="a.address">
            {{ i > 0 ? ' · ' : '' }}{{ formatRawAmount(m.due[i], a.decimals) }} {{ a.symbol }}
          </span>
        </span>
      </li>
    </ul>

    <div class="flex flex-wrap gap-2">
      <Button
        v-for="(a, i) in team.assets"
        :key="a.address"
        size="sm"
        variant="outline"
        class="h-8 text-xs rounded-xl"
        :disabled="busy || !team.members.some((m) => m.due[i] > 0n)"
        @click="releaseAll(a.address)"
      >
        {{ t('releaseAll') }} {{ a.symbol }}
      </Button>
    </div>
    <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  gotonFeeSplitterAbi,
  gotonTeamSplitterAbi,
  launchpadTokenAbi,
  resolveFeeSplitter,
  type NetworkConfig,
} from '@goton/shared-types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useI18n } from '@/lib/i18n';
import { formatRawAmount } from '@/lib/limit-orders';
import { shortenAddress } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { getPublicClient } from '@/lib/viem-client';
import { sendWalletTransaction } from '@/lib/wallet-tx';

const props = defineProps<{
  token: `0x${string}`;
  symbol: string;
  network: NetworkConfig;
}>();
const { t } = useI18n();

interface Asset {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}
interface Team {
  address: `0x${string}`;
  assets: Asset[];
  members: Array<{ address: `0x${string}`; shareBps: number; due: bigint[] }>;
}
const NATIVE = '0x0000000000000000000000000000000000000000' as const;
const team = ref<Team | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

/**
 * The token's tax recipient and its fee splitter's creator payout are where a team splitter can
 * sit; the first of them that answers `payees()` is the team.
 */
async function load() {
  team.value = null;
  const client = getPublicClient(props.network.chainId);
  const candidates = new Set<`0x${string}`>();
  let quote: `0x${string}` = NATIVE;
  try {
    const [, , recipient] = await client.readContract({
      address: props.token,
      abi: launchpadTokenAbi,
      functionName: 'taxConfig',
    });
    candidates.add(recipient);
  } catch {
    // Tokens without a tax config.
  }
  try {
    const splitter = await resolveFeeSplitter(client, props.network, props.token);
    if (splitter) {
      quote = (await client.readContract({
        address: splitter.address,
        abi: gotonFeeSplitterAbi,
        functionName: 'quoteAsset',
      })) as `0x${string}`;
      candidates.add(
        (await client.readContract({
          address: splitter.address,
          abi: gotonFeeSplitterAbi,
          functionName: 'creatorRecipient',
        })) as `0x${string}`,
      );
    }
  } catch {
    // No fee splitter yet (Robinhood before graduation).
  }

  for (const candidate of candidates) {
    try {
      const payees = (await client.readContract({
        address: candidate,
        abi: gotonTeamSplitterAbi,
        functionName: 'payees',
      })) as `0x${string}`[];
      const native = props.network.nativeCurrency.symbol;
      const assets: Asset[] = [
        { address: props.token, symbol: props.symbol, decimals: 18 },
        quote === NATIVE
          ? { address: NATIVE, symbol: native, decimals: 18 }
          : { address: quote, symbol: native, decimals: 6 },
      ];
      const members = await Promise.all(
        payees.map(async (address) => {
          const shareBps = Number(
            await client.readContract({
              address: candidate,
              abi: gotonTeamSplitterAbi,
              functionName: 'shareBps',
              args: [address],
            }),
          );
          const due = await Promise.all(
            assets.map(
              (a) =>
                client.readContract({
                  address: candidate,
                  abi: gotonTeamSplitterAbi,
                  functionName: 'releasable',
                  args: [a.address, address],
                }) as Promise<bigint>,
            ),
          );
          return { address, shareBps, due };
        }),
      );
      team.value = { address: candidate, assets, members };
      return;
    } catch {
      // Not a team splitter.
    }
  }
}

async function releaseAll(asset: `0x${string}`) {
  if (!team.value) return;
  busy.value = true;
  error.value = null;
  try {
    const teamAddress = team.value.address;
    await sendWalletTransaction(props.network, ({ walletClient, account }) =>
      walletClient.writeContract({
        address: teamAddress,
        abi: gotonTeamSplitterAbi,
        functionName: 'releaseAll',
        args: [asset],
        account,
        chain: walletClient.chain,
      }),
    );
    toast.success(t('teamPaid'));
    await load();
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (!/user rejected|denied/i.test(msg)) error.value = msg.split('\n')[0];
  } finally {
    busy.value = false;
  }
}

watch(() => [props.token, props.network.chainId], load, { immediate: true });
</script>
