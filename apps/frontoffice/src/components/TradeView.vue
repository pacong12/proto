<template>
  <!-- Full-width terminal layout, no outer max-width constraints -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Loading state -->
    <div
      v-if="tokenLoading"
      class="flex items-center justify-center py-32 text-muted-foreground gap-3"
    >
      <Loader2 class="w-5 h-5 animate-spin text-emerald-500" />
      <span class="text-sm font-medium">Loading token data...</span>
    </div>

    <!-- Token not found state -->
    <div
      v-else-if="tokenNotFound"
      class="flex flex-col items-center justify-center py-32 gap-4 text-center px-4"
    >
      <AlertCircle class="w-10 h-10 text-muted-foreground" />
      <div class="space-y-1">
        <p class="text-base font-semibold text-foreground">Token not found</p>
        <p class="text-xs text-muted-foreground font-mono">{{ props.tokenAddress }}</p>
        <p class="text-xs text-muted-foreground">
          This token has not been indexed yet or does not exist on this network.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Breadcrumb Navigation (ubi.fun style) -->
      <div class="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <RouterLink to="/launchpad" class="hover:text-foreground transition font-medium">
          Markets
        </RouterLink>
        <span>/</span>
        <span class="text-foreground font-bold">{{ currentToken.name }}</span>
      </div>

      <!-- ============================================================
           ROW 1: UBI.FUN TOKEN HEADER & 4-METRIC STAT STRIP
           ============================================================ -->
      <div class="space-y-4">
        <!-- Main Token Identity Row -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5 min-w-0">
            <OptimizedImage
              :src="currentToken.logo"
              :alt="currentToken.name"
              :fallback-text="currentToken.symbol"
              :width="48"
              :height="48"
              class="rounded-full border border-border object-cover ring-2 ring-border shadow-xs shrink-0"
            />
            <div class="min-w-0">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h1 class="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
                  {{ currentToken.name }}
                </h1>
                <!-- Pin / Star Watchlist Button (Pons style) -->
                <button
                  type="button"
                  class="p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer select-none"
                  :class="isPinned(currentToken.address) ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'"
                  :title="isPinned(currentToken.address) ? 'Unpin coin' : 'Pin to Watchlist'"
                  @click.stop="togglePin(currentToken.address)"
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
                  {{ currentMarketData.isGraduated ? 'Open Market' : 'Bonding Curve' }}
                </Badge>
                <span class="text-xs sm:text-sm font-bold font-mono text-muted-foreground">
                  ${{ currentToken.symbol }}
                </span>
                <span class="text-xs font-mono text-muted-foreground">
                  · {{ formatRelativeTime(currentToken.createdAt) }}
                </span>
              </div>

              <!-- Contract Address Pill & Socials -->
              <div class="flex items-center gap-2.5 mt-1.5 flex-wrap text-xs font-mono">
                <button
                  type="button"
                  class="flex items-center gap-1 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-lg border border-border transition cursor-pointer text-[11px]"
                  title="Copy Contract Address"
                  @click="copyAddress(currentToken.address)"
                >
                  <span>{{ shortenAddress(currentToken.address, 6, 4) }}</span>
                  <Check v-if="copied" class="w-3 h-3 text-emerald-500" />
                  <Copy v-else class="w-3 h-3" />
                </button>

                <a
                  :href="`${explorerUrl}/token/${currentToken.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground p-0.5 transition"
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

                <!-- Dev wallet attribution (lunch.fun style) -->
                <span
                  v-if="currentToken.deployer"
                  class="text-muted-foreground text-[11px] flex items-center gap-1"
                >
                  <span>by</span>
                  <a
                    :href="`${explorerUrl}/address/${currentToken.deployer}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-foreground underline decoration-dotted transition"
                    title="Dev Wallet"
                  >
                    {{ shortenAddress(currentToken.deployer, 6, 4) }}
                  </a>
                </span>

                <!-- Socials -->
                <a
                  v-if="currentToken.socials?.twitter"
                  :href="currentToken.socials.twitter"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground transition p-0.5"
                  title="Twitter / X"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                    />
                  </svg>
                </a>
                <a
                  v-if="currentToken.socials?.telegram"
                  :href="currentToken.socials.telegram"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground transition p-0.5"
                  title="Telegram"
                >
                  <Send class="w-3.5 h-3.5" />
                </a>
                <a
                  v-if="currentToken.socials?.website"
                  :href="currentToken.socials.website"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground transition p-0.5"
                  title="Website"
                >
                  <Globe class="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <!-- Right Action Controls (Callout, Share, Copy Link) -->
          <div class="flex items-center gap-2 shrink-0 flex-wrap">
            <!-- Callout Button (pump.fun style) -->
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer shadow-2xs font-mono"
              @click="openCallModal"
            >
              <Megaphone class="w-3.5 h-3.5" />
              <span>Call ${{ currentToken.symbol }}</span>
            </Button>

            <!-- Share to X Button -->
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl border-border cursor-pointer"
              @click="shareToX"
            >
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                />
              </svg>
              <span>Share</span>
            </Button>

            <!-- Copy Link Button -->
            <Button
              variant="outline"
              size="sm"
              class="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl border-border cursor-pointer"
              @click="copyTokenLink"
            >
              <Check v-if="linkCopied" class="w-3.5 h-3.5 text-emerald-500" />
              <Copy v-else class="w-3.5 h-3.5" />
              <span>{{ linkCopied ? 'Copied' : 'Copy link' }}</span>
            </Button>
          </div>
        </div>

        <!-- 4-Stat Metrics Cards Grid (ubi.fun exact style) -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono text-xs">
          <div class="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs">
            <span
              class="text-muted-foreground text-[10px] uppercase tracking-wider block font-semibold"
            >
              Market cap
            </span>
            <span class="font-black text-lg sm:text-xl text-foreground block mt-1">
              ${{ formatNumberCap(currentMarketData.marketCapUsd ?? 4200) }}
            </span>
          </div>

          <div class="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs">
            <span
              class="text-muted-foreground text-[10px] uppercase tracking-wider block font-semibold"
            >
              Token price
            </span>
            <span class="font-black text-lg sm:text-xl text-foreground block mt-1 truncate">
              {{ formatPriceUsd(currentMarketData.priceUsd) }}
            </span>
          </div>

          <div class="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs">
            <span
              class="text-muted-foreground text-[10px] uppercase tracking-wider block font-semibold"
            >
              Volume · 24h
            </span>
            <span class="font-black text-lg sm:text-xl text-foreground block mt-1">
              {{
                (currentMarketData.volume24hUsd ?? 0) > 0
                  ? formatCompactUsd(currentMarketData.volume24hUsd)
                  : '—'
              }}
            </span>
          </div>

          <div class="p-3.5 sm:p-4 rounded-2xl bg-card border border-border shadow-xs">
            <span
              class="text-muted-foreground text-[10px] uppercase tracking-wider block font-semibold"
            >
              Change · 24h
            </span>
            <span
              class="font-black text-lg sm:text-xl block mt-1"
              :class="
                (currentMarketData.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
              "
            >
              {{ (currentMarketData.priceChange24h ?? 0) >= 0 ? '+' : ''
              }}{{ (currentMarketData.priceChange24h ?? 0).toFixed(2) }}%
            </span>
          </div>
        </div>

        <!-- Security, Distribution & Trust Ribbon (lunch.fun style) -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs font-mono">
          <div
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border shrink-0 shadow-2xs"
            title="Supply held by top 10 holders"
          >
            <span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider"
              >Top 10:</span
            >
            <span class="font-bold text-foreground">
              {{ top10HoldingPercent > 0 ? top10HoldingPercent.toFixed(1) + '%' : '—' }}
            </span>
          </div>

          <div
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border shrink-0 shadow-2xs"
            title="Supply held by token creator"
          >
            <span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider"
              >Dev Holds:</span
            >
            <span
              class="font-bold"
              :class="devHoldingPercent > 10 ? 'text-amber-500' : 'text-foreground'"
            >
              {{ devHoldingPercent.toFixed(1) }}%
            </span>
          </div>

          <div
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border shrink-0 shadow-2xs"
            title="Total unique token holders"
          >
            <span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider"
              >Holders:</span
            >
            <span class="font-bold text-foreground">{{ holders.length.toLocaleString() }}</span>
          </div>

          <div
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border shrink-0 shadow-2xs"
            title="Buy / Sell creator trading tax"
          >
            <span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider"
              >Tax:</span
            >
            <span class="font-bold text-foreground">
              {{ (onchainTaxConfig.buyTaxBps / 100).toFixed(0) }}% /
              {{ (onchainTaxConfig.sellTaxBps / 100).toFixed(0) }}%
            </span>
          </div>

          <div
            v-if="burnedInfo.percent > 0"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border shrink-0 shadow-2xs"
            title="Total burned supply"
          >
            <span class="text-muted-foreground text-[10px] uppercase font-bold tracking-wider"
              >Burned:</span
            >
            <span class="font-bold text-rose-500">{{ burnedInfo.percent.toFixed(1) }}%</span>
          </div>

          <a
            :href="`${explorerUrl}/token/${currentToken.address}#code`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold text-[11px] transition"
            title="View contract source on explorer"
          >
            <Check class="w-3.5 h-3.5" />
            <span>Verified</span>
          </a>
        </div>

        <!-- Pending tax change warning - visible to all visitors -->
        <PendingTaxBanner
          v-if="hasPendingTax && pendingTax"
          :pending="pendingTax"
          :symbol="currentToken.symbol"
        />
      </div>

      <!-- ============================================================
           ROW 2: Main Trading Layout - Chart, Swap, & Tabs
           ============================================================ -->
      <!-- Main Trading Grid: Responsive Order (Chart -> Swap -> Tabs on mobile; Chart+Tabs (left) & Swap (right) on desktop) -->
      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <!-- 1. Chart Card (Col 1, Row 1 on xl) -->
        <div class="xl:col-start-1 xl:row-start-1 min-w-0 w-full space-y-6">
          <div class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <!-- Chart Header with Live Price + Timeframes -->
            <div
              class="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-card"
            >
              <div class="flex items-baseline gap-2.5">
                <span
                  class="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono"
                >
                  {{ activeChartHeaderPrice }}
                </span>
                <span
                  class="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
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

              <!-- Timeframe switcher pills -->
              <div class="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
                <button
                  v-for="res in resolutions"
                  :key="res.label"
                  type="button"
                  class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer"
                  :class="
                    selectedResolution === res.seconds
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="changeResolution(res.seconds)"
                >
                  {{ res.label }}
                </button>
              </div>
            </div>

            <!-- TradingChart wrapper -->
            <div class="p-4 sm:p-5 bg-card">
              <TradingChart
                v-model:chart-mode="chartDisplayMode"
                v-model:currency-mode="chartCurrencyMode"
                :data="candlestickData"
                :token-symbol="currentToken.symbol"
                :token-address="currentToken.address"
                :height="420"
                :resolution="selectedResolution"
                :native-symbol="currencySymbol"
                :native-quote-price="quoteAssetPriceUsd"
                :total-supply="
                  Number(
                    currentToken.totalSupply
                      ? BigInt(currentToken.totalSupply) / 10n ** 18n
                      : 1000000000,
                  )
                "
              />
            </div>
          </div>
        </div>

        <!-- 2. Swap Panel Column (Mobile: 2nd right under Chart! Desktop: Col 2, Row 1-2) -->
        <div class="xl:col-start-2 xl:row-start-1 xl:row-span-2 w-full shrink-0 space-y-6">
          <div class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <!-- Graduation progress card -->
            <div class="p-5 sm:p-6 border-b border-border space-y-2.5">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-semibold text-foreground">
                  {{ currentToken.version === 'v2' ? 'Bonding Curve' : 'Uniswap V3 Liquidity' }}
                </span>
                <span class="text-xs font-mono font-bold text-primary">
                  {{ (currentMarketData.graduationProgress * 100).toFixed(1) }}%
                </span>
              </div>
              <Progress
                :model-value="currentMarketData.graduationProgress * 100"
                class="h-1.5 mb-2"
              />
              <div class="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>
                  {{ currentMarketData.pairedPrincipalWeth }} /
                  {{ currentMarketData.graduationThresholdWeth }} {{ currencySymbol }}
                </span>
                <span>{{
                  currentMarketData.isGraduated
                    ? 'Graduated'
                    : `Need ${remainingToGraduate} ${currencySymbol}`
                }}</span>
              </div>
              <!-- Graduation call-to-action banner -->
              <div
                v-if="currentToken.version === 'v2' && !currentMarketData.isGraduated"
                class="mt-2 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-[11px] font-mono flex items-center gap-1.5 text-foreground"
              >
                <Sparkles class="w-3.5 h-3.5 shrink-0" />
                <span>Graduates to Uniswap v4 at 100%</span>
              </div>
              <div
                v-else-if="currentMarketData.isGraduated"
                class="mt-2 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-[11px] font-mono flex items-center gap-1.5 text-foreground"
              >
                <Check class="w-3.5 h-3.5 shrink-0" />
                <span>Liquidity locked in Uniswap DEX</span>
              </div>
            </div>

            <!-- Post-Graduation Pool Details Card (lunch.fun style) -->
            <div
              v-if="currentMarketData.isGraduated && currentToken.poolAddress"
              class="p-4 border-b border-border bg-muted/20 space-y-2 text-xs font-mono"
            >
              <div class="flex items-center justify-between font-bold text-foreground">
                <span class="text-[10px] uppercase tracking-wider text-muted-foreground"
                  >Uniswap Pool</span
                >
                <span class="text-emerald-500 flex items-center gap-1 text-[11px]">
                  <Check class="w-3 h-3" />
                  Locked
                </span>
              </div>
              <div class="space-y-1 text-[11px]">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Pair</span>
                  <div class="flex items-center gap-1">
                    <span class="text-foreground">{{
                      shortenAddress(currentToken.poolAddress, 6, 4)
                    }}</span>
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Copy pair address"
                      @click="copyAddress(currentToken.poolAddress)"
                    >
                      <Copy class="w-3 h-3" />
                    </button>
                    <a
                      :href="`${explorerUrl}/address/${currentToken.poolAddress}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink class="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Locked {{ currencySymbol }}</span>
                  <span class="font-bold text-foreground">
                    {{ currentMarketData.pairedPrincipalWeth }} {{ currencySymbol }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Swap panel form wrapper -->
            <div class="p-5 sm:p-6 space-y-4">
              <!-- Wrong network warning banner -->
              <div
                v-if="isConnected && activeNetwork.chainId !== tokenNetwork.chainId"
                class="px-3 py-2.5 rounded-xl bg-muted border border-border text-xs text-foreground flex items-center gap-2"
              >
                <AlertCircle class="w-3.5 h-3.5 shrink-0" />
                <span>Switch to {{ tokenNetwork.name }} to trade.</span>
              </div>

              <!-- Buy / Sell tabs + Slippage gear in ONE row -->
              <div class="flex items-center justify-between gap-3">
                <div class="flex rounded-xl border border-border bg-muted p-1 w-44 shrink-0">
                  <button
                    type="button"
                    class="flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center"
                    :class="
                      isBuy
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="tradeTab = 'buy'"
                  >
                    {{ t('buy') }}
                  </button>
                  <button
                    type="button"
                    class="flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center"
                    :class="
                      !isBuy
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="tradeTab = 'sell'"
                  >
                    {{ t('sell') }}
                  </button>
                </div>

                <!-- Slippage Popover -->
                <Popover>
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      aria-label="Slippage settings"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition cursor-pointer bg-card"
                    >
                      <Settings class="w-3.5 h-3.5" />
                      <span>{{ slippage }}%</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    class="w-64 p-3 bg-card border border-border rounded-2xl shadow-2xl space-y-3"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-foreground">Slippage Tolerance</span>
                      <span class="text-xs font-mono font-bold text-primary">{{ slippage }}%</span>
                    </div>
                    <div class="grid grid-cols-4 gap-1.5">
                      <Button
                        v-for="preset in [0.5, 1.0, 2.0]"
                        :key="preset"
                        size="sm"
                        :variant="slippage === preset && !isCustomSlippage ? 'default' : 'outline'"
                        class="h-7 px-1 text-xs font-mono"
                        @click="selectSlippagePreset(preset)"
                      >
                        {{ preset }}%
                      </Button>
                      <Button
                        size="sm"
                        :variant="isCustomSlippage ? 'default' : 'outline'"
                        class="h-7 px-1 text-xs font-mono"
                        @click="isCustomSlippage = true"
                      >
                        Custom
                      </Button>
                    </div>
                    <div v-if="isCustomSlippage" class="space-y-1">
                      <div class="relative">
                        <Input
                          v-model="customSlippageInput"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="49"
                          placeholder="1.0"
                          class="h-8 text-xs font-mono pr-7 bg-muted/40"
                          @input="handleCustomSlippageInput"
                        />
                        <span
                          class="absolute right-2.5 top-2 text-xs font-mono font-bold text-muted-foreground"
                          >%</span
                        >
                      </div>
                      <div
                        v-if="slippage > SLIPPAGE_WARN_THRESHOLD"
                        class="text-[10px] font-mono text-amber-500 flex items-center gap-1"
                      >
                        <AlertCircle class="w-3 h-3 shrink-0" />
                        High slippage - sandwich attack risk.
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <!-- You Pay input -->
              <div class="space-y-2">
                <div class="flex justify-between items-center text-xs text-muted-foreground">
                  <div class="flex items-center gap-2">
                    <span>You pay</span>
                    <div
                      v-if="isBuy"
                      class="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border text-[10px] font-mono font-bold"
                    >
                      <button
                        type="button"
                        class="px-1.5 py-0.5 rounded transition cursor-pointer"
                        :class="
                          !payInUsd
                            ? 'bg-background text-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        "
                        @click="payInUsd = false"
                      >
                        {{ currencySymbol }}
                      </button>
                      <button
                        type="button"
                        class="px-1.5 py-0.5 rounded transition cursor-pointer"
                        :class="
                          payInUsd
                            ? 'bg-background text-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        "
                        @click="payInUsd = true"
                      >
                        USD
                      </button>
                    </div>
                  </div>
                  <span
                    class="font-mono flex items-center gap-1 cursor-pointer select-none hover:opacity-80 transition"
                    :title="
                      isBuy
                        ? 'Click to fill max ' + currencySymbol
                        : 'Click to fill max ' + currentToken.symbol
                    "
                    @click="applyPercentage(100)"
                  >
                    <span>Bal:</span>
                    <span
                      v-if="!isBuy && isTokenBalanceLoading"
                      class="animate-pulse font-bold text-foreground"
                      >...</span
                    >
                    <span v-else class="font-bold text-foreground">{{
                      isBuy ? formatEthBalance(balanceWei) : formatTokenBalance(userTokenBalance)
                    }}</span>
                    <span>{{ isBuy ? currencySymbol : currentToken.symbol }}</span>
                  </span>
                </div>
                <div class="relative">
                  <Input
                    v-model="amountIn"
                    type="number"
                    step="any"
                    placeholder="0.0"
                    class="text-lg font-mono font-bold text-foreground bg-muted/40 border-input h-12 pr-16 rounded-xl"
                  />
                  <span
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-muted-foreground select-none"
                  >
                    {{ isBuy ? (payInUsd ? 'USD' : currencySymbol) : currentToken.symbol }}
                  </span>
                </div>

                <!-- Quick buy presets (buy mode only) -->
                <div v-if="isBuy" class="grid grid-cols-4 gap-1.5 pt-0.5">
                  <button
                    v-for="presetVal in activeBuyPresets"
                    :key="presetVal"
                    type="button"
                    class="h-7 text-xs font-mono font-medium rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground transition cursor-pointer"
                    @click="applyQuickBuy(presetVal)"
                  >
                    {{ payInUsd ? '$' + presetVal : presetVal }}
                  </button>
                </div>

                <!-- Percentage buttons -->
                <div class="grid grid-cols-4 gap-1.5 pt-0.5">
                  <button
                    v-for="percent in [25, 50, 75, 100]"
                    :key="percent"
                    type="button"
                    class="h-7 text-xs font-mono font-medium rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground transition cursor-pointer"
                    @click="applyPercentage(percent)"
                  >
                    {{ percent === 100 ? 'Max' : `${percent}%` }}
                  </button>
                </div>
              </div>

              <!-- You receive output -->
              <div class="space-y-1.5">
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>You receive (est.)</span>
                  <span class="font-mono">{{ isBuy ? currentToken.symbol : currencySymbol }}</span>
                </div>
                <div
                  class="w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm font-mono font-bold text-foreground min-h-[46px] flex items-center justify-between"
                >
                  <span>{{ estimatedOutput }}</span>
                </div>
              </div>

              <!-- Last price indicator (lunch.fun style) -->
              <div
                class="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-0.5 px-0.5"
              >
                <span>Last price</span>
                <span class="font-bold text-foreground truncate">
                  {{ formatPriceUsd(currentMarketData.priceUsd) }}
                </span>
              </div>

              <!-- High-slippage inline warning (L-3 fix) -->
              <div
                v-if="
                  slippage > SLIPPAGE_WARN_THRESHOLD &&
                  isConnected &&
                  activeNetwork.chainId === tokenNetwork.chainId
                "
                class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] font-mono text-amber-500"
              >
                <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Slippage is set to <strong>{{ slippage }}%</strong> — high sandwich attack risk.
                  Lower it in the settings above or proceed with caution.
                </span>
              </div>

              <!-- CTA Swap button -->
              <Button
                v-if="!isConnected"
                class="w-full font-bold h-11 cursor-pointer rounded-xl text-sm shadow-md"
                @click="openWallet"
              >
                {{ t('connectWallet') }}
              </Button>
              <Button
                v-else-if="activeNetwork.chainId !== tokenNetwork.chainId"
                variant="outline"
                class="w-full font-bold h-11 cursor-pointer rounded-xl text-sm border-amber-500 text-amber-500"
                @click="switchOrAddNetwork(tokenNetwork)"
              >
                Switch to {{ tokenNetwork.name }}
              </Button>
              <Button
                v-else
                :disabled="isSwapDisabled"
                class="w-full font-bold h-11 cursor-pointer rounded-xl text-sm transition shadow-md"
                :variant="isBuy ? 'default' : 'destructive'"
                @click="handleSwap"
              >
                <Loader2 v-if="isSwapping" class="w-4 h-4 mr-2 animate-spin" />
                <ArrowUpDown v-else class="w-4 h-4 mr-2" />
                {{ swapButtonText }}
              </Button>
            </div>
          </div>
        </div>

        <!-- 3. Bottom Tabs Card (Mobile: 3rd after Swap; Desktop: Col 1, Row 2) -->
        <div class="xl:col-start-1 xl:row-start-2 min-w-0 w-full space-y-6">
          <div class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <Tabs v-model="activeBottomTab" class="w-full">
              <!-- Tab headers -->
              <div
                class="flex items-center justify-between border-b border-border bg-muted/30 px-3 sm:px-4 py-2 overflow-x-auto no-scrollbar gap-2"
              >
                <TabsList
                  class="flex gap-1 bg-transparent border-0 rounded-none h-auto p-0 shrink-0"
                >
                  <TabsTrigger
                    v-for="tab in [
                      { value: 'callouts', label: 'Callouts' },
                      { value: 'trades', label: t('trades') },
                      { value: 'top-traders', label: t('topTraders') },
                      { value: 'holders', label: t('holders') },
                      { value: 'about', label: t('about') },
                    ]"
                    :key="tab.value"
                    :value="tab.value"
                    class="px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground hover:text-foreground bg-transparent transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {{ tab.label }}
                    <span
                      v-if="tab.value === 'callouts' && callouts.length > 0"
                      class="ml-1 px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-bold text-[10px]"
                    >
                      {{ callouts.length }}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <Button
                  v-if="activeBottomTab === 'trades'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 px-2 text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  @click="fetchTrades(currentToken.address)"
                >
                  <RefreshCw class="w-3.5 h-3.5 sm:mr-1" />
                  <span class="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  v-if="activeBottomTab === 'callouts'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 px-2 text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  @click="fetchCallouts(currentToken.address)"
                >
                  <RefreshCw class="w-3.5 h-3.5 sm:mr-1" />
                  <span class="hidden sm:inline">Refresh</span>
                </Button>
              </div>

              <!-- Tab: Community Callouts (pump.fun style) -->
              <TabsContent
                value="callouts"
                class="mt-0 max-h-[460px] overflow-y-auto p-4 sm:p-5 space-y-4"
              >
                <!-- Quick Post Callout Action -->
                <div
                  class="p-4 rounded-2xl border border-border bg-muted/30 flex items-center justify-between gap-3 font-mono text-xs"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <Megaphone class="w-4 h-4 text-primary shrink-0" />
                    <div class="min-w-0">
                      <p class="font-bold text-foreground text-xs leading-tight">
                        Post a Community Callout
                      </p>
                      <p class="text-[11px] text-muted-foreground truncate">
                        Attach your thesis, exit price target, and verified position.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    class="h-8 px-3 text-xs font-bold gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                    @click="openCallModal"
                  >
                    <Megaphone class="w-3 h-3" />
                    <span>Call ${{ currentToken.symbol }}</span>
                  </Button>
                </div>

                <!-- Callouts Feed -->
                <div
                  v-if="calloutsLoading && callouts.length === 0"
                  class="py-12 text-center text-muted-foreground"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-primary" />
                  <span class="text-xs font-mono">Loading callouts...</span>
                </div>
                <Empty
                  v-else-if="callouts.length === 0"
                  :title="'No callouts yet'"
                  :description="`Be the first to call $${currentToken.symbol} to the community!`"
                  class="py-12 border-none bg-muted/20"
                >
                  <template #icon>
                    <Megaphone class="w-6 h-6 text-muted-foreground opacity-60" />
                  </template>
                </Empty>
                <div v-else class="space-y-3">
                  <div
                    v-for="cmt in paginatedCallouts"
                    :key="cmt.id"
                    class="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors space-y-2.5"
                  >
                    <!-- Header: Author + Badges + Time -->
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <Jazzicon :address="cmt.authorAddress" :size="18" />
                        <span class="text-xs font-mono font-bold text-foreground">
                          {{ truncateAddress(cmt.authorAddress) }}
                        </span>
                        <Badge
                          v-if="
                            cmt.authorAddress.toLowerCase() === currentToken.deployer?.toLowerCase()
                          "
                          variant="secondary"
                          class="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono"
                        >
                          Creator
                        </Badge>
                        <Badge
                          v-else-if="isHolderAddress(cmt.authorAddress)"
                          variant="outline"
                          class="text-[9px] px-1.5 py-0 h-4 font-mono text-muted-foreground"
                        >
                          Holder
                        </Badge>
                      </div>
                      <span class="text-[10px] font-mono text-muted-foreground">
                        {{ formatRelativeTime(cmt.createdAt) }}
                      </span>
                    </div>

                    <!-- Callout Text -->
                    <p
                      class="text-xs leading-relaxed text-foreground font-sans break-words whitespace-pre-wrap font-medium"
                    >
                      <CashtagText :text="cmt.content" :tokens="[{ token: currentToken }]" />
                    </p>

                    <!-- Optional Attached Image -->
                    <div
                      v-if="cmt.imageUrl"
                      class="rounded-lg overflow-hidden border border-border max-w-xs"
                    >
                      <img
                        :src="resolveSafeUrl(cmt.imageUrl)"
                        alt="Call attachment"
                        class="w-full max-h-48 object-cover"
                      />
                    </div>

                    <!-- Pump.fun Style Callout Mini Token Card -->
                    <div
                      class="p-2.5 rounded-xl border border-border bg-muted/40 flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <OptimizedImage
                          :src="currentToken.logo"
                          :alt="currentToken.name"
                          :fallback-text="currentToken.symbol"
                          :width="26"
                          :height="26"
                          class="rounded-full border border-border shrink-0"
                        />
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5 leading-none">
                            <span class="font-bold text-foreground text-xs"
                              >${{ currentToken.symbol }}</span
                            >
                            <span class="text-[10px] text-muted-foreground truncate">{{
                              currentToken.name
                            }}</span>
                          </div>
                          <span class="text-[10px] text-emerald-500 font-bold block mt-1">
                            {{
                              cmt.targetMcap
                                ? `Target: ${cmt.targetMcap}`
                                : `MC: ${formatCompactUsd(currentMarketData.marketCapUsd || 4200)}`
                            }}
                          </span>
                        </div>
                      </div>

                      <div class="text-right shrink-0">
                        <span class="text-[9px] text-muted-foreground block uppercase font-bold"
                          >Position</span
                        >
                        <span class="text-xs font-bold text-foreground">
                          {{ cmt.positionUsd ? `$${cmt.positionUsd.toFixed(2)}` : 'Holder' }}
                        </span>
                      </div>
                    </div>

                    <!-- Card Actions: Thread Replies + Like + Total Views + Share Sheet (Twitter/X style) -->
                    <div
                      class="flex items-center justify-between pt-1 border-t border-border text-xs font-sans text-muted-foreground"
                    >
                      <button
                        type="button"
                        class="group flex items-center gap-1 hover:text-sky-500 transition-colors cursor-pointer text-xs"
                        title="View replies"
                        @click="openThreadModal(cmt)"
                      >
                        <div class="p-1 rounded-full group-hover:bg-sky-500/10 transition-colors">
                          <MessageCircle class="w-3.5 h-3.5" />
                        </div>
                        <span class="group-hover:text-sky-500">{{ cmt.repliesCount || 0 }}</span>
                      </button>

                      <button
                        type="button"
                        aria-label="Like callout"
                        class="group flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer text-xs"
                        :class="cmt.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
                        @click="toggleLike(cmt.id)"
                      >
                        <div class="p-1 rounded-full group-hover:bg-rose-500/10 transition-colors">
                          <Heart
                            class="w-3.5 h-3.5"
                            :class="cmt.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
                          />
                        </div>
                        <span class="group-hover:text-rose-500">{{ cmt.likesCount }}</span>
                      </button>

                      <!-- Total Views (Display only, strictly NOT clickable, Twitter / X style) -->
                      <div
                        class="flex items-center gap-1 text-muted-foreground select-none cursor-default text-xs"
                        title="Views"
                      >
                        <div class="p-1">
                          <BarChart2 class="w-3.5 h-3.5 text-muted-foreground/70" />
                        </div>
                        <span>{{ formatViews(cmt.viewsCount || 0) }}</span>
                      </div>

                      <button
                        type="button"
                        class="group flex items-center text-muted-foreground hover:text-sky-500 transition-colors cursor-pointer text-xs"
                        title="Share callout"
                        @click="openShareModal(cmt)"
                      >
                        <div class="p-1 rounded-full group-hover:bg-sky-500/10 transition-colors">
                          <Share2 class="w-3.5 h-3.5" />
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Callouts Pagination -->
                  <div v-if="callouts.length > calloutsPageSize" class="pt-2 flex justify-center">
                    <Pagination
                      :total="callouts.length"
                      :items-per-page="calloutsPageSize"
                      :page="calloutsPage"
                      @update:page="calloutsPage = $event"
                    />
                  </div>
                </div>
              </TabsContent>

              <!-- Tab: Live Trades -->
              <TabsContent value="trades" class="mt-0 max-h-[340px] overflow-y-auto">
                <!-- Order flow filters & stats (lunch.fun style) -->
                <div
                  v-if="trades.length > 0"
                  class="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:px-4 border-b border-border bg-muted/20 text-xs font-mono"
                >
                  <div class="flex items-center gap-1.5">
                    <button
                      v-for="flt in [
                        { key: 'all', label: `All (${trades.length})` },
                        { key: 'buy', label: `Buys (${orderFlowStats.buyCount})` },
                        { key: 'sell', label: `Sells (${orderFlowStats.sellCount})` },
                      ]"
                      :key="flt.key"
                      type="button"
                      class="px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      :class="
                        tradeFilter === flt.key
                          ? 'bg-foreground text-background shadow-2xs'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      "
                      @click="
                        tradeFilter = flt.key as any;
                        tradesPage = 1;
                      "
                    >
                      {{ flt.label }}
                    </button>
                  </div>
                  <div class="text-[11px] font-bold">
                    <span class="text-muted-foreground">Net: </span>
                    <span
                      :class="
                        orderFlowStats.netVolumeUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      "
                    >
                      {{ orderFlowStats.netVolumeUsd >= 0 ? '+' : '' }}${{
                        Math.abs(orderFlowStats.netVolumeUsd).toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })
                      }}
                    </span>
                  </div>
                </div>

                <div
                  v-if="tradesLoading && trades.length === 0"
                  class="py-16 text-center text-muted-foreground"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span class="text-xs">Loading trades...</span>
                </div>
                <div
                  v-else-if="trades.length === 0"
                  class="py-16 text-center text-muted-foreground"
                >
                  <p class="text-xs font-mono">No trades recorded yet.</p>
                </div>
                <div
                  v-else-if="filteredTrades.length === 0"
                  class="py-16 text-center text-muted-foreground"
                >
                  <p class="text-xs font-mono">No trades match this filter.</p>
                </div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-xs font-mono min-w-[540px]">
                    <thead class="sticky top-0 z-10 bg-muted">
                      <tr class="border-b border-border text-muted-foreground">
                        <th class="py-2 px-3 font-semibold">Type</th>
                        <th class="py-2 px-3 font-semibold">Price</th>
                        <th class="py-2 px-3 font-semibold">{{ currencySymbol }}</th>
                        <th class="py-2 px-3 font-semibold">{{ currentToken.symbol }}</th>
                        <th class="py-2 px-3 font-semibold">Trader</th>
                        <th class="py-2 px-3 font-semibold">Age</th>
                        <th class="py-2 px-3 font-semibold text-right">Tx</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      <tr
                        v-for="trade in paginatedTrades"
                        :key="trade.id || trade.transactionHash"
                        class="hover:bg-muted/50 transition-colors"
                      >
                        <td class="py-2 px-3 whitespace-nowrap">
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider border border-border"
                            :class="
                              trade.isBuy
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            "
                          >
                            {{ trade.isBuy ? 'BUY' : 'SELL' }}
                          </span>
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-foreground font-medium">
                          ${{
                            trade.priceUsd < 0.0001
                              ? trade.priceUsd.toFixed(8)
                              : trade.priceUsd.toFixed(4)
                          }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-foreground">
                          {{ parseFloat(trade.wethAmount).toFixed(4) }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-foreground font-medium">
                          {{ formatTokenNumber(trade.tokenAmount) }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap">
                          <div class="flex items-center gap-1.5 text-foreground">
                            <Jazzicon :address="trade.trader" :size="14" />
                            <span>{{ truncateAddress(trade.trader) }}</span>
                            <button
                              type="button"
                              aria-label="Copy trader address"
                              class="text-muted-foreground hover:text-foreground transition cursor-pointer"
                              @click="copyText(trade.trader, trade.id + '-trader')"
                            >
                              <Check
                                v-if="copiedId === trade.id + '-trader'"
                                class="w-3 h-3 text-emerald-400"
                              />
                              <Copy v-else class="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-muted-foreground">
                          {{ formatRelativeTime(trade.timestamp) }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-right">
                          <a
                            :href="`${explorerUrl}/tx/${trade.transactionHash}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View transaction on explorer"
                            class="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
                          >
                            <ExternalLink class="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Trades Pagination -->
                  <div
                    v-if="filteredTrades.length > tradesPageSize"
                    class="py-3 border-t border-border flex justify-center bg-muted/30"
                  >
                    <Pagination
                      :total="filteredTrades.length"
                      :items-per-page="tradesPageSize"
                      :page="tradesPage"
                      @update:page="tradesPage = $event"
                    />
                  </div>
                </div>
              </TabsContent>

              <!-- Tab: Top Traders -->
              <TabsContent value="top-traders" class="mt-0 max-h-[340px] overflow-y-auto">
                <div
                  v-if="topTradersLoading && topTraders.length === 0"
                  class="py-16 text-center text-muted-foreground"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span class="text-xs">Loading traders...</span>
                </div>
                <div
                  v-else-if="topTraders.length === 0"
                  class="py-16 text-center text-muted-foreground"
                >
                  <p class="text-xs font-mono">No trading activity recorded yet.</p>
                </div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-xs font-mono min-w-[520px]">
                    <thead class="sticky top-0 z-10 bg-muted">
                      <tr class="border-b border-border text-muted-foreground">
                        <th class="py-2 px-3 font-semibold w-10">#</th>
                        <th class="py-2 px-3 font-semibold">Trader</th>
                        <th class="py-2 px-3 font-semibold">Tag</th>
                        <th class="py-2 px-3 font-semibold text-right">Buy / Sell</th>
                        <th class="py-2 px-3 font-semibold text-center">Position</th>
                        <th class="py-2 px-3 font-semibold text-right">Est. PnL</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      <tr
                        v-for="(trader, idx) in paginatedTopTraders"
                        :key="trader.address"
                        class="hover:bg-muted/50 transition-colors"
                      >
                        <td class="py-2 px-3 text-muted-foreground font-bold">
                          #{{ (topTradersPage - 1) * topTradersPageSize + idx + 1 }}
                        </td>
                        <td class="py-2 px-3">
                          <div class="flex items-center gap-1.5">
                            <Jazzicon :address="trader.address" :size="14" />
                            <span class="text-foreground font-medium">{{
                              truncateAddress(trader.address)
                            }}</span>
                            <button
                              type="button"
                              aria-label="Copy trader address"
                              class="text-muted-foreground hover:text-foreground transition cursor-pointer"
                              @click="copyText(trader.address, `trader-${trader.address}`)"
                            >
                              <Copy class="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td class="py-2 px-3">
                          <Badge
                            :variant="
                              trader.isDev
                                ? 'default'
                                : trader.walletTag === 'smart_degen'
                                  ? 'outline'
                                  : 'secondary'
                            "
                            class="text-[9px] px-1.5 py-0 uppercase h-4 font-mono"
                          >
                            {{ trader.isDev ? 'Dev' : trader.walletTag }}
                          </Badge>
                        </td>
                        <td class="py-2 px-3 text-right">
                          <span class="text-emerald-500 font-medium"
                            >${{ trader.buyVolumeUsd.toLocaleString() }}</span
                          >
                          <span class="text-muted-foreground mx-1">/</span>
                          <span class="text-rose-500 font-medium"
                            >${{ trader.sellVolumeUsd.toLocaleString() }}</span
                          >
                        </td>
                        <td class="py-2 px-3 text-center">
                          <Badge
                            :variant="
                              trader.positionStatus === 'holding'
                                ? 'default'
                                : trader.positionStatus === 'clean_all'
                                  ? 'destructive'
                                  : 'outline'
                            "
                            class="text-[9px] px-1.5 py-0 uppercase h-4 font-mono"
                          >
                            {{
                              trader.positionStatus === 'holding'
                                ? 'Holding'
                                : trader.positionStatus === 'clean_all'
                                  ? 'Exited'
                                  : 'Partial'
                            }}
                          </Badge>
                        </td>
                        <td
                          class="py-2 px-3 text-right font-bold"
                          :class="trader.profitUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                        >
                          {{ trader.profitUsd >= 0 ? '+' : '-' }}${{
                            Math.abs(trader.profitUsd).toLocaleString()
                          }}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Top Traders Pagination -->
                  <div
                    v-if="topTraders.length > topTradersPageSize"
                    class="py-3 border-t border-border flex justify-center bg-muted/30"
                  >
                    <Pagination
                      :total="topTraders.length"
                      :items-per-page="topTradersPageSize"
                      :page="topTradersPage"
                      @update:page="topTradersPage = $event"
                    />
                  </div>
                </div>
              </TabsContent>

              <!-- Tab: Holders -->
              <TabsContent value="holders" class="mt-0 max-h-[340px] overflow-y-auto">
                <div
                  v-if="holdersLoading && holders.length === 0"
                  class="py-16 text-center text-muted-foreground"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span class="text-xs">Loading holders...</span>
                </div>
                <div
                  v-else-if="holders.length === 0"
                  class="py-16 text-center text-muted-foreground"
                >
                  <p class="text-xs font-mono">No holder data available.</p>
                </div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-xs font-mono min-w-[500px]">
                    <thead class="sticky top-0 z-10 bg-muted">
                      <tr class="border-b border-border text-muted-foreground">
                        <th class="py-2 px-3 font-semibold w-10">#</th>
                        <th class="py-2 px-3 font-semibold">Holder</th>
                        <th class="py-2 px-3 font-semibold w-44">Share</th>
                        <th class="py-2 px-3 font-semibold text-right">Balance</th>
                        <th class="py-2 px-3 font-semibold text-right w-8"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      <tr
                        v-for="(holder, idx) in paginatedHolders"
                        :key="holder.address"
                        class="hover:bg-muted/50 transition-colors"
                      >
                        <td class="py-2 px-3 text-muted-foreground font-bold">
                          #{{ (holdersPage - 1) * holdersPageSize + idx + 1 }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap">
                          <div class="flex items-center gap-1.5">
                            <Jazzicon :address="holder.address" :size="14" />
                            <span class="text-foreground font-medium">{{
                              truncateAddress(holder.address)
                            }}</span>
                            <button
                              type="button"
                              aria-label="Copy holder address"
                              class="text-muted-foreground hover:text-foreground transition cursor-pointer"
                              @click="copyText(holder.address, 'holder-' + idx)"
                            >
                              <Check
                                v-if="copiedId === 'holder-' + idx"
                                class="w-3 h-3 text-emerald-400"
                              />
                              <Copy v-else class="w-3 h-3" />
                            </button>
                            <Badge
                              v-if="getHolderBadge(holder.address)"
                              variant="outline"
                              class="text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground font-mono"
                            >
                              {{ getHolderBadge(holder.address) }}
                            </Badge>
                          </div>
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap">
                          <div class="flex items-center gap-2">
                            <span class="text-foreground font-semibold w-12 text-right shrink-0">
                              {{ holder.percent.toFixed(2) }}%
                            </span>
                            <Progress :model-value="holder.percent" class="h-1.5 w-28" />
                          </div>
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-right text-foreground">
                          {{ formatTokenNumber(holder.balance) }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-right">
                          <a
                            :href="`${explorerUrl}/address/${holder.address}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
                          >
                            <ExternalLink class="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Holders Pagination -->
                  <div
                    v-if="holders.length > holdersPageSize"
                    class="py-3 border-t border-border flex justify-center bg-muted/30"
                  >
                    <Pagination
                      :total="holders.length"
                      :items-per-page="holdersPageSize"
                      :page="holdersPage"
                      @update:page="holdersPage = $event"
                    />
                  </div>
                </div>
              </TabsContent>

              <!-- Tab: About -->
              <TabsContent value="about" class="mt-0 p-4 space-y-5 max-h-[340px] overflow-y-auto">
                <!-- Description -->
                <p class="text-sm leading-relaxed text-muted-foreground">
                  {{
                    currentToken.description ||
                    `Fixed-supply launchpad token on ${activeNetwork.name}.`
                  }}
                </p>

                <!-- Contract addresses -->
                <div class="space-y-2">
                  <p
                    class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground"
                  >
                    Contract Addresses
                  </p>
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-xs text-muted-foreground font-mono shrink-0">Token</span>
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-mono text-foreground truncate">{{
                          currentToken.address
                        }}</span>
                        <button
                          type="button"
                          aria-label="Copy token address"
                          class="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                          @click="copyAddress"
                        >
                          <Check v-if="copied" class="w-3 h-3 text-emerald-400" />
                          <Copy v-else class="w-3 h-3" />
                        </button>
                        <a
                          :href="`${explorerUrl}/address/${currentToken.address}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View token on explorer"
                          class="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <ExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div
                      v-if="currentToken.poolAddress"
                      class="flex items-center justify-between gap-3"
                    >
                      <span class="text-xs text-muted-foreground font-mono shrink-0">Pool</span>
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-mono text-foreground truncate">{{
                          currentToken.poolAddress
                        }}</span>
                        <a
                          :href="`${explorerUrl}/address/${currentToken.poolAddress}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View pool on explorer"
                          class="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <ExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Market data grid -->
                <div class="grid grid-cols-3 gap-4 pt-3 border-t border-border">
                  <div>
                    <p class="text-[10px] uppercase tracking-wider text-muted-foreground">Price</p>
                    <p class="text-sm font-bold font-mono mt-0.5 text-foreground">
                      {{ formatPriceUsd(currentMarketData.priceUsd) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Mkt Cap
                    </p>
                    <p class="text-sm font-bold font-mono mt-0.5 text-foreground">
                      {{ formatCompactUsd(currentMarketData.marketCapUsd) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px] uppercase tracking-wider text-muted-foreground">
                      24h Vol
                    </p>
                    <p class="text-sm font-bold font-mono mt-0.5 text-foreground">
                      {{ formatCompactUsd(currentMarketData.volume24hUsd) }}
                    </p>
                  </div>
                </div>

                <!-- Trading Taxes & Fees Card -->
                <div class="space-y-2.5 pt-3 border-t border-border font-mono text-xs">
                  <div class="flex items-center justify-between">
                    <div>
                      <p
                        class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground"
                      >
                        Trading Taxes &amp; Fees
                      </p>
                      <p class="text-xs text-foreground mt-0.5">
                        Buy Tax:
                        <span class="font-bold"
                          >{{ (onchainTaxConfig.buyTaxBps / 100).toFixed(1) }}%</span
                        >
                        - Sell Tax:
                        <span class="font-bold"
                          >{{ (onchainTaxConfig.sellTaxBps / 100).toFixed(1) }}%</span
                        >
                        - Protocol Fee:
                        <span class="font-bold text-emerald-500">1.0%</span>
                      </p>
                    </div>

                    <!-- Creator Manage Tax Trigger -->
                    <Button
                      v-if="isCreator"
                      variant="outline"
                      size="sm"
                      class="h-7 text-xs font-mono cursor-pointer"
                      @click="taxModalOpen = true"
                    >
                      Update Tax
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <!-- Creator Tax Management Dialog -->
      <Dialog v-model:open="taxModalOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Creator Tax Settings</DialogTitle>
            <DialogDescription>
              Configure trading taxes on ${{ currentToken.symbol }}. Changes require a 24-hour
              timelock before taking effect (max 10%).
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-4 py-2 font-mono text-xs">
            <div class="space-y-1.5">
              <Label for="update-buy-tax">Buy Tax (%)</Label>
              <Input
                id="update-buy-tax"
                v-model="editBuyTax"
                type="number"
                min="0"
                max="10"
                step="0.1"
                placeholder="1"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="update-sell-tax">Sell Tax (%)</Label>
              <Input
                id="update-sell-tax"
                v-model="editSellTax"
                type="number"
                min="0"
                max="10"
                step="0.1"
                placeholder="1"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="update-tax-recipient">Tax Recipient Wallet</Label>
              <Input
                id="update-tax-recipient"
                v-model="editTaxRecipient"
                type="text"
                :placeholder="account || '0x...'"
              />
            </div>
          </div>

          <!-- Deployer: manage pending timelock proposal -->
          <div class="pt-2 border-t border-border">
            <p
              class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3 font-mono"
            >
              Pending proposal
            </p>
            <TaxTimelockPanel
              :token-address="currentToken.address"
              :pending="pendingTax"
              :has-pending="hasPendingTax"
              :is-ready="taxIsReady"
              :seconds-until-ready="taxSecondsUntilReady"
              :action-loading="taxActionLoading"
              :error="taxError"
              @accept="handleAcceptTax"
              @cancel="handleCancelTax"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" @click="taxModalOpen = false">Cancel</Button>
            <Button :disabled="updatingTax" @click="handleUpdateTax">
              <Loader2 v-if="updatingTax" class="w-4 h-4 mr-2 animate-spin" />
              Save Onchain Tax
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Callout Modal (pump.fun style) -->
      <Dialog v-model:open="callModalOpen">
        <DialogContent class="sm:max-w-md bg-card border-border font-mono text-xs">
          <DialogHeader>
            <div class="flex items-center gap-2">
              <Megaphone class="w-4 h-4 text-primary shrink-0" />
              <DialogTitle class="text-base font-black font-mono">
                Call ${{ currentToken.symbol }}
              </DialogTitle>
            </div>
            <DialogDescription class="text-xs text-muted-foreground font-mono">
              Post an on-chain verified alpha callout with your price target and thesis.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-4 py-2">
            <!-- Mini Token Card Preview -->
            <div
              class="p-3.5 rounded-xl border border-border bg-muted/40 flex items-center justify-between gap-3"
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
                    <span class="text-muted-foreground text-[11px] truncate">
                      {{ currentToken.name }}
                    </span>
                  </div>
                  <span class="text-[11px] text-muted-foreground block mt-0.5">
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
                <span class="text-[10px] text-muted-foreground block uppercase font-bold"
                  >Your Position</span
                >
                <span
                  class="text-xs font-bold"
                  :class="userHoldingTokensCount > 0 ? 'text-emerald-500' : 'text-amber-500'"
                >
                  {{ userHoldingTokensCount > 0 ? `$${userHoldingUsd.toFixed(2)}` : '0 tokens' }}
                </span>
              </div>
            </div>

            <!-- Position Requirement Alert (pump.fun rule: caller must hold tokens) -->
            <div
              v-if="userTokenBalance <= 0n"
              class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-between gap-2"
            >
              <div class="flex items-center gap-2 min-w-0">
                <AlertCircle class="w-4 h-4 shrink-0" />
                <span class="text-[11px] font-sans">
                  You must hold a position in ${{ currentToken.symbol }} to post a callout.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                class="h-6 px-2 text-[10px] border-amber-500 text-amber-500 hover:bg-amber-500/10 shrink-0 font-bold cursor-pointer"
                @click="goToBuyFromCall"
              >
                Buy Now
              </Button>
            </div>

            <!-- Target Market Cap selector pills -->
            <div class="space-y-1.5">
              <Label class="text-[11px] font-bold text-foreground">Target Market Cap</Label>
              <div class="grid grid-cols-4 gap-1.5">
                <Button
                  v-for="target in [
                    '$25K MC',
                    '$50K MC',
                    '$100K MC',
                    '$250K MC',
                    '$500K MC',
                    '$1M MC',
                    '$5M MC',
                    'Moon 🚀',
                  ]"
                  :key="target"
                  type="button"
                  size="sm"
                  :variant="callTargetMcap === target ? 'default' : 'outline'"
                  class="h-7 px-1 text-[11px] font-mono"
                  @click="callTargetMcap = target"
                >
                  {{ target }}
                </Button>
              </div>
            </div>

            <!-- Thesis / Callout Message -->
            <div class="space-y-1.5">
              <Label class="text-[11px] font-bold text-foreground">Call Thesis / Alpha</Label>
              <textarea
                v-model="callContent"
                rows="3"
                maxlength="500"
                placeholder="Why are you calling this token? (e.g. dev is active, community building, send it to $100K MC!)..."
                class="w-full text-xs font-sans p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
              />
              <div class="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{{ callContent.length }}/500</span>
                <span v-if="account" class="truncate"
                  >Caller: {{ shortenAddress(account, 6, 4) }}</span
                >
              </div>
            </div>

            <!-- Optional Image URL -->
            <div class="space-y-1.5">
              <Label class="text-[11px] font-bold text-foreground"
                >Image / Chart URL (Optional)</Label
              >
              <Input
                v-model="callImageUrl"
                type="text"
                placeholder="https://... or ipfs://... (chart screenshot / meme)"
                class="h-8 text-xs font-mono"
              />
            </div>

            <!-- Also share to X toggle -->
            <div class="flex items-center gap-2 pt-1">
              <input
                id="share-call-x"
                v-model="callShareToX"
                type="checkbox"
                class="rounded border-border text-primary cursor-pointer"
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
              class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2"
            >
              {{ callError }}
            </div>
          </div>

          <DialogFooter class="flex sm:justify-between items-center gap-2 pt-2">
            <Button variant="outline" size="sm" @click="callModalOpen = false">Cancel</Button>
            <Button
              :disabled="isPostingCall || !callContent.trim() || userTokenBalance <= 0n"
              size="sm"
              class="gap-1.5 font-bold cursor-pointer shadow-xs"
              @click="handlePostCallout"
            >
              <Loader2 v-if="isPostingCall" class="w-3.5 h-3.5 animate-spin" />
              <Megaphone v-else class="w-3.5 h-3.5" />
              <span>Post Call</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Share Sheet & Thread Modals -->
      <ShareModal
        :is-open="isShareModalOpen"
        :call="activeShareCall"
        @close="isShareModalOpen = false"
      />

      <ThreadModal
        :is-open="isThreadModalOpen"
        :target-call="activeThreadCall"
        :account="account"
        :tokens="[{ token: currentToken }]"
        @close="isThreadModalOpen = false"
        @toggle-like="toggleLike"
        @share="openShareModal"
        @reply-posted="onReplyPosted"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { parseAbi, parseEther, erc20Abi } from 'viem';
import { useI18n } from '@/lib/i18n';
import {
  ArrowUpDown,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Settings,
  ExternalLink,
  Sparkles,
  Send,
  Heart,
  RefreshCw,
  Globe,
  ArrowRight,
  Megaphone,
  Share2,
  MessageCircle,
  BarChart2,
  Star,
} from 'lucide-vue-next';
import { useSwap, SLIPPAGE_WARN_THRESHOLD, parseAmountToWei } from '../composables/useSwap';
import { useWallet } from '../composables/useWallet';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useTaxConfig } from '../composables/useTaxConfig';
import { getPublicClient } from '../lib/viem-client';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Jazzicon } from '@/components/ui/avatar';
import PendingTaxBanner from './tax/PendingTaxBanner.vue';
import TaxTimelockPanel from './tax/TaxTimelockPanel.vue';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import { Empty } from '@/components/ui/empty';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { TradingChart } from '@/components/ui/chart';
import { CashtagText, ShareModal, ThreadModal } from '@/components/feed';
import {
  shortenAddress,
  formatTokenNumber,
  formatRelativeTime,
  formatCompactUsd,
  formatPriceUsd,
} from '@/lib/utils';
import {
  ROBINHOOD_CHAIN,
  ARC_CHAIN,
  ARC_PROTO_CURVE_ADDRESS,
  resolveTokenNetwork,
  launchpadTokenAbi,
  launchpadV2FactoryAbi,
  bondingCurveAbi,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TokenCommentEntity,
  type FeedCalloutItem,
} from '@proto/shared-types';

const props = defineProps<{
  tokenAddress?: string;
}>();

const { t } = useI18n();

// Suppress unused import warning - SLIPPAGE_WARN_THRESHOLD is used directly in the template
// to keep the threshold in sync with useSwap without duplicating the magic number.

interface LiveTrade {
  id: string;
  tokenAddress: string;
  poolAddress: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  wethAmount: string;
  priceUsd: number;
  blockNumber: string;
  transactionHash: string;
  timestamp: number;
}

interface TokenHolder {
  address: string;
  balance: string;
  percent: number;
}

const { executeSwap, isSwapping, swapError, slippage } = useSwap();
const {
  isConnected,
  account,
  balanceWei,
  activeNetwork,
  switchOrAddNetwork,
  openWallet,
  updateBalance,
} = useWallet();

const { setTokenTax } = useLaunchpad();

const {
  pending: pendingTax,
  hasPending: hasPendingTax,
  isReady: taxIsReady,
  secondsUntilReady: taxSecondsUntilReady,
  actionLoading: taxActionLoading,
  error: taxError,
  loadPendingTax,
  acceptTaxConfig,
  cancelTaxConfig,
} = useTaxConfig();

async function handleAcceptTax() {
  const hash = await acceptTaxConfig(currentToken.value.address);
  if (hash) {
    toast.success('Tax configuration applied onchain');
    await loadOnchainTax(currentToken.value.address);
  } else if (taxError.value) {
    toast.error('Failed to apply tax config: ' + taxError.value);
  }
}

async function handleCancelTax() {
  const hash = await cancelTaxConfig(currentToken.value.address);
  if (hash) {
    toast.success('Tax proposal cancelled');
  } else if (taxError.value) {
    toast.error('Failed to cancel tax proposal: ' + taxError.value);
  }
}

const isCreator = computed(() => {
  if (!account.value || !currentToken.value.deployer) return false;
  return account.value.toLowerCase() === currentToken.value.deployer.toLowerCase();
});

// Callout State (pump.fun style)
const callModalOpen = ref(false);
const callTargetMcap = ref('$100K MC');
const callContent = ref('');
const callImageUrl = ref('');
const callShareToX = ref(true);
const isPostingCall = ref(false);
const callError = ref<string | null>(null);

const userHoldingTokensCount = computed(() => {
  const decimals = currentToken.value.decimals || 18;
  return Number(userTokenBalance.value) / 10 ** decimals;
});

const userHoldingUsd = computed(() => {
  return userHoldingTokensCount.value * (currentMarketData.value.priceUsd || 0);
});

function openCallModal(): void {
  callModalOpen.value = true;
  callError.value = null;
  if (!callContent.value) {
    callContent.value = `Calling $${currentToken.value.symbol} - target ${callTargetMcap.value}!`;
  }
}

function goToBuyFromCall(): void {
  callModalOpen.value = false;
  tradeTab.value = 'buy';
}

async function handlePostCallout(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  if (userTokenBalance.value <= 0n) {
    callError.value = `You must hold a position in $${currentToken.value.symbol} to post a callout. Please buy tokens first.`;
    return;
  }
  const content = callContent.value.trim();
  if (!content) {
    callError.value = 'Please write your thesis or target before calling.';
    return;
  }

  isPostingCall.value = true;
  callError.value = null;
  try {
    const res = await fetch(`/api/tokens/${currentToken.value.address}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: account.value,
        content,
        imageUrl: callImageUrl.value.trim() || undefined,
        targetMcap: callTargetMcap.value,
        positionUsd: userHoldingUsd.value > 0 ? userHoldingUsd.value : undefined,
        callType: 'call',
      }),
    });
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      toast.success(`Called $${currentToken.value.symbol}! 📢`);

      if (callShareToX.value && typeof window !== 'undefined') {
        const tweetText = encodeURIComponent(
          `I just called $${currentToken.value.symbol} at ${formatCompactUsd(currentMarketData.value.marketCapUsd || 4200)} MC (Target: ${callTargetMcap.value}) on @proto_protocol! 🚀\n\n"${content.slice(0, 100)}"\n\n${window.location.href}`,
        );
        window.open(
          `https://twitter.com/intent/tweet?text=${tweetText}`,
          '_blank',
          'noopener,noreferrer',
        );
      }

      callContent.value = '';
      callImageUrl.value = '';
      callModalOpen.value = false;
      activeBottomTab.value = 'callouts';
      await fetchCallouts(currentToken.value.address);
    } else {
      callError.value = envelope.error?.message || 'Failed to publish callout.';
    }
  } catch (err) {
    callError.value = (err as Error).message || 'Network error.';
  } finally {
    isPostingCall.value = false;
  }
}

// Social Modals state
const isShareModalOpen = ref(false);
const activeShareCall = ref<FeedCalloutItem | null>(null);
const isThreadModalOpen = ref(false);
const activeThreadCall = ref<FeedCalloutItem | null>(null);

function formatViews(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val || 0);
}

function openShareModal(cmt: TokenCommentEntity) {
  activeShareCall.value = {
    ...cmt,
    tokenName: currentToken.value.name,
    tokenSymbol: currentToken.value.symbol,
    tokenLogo: currentToken.value.logo,
    tokenMarketCapUsd: currentMarketData.value?.marketCapUsd,
    tokenPriceUsd: currentMarketData.value?.priceUsd,
  };
  isShareModalOpen.value = true;
}

function openThreadModal(cmt: TokenCommentEntity) {
  activeThreadCall.value = {
    ...cmt,
    tokenName: currentToken.value.name,
    tokenSymbol: currentToken.value.symbol,
    tokenLogo: currentToken.value.logo,
    tokenMarketCapUsd: currentMarketData.value?.marketCapUsd,
    tokenPriceUsd: currentMarketData.value?.priceUsd,
  };
  isThreadModalOpen.value = true;
}

function onReplyPosted(reply: FeedCalloutItem) {
  if (activeThreadCall.value) {
    activeThreadCall.value.repliesCount = (activeThreadCall.value.repliesCount || 0) + 1;
  }
  const rootItem = callouts.value.find((c) => c.id === reply.parentId);
  if (rootItem) {
    rootItem.repliesCount = (rootItem.repliesCount || 0) + 1;
  }
}

function shareCalloutToX(cmt: TokenCommentEntity) {
  if (typeof window !== 'undefined') {
    const target = cmt.targetMcap ? `(Target: ${cmt.targetMcap}) ` : '';
    const text = encodeURIComponent(
      `Check out this call on $${currentToken.value.symbol} ${target}on @proto_protocol! 📢\n\n"${cmt.content.slice(0, 120)}"\n\n${window.location.href}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}

// Watchlist Pin Feature (Pons style with localStorage persistence)
const pinnedTokens = ref<Set<string>>(new Set());

function loadPinnedTokens() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('proto_pinned_tokens');
    if (raw) {
      pinnedTokens.value = new Set(JSON.parse(raw));
    }
  } catch {}
}

function togglePin(address: string) {
  if (!address) return;
  const lower = address.toLowerCase();
  const next = new Set(pinnedTokens.value);
  if (next.has(lower)) {
    next.delete(lower);
  } else {
    next.add(lower);
  }
  pinnedTokens.value = next;
  try {
    localStorage.setItem('proto_pinned_tokens', JSON.stringify(Array.from(next)));
  } catch {}
}

function isPinned(address: string): boolean {
  return pinnedTokens.value.has(address.toLowerCase());
}

function resolveSafeUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('ipfs://')) {
    const hash = trimmed.replace('ipfs://', '');
    return `/api/ipfs/${hash}`;
  }
  return trimmed;
}

function isHolderAddress(addr: string): boolean {
  if (!addr || holders.value.length === 0) return false;
  return holders.value.some((h) => h.address.toLowerCase() === addr.toLowerCase());
}

const onchainTaxConfig = ref({
  buyTaxBps: 0,
  sellTaxBps: 0,
  taxRecipient: '',
});

const taxModalOpen = ref(false);
const editBuyTax = ref('1');
const editSellTax = ref('1');
const editTaxRecipient = ref('');
const updatingTax = ref(false);

async function loadOnchainTax(tokenAddr: `0x${string}`) {
  try {
    const client = getPublicClient(tokenNetwork.value.chainId);
    const cfg = (await client.readContract({
      address: tokenAddr,
      abi: launchpadTokenAbi,
      functionName: 'taxConfig',
    })) as [number, number, string];
    if (cfg) {
      onchainTaxConfig.value = {
        buyTaxBps: Number(cfg[0]),
        sellTaxBps: Number(cfg[1]),
        taxRecipient: cfg[2],
      };
      editBuyTax.value = String(Number(cfg[0]) / 100);
      editSellTax.value = String(Number(cfg[1]) / 100);
      editTaxRecipient.value = cfg[2];
    }
  } catch {
    // Non-blocking
  }
}

async function handleUpdateTax() {
  if (!account.value) return;
  updatingTax.value = true;
  try {
    const buyVal = parseFloat(editBuyTax.value || '0');
    const sellVal = parseFloat(editSellTax.value || '0');
    const recipient = (editTaxRecipient.value.trim() as `0x${string}`) || account.value;
    const hash = await setTokenTax(currentToken.value.address, buyVal, sellVal, recipient);
    if (hash) {
      toast.success('Tax change proposed — activates in 24 hours', {
        description: `Buy Tax: ${buyVal}%, Sell Tax: ${sellVal}%`,
      });
      await loadOnchainTax(currentToken.value.address);
      await loadPendingTax(currentToken.value.address, tokenNetwork.value.chainId);
      taxModalOpen.value = false;
    }
  } catch (err) {
    toast.error('Failed to update tax: ' + (err as Error).message);
  } finally {
    updatingTax.value = false;
  }
}

const currentToken = ref<LaunchedTokenEntity>({
  address: (props.tokenAddress as `0x${string}`) || '0x0000000000000000000000000000000000000000',
  name: '',
  symbol: '',
  decimals: 18,
  totalSupply: '0',
  logo: '',
  description: '',
  socials: {},
  deployer: '0x0000000000000000000000000000000000000000',
  pairedToken: '0x0000000000000000000000000000000000000000',
  poolAddress: '0x0000000000000000000000000000000000000000',
  isToken0: true,
  poolFee: 10000,
  positionId: 0n,
  restrictionsEndBlock: 0n,
  launchBlock: 0n,
  createdAt: 0,
});

const currentMarketData = ref<TokenMarketData>({
  address: currentToken.value.address,
  priceInWeth: 0,
  priceUsd: 0,
  marketCapUsd: 0,
  fdvUsd: 0,
  pairedPrincipalWeth: '0.0000',
  graduationThresholdWeth: '4.2',
  graduationProgress: 0,
  isGraduated: false,
  volume24hUsd: 0,
});

const tokenNetwork = computed(() =>
  resolveTokenNetwork(currentToken.value, activeNetwork.value.chainId),
);

const isArcToken = computed(() => tokenNetwork.value.chainId === ARC_CHAIN.chainId);

const currencySymbol = computed(() => tokenNetwork.value.nativeCurrency.symbol);
const explorerUrl = computed(() => tokenNetwork.value.blockExplorer);
const buyPresets = computed(() => {
  return currencySymbol.value === 'USDC'
    ? ['10', '50', '100', '500']
    : ['0.01', '0.05', '0.1', '0.5'];
});

// Holders & trader data
const holders = ref<TokenHolder[]>([]);
const holdersLoading = ref(false);
const topTraders = ref<
  Array<{
    address: string;
    buyVolumeUsd: number;
    sellVolumeUsd: number;
    totalTrades: number;
    profitUsd: number;
    isDev: boolean;
    walletTag: string;
    firstBuyTimestamp?: number;
    firstBuyPriceUsd?: number;
    avgCostUsd?: number;
    holdingAmountTokens?: string;
    positionStatus?: 'holding' | 'partial' | 'clean_all';
  }>
>([]);
const topTradersLoading = ref(false);

const devInfo = ref({
  creatorAddress: '',
  initialBuyEth: '0.00',
  currentHoldPercent: 0,
  creatorStatus: 'none',
  totalDevSoldEth: '0.00',
  hasRenounced: false,
});

const devHoldingPercent = computed(() => {
  if (!currentToken.value.deployer || holders.value.length === 0) return 0;
  const dev = holders.value.find(
    (h) => h.address.toLowerCase() === currentToken.value.deployer.toLowerCase(),
  );
  return dev ? dev.percent : 0;
});

const top10HoldingPercent = computed(() => {
  if (holders.value.length === 0) return 0;
  return holders.value.slice(0, 10).reduce((acc, h) => acc + h.percent, 0);
});

const burnedInfo = computed(() => {
  if (holders.value.length === 0) return { amount: 0, percent: 0 };
  const dead = holders.value.find(
    (h) =>
      h.address.toLowerCase() === '0x000000000000000000000000000000000000dead' ||
      h.address.toLowerCase() === '0x0000000000000000000000000000000000000000',
  );
  if (!dead) return { amount: 0, percent: 0 };
  return { amount: dead.balance, percent: dead.percent };
});

const quoteAssetPriceUsd = computed(() => {
  if (isArcToken.value) return 1;
  if (currentMarketData.value.priceInWeth > 0) {
    return currentMarketData.value.priceUsd / currentMarketData.value.priceInWeth;
  }
  return 2700;
});

const remainingToGraduate = computed(() => {
  const current = Number(currentMarketData.value.pairedPrincipalWeth || 0);
  const target = Number(
    currentMarketData.value.graduationThresholdWeth ||
      (currencySymbol.value === 'USDC' ? 69000 : 4.2),
  );
  const diff = Math.max(0, target - current);
  return currencySymbol.value === 'USDC' ? diff.toFixed(0) : diff.toFixed(3);
});

// Trade state
const tradeTab = ref<'buy' | 'sell'>('buy');
const isBuy = computed(() => tradeTab.value === 'buy');
const payInUsd = ref(false);
const chartDisplayMode = ref<'price' | 'mcap'>('price');
const chartCurrencyMode = ref<'usd' | 'native'>('usd');

const activeChartHeaderPrice = computed(() => {
  if (chartDisplayMode.value === 'mcap') {
    return formatCompactUsd(currentMarketData.value.marketCapUsd || 4200);
  }
  if (chartCurrencyMode.value === 'native') {
    const val = currentMarketData.value.priceInWeth || 0;
    if (val < 0.00000001) return `${val.toFixed(11)} ${currencySymbol.value}`;
    if (val < 0.0001) return `${val.toFixed(8)} ${currencySymbol.value}`;
    return `${val.toFixed(6)} ${currencySymbol.value}`;
  }
  return formatPriceUsd(currentMarketData.value.priceUsd);
});

const amountIn = ref('10');
const tokenNotFound = ref(false);
const swapSuccessTx = ref<string | null>(null);
const copied = ref(false);
const copiedId = ref<string | null>(null);
const tokenLoading = ref(true);
const activeBottomTab = ref<'callouts' | 'trades' | 'top-traders' | 'holders' | 'about'>(
  'callouts',
);

const effectiveNativeInput = computed(() => {
  const input = parseFloat(amountIn.value) || 0;
  if (input <= 0) return 0;
  if (isBuy.value && payInUsd.value) {
    return input / (quoteAssetPriceUsd.value || 1);
  }
  return input;
});

const activeBuyPresets = computed(() => {
  if (payInUsd.value) {
    return ['10', '50', '100', '500'];
  }
  return buyPresets.value;
});

// Trades
const trades = ref<LiveTrade[]>([]);
const tradesLoading = ref(false);
const tradeFilter = ref<'all' | 'buy' | 'sell'>('all');

const filteredTrades = computed(() => {
  if (tradeFilter.value === 'all') return trades.value;
  return trades.value.filter((t) => (tradeFilter.value === 'buy' ? t.isBuy : !t.isBuy));
});

const orderFlowStats = computed(() => {
  let buyCount = 0;
  let sellCount = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  for (const t of trades.value) {
    const isB = t.isBuy;
    const val = Number(t.wethAmount || 0);
    if (isB) {
      buyCount++;
      buyVolume += val;
    } else {
      sellCount++;
      sellVolume += val;
    }
  }

  const netVolumeEth = buyVolume - sellVolume;
  const netVolumeUsd = netVolumeEth * (quoteAssetPriceUsd.value || 1);

  return {
    buyCount,
    sellCount,
    netVolumeUsd,
  };
});

const userTokenBalance = ref<bigint>(0n);
const isTokenBalanceLoading = ref(false);
const isMaxSell = ref(false);

// Slippage
const isCustomSlippage = ref(false);
const customSlippageInput = ref('');

// Callouts State
const callouts = ref<TokenCommentEntity[]>([]);
const calloutsLoading = ref(false);

// Pagination state for bottom tabs (Trades, Top Traders, Holders, Callouts)
const tradesPage = ref(1);
const tradesPageSize = 10;
const paginatedTrades = computed(() => {
  const start = (tradesPage.value - 1) * tradesPageSize;
  return filteredTrades.value.slice(start, start + tradesPageSize);
});

const topTradersPage = ref(1);
const topTradersPageSize = 10;
const paginatedTopTraders = computed(() => {
  const start = (topTradersPage.value - 1) * topTradersPageSize;
  return topTraders.value.slice(start, start + topTradersPageSize);
});

const holdersPage = ref(1);
const holdersPageSize = 10;
const paginatedHolders = computed(() => {
  const start = (holdersPage.value - 1) * holdersPageSize;
  return holders.value.slice(start, start + holdersPageSize);
});

const calloutsPage = ref(1);
const calloutsPageSize = 10;
const paginatedCallouts = computed(() => {
  const start = (calloutsPage.value - 1) * calloutsPageSize;
  return callouts.value.slice(start, start + calloutsPageSize);
});

// Reset current page when lists update and exceed max pages
watch(filteredTrades, (list) => {
  const max = Math.max(1, Math.ceil(list.length / tradesPageSize));
  if (tradesPage.value > max) tradesPage.value = 1;
});
watch(topTraders, (list) => {
  const max = Math.max(1, Math.ceil(list.length / topTradersPageSize));
  if (topTradersPage.value > max) topTradersPage.value = 1;
});
watch(holders, (list) => {
  const max = Math.max(1, Math.ceil(list.length / holdersPageSize));
  if (holdersPage.value > max) holdersPage.value = 1;
});
watch(callouts, (list) => {
  const max = Math.max(1, Math.ceil(list.length / calloutsPageSize));
  if (calloutsPage.value > max) calloutsPage.value = 1;
});

// Resolution & candle data
const resolutions = [
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '4h', seconds: 14400 },
  { label: '1d', seconds: 86400 },
];
const selectedResolution = ref(3600);
const candlestickData = ref<
  Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
>([]);
let liveCandleTimer: ReturnType<typeof setInterval> | null = null;

// -----------------------------------------------------------------------
// Bonding curve AMM preview math
// Mirrors BondingCurve.sol constants exactly:
//   CURVE_TOKEN_SUPPLY = 800_000_000 (tokens allocated to curve, not wei)
//   POOL_RESERVE_SUPPLY = 200_000_000 (reserved for V4 LP)
//   fee = 1% (100 bps)
// -----------------------------------------------------------------------
const CURVE_TOKEN_SUPPLY = 800_000_000; // tokens (not wei)

function getVirtualReserves() {
  const vEthRaw = currentToken.value.virtualEthReserve;
  const vTokenRaw = currentToken.value.virtualTokenReserve;
  if (vEthRaw && vTokenRaw) {
    const vEth = Number(BigInt(vEthRaw)) / 1e18;
    const vToken = Number(BigInt(vTokenRaw)) / 10 ** (currentToken.value.decimals || 18);
    if (vEth > 0 && vToken > 0) {
      return { vEth, vToken };
    }
  }
  // Fallback: reconstruct from pairedPrincipalWeth + contract initial virtual reserves.
  // BondingCurve constructor: virtualEthReserve = 3 ETH (Robinhood) / 4200 USDC (Arc),
  // virtualTokenReserve = CURVE_TOKEN_SUPPLY = 800_000_000.
  const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
  const isArc = currencySymbol.value === 'USDC';
  const baseVirtualEth = isArc ? 4200.0 : 3.0;
  return {
    vEth: baseVirtualEth + currentRaised,
    vToken: CURVE_TOKEN_SUPPLY,
  };
}

function computeCurveBuyOutput(ethIn: number): number {
  if (ethIn <= 0) return 0;
  const { vEth, vToken } = getVirtualReserves();
  // 1% fee deducted before AMM calculation (matches contract: fee = ethIn * 100 / 10000)
  const netEth = ethIn * 0.99;
  const k = vEth * vToken;
  const newEthReserve = vEth + netEth;
  const newTokenReserve = k / newEthReserve;
  const rawOut = Math.max(0, vToken - newTokenReserve);
  // Cap to curve-available supply: contract checks balanceOf(curve) - POOL_RESERVE_SUPPLY
  // We approximate: remaining curve supply = vToken (decreases as tokens are bought)
  // Conservative cap: don't show more than what the virtual reserve can deliver
  return Math.min(rawOut, vToken);
}

function computeCurveSellOutput(tokensIn: number): number {
  if (tokensIn <= 0) return 0;
  const { vEth, vToken } = getVirtualReserves();
  const k = vEth * vToken;
  const newTokenReserve = vToken + tokensIn;
  const newEthReserve = k / newTokenReserve;
  // 1% fee taken from gross ETH out (matches contract: feeEth = grossEth * 100 / 10000)
  const grossEth = Math.max(0, vEth - newEthReserve);
  return grossEth * 0.99;
}

const estimatedOutput = computed(() => {
  const input = effectiveNativeInput.value;
  if (input <= 0) return `0 ${isBuy.value ? currentToken.value.symbol : currencySymbol.value}`;

  const isV2OnCurve = currentToken.value.version === 'v2' && !currentMarketData.value.isGraduated;

  if (isBuy.value) {
    const tokens = isV2OnCurve
      ? computeCurveBuyOutput(input)
      : input / (currentMarketData.value.priceInWeth || 0.000001);
    return `${tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currentToken.value.symbol}`;
  } else {
    const weth = isV2OnCurve
      ? computeCurveSellOutput(input)
      : input * (currentMarketData.value.priceInWeth || 0);
    const decimals = currencySymbol.value === 'USDC' ? 2 : 6;
    return `${weth.toFixed(decimals)} ${currencySymbol.value}`;
  }
});

const swapButtonText = computed(() => {
  if (isSwapping.value) return 'Executing...';
  if (!isConnected.value) return t('connectWallet');
  if (activeNetwork.value.chainId !== tokenNetwork.value.chainId) {
    return `Switch to ${tokenNetwork.value.name}`;
  }
  const input = effectiveNativeInput.value;
  if (!amountIn.value || input <= 0) return 'Enter an amount';

  if (!isBuy.value) {
    if (userTokenBalance.value <= 0n) {
      return `Insufficient ${currentToken.value.symbol} balance`;
    }
    if (!isMaxSell.value) {
      const decimals = currentToken.value.decimals || 18;
      const inputWei = parseAmountToWei(amountIn.value, decimals);
      if (inputWei > userTokenBalance.value) {
        return `Insufficient ${currentToken.value.symbol} balance`;
      }
    }
    return `Sell ${currentToken.value.symbol}`;
  } else {
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance > 0 && input > ethBalance) {
      return `Insufficient ${currencySymbol.value} balance`;
    }
    return `Buy ${currentToken.value.symbol}`;
  }
});

const isSwapDisabled = computed(() => {
  if (isSwapping.value) return true;
  if (!isConnected.value) return false;
  if (activeNetwork.value.chainId !== tokenNetwork.value.chainId) return false;
  const input = parseFloat(amountIn.value) || 0;
  if (!amountIn.value || input <= 0) return true;
  if (!isBuy.value) {
    if (userTokenBalance.value <= 0n) return true;
    if (!isMaxSell.value) {
      const decimals = currentToken.value.decimals || 18;
      const inputWei = parseAmountToWei(amountIn.value, decimals);
      return inputWei > userTokenBalance.value;
    }
    return false;
  }
  const ethBalance = Number(balanceWei.value) / 1e18;
  if (ethBalance > 0 && input > ethBalance) return true;
  return false;
});

// -----------------------------------------------------------------------
// UI Helpers
// -----------------------------------------------------------------------
function applyQuickBuy(val: string) {
  amountIn.value = val;
}

function applyPercentage(percent: number) {
  if (isBuy.value) {
    isMaxSell.value = false;
    const isArc = currencySymbol.value === 'USDC';
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance <= 0) {
      amountIn.value = '0';
      return;
    }
    const reserveGas = isArc ? 0.05 : 0.005;
    const maxEth =
      percent === 100 ? Math.max(0, ethBalance - reserveGas) : ethBalance * (percent / 100);
    const nativeVal = maxEth > 0 ? maxEth : ethBalance;
    if (payInUsd.value) {
      amountIn.value = (nativeVal * (quoteAssetPriceUsd.value || 1)).toFixed(2);
    } else {
      amountIn.value = nativeVal.toFixed(isArc ? 2 : 4);
    }
  } else {
    const decimals = currentToken.value.decimals || 18;
    if (userTokenBalance.value <= 0n) {
      amountIn.value = '0';
      isMaxSell.value = false;
      return;
    }
    if (percent === 100) {
      isMaxSell.value = true;
      const whole = userTokenBalance.value / 10n ** BigInt(decimals);
      const frac = userTokenBalance.value % 10n ** BigInt(decimals);
      const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
      amountIn.value = fracStr ? `${whole}.${fracStr}` : whole.toString();
    } else {
      isMaxSell.value = false;
      const tokenBal = Number(userTokenBalance.value) / 10 ** decimals;
      const calculated = tokenBal * (percent / 100);
      amountIn.value = calculated < 1 ? calculated.toFixed(6) : calculated.toFixed(2);
    }
  }
}

function selectSlippagePreset(val: number) {
  slippage.value = val;
  isCustomSlippage.value = false;
  customSlippageInput.value = '';
}

function handleCustomSlippageInput() {
  const val = parseFloat(customSlippageInput.value);
  if (!isNaN(val) && val > 0 && val <= 49) {
    slippage.value = val;
  } else if (!isNaN(val) && val > 49) {
    slippage.value = 49;
    customSlippageInput.value = '49';
  }
}

function formatEthBalance(wei: bigint): string {
  const isArc = currencySymbol.value === 'USDC';
  const val = Number(wei) / 1e18;
  if (val === 0) return isArc ? '0.00' : '0.0000';
  if (isArc) return val < 0.01 ? val.toFixed(4) : val.toFixed(2);
  return val < 0.0001 ? val.toFixed(6) : val.toFixed(4);
}

function formatTokenBalance(wei: bigint): string {
  const decimals = currentToken.value.decimals || 18;
  const val = Number(wei) / 10 ** decimals;
  if (val === 0) return '0.00';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.0001) return val.toFixed(4);
  return val.toFixed(6);
}
function truncateAddress(addr: string): string {
  return shortenAddress(addr);
}

function getHolderBadge(addr: string): string | null {
  const lower = addr.toLowerCase();
  if (lower === ROBINHOOD_CHAIN.contracts.locker.toLowerCase()) return 'LP Locker';
  if (lower === currentToken.value.deployer?.toLowerCase()) return 'Creator';
  if (lower === currentToken.value.poolAddress?.toLowerCase()) return 'Pool';
  return null;
}

function copyText(text: string, id: string) {
  navigator.clipboard.writeText(text);
  copiedId.value = id;
  setTimeout(() => {
    if (copiedId.value === id) copiedId.value = null;
  }, 2000);
}

function copyAddress(addr?: string | Event) {
  if (typeof navigator !== 'undefined') {
    const textToCopy = typeof addr === 'string' && addr ? addr : currentToken.value.address;
    navigator.clipboard.writeText(textToCopy);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}

const linkCopied = ref(false);
function copyTokenLink() {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    navigator.clipboard.writeText(window.location.href);
    linkCopied.value = true;
    toast.success('Link copied to clipboard');
    setTimeout(() => {
      linkCopied.value = false;
    }, 2000);
  }
}

function shareToX() {
  if (typeof window !== 'undefined') {
    const text = encodeURIComponent(
      `Trading $${currentToken.value.symbol} on @proto_protocol on ${tokenNetwork.value.name}! 🚀\n${window.location.href}`,
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
  }
}

function formatNumberCap(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

// -----------------------------------------------------------------------
// Data Fetching
// -----------------------------------------------------------------------
let balanceFetchPromise: Promise<void> | null = null;
let lastBalanceFetchTime = 0;

async function fetchUserTokenBalance(force = false) {
  const currentAcc = account.value;
  const tokenAddr = currentToken.value.address;
  if (!currentAcc || !tokenAddr || tokenAddr === '0x0000000000000000000000000000000000000000') {
    userTokenBalance.value = 0n;
    return;
  }
  const now = Date.now();
  if (balanceFetchPromise) return balanceFetchPromise;
  if (!force && now - lastBalanceFetchTime < 2500) return;
  lastBalanceFetchTime = now;

  // Never flicker if balance is already loaded
  if (userTokenBalance.value === 0n) {
    isTokenBalanceLoading.value = true;
  }

  balanceFetchPromise = (async () => {
    try {
      const [onChainResult, backendResult] = await Promise.allSettled([
        getPublicClient(tokenNetwork.value.chainId).readContract({
          address: tokenAddr as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [currentAcc as `0x${string}`],
        }) as Promise<bigint>,
        fetch(`/api/tokens/${tokenAddr}/balance?account=${currentAcc}`)
          .then((r) => r.json())
          .catch(() => null),
      ]);

      let resolvedBal: bigint | null = null;
      if (onChainResult.status === 'fulfilled' && onChainResult.value > 0n) {
        resolvedBal = onChainResult.value;
      } else if (
        backendResult.status === 'fulfilled' &&
        backendResult.value?.success &&
        backendResult.value?.data?.balanceWei
      ) {
        resolvedBal = BigInt(backendResult.value.data.balanceWei);
      } else if (onChainResult.status === 'fulfilled') {
        resolvedBal = onChainResult.value;
      }

      if (resolvedBal !== null) {
        userTokenBalance.value = resolvedBal;
      }
    } catch {
      // Non-blocking
    } finally {
      isTokenBalanceLoading.value = false;
      balanceFetchPromise = null;
    }
  })();

  return balanceFetchPromise;
}

async function fetchTrades(address: string) {
  tradesLoading.value = true;
  try {
    const res = await fetch(`/api/tokens/${address}/trades?limit=50`);
    const envelope = await res.json();
    trades.value = envelope.success && Array.isArray(envelope.data) ? envelope.data : [];
  } catch {
    trades.value = [];
  } finally {
    tradesLoading.value = false;
  }
}

async function fetchHolders(address: string) {
  holdersLoading.value = true;
  try {
    const res = await fetch(`/api/tokens/${address}/holders?limit=50`);
    const envelope = await res.json();
    holders.value = envelope.success && Array.isArray(envelope.data) ? envelope.data : [];
  } catch {
    holders.value = [];
  } finally {
    holdersLoading.value = false;
  }
}

async function fetchTopTraders(address: string) {
  topTradersLoading.value = true;
  try {
    const res = await fetch(`/api/tokens/${address}/top-traders?limit=20`);
    const envelope = await res.json();
    topTraders.value = envelope.success && Array.isArray(envelope.data) ? envelope.data : [];
  } catch {
    topTraders.value = [];
  } finally {
    topTradersLoading.value = false;
  }
}

async function fetchDevActivity(address: string) {
  try {
    const res = await fetch(`/api/tokens/${address}/dev-activity`);
    const envelope = await res.json();
    if (envelope.success && envelope.data) devInfo.value = envelope.data;
  } catch {
    // non-blocking
  }
}

// -----------------------------------------------------------------------
// Community Callouts Fetcher & Reaction
// -----------------------------------------------------------------------
async function fetchCallouts(address: string) {
  calloutsLoading.value = true;
  try {
    const viewerParam = account.value ? `?viewer=${account.value}` : '';
    const res = await fetch(`/api/tokens/${address}/comments${viewerParam}`);
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      callouts.value = envelope.data;
    }
  } catch {
    callouts.value = [];
  } finally {
    calloutsLoading.value = false;
  }
}

async function toggleLike(commentId: string) {
  if (!account.value) {
    openWallet();
    return;
  }
  try {
    const res = await fetch(
      `/api/tokens/${currentToken.value.address}/comments/${commentId}/like`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: account.value }),
      },
    );
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      const call = callouts.value.find((c) => c.id === commentId);
      if (call) {
        call.isLikedByViewer = envelope.data.liked;
        call.likesCount = envelope.data.likesCount;
      }
    }
  } catch {
    // Non-blocking
  }
}

// -----------------------------------------------------------------------
// Multi-Timeframe Candlestick Engine (1m, 5m, 15m, 1h, 4h, 1d)
// Continuous timeline from token release to now
// -----------------------------------------------------------------------
async function fetchCandlesticks(address: string, resolutionSeconds = 60) {
  try {
    const res = await fetch(
      `/api/tokens/${address}/ohlcv?resolution=${resolutionSeconds}&fillGaps=true`,
    );
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data) && envelope.data.length > 0) {
      const parsed = envelope.data.map(
        (c: {
          timestamp: number;
          open: number;
          high: number;
          low: number;
          close: number;
          volume?: number;
        }) => ({
          time: Math.floor(c.timestamp / 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume ?? 0,
        }),
      );

      if (currentMarketData.value.priceUsd > 0) {
        const last = parsed[parsed.length - 1];
        const nowSec = Math.floor(Date.now() / 1000);
        const currentBucket = Math.floor(nowSec / resolutionSeconds) * resolutionSeconds;

        if (last.time === currentBucket) {
          last.close = currentMarketData.value.priceUsd;
          last.high = Math.max(last.high, currentMarketData.value.priceUsd);
          last.low = Math.min(last.low, currentMarketData.value.priceUsd);
        } else if (currentBucket > last.time) {
          parsed.push({
            time: currentBucket,
            open: last.close,
            high: Math.max(last.close, currentMarketData.value.priceUsd),
            low: Math.min(last.close, currentMarketData.value.priceUsd),
            close: currentMarketData.value.priceUsd,
            volume: 0,
          });
        }
      }
      candlestickData.value = [...parsed];
      return;
    }

    // Strictly real data fallback (0 dummy / synthetic data):
    // If the indexer has no trade records yet, render the real creation baseline price
    if (currentMarketData.value.priceUsd > 0) {
      const tokenCreatedSec = currentToken.value.createdAt
        ? Math.floor(currentToken.value.createdAt / 1000)
        : Math.floor(Date.now() / 1000) - 3600;
      const nowSec = Math.floor(Date.now() / 1000);
      const start = Math.floor(tokenCreatedSec / resolutionSeconds) * resolutionSeconds;
      const end = Math.floor(nowSec / resolutionSeconds) * resolutionSeconds;
      const price = currentMarketData.value.priceUsd;

      const realBaseline = [
        {
          time: start,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
        },
      ];
      if (end > start) {
        realBaseline.push({
          time: end,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
        });
      }
      candlestickData.value = realBaseline;
      return;
    }
    candlestickData.value = [];
  } catch {
    candlestickData.value = [];
  }
}

async function changeResolution(seconds: number) {
  selectedResolution.value = seconds;
  await fetchCandlesticks(currentToken.value.address, seconds);
}

async function handleSwap() {
  swapSuccessTx.value = null;
  let expectedAmountOut: bigint | undefined;
  const input = effectiveNativeInput.value;
  const isV2OnCurve = currentToken.value.version === 'v2' && !currentMarketData.value.isGraduated;

  if (input > 0 && currentMarketData.value.priceInWeth > 0) {
    if (isBuy.value) {
      const estimatedTokens = isV2OnCurve
        ? computeCurveBuyOutput(input)
        : input / (currentMarketData.value.priceInWeth || 0.000001);
      expectedAmountOut = parseEther(Math.max(0, estimatedTokens).toFixed(6));
    } else {
      const estimatedEth = isV2OnCurve
        ? computeCurveSellOutput(input)
        : input * (currentMarketData.value.priceInWeth || 0);
      expectedAmountOut = parseEther(Math.max(0, estimatedEth).toFixed(6));
    }
  }

  let loadingToastId: string | number | undefined;

  const hash = await executeSwap({
    tokenAddress: currentToken.value.address,
    isBuy: isBuy.value,
    amountInEth:
      !isBuy.value && isMaxSell.value
        ? userTokenBalance.value
        : isBuy.value
          ? effectiveNativeInput.value.toString()
          : amountIn.value,
    slippagePercent: slippage.value,
    expectedAmountOut,
    version: currentToken.value.version,
    curveAddress: currentToken.value.curveAddress,
    isGraduated: currentMarketData.value.isGraduated,
    chainId: tokenNetwork.value.chainId,
    tokenDecimals: currentToken.value.decimals || 18,
    onApproveSubmitted: (approveHash) => {
      toast.info('Approval Submitted', {
        description: 'Approving tokens for trading...',
        action: {
          label: 'View on Explorer',
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.open(
                `${explorerUrl.value}/tx/${approveHash}`,
                '_blank',
                'noopener,noreferrer',
              );
            }
          },
        },
        duration: 5000,
      });
    },
    onSubmitted: (txHash) => {
      loadingToastId = toast.loading(
        isBuy.value ? 'Processing Buy Order...' : 'Processing Sell Order...',
        {
          description: 'Transaction broadcasted. Waiting for block confirmation...',
          action: {
            label: 'View on Explorer',
            onClick: () => {
              if (typeof window !== 'undefined') {
                window.open(`${explorerUrl.value}/tx/${txHash}`, '_blank', 'noopener,noreferrer');
              }
            },
          },
        },
      );

      // Trigger immediate background sync
      fetch(`/api/tokens/${currentToken.value.address}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      }).catch(() => {});
    },
  });

  if (hash) {
    swapSuccessTx.value = hash;
    isMaxSell.value = false;

    const txExplorerLink = `${explorerUrl.value}/tx/${hash}`;
    toast.success('Swap Confirmed', {
      id: loadingToastId,
      description: isBuy.value
        ? `Successfully bought ${currentToken.value.symbol || 'tokens'}!`
        : `Successfully sold ${currentToken.value.symbol || 'tokens'}!`,
      action: {
        label: 'View on Explorer',
        onClick: () => {
          if (typeof window !== 'undefined') {
            window.open(txExplorerLink, '_blank', 'noopener,noreferrer');
          }
        },
      },
      duration: 8000,
    });

    try {
      await fetch(`/api/tokens/${currentToken.value.address}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash }),
      });
    } catch {
      // non-blocking
    }
    await loadTokenData(currentToken.value.address);
    await Promise.allSettled([
      updateBalance(),
      fetchUserTokenBalance(true),
      fetchTrades(currentToken.value.address),
      fetchCandlesticks(currentToken.value.address, selectedResolution.value),
      fetchHolders(currentToken.value.address),
      fetchTopTraders(currentToken.value.address),
    ]);

    // Fast realtime sync poll for 6s in background
    for (let i = 1; i <= 3; i++) {
      setTimeout(async () => {
        await Promise.allSettled([
          updateBalance(),
          fetchUserTokenBalance(true),
          fetchTrades(currentToken.value.address),
          fetchCandlesticks(currentToken.value.address, selectedResolution.value),
        ]);
      }, i * 2000);
    }
  } else if (swapError.value) {
    toast.error('Swap Failed', {
      id: loadingToastId,
      description: swapError.value,
      duration: 6000,
    });
  }
}

async function loadTokenData(address: `0x${string}`) {
  tokenLoading.value = true;
  tokenNotFound.value = false;
  let loaded = false;

  try {
    const res = await fetch(`/api/tokens/${address}`);
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      currentToken.value = envelope.data.token;
      currentMarketData.value = envelope.data.marketData;
      loaded = true;
    }
  } catch {
    // non-blocking fallback
  }

  // Direct On-Chain Hydration Fallback:
  // If backend is catching up or returns 404, hydrate token & bonding curve directly from chain
  if (!loaded) {
    try {
      const chainsToTry = [ARC_CHAIN, ROBINHOOD_CHAIN];

      for (const network of chainsToTry) {
        if (loaded) break;
        const client = getPublicClient(network.chainId);
        const factories = [
          network.contracts.factoryV2,
          network.contracts.factory,
          network.chainId === 5042
            ? ('0xf94d16c9E90fCd55b75D318d0104269146612abF' as `0x${string}`)
            : undefined,
          network.chainId === 4663
            ? ('0xbA42499Cfe59abc05120A100EEc4f859F476034F' as `0x${string}`)
            : undefined,
          network.chainId === 4663
            ? ('0xcC547D4EC0eF85FE506D2b2EEe02Be3620178B16' as `0x${string}`)
            : undefined,
        ].filter((f): f is `0x${string}` =>
          Boolean(f && f !== '0x0000000000000000000000000000000000000000'),
        );

        for (const factory of factories) {
          try {
            const launch = (await client.readContract({
              address: factory,
              abi: launchpadV2FactoryAbi,
              functionName: 'launches',
              args: [address],
            })) as [`0x${string}`, `0x${string}`, `0x${string}`, bigint, boolean];

            const curveAddress = launch[1];
            if (curveAddress && curveAddress !== '0x0000000000000000000000000000000000000000') {
              const [name, symbol, decimals, totalSupply, vEth, vToken, raised, target, grad] =
                await Promise.all([
                  client.readContract({ address, abi: erc20Abi, functionName: 'name' }),
                  client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
                  client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
                  client.readContract({ address, abi: erc20Abi, functionName: 'totalSupply' }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'virtualEthReserve',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'virtualTokenReserve',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'totalEthRaised',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'graduationTarget',
                  }),
                  client.readContract({
                    address: curveAddress,
                    abi: bondingCurveAbi,
                    functionName: 'graduated',
                  }),
                ]);

              const vEthNum = Number(vEth) / 1e18;
              const vTokenNum = Number(vToken) / 10 ** (decimals || 18);
              const spotPrice = vTokenNum > 0 ? vEthNum / vTokenNum : 0;
              const isArc = network.chainId === 5042;
              const quoteUsd = isArc ? 1.0 : 2500;
              const priceUsd = spotPrice * quoteUsd;

              currentToken.value = {
                address,
                name: name as string,
                symbol: symbol as string,
                decimals: decimals || 18,
                totalSupply: totalSupply.toString(),
                logo: '',
                description: '',
                socials: {},
                deployer: launch[2],
                pairedToken: network.contracts.weth,
                poolAddress: curveAddress,
                isToken0: false,
                poolFee: 10000,
                positionId: 0n,
                restrictionsEndBlock: 0n,
                launchBlock: 0n,
                createdAt: Number(launch[3]) * 1000,
                version: 'v2',
                curveAddress,
                virtualEthReserve: vEth.toString(),
                virtualTokenReserve: vToken.toString(),
                graduationTarget: target.toString(),
                initialBuyAmount: raised.toString(),
                isGraduated: grad as boolean,
              };

              const raisedEth = Number(raised) / 1e18;
              const targetEth = Number(target) / 1e18;
              currentMarketData.value = {
                address,
                priceInWeth: spotPrice,
                priceUsd,
                marketCapUsd: priceUsd * 1_000_000_000,
                fdvUsd: priceUsd * 1_000_000_000,
                pairedPrincipalWeth: raisedEth.toFixed(4),
                graduationThresholdWeth: targetEth.toFixed(2),
                graduationProgress: targetEth > 0 ? (raisedEth / targetEth) * 100 : 0,
                isGraduated: grad as boolean,
                volume24hUsd: 0,
              };
              loaded = true;
              break;
            }
          } catch {
            // continue checking next factory
          }
        }
      }
    } catch {
      // fallback
    }

    if (!loaded) {
      tokenNotFound.value = true;
    }
  }

  await Promise.allSettled([
    fetchCandlesticks(address, selectedResolution.value),
    fetchTrades(address),
    fetchTopTraders(address),
    fetchDevActivity(address),
    fetchHolders(address),
    fetchCallouts(address),
    loadOnchainTax(address),
    loadPendingTax(address, tokenNetwork.value.chainId),
  ]);
  tokenLoading.value = false;
}

// Reset amount and success state when switching between buy and sell tabs
// to avoid unit confusion (ETH vs token amount).
watch(tradeTab, (newTab) => {
  amountIn.value = '';
  payInUsd.value = false;
  isMaxSell.value = false;
  swapSuccessTx.value = null;
  if (newTab === 'sell') {
    fetchUserTokenBalance(true);
  }
});

watch(
  () => props.tokenAddress,
  async (newAddress) => {
    if (newAddress && newAddress !== currentToken.value.address) {
      currentToken.value.address = newAddress as `0x${string}`;
      await loadTokenData(newAddress as `0x${string}`);
      await fetchUserTokenBalance(true);
    }
  },
);

watch(
  () => account.value,
  (newAcc, oldAcc) => {
    if (newAcc && newAcc !== oldAcc) {
      Promise.allSettled([fetchUserTokenBalance(true), fetchCallouts(currentToken.value.address)]);
    } else if (!newAcc) {
      userTokenBalance.value = 0n;
    }
  },
);

watch(
  () => [currentMarketData.value.priceUsd, currentMarketData.value.priceInWeth],
  ([newPriceUsd]) => {
    if (Number(newPriceUsd) > 0 && candlestickData.value.length > 0) {
      const copy = [...candlestickData.value];
      const last = { ...copy[copy.length - 1] };
      last.close = Number(newPriceUsd);
      last.high = Math.max(last.high, Number(newPriceUsd));
      last.low = Math.min(last.low, Number(newPriceUsd));
      copy[copy.length - 1] = last;
      candlestickData.value = copy;
    }
  },
);

onMounted(async () => {
  loadPinnedTokens();
  const addr = (props.tokenAddress as `0x${string}`) || currentToken.value.address;
  if (addr && addr !== '0x0000000000000000000000000000000000000000') {
    currentToken.value.address = addr;
    await loadTokenData(addr);
    await fetchUserTokenBalance();
  }

  // Real-time chart & data poller: refreshes every 10 seconds to keep timeframe advancing to current second
  liveCandleTimer = setInterval(() => {
    if (currentToken.value.address && !tokenLoading.value) {
      fetchCandlesticks(currentToken.value.address, selectedResolution.value);
    }
  }, 10000);
});

onUnmounted(() => {
  if (liveCandleTimer) {
    clearInterval(liveCandleTimer);
    liveCandleTimer = null;
  }
});
</script>
