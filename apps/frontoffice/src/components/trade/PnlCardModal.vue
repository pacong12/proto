<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden text-xs flex flex-col max-h-[92vh]"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-border">
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-primary" />
          <h2 class="text-sm font-bold text-foreground">{{ t('pnlShareTitle') }}</h2>
        </div>
        <button
          type="button"
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body / Card Preview -->
      <div class="p-5 space-y-4 overflow-y-auto">
        <!-- Rendered Card Container -->
        <div
          ref="cardContainerRef"
          class="p-5 rounded-2xl bg-zinc-950 border border-primary/40 text-foreground relative overflow-hidden shadow-2xl space-y-4"
        >
          <!-- Background Glow Accent -->
          <div
            class="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none"
            :class="isProfit ? 'bg-emerald-500/15' : 'bg-rose-500/15'"
          />

          <!-- Top Byline: Brand + Network Badge -->
          <div
            class="flex items-center justify-between relative z-10 border-b border-zinc-800 pb-3"
          >
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-sm tracking-tight text-foreground font-mono"
                >proto</span
              >
              <span class="text-zinc-600 font-mono">/</span>
              <span class="text-[11px] font-mono text-muted-foreground">{{
                tokenNetwork.name
              }}</span>
            </div>
            <div
              class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border"
              :class="
                isProfit
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  : 'border-rose-500/40 text-rose-400 bg-rose-500/10'
              "
            >
              {{ isProfit ? t('pnlProfitSignal') : t('pnlPosition') }}
            </div>
          </div>

          <!-- Token Info & Return Figure -->
          <div class="flex items-center justify-between relative z-10 gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <OptimizedImage
                :src="currentToken.logo"
                :alt="currentToken.name"
                :fallback-text="currentToken.symbol"
                :width="48"
                :height="48"
                class="rounded-xl border border-zinc-800 shrink-0 w-12 h-12 object-cover"
              />
              <div class="min-w-0">
                <h3 class="font-extrabold text-base text-foreground truncate">
                  ${{ currentToken.symbol }}
                </h3>
                <p class="text-xs text-zinc-400 truncate">{{ currentToken.name }}</p>
              </div>
            </div>

            <!-- Return Metric -->
            <div class="text-right shrink-0">
              <span class="text-[10px] font-mono text-zinc-400 uppercase block font-bold">{{
                t('pnlUnrealizedReturn')
              }}</span>
              <span
                class="text-2xl sm:text-3xl font-black font-mono tracking-tight"
                :class="isProfit ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ formattedMultiplier }}
              </span>
            </div>
          </div>

          <!-- Position Breakdown Strip -->
          <div
            class="grid grid-cols-3 gap-2 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 relative z-10 font-mono text-xs"
          >
            <div>
              <span class="text-[10px] text-zinc-500 uppercase block">{{
                t('pnlHoldingValue')
              }}</span>
              <span class="font-bold text-foreground block truncate">
                ${{ formatCompactUsd(userHoldingUsd) }}
              </span>
            </div>
            <div>
              <span class="text-[10px] text-zinc-500 uppercase block">{{ t('pnlMarketCap') }}</span>
              <span class="font-bold text-foreground block truncate">
                ${{ formatCompactUsd(currentMarketData.marketCapUsd || 4200) }}
              </span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-zinc-500 uppercase block">{{
                t('pnlTokenPrice')
              }}</span>
              <span class="font-bold text-foreground block truncate">
                ${{
                  currentMarketData.priceUsd ? currentMarketData.priceUsd.toFixed(6) : '0.000000'
                }}
              </span>
            </div>
          </div>

          <!-- Footer Byline: Trader Identity + Link -->
          <div
            class="flex items-center justify-between relative z-10 pt-1 text-[11px] font-mono text-zinc-400"
          >
            <div class="flex items-center gap-1.5 truncate">
              <span class="text-zinc-500">{{ t('pnlTrader') }}</span>
              <span class="text-foreground font-bold truncate">
                {{ account ? getUserIdentity(account).displayName : t('pnlAnonTrader') }}
              </span>
            </div>
            <span class="text-primary font-bold shrink-0">{{ SITE.appHost }}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <Button
            variant="outline"
            class="h-9 font-bold text-xs gap-1.5 rounded-xl cursor-pointer"
            :disabled="isGeneratingImage"
            @click="downloadCard"
          >
            <Download class="w-3.5 h-3.5" />
            <span>{{ isGeneratingImage ? t('pnlGenerating') : t('pnlDownloadImage') }}</span>
          </Button>

          <Button
            class="h-9 font-bold text-xs gap-1.5 rounded-xl bg-foreground text-background hover:opacity-90 cursor-pointer"
            @click="shareOnX"
          >
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              />
            </svg>
            <span>{{ t('pnlShareOnX') }}</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, X, Download } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { formatCompactUsd } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { toast } from '@/components/ui/sonner';
import { useI18n } from '@/lib/i18n';
import { SITE } from '@/lib/site';
import type { LaunchedTokenEntity, TokenMarketData, NetworkConfig } from '@proto/shared-types';

interface Props {
  isOpen: boolean;
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  userHoldingUsd: number;
  userTokenBalance: bigint;
  account?: string;
  tokenNetwork: NetworkConfig;
}

const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{ (e: 'close'): void }>();

const isGeneratingImage = ref(false);
const cardContainerRef = ref<HTMLDivElement | null>(null);

const isProfit = computed(() => {
  return props.userHoldingUsd >= 5;
});

const formattedMultiplier = computed(() => {
  if (props.userHoldingUsd <= 0) return '+0.0%';
  const mult = Math.max(1, (props.currentMarketData.marketCapUsd || 4200) / 4200);
  const percent = (mult - 1) * 100;
  return percent > 0 ? `+${percent.toFixed(1)}%` : `${percent.toFixed(1)}%`;
});

async function generateCanvasImage(): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas context');

  // 1. Dark Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
  bgGrad.addColorStop(0, '#09090b');
  bgGrad.addColorStop(1, '#000000');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 630);

  // 2. Glow Accent Circle
  const accentGrad = ctx.createRadialGradient(1050, 100, 10, 1050, 100, 400);
  accentGrad.addColorStop(
    0,
    isProfit.value ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
  );
  accentGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, 1200, 630);

  // 3. Border
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, 1140, 570);

  // 4. Header Bar
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('proto', 70, 95);

  ctx.fillStyle = '#71717a';
  ctx.font = '28px monospace';
  ctx.fillText(`/ ${props.tokenNetwork.name}`, 200, 95);

  // Badge
  ctx.fillStyle = isProfit.value ? '#10b981' : '#f43f5e';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    (isProfit.value ? t('pnlVerifiedProfit') : t('pnlOpenPosition')).toUpperCase(),
    1130,
    95,
  );
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 130);
  ctx.lineTo(1130, 130);
  ctx.stroke();

  // 5. Token Identity
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px sans-serif';
  ctx.fillText(`$${props.currentToken.symbol}`, 70, 240);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '32px sans-serif';
  ctx.fillText(props.currentToken.name, 70, 290);

  // 6. Big Multiplier Callout
  ctx.fillStyle = isProfit.value ? '#34d399' : '#fb7185';
  ctx.font = '900 96px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(formattedMultiplier.value, 1130, 260);

  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(t('pnlUnrealizedReturn').toUpperCase(), 1130, 300);
  ctx.textAlign = 'left';

  // 7. Stats Box
  ctx.fillStyle = '#18181b';
  ctx.fillRect(70, 360, 1060, 140);
  ctx.strokeStyle = '#27272a';
  ctx.strokeRect(70, 360, 1060, 140);

  // Stat 1: Position Value
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(t('pnlHoldingValue').toUpperCase(), 105, 410);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.fillText(`$${formatCompactUsd(props.userHoldingUsd)}`, 105, 460);

  // Stat 2: Market Cap
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(t('pnlMarketCap').toUpperCase(), 480, 410);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.fillText(`$${formatCompactUsd(props.currentMarketData.marketCapUsd || 4200)}`, 480, 460);

  // Stat 3: Price
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(t('pnlTokenPrice').toUpperCase(), 840, 410);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.fillText(
    `$${props.currentMarketData.priceUsd ? props.currentMarketData.priceUsd.toFixed(6) : '0.000000'}`,
    840,
    460,
  );

  // 8. Footer Byline
  const traderName = props.account
    ? getUserIdentity(props.account).displayName
    : t('pnlAnonTrader');
  ctx.fillStyle = '#71717a';
  ctx.font = '24px monospace';
  ctx.fillText(`${t('pnlTrader')} ${traderName}`, 70, 560);

  ctx.fillStyle = '#ec4899';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(SITE.appHost, 1130, 560);

  return canvas.toDataURL('image/png');
}

async function downloadCard(): Promise<void> {
  isGeneratingImage.value = true;
  try {
    const dataUrl = await generateCanvasImage();
    const link = document.createElement('a');
    link.download = `proto-pnl-${props.currentToken.symbol.toLowerCase()}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success('PnL card downloaded!');
  } catch (err) {
    toast.error('Failed to export card: ' + (err as Error).message);
  } finally {
    isGeneratingImage.value = false;
  }
}

function shareOnX(): void {
  const tweetText = encodeURIComponent(
    `Holding $${props.currentToken.symbol} on @protodotfun!\n\n` +
      `Current Return: ${formattedMultiplier.value} | MC: $${formatCompactUsd(props.currentMarketData.marketCapUsd || 4200)}\n\n` +
      `${window.location.href}`,
  );
  window.open(
    `https://twitter.com/intent/tweet?text=${tweetText}`,
    '_blank',
    'noopener,noreferrer',
  );
}
</script>
