<template>
  <header class="space-y-4 pb-2 border-b border-border/80">
    <!-- Top Row: Back Navigation + Action Buttons -->
    <div class="flex items-center justify-between gap-3 text-xs font-mono">
      <RouterLink
        to="/launchpad"
        class="text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5 font-medium group"
      >
        <ChevronLeft class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Markets</span>
        <span class="text-muted-foreground/40">/</span>
        <span class="text-foreground font-bold truncate max-w-[200px] sm:max-w-none">{{
          currentToken.name
        }}</span>
      </RouterLink>

      <!-- Top Action Controls (Callout, Share, Copy Link) -->
      <div class="flex items-center gap-2">
        <!-- Callout Button (pump.fun style) -->
        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2.5 text-xs font-bold gap-1 rounded-xl border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer shadow-2xs font-mono"
          @click="$emit('openCallModal')"
        >
          <Megaphone class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Call ${{ currentToken.symbol }}</span>
          <span class="sm:hidden">Call</span>
        </Button>

        <!-- Share to X Button -->
        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2.5 text-xs font-bold gap-1 rounded-xl border-border cursor-pointer font-mono"
          @click="$emit('shareToX')"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
            />
          </svg>
          <span class="hidden sm:inline">Share</span>
        </Button>

        <!-- Copy Link Button -->
        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2.5 text-xs font-bold gap-1 rounded-xl border-border cursor-pointer font-mono"
          @click="$emit('copyTokenLink')"
        >
          <Check v-if="linkCopied" class="w-3 h-3 text-emerald-500" />
          <Copy v-else class="w-3 h-3" />
          <span class="hidden sm:inline">{{ linkCopied ? 'Copied' : 'Copy link' }}</span>
        </Button>
      </div>
    </div>

    <!-- Main Identity & Live Figure Row -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <!-- Left: Artwork + Titles + Metadata Byline -->
      <div class="flex items-start gap-4 min-w-0">
        <div class="relative shrink-0">
          <OptimizedImage
            :src="currentToken.logo"
            :alt="currentToken.name"
            :fallback-text="currentToken.symbol"
            :width="64"
            :height="64"
            class="rounded-2xl border border-border object-cover ring-2 ring-border shadow-xs shrink-0 w-14 h-14 sm:w-16 sm:h-16"
          />
          <img
            :src="tokenNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
            :alt="tokenNetwork.name"
            :title="tokenNetwork.name"
            class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-black bg-black object-contain shadow-xs"
          />
        </div>
        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <h1
              class="text-2xl sm:text-3xl font-black font-sans tracking-tight text-foreground truncate"
            >
              {{ currentToken.name }}
            </h1>
            <span class="text-sm sm:text-base font-bold font-mono text-muted-foreground">
              ${{ currentToken.symbol }}
            </span>
            <!-- Pin / Star Watchlist Button (Pons style) -->
            <button
              type="button"
              class="p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none"
              :class="
                isPinned(currentToken.address)
                  ? 'text-amber-400'
                  : 'text-muted-foreground/35 hover:text-amber-400'
              "
              :title="isPinned(currentToken.address) ? 'Unpin coin' : 'Pin to Watchlist'"
              @click.stop="$emit('togglePin', currentToken.address)"
            >
              <Star
                class="w-4 h-4"
                :class="isPinned(currentToken.address) ? 'fill-amber-400 text-amber-400' : ''"
              />
            </button>
            <Badge
              :variant="currentMarketData.isGraduated ? 'default' : 'outline'"
              class="text-[10px] font-mono h-4 px-1.5 border-border uppercase font-semibold"
            >
              {{ currentMarketData.isGraduated ? 'Graduated' : 'Bonding Curve' }}
            </Badge>
          </div>

          <!-- 1-2 Line Token Description -->
          <p
            v-if="currentToken.description"
            class="text-xs sm:text-sm text-muted-foreground font-sans line-clamp-2 max-w-2xl leading-relaxed"
          >
            {{ currentToken.description }}
          </p>

          <!-- Metadata Byline (Pons-style clean strip) -->
          <div
            class="flex items-center gap-2 flex-wrap text-xs font-sans text-muted-foreground pt-0.5"
          >
            <span v-if="currentToken.deployer" class="inline-flex items-center gap-1">
              <span>by</span>
              <RouterLink
                :to="'/' + getUserIdentity(currentToken.deployer).name"
                class="hover:text-foreground hover:underline transition text-foreground font-mono font-bold"
                :title="currentToken.deployer"
              >
                {{ getUserIdentity(currentToken.deployer).name }}
              </RouterLink>
            </span>
            <span class="text-muted-foreground/50">·</span>
            <span class="font-mono text-[11px]">{{
              formatRelativeTime(currentToken.createdAt)
            }}</span>
            <span class="text-muted-foreground/50">·</span>
            <span class="text-[11px] text-muted-foreground font-semibold font-mono">
              {{ currencySymbol }} pair
            </span>
            <span class="text-muted-foreground/50">·</span>
            <!-- Contract Address Pill -->
            <button
              type="button"
              class="inline-flex items-center gap-1 hover:text-foreground transition cursor-pointer text-[11px] font-mono"
              title="Copy Contract Address"
              @click="$emit('copyAddress', currentToken.address)"
            >
              <span>{{ shortenAddress(currentToken.address, 6, 4) }}</span>
              <Check v-if="copied" class="w-3 h-3 text-emerald-500" />
              <Copy v-else class="w-3 h-3" />
            </button>
            <a
              v-if="explorerUrl"
              :href="`${explorerUrl}/token/${currentToken.address}`"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-foreground transition p-0.5"
              title="View on Explorer"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>

            <!-- IPFS Gateway link -->
            <a
              v-if="currentToken.logo && currentToken.logo.startsWith('ipfs://')"
              :href="`https://ipfs.filebase.io/ipfs/${currentToken.logo.replace('ipfs://', '')}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-muted-foreground hover:text-foreground p-0.5 transition inline-flex items-center"
              title="View Image on IPFS"
            >
              <svg
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </a>

            <!-- Socials -->
            <a
              v-if="safeUrl(currentToken.socials?.twitter)"
              :href="safeUrl(currentToken.socials?.twitter)"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-foreground transition p-0.5"
              title="Twitter / X"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                />
              </svg>
            </a>
            <a
              v-if="safeUrl(currentToken.socials?.telegram)"
              :href="safeUrl(currentToken.socials?.telegram)"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-foreground transition p-0.5"
              title="Telegram"
            >
              <Send class="w-3.5 h-3.5" />
            </a>
            <a
              v-if="safeUrl(currentToken.socials?.website)"
              :href="safeUrl(currentToken.socials?.website)"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-foreground transition p-0.5"
              title="Website"
            >
              <Globe class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      <!-- Right: Pons-style Large Clickable Live Figure with Flash Animation -->
      <button
        type="button"
        class="text-left md:text-right flex flex-col items-start md:items-end gap-0.5 cursor-pointer select-none group transition-all self-start md:self-auto shrink-0 font-mono"
        :title="`Click to toggle between Market Cap and Price display`"
        @click="$emit('toggleFigure')"
      >
        <span
          class="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold font-sans"
        >
          {{ primaryFigureMode === 'mcap' ? 'Market cap' : 'Token price' }}
        </span>
        <div class="flex items-baseline gap-2">
          <span
            class="text-2xl sm:text-3xl font-black tracking-tight transition-all duration-300"
            :class="
              priceFlash === 'up'
                ? 'text-emerald-400 scale-105'
                : priceFlash === 'down'
                  ? 'text-rose-400 scale-105'
                  : 'text-foreground'
            "
          >
            {{ primaryFigureValue }}
          </span>
          <span
            class="text-xs font-bold px-1.5 py-0.5 rounded-full"
            :class="
              (currentMarketData.priceChange24h ?? 0) >= 0
                ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'
                : 'text-rose-500 bg-rose-500/10 border border-rose-500/20'
            "
          >
            {{ (currentMarketData.priceChange24h ?? 0) >= 0 ? '+' : ''
            }}{{ (currentMarketData.priceChange24h ?? 0).toFixed(2) }}%
          </span>
        </div>
        <span
          class="text-[11px] text-muted-foreground group-hover:text-foreground transition underline decoration-dotted"
        >
          {{ secondaryFigureValue }}
        </span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import {
  ChevronLeft,
  Megaphone,
  Copy,
  Check,
  Star,
  ExternalLink,
  Send,
  Globe,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { shortenAddress, formatRelativeTime } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import type { LaunchedTokenEntity, TokenMarketData, NetworkConfig } from '@proto/shared-types';

interface Props {
  currentToken: LaunchedTokenEntity;
  currentMarketData: TokenMarketData;
  currencySymbol?: string;
  tokenNetwork: NetworkConfig;
  explorerUrl?: string;
  primaryFigureMode: 'mcap' | 'price';
  primaryFigureValue: string;
  secondaryFigureValue: string;
  priceFlash?: 'up' | 'down' | null;
  linkCopied?: boolean;
  copied?: boolean;
  isPinned: (address: string) => boolean;
}

withDefaults(defineProps<Props>(), {
  currencySymbol: 'ETH',
  explorerUrl: '',
  priceFlash: null,
  linkCopied: false,
  copied: false,
});

defineEmits<{
  (e: 'openCallModal'): void;
  (e: 'shareToX'): void;
  (e: 'copyTokenLink'): void;
  (e: 'togglePin', address: string): void;
  (e: 'copyAddress', address: string): void;
  (e: 'toggleFigure'): void;
}>();

function safeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}
</script>
