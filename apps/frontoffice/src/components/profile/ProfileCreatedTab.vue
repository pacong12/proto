<template>
  <div class="space-y-4">
    <div v-if="loading" class="py-12 text-center text-xs text-muted-foreground">
      <Loader2 class="w-5 h-5 text-foreground animate-spin mx-auto mb-2" />
      Loading created tokens...
    </div>
    <Empty
      v-else-if="myLaunches.length === 0"
      title="No created tokens"
      description="No tokens have been launched from this address yet."
      class="py-14"
    >
      <template #icon>
        <Rocket class="w-6 h-6" />
      </template>
      <template v-if="isOwnProfile" #action>
        <Button as-child size="sm" class="rounded-xl px-4 font-mono font-bold cursor-pointer">
          <RouterLink to="/launchpad/create">Create a Coin</RouterLink>
        </Button>
      </template>
    </Empty>
    <div v-else class="space-y-4">
      <Card
        v-for="token in myLaunches"
        :key="token.address"
        class="bg-card border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="flex items-start gap-3.5">
          <div class="relative shrink-0">
            <OptimizedImage
              :src="token.logo"
              :alt="token.name"
              :fallback-text="token.symbol"
              :width="48"
              :height="48"
              class="rounded-lg border border-border"
            />
            <img
              :src="
                getTokenNetwork(token.address).chainId === 5042
                  ? '/chains/arc.svg'
                  : '/chains/robinhood.svg'
              "
              :alt="getTokenNetwork(token.address).name"
              :title="getTokenNetwork(token.address).name"
              class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-black bg-black object-contain shadow-xs"
            />
          </div>

          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-bold text-base text-foreground">
                {{ token.name }}
              </h3>
              <span class="text-xs font-mono text-muted-foreground">${{ token.symbol }}</span>
              <TaxTooltip
                :buy-tax-bps="token.taxConfig?.buyTaxBps"
                :sell-tax-bps="token.taxConfig?.sellTaxBps"
                custom-class="text-xs"
              />
              <span
                v-if="(token.taxConfig?.revenueSplit?.holders ?? 0) > 0"
                class="text-xs text-sky-400 font-mono px-1.5 py-0.5 rounded border border-sky-500/20 bg-sky-500/5"
                title="Holder Fee Sharing Enabled"
              >
                {{ token.taxConfig?.revenueSplit?.holders }}% Divs
              </span>
            </div>
            <!-- CA copy button -->
            <button
              type="button"
              class="flex items-center gap-1.5 mt-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
              :title="'Copy contract address: ' + token.address"
              @click.stop="copyCA(token.address)"
            >
              <span class="break-all sm:break-normal">{{ token.address }}</span>
              <Check
                v-if="copiedCA === token.address"
                class="w-3.5 h-3.5 text-emerald-500 shrink-0"
              />
              <Copy
                v-else
                class="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
              />
            </button>
            <div
              class="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap font-mono"
            >
              <span>
                Accrued:
                <strong class="text-foreground font-mono">
                  {{
                    token.unclaimedWeth === '—'
                      ? 'Curve'
                      : `${token.unclaimedWeth} ${nativeCurrencySymbol}`
                  }}
                </strong>
              </span>
              <template v-if="token.redirect">
                <span>•</span>
                <span>
                  Redirect:
                  <strong class="font-mono text-foreground">
                    {{ token.redirect.slice(0, 6) }}...{{ token.redirect.slice(-4) }}
                  </strong>
                </span>
              </template>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-center font-mono flex-wrap">
          <Button
            as-child
            variant="outline"
            size="sm"
            class="h-8 px-2.5 text-xs font-semibold gap-1 border-border cursor-pointer font-mono"
          >
            <RouterLink :to="`/token/${token.address}`">
              Trade
              <ExternalLink class="w-3 h-3" />
            </RouterLink>
          </Button>
          <template v-if="isOwnProfile">
            <Button
              @click="emit('claim', token.address)"
              :disabled="loadingAction || claimingToken === token.address"
              variant="default"
              size="sm"
              class="cursor-pointer"
            >
              <Loader2
                v-if="claimingToken === token.address"
                class="w-3.5 h-3.5 mr-1 animate-spin"
              />
              <ArrowDownToLine v-else class="w-3.5 h-3.5 mr-1" />
              Claim Fees
            </Button>
            <Button
              @click="emit('cto', token.address)"
              variant="outline"
              size="sm"
              class="cursor-pointer"
            >
              <Share2 class="w-3.5 h-3.5 mr-1" />
              CTO Redirect
            </Button>
          </template>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Loader2,
  ArrowDownToLine,
  Share2,
  Rocket,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-vue-next';
import TaxTooltip from '@/components/ui/TaxTooltip.vue';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { useTokenStore } from '@/composables/useTokenStore';
import type { MyLaunchItem } from './types';

const { getTokenNetwork } = useTokenStore();

defineProps<{
  myLaunches: MyLaunchItem[];
  loading: boolean;
  isOwnProfile: boolean;
  claimingToken: string | null;
  loadingAction: boolean;
  nativeCurrencySymbol: string;
}>();

const emit = defineEmits<{
  (e: 'claim', address: string): void;
  (e: 'cto', address: string): void;
}>();

const copiedCA = ref<string | null>(null);

function copyCA(address: string): void {
  if (typeof navigator === 'undefined') return;
  navigator.clipboard.writeText(address);
  copiedCA.value = address;
  setTimeout(() => {
    copiedCA.value = null;
  }, 2000);
}
</script>
