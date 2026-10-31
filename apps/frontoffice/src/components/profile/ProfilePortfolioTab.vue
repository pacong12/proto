<template>
  <div class="space-y-4">
    <Empty
      v-if="portfolioPositions.length === 0"
      :title="t('noHoldings')"
      :description="t('noHoldingsDesc')"
      class="py-14"
    >
      <template #icon>
        <PieChart class="w-6 h-6" />
      </template>
      <template #action>
        <Button
          as-child
          size="sm"
          variant="outline"
          class="rounded-xl px-4 font-bold cursor-pointer"
        >
          <RouterLink to="/launchpad">{{ t('exploreTokens') }}</RouterLink>
        </Button>
      </template>
    </Empty>
    <div v-else class="rounded-2xl border border-border overflow-hidden bg-black">
      <Table class="text-xs bg-black">
        <TableHeader>
          <TableRow class="border-b border-border text-muted-foreground bg-black hover:bg-black">
            <TableHead class="py-2.5 px-3 font-semibold text-muted-foreground bg-black">{{
              t('asset')
            }}</TableHead>
            <TableHead
              class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black"
              >{{ t('balance') }}</TableHead
            >
            <TableHead
              class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black"
              >{{ t('priceUsdCol') }}</TableHead
            >
            <TableHead
              class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black"
              >{{ t('valueUsdCol') }}</TableHead
            >
            <TableHead
              class="py-2.5 px-3 font-semibold text-right text-muted-foreground bg-black"
              >{{ t('action') }}</TableHead
            >
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="pos in portfolioPositions"
            :key="pos.tokenAddress"
            class="hover:bg-zinc-900/40 transition-colors bg-black"
          >
            <TableCell class="py-2.5 px-3">
              <div class="flex items-center gap-2">
                <div class="relative shrink-0">
                  <Avatar class="w-6 h-6 rounded border border-border overflow-hidden">
                    <AvatarFallback class="text-xs bg-muted text-foreground">
                      {{ pos.symbol.slice(0, 3) }}
                    </AvatarFallback>
                  </Avatar>
                  <img
                    :src="getChainIcon(getTokenNetwork(pos.tokenAddress))"
                    :alt="getTokenNetwork(pos.tokenAddress).name"
                    class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black bg-black object-contain shadow-xs"
                  />
                </div>
                <span class="font-bold text-foreground">{{ pos.name }}</span>
                <span class="text-muted-foreground">${{ pos.symbol }}</span>
              </div>
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right text-foreground font-medium">
              {{ pos.balanceFormatted }}
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right text-muted-foreground">
              ${{ pos.priceUsd.toFixed(8) }}
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right text-foreground font-bold">
              ${{
                pos.valueUsd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}
            </TableCell>
            <TableCell class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
              <Button
                v-if="wallet"
                variant="outline"
                size="sm"
                class="h-7 px-2.5 text-xs font-semibold gap-1 border-border cursor-pointer"
                @click="sharedToken = pos.tokenAddress"
              >
                <Share2 class="w-3 h-3" />
                {{ t('pnlShare') }}
              </Button>
              <Button
                as-child
                variant="outline"
                size="sm"
                class="h-7 px-2.5 text-xs font-semibold gap-1 border-border cursor-pointer"
              >
                <RouterLink :to="`/token/${pos.tokenAddress}`">
                  {{ t('trade') }}
                  <ExternalLink class="w-3 h-3" />
                </RouterLink>
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <PnlCardModal
      :is-open="!!sharedToken"
      :wallet="wallet"
      :token="sharedToken ?? undefined"
      @close="sharedToken = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ExternalLink, PieChart, Share2 } from 'lucide-vue-next';
import PnlCardModal from '@/components/trade/PnlCardModal.vue';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getChainIcon } from '@/lib/utils';
import { useTokenStore } from '@/composables/useTokenStore';
import { Empty } from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { PortfolioPosition } from './types';

const { t } = useI18n();
const { getTokenNetwork } = useTokenStore();

defineProps<{
  portfolioPositions: PortfolioPosition[];
  /** The profile's wallet, whose positions can be shared as PnL cards. */
  wallet?: string;
}>();

/** The token whose PnL card is open. */
const sharedToken = ref<string | null>(null);
</script>
