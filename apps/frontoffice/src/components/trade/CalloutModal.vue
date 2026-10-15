<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md bg-card border-border text-xs">
      <DialogHeader>
        <div class="flex items-center gap-2">
          <Megaphone class="w-4 h-4 text-primary shrink-0" />
          <DialogTitle class="text-base font-black"> Call ${{ currentToken.symbol }} </DialogTitle>
        </div>
        <DialogDescription class="text-xs text-muted-foreground">
          Post an on-chain verified alpha callout with your price target and thesis.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <!-- Mini Token Card Preview -->
        <div
          class="p-3.5 rounded-xl border border-border bg-black flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <OptimizedImage
              :src="currentToken.logo"
              :alt="currentToken.name"
              :fallback-text="currentToken.symbol"
              :width="36"
              :height="36"
              class="rounded-full border border-border shrink-0"
            />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-foreground text-sm leading-tight truncate">
                  ${{ currentToken.symbol }}
                </span>
                <span class="text-muted-foreground text-xs truncate">
                  {{ currentToken.name }}
                </span>
              </div>
              <span class="text-xs text-muted-foreground block mt-0.5">
                MC:
                <strong class="text-foreground"
                  >${{ formatCompactUsd(currentMarketData.marketCapUsd || 4200) }}</strong
                >
                · Price:
                <strong class="text-foreground">{{
                  formatPriceUsd(currentMarketData.priceUsd)
                }}</strong>
              </span>
            </div>
          </div>

          <div class="text-right shrink-0">
            <span class="text-xs text-muted-foreground block uppercase font-bold">{{
              t('yourPosition')
            }}</span>
            <span
              class="text-xs font-bold"
              :class="userHoldingTokensCount > 0 ? 'text-emerald-500' : 'text-amber-500'"
            >
              {{ userHoldingTokensCount > 0 ? `$${userHoldingUsd.toFixed(2)}` : '0 tokens' }}
            </span>
          </div>
        </div>

        <!-- Anti-Spam Position Requirement (Pump.fun Rule: must hold at least $1 worth of token) -->
        <div
          v-if="!hasSufficientHoldingForComment"
          class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-between gap-3 text-xs font-sans"
        >
          <div class="flex items-center gap-2 min-w-0">
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span class="text-xs font-sans">
              Anti-spam: You must hold at least $1.00 worth of ${{ currentToken.symbol }} to
              comment.
              <span v-if="userHoldingUsd > 0" class="block text-xs text-amber-400">
                (Current: ${{ userHoldingUsd.toFixed(2) }})
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            class="h-7 px-2.5 text-xs border-amber-500 text-amber-500 hover:bg-amber-500/10 shrink-0 font-bold cursor-pointer rounded-lg"
            @click="$emit('goToBuy')"
          >
            Buy ${{ Math.max(1, Math.ceil(1 - userHoldingUsd)) }} of ${{ currentToken.symbol }}
          </Button>
        </div>

        <!-- Comment Message / Thesis -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-foreground">{{ t('commentAlpha') }}</Label>
          <textarea
            :value="callContent"
            rows="3"
            maxlength="500"
            :placeholder="`Share your thoughts or post a meme about $${currentToken.symbol}...`"
            class="w-full text-xs font-sans p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
            @input="$emit('update:callContent', ($event.target as HTMLTextAreaElement).value)"
          />
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>{{ callContent.length }}/500</span>
            <span v-if="account" class="truncate">Caller: {{ shortenAddress(account, 6, 4) }}</span>
          </div>
        </div>

        <!-- Optional Image URL -->
        <div class="space-y-1.5">
          <Label class="text-xs font-bold text-foreground">{{ t('imageUrlOptional') }}</Label>
          <Input
            :model-value="callImageUrl"
            type="text"
            placeholder="https://... or ipfs://... (chart screenshot / meme)"
            class="h-8 text-xs"
            @update:model-value="$emit('update:callImageUrl', String($event))"
          />
        </div>

        <!-- Also share to X toggle -->
        <div class="flex items-center gap-2 pt-1">
          <input
            id="share-call-x"
            :checked="callShareToX"
            type="checkbox"
            class="rounded border-border text-primary cursor-pointer"
            @change="$emit('update:callShareToX', ($event.target as HTMLInputElement).checked)"
          />
          <label
            for="share-call-x"
            class="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Also compose tweet to share on X (Twitter)
          </label>
        </div>

        <!-- Error message -->
        <div
          v-if="callError"
          class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2"
        >
          {{ callError }}
        </div>
      </div>

      <DialogFooter class="flex sm:justify-between items-center gap-2 pt-2">
        <Button variant="outline" size="sm" @click="$emit('update:open', false)">{{
          t('cancel')
        }}</Button>
        <Button
          :disabled="isPostingCall || !callContent.trim() || userTokenBalance <= 0n"
          size="sm"
          class="gap-1.5 font-bold cursor-pointer shadow-xs"
          @click="$emit('postCallout')"
        >
          <Loader2 v-if="isPostingCall" class="w-3.5 h-3.5 animate-spin" />
          <Megaphone v-else class="w-3.5 h-3.5" />
          <span>{{ t('postCall') }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Megaphone, AlertCircle, Loader2 } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { formatCompactUsd, formatPriceUsd, shortenAddress } from '@/lib/utils';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

const { t } = useI18n();

interface Props {
  open: boolean;
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  userHoldingTokensCount: number;
  userHoldingUsd: number;
  hasSufficientHoldingForComment: boolean;
  userTokenBalance: bigint;
  account?: string;
  callContent: string;
  callImageUrl: string;
  callShareToX: boolean;
  callError: string | null;
  isPostingCall: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'update:callContent', val: string): void;
  (e: 'update:callImageUrl', val: string): void;
  (e: 'update:callShareToX', val: boolean): void;
  (e: 'postCallout'): void;
  (e: 'goToBuy'): void;
}>();
</script>
