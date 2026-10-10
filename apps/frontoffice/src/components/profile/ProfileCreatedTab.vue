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
              <Badge
                :variant="token.version === 'v2' ? 'outline' : 'secondary'"
                class="text-[9px] px-1.5 py-0 h-4 font-mono uppercase"
              >
                {{ token.version === 'v2' ? 'v2 Curve' : 'v1 Direct' }}
              </Badge>
            </div>
            <p class="text-xs font-mono text-muted-foreground mt-0.5 break-all sm:break-normal">
              {{ token.address }}
            </p>
            <div
              class="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap font-mono"
            >
              <span>
                Accrued:
                <strong class="text-foreground font-mono">
                  {{
                    token.unclaimedWeth === '—'
                      ? token.version === 'v2'
                        ? 'v2 curve'
                        : '—'
                      : `${token.unclaimedWeth} ${nativeCurrencySymbol}`
                  }}
                </strong>
              </span>
              <span>•</span>
              <span>
                Redirect:
                <strong class="font-mono text-foreground">
                  {{ token.redirect ? `${token.redirect.slice(0, 6)}...` : 'None (Self)' }}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div v-if="isOwnProfile" class="flex items-center gap-2 self-end sm:self-center font-mono">
          <Button
            @click="emit('claim', token.address)"
            :disabled="loadingAction || claimingToken === token.address"
            variant="default"
            size="sm"
            class="cursor-pointer"
          >
            <Loader2 v-if="claimingToken === token.address" class="w-3.5 h-3.5 mr-1 animate-spin" />
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
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader2, ArrowDownToLine, Share2, Rocket } from 'lucide-vue-next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
</script>
