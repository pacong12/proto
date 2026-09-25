<template>
  <!-- Full-width terminal layout, no outer max-width constraints -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Loading state -->
    <div
      v-if="tokenLoading"
      class="flex items-center justify-center py-32 text-zinc-500 dark:text-zinc-400 gap-3"
    >
      <Loader2 class="w-5 h-5 animate-spin text-emerald-500" />
      <span class="text-sm font-medium">Loading token data...</span>
    </div>

    <!-- Token not found state -->
    <div
      v-else-if="tokenNotFound"
      class="flex flex-col items-center justify-center py-32 gap-4 text-center px-4"
    >
      <AlertCircle class="w-10 h-10 text-zinc-400" />
      <div class="space-y-1">
        <p class="text-base font-semibold text-black dark:text-white">Token not found</p>
        <p class="text-xs text-zinc-500 font-mono">{{ props.tokenAddress }}</p>
        <p class="text-xs text-zinc-400">
          This token has not been indexed yet or does not exist on this network.
        </p>
      </div>
    </div>

    <template v-else>
      <!-- Top Token Info Header Card -->
      <div
        class="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4"
      >
        <!-- Logo + Name + Ticker -->
        <div class="flex items-center gap-3 min-w-0">
          <OptimizedImage
            :src="currentToken.logo"
            :alt="currentToken.name"
            :fallback-text="currentToken.symbol"
            :width="36"
            :height="36"
            :chain-badge="
              tokenNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'
            "
            :currency-badge="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
            class="rounded-lg border border-zinc-200 dark:border-zinc-800 shrink-0"
          />
          <div class="flex items-center gap-2 min-w-0">
            <h1 class="text-base font-bold tracking-tight text-black dark:text-white truncate">
              {{ currentToken.name }}
            </h1>
            <span class="font-mono text-xs text-zinc-500 shrink-0">${{ currentToken.symbol }}</span>
          </div>
        </div>

        <!-- Status badges -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            class="text-[10px] font-mono h-5 px-2 text-black dark:text-white border-zinc-300 dark:border-zinc-700"
          >
            {{ currentToken.version === 'v2' ? 'V2 Curve' : 'V1 Pool' }}
          </Badge>
          <Badge
            variant="outline"
            class="text-[10px] font-mono h-5 px-2 border-border text-foreground bg-muted/40"
          >
            {{ currentMarketData.isGraduated ? 'Graduated' : 'Bonding Curve' }}
          </Badge>
          <Badge :variant="devBadgeVariant" class="text-[10px] font-mono h-5 px-2">
            {{ devBadgeText }}
          </Badge>
        </div>

        <!-- Sentiment Voting (Bullish / Bearish) - Clean Monochrome -->
        <div
          class="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg border border-border text-xs font-mono"
        >
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer"
            :class="
              votesSummary.viewerVote === 'bullish'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            title="Vote Bullish"
            aria-label="Vote Bullish"
            @click="castVote('bullish')"
          >
            <Rocket class="w-3 h-3" />
            <span>{{ votesSummary.bullishCount }}</span>
          </button>

          <span class="text-muted-foreground text-[10px] font-bold"
            >{{ votesSummary.bullishPercent }}%</span
          >

          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer"
            :class="
              votesSummary.viewerVote === 'bearish'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            title="Vote Bearish"
            aria-label="Vote Bearish"
            @click="castVote('bearish')"
          >
            <Flame class="w-3 h-3" />
            <span>{{ votesSummary.bearishCount }}</span>
          </button>
        </div>

        <!-- Live market stats pill row -->
        <div
          class="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-4 w-full sm:w-auto sm:ml-auto font-mono text-xs pt-3 sm:pt-0 border-t sm:border-t-0 border-border"
        >
          <div
            class="flex flex-col sm:items-end p-2 sm:p-0 rounded-xl bg-muted/40 sm:bg-transparent"
          >
            <span
              class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-semibold"
              >Price</span
            >
            <span class="font-bold text-black dark:text-white">{{
              formatPriceUsd(currentMarketData.priceUsd)
            }}</span>
          </div>
          <div
            class="flex flex-col sm:items-end p-2 sm:p-0 rounded-xl bg-muted/40 sm:bg-transparent"
          >
            <span
              class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-semibold"
              >Mkt Cap</span
            >
            <span class="font-bold text-black dark:text-white">{{
              formatCompactUsd(currentMarketData.marketCapUsd)
            }}</span>
          </div>
          <div
            class="flex flex-col sm:items-end p-2 sm:p-0 rounded-xl bg-muted/40 sm:bg-transparent"
          >
            <span
              class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-semibold"
              >24h Vol</span
            >
            <span class="font-bold text-black dark:text-white">{{
              formatCompactUsd(currentMarketData.volume24hUsd)
            }}</span>
          </div>
          <div
            class="flex flex-col sm:items-end p-2 sm:p-0 rounded-xl bg-muted/40 sm:bg-transparent"
          >
            <span
              class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-semibold"
              >Raised</span
            >
            <span class="font-bold text-black dark:text-white truncate">
              {{ currentMarketData.pairedPrincipalWeth }} /
              {{ currentMarketData.graduationThresholdWeth }} {{ currencySymbol }}
            </span>
          </div>
        </div>
      </div>

      <!-- ============================================================
           ROW 2: Main Trading Layout - Chart, Swap, & Tabs
           ============================================================ -->
      <!-- Main Trading Grid: Responsive Order (Chart -> Swap -> Tabs on mobile; Chart+Tabs (left) & Swap (right) on desktop) -->
      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <!-- 1. Chart Card (Col 1, Row 1 on xl) -->
        <div class="xl:col-start-1 xl:row-start-1 min-w-0 w-full space-y-6">
          <div class="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <!-- Timeframe switcher bar -->
            <div
              class="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 flex-wrap"
            >
              <span
                class="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mr-3 font-semibold"
                >Interval</span
              >
              <div class="flex items-center gap-0.5">
                <button
                  v-for="res in resolutions"
                  :key="res.label"
                  type="button"
                  class="px-2.5 py-1 text-xs font-mono font-semibold rounded transition-all cursor-pointer"
                  :class="
                    selectedResolution === res.seconds
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  "
                  @click="changeResolution(res.seconds)"
                >
                  {{ res.label }}
                </button>
              </div>

              <!-- Security badges inline, right-aligned -->
              <div class="ml-auto flex items-center gap-1.5 flex-wrap">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-foreground border border-border"
                >
                  <ShieldCheck class="w-3 h-3" />
                  No Mint
                </span>
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-foreground border border-border"
                >
                  Dev {{ devHoldingPercent === 0 ? '0%' : `${devHoldingPercent.toFixed(1)}%` }}
                </span>
                <span
                  class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border"
                >
                  Top10: {{ top10HoldingPercent.toFixed(1) }}%
                </span>
                <span
                  class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border"
                >
                  Anti-Snipe
                </span>
              </div>
            </div>

            <!-- TradingChart wrapper -->
            <div class="p-4 sm:p-5 bg-card">
              <TradingChart
                :data="candlestickData"
                :token-symbol="currentToken.symbol"
                :token-address="currentToken.address"
                :height="420"
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
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>You pay</span>
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
                    {{ isBuy ? currencySymbol : currentToken.symbol }}
                  </span>
                </div>

                <!-- Quick buy presets (buy mode only) -->
                <div v-if="isBuy" class="grid grid-cols-4 gap-1.5 pt-0.5">
                  <button
                    v-for="ethVal in buyPresets"
                    :key="ethVal"
                    type="button"
                    class="h-7 text-xs font-mono font-medium rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground transition cursor-pointer"
                    @click="applyQuickBuy(ethVal)"
                  >
                    {{ ethVal }}
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

              <!-- Status messages -->
              <div
                v-if="swapSuccessTx"
                class="px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-xs space-y-1.5"
              >
                <div class="flex items-center gap-1.5 text-primary font-bold">
                  <Check class="w-3.5 h-3.5" />
                  Swap Confirmed
                </div>
                <a
                  :href="`${explorerUrl}/tx/${swapSuccessTx}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-[10px] text-muted-foreground hover:text-primary transition underline flex items-center gap-1"
                >
                  View on Explorer <ExternalLink class="w-3 h-3" />
                </a>
              </div>
              <div
                v-if="swapError"
                class="px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2"
              >
                <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{{ swapError }}</span>
              </div>
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
                      { value: 'thread', label: 'Thread' },
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
                      v-if="tab.value === 'thread' && comments.length > 0"
                      class="ml-1 px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px]"
                    >
                      {{ comments.length }}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <Button
                  v-if="activeBottomTab === 'trades'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 px-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer shrink-0"
                  @click="fetchTrades(currentToken.address)"
                >
                  <RefreshCw class="w-3.5 h-3.5 sm:mr-1" />
                  <span class="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  v-if="activeBottomTab === 'thread'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 px-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer shrink-0"
                  @click="fetchComments(currentToken.address)"
                >
                  <RefreshCw class="w-3.5 h-3.5 sm:mr-1" />
                  <span class="hidden sm:inline">Refresh</span>
                </Button>
              </div>

              <!-- Tab: Discussion Thread & Comments -->
              <TabsContent
                value="thread"
                class="mt-0 max-h-[420px] overflow-y-auto p-5 sm:p-6 space-y-5"
              >
                <!-- Post Comment Form -->
                <div class="p-4 sm:p-5 rounded-2xl border border-border bg-muted/30 space-y-3">
                  <div
                    class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono"
                  >
                    <span
                      class="flex items-center gap-1.5 font-semibold text-black dark:text-white"
                    >
                      <MessageSquare class="w-3.5 h-3.5 text-emerald-500" />
                      Share your take on ${{ currentToken.symbol }}
                    </span>
                    <span v-if="account" class="text-[10px]">
                      Posting as
                      <span class="font-bold text-black dark:text-white">{{
                        truncateAddress(account)
                      }}</span>
                    </span>
                  </div>

                  <div class="relative">
                    <textarea
                      v-model="newCommentText"
                      rows="2"
                      maxlength="500"
                      placeholder="What is your price target or reaction?..."
                      class="w-full text-xs font-sans p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono text-zinc-400"
                      >{{ newCommentText.length }}/500</span
                    >
                    <Button
                      size="sm"
                      class="h-7 px-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer rounded-lg flex items-center gap-1"
                      :disabled="isPostingComment || !newCommentText.trim()"
                      @click="postComment"
                    >
                      <Loader2 v-if="isPostingComment" class="w-3 h-3 animate-spin" />
                      <Send v-else class="w-3 h-3" />
                      <span>Post Comment</span>
                    </Button>
                  </div>
                  <div
                    v-if="commentError"
                    class="text-[10px] font-mono text-rose-500 flex items-center gap-1 mt-1"
                  >
                    <AlertCircle class="w-3 h-3 shrink-0" />
                    <span>{{ commentError }}</span>
                  </div>
                </div>

                <!-- Comments Feed -->
                <div
                  v-if="commentsLoading && comments.length === 0"
                  class="py-12 text-center text-zinc-500"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span class="text-xs">Loading comments...</span>
                </div>
                <div
                  v-else-if="comments.length === 0"
                  class="py-12 text-center text-zinc-500 space-y-1"
                >
                  <MessageSquare class="w-6 h-6 mx-auto mb-1.5 text-zinc-400 opacity-60" />
                  <p class="text-xs font-mono font-medium">No comments yet.</p>
                  <p class="text-[11px] text-zinc-400">
                    Be the first to share your thoughts on ${{ currentToken.symbol }}!
                  </p>
                </div>
                <div v-else class="space-y-2.5">
                  <div
                    v-for="cmt in paginatedComments"
                    :key="cmt.id"
                    class="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors space-y-1.5"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <Jazzicon :address="cmt.authorAddress" :size="16" />
                        <span class="text-xs font-mono font-semibold text-black dark:text-white">
                          {{ truncateAddress(cmt.authorAddress) }}
                        </span>
                        <Badge
                          v-if="
                            cmt.authorAddress.toLowerCase() === currentToken.deployer?.toLowerCase()
                          "
                          class="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        >
                          Creator
                        </Badge>
                      </div>
                      <span class="text-[10px] font-mono text-zinc-400">
                        {{ formatRelativeTime(cmt.createdAt) }}
                      </span>
                    </div>

                    <p
                      class="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 font-sans break-words whitespace-pre-wrap"
                    >
                      {{ cmt.content }}
                    </p>

                    <div
                      class="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/40"
                    >
                      <button
                        type="button"
                        aria-label="Like comment"
                        class="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-rose-500 transition cursor-pointer"
                        :class="cmt.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
                        @click="toggleLike(cmt.id)"
                      >
                        <Heart
                          class="w-3.5 h-3.5"
                          :class="cmt.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
                        />
                        <span>{{ cmt.likesCount }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Comments Pagination -->
                  <div v-if="comments.length > commentsPageSize" class="pt-2 flex justify-center">
                    <Pagination
                      :total="comments.length"
                      :items-per-page="commentsPageSize"
                      :page="commentsPage"
                      @update:page="commentsPage = $event"
                    />
                  </div>
                </div>
              </TabsContent>

              <!-- Tab: Live Trades -->
              <TabsContent value="trades" class="mt-0 max-h-[340px] overflow-y-auto">
                <div
                  v-if="tradesLoading && trades.length === 0"
                  class="py-16 text-center text-zinc-500"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span class="text-xs">Loading trades...</span>
                </div>
                <div v-else-if="trades.length === 0" class="py-16 text-center text-zinc-500">
                  <p class="text-xs font-mono">No trades recorded yet.</p>
                </div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-xs font-mono min-w-[540px]">
                    <thead class="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
                      <tr
                        class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400"
                      >
                        <th class="py-2 px-3 font-semibold">Type</th>
                        <th class="py-2 px-3 font-semibold">Price</th>
                        <th class="py-2 px-3 font-semibold">{{ currencySymbol }}</th>
                        <th class="py-2 px-3 font-semibold">{{ currentToken.symbol }}</th>
                        <th class="py-2 px-3 font-semibold">Trader</th>
                        <th class="py-2 px-3 font-semibold">Age</th>
                        <th class="py-2 px-3 font-semibold text-right">Tx</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      <tr
                        v-for="trade in paginatedTrades"
                        :key="trade.id || trade.transactionHash"
                        class="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
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
                        <td
                          class="py-2 px-3 whitespace-nowrap text-black dark:text-white font-medium"
                        >
                          ${{
                            trade.priceUsd < 0.0001
                              ? trade.priceUsd.toFixed(8)
                              : trade.priceUsd.toFixed(4)
                          }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-black dark:text-white">
                          {{ parseFloat(trade.wethAmount).toFixed(4) }}
                        </td>
                        <td
                          class="py-2 px-3 whitespace-nowrap text-black dark:text-white font-medium"
                        >
                          {{ formatTokenNumber(trade.tokenAmount) }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap">
                          <div class="flex items-center gap-1.5 text-black dark:text-white">
                            <Jazzicon :address="trade.trader" :size="14" />
                            <span>{{ truncateAddress(trade.trader) }}</span>
                            <button
                              type="button"
                              aria-label="Copy trader address"
                              class="text-zinc-400 hover:text-emerald-400 transition cursor-pointer"
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
                        <td class="py-2 px-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                          {{ formatRelativeTime(trade.timestamp) }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-right">
                          <a
                            :href="`${explorerUrl}/tx/${trade.transactionHash}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View transaction on explorer"
                            class="text-zinc-400 hover:text-emerald-400 transition-colors inline-flex items-center"
                          >
                            <ExternalLink class="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Trades Pagination -->
                  <div
                    v-if="trades.length > tradesPageSize"
                    class="py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-center bg-zinc-50/50 dark:bg-zinc-900/30"
                  >
                    <Pagination
                      :total="trades.length"
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
                  class="py-16 text-center text-zinc-500"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span class="text-xs">Loading traders...</span>
                </div>
                <div v-else-if="topTraders.length === 0" class="py-16 text-center text-zinc-500">
                  <p class="text-xs font-mono">No trading activity recorded yet.</p>
                </div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-xs font-mono min-w-[520px]">
                    <thead class="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
                      <tr
                        class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400"
                      >
                        <th class="py-2 px-3 font-semibold w-10">#</th>
                        <th class="py-2 px-3 font-semibold">Trader</th>
                        <th class="py-2 px-3 font-semibold">Tag</th>
                        <th class="py-2 px-3 font-semibold text-right">Buy / Sell</th>
                        <th class="py-2 px-3 font-semibold text-center">Position</th>
                        <th class="py-2 px-3 font-semibold text-right">Est. PnL</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      <tr
                        v-for="(trader, idx) in paginatedTopTraders"
                        :key="trader.address"
                        class="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <td class="py-2 px-3 text-zinc-500 font-bold">
                          #{{ (topTradersPage - 1) * topTradersPageSize + idx + 1 }}
                        </td>
                        <td class="py-2 px-3">
                          <div class="flex items-center gap-1.5">
                            <Jazzicon :address="trader.address" :size="14" />
                            <span class="text-black dark:text-white font-medium">{{
                              truncateAddress(trader.address)
                            }}</span>
                            <button
                              type="button"
                              aria-label="Copy trader address"
                              class="text-zinc-400 hover:text-emerald-400 transition cursor-pointer"
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
                            class="text-[9px] px-1.5 py-0 uppercase h-4"
                          >
                            {{ trader.isDev ? 'Dev' : trader.walletTag }}
                          </Badge>
                        </td>
                        <td class="py-2 px-3 text-right">
                          <span class="text-emerald-500 font-medium"
                            >${{ trader.buyVolumeUsd.toLocaleString() }}</span
                          >
                          <span class="text-zinc-400 mx-1">/</span>
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
                            class="text-[9px] px-1.5 py-0 uppercase h-4"
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
                    class="py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-center bg-zinc-50/50 dark:bg-zinc-900/30"
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
                  class="py-16 text-center text-zinc-500"
                >
                  <Loader2 class="w-4 h-4 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span class="text-xs">Loading holders...</span>
                </div>
                <div v-else-if="holders.length === 0" class="py-16 text-center text-zinc-500">
                  <p class="text-xs font-mono">No holder data available.</p>
                </div>
                <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-xs font-mono min-w-[500px]">
                    <thead class="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
                      <tr
                        class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400"
                      >
                        <th class="py-2 px-3 font-semibold w-10">#</th>
                        <th class="py-2 px-3 font-semibold">Holder</th>
                        <th class="py-2 px-3 font-semibold w-44">Share</th>
                        <th class="py-2 px-3 font-semibold text-right">Balance</th>
                        <th class="py-2 px-3 font-semibold text-right w-8"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      <tr
                        v-for="(holder, idx) in paginatedHolders"
                        :key="holder.address"
                        class="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <td class="py-2 px-3 text-zinc-500 font-bold">
                          #{{ (holdersPage - 1) * holdersPageSize + idx + 1 }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap">
                          <div class="flex items-center gap-1.5">
                            <Jazzicon :address="holder.address" :size="14" />
                            <span class="text-black dark:text-white font-medium">{{
                              truncateAddress(holder.address)
                            }}</span>
                            <button
                              type="button"
                              aria-label="Copy holder address"
                              class="text-zinc-400 hover:text-emerald-400 transition cursor-pointer"
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
                              class="text-[9px] px-1.5 py-0 h-4 border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                            >
                              {{ getHolderBadge(holder.address) }}
                            </Badge>
                          </div>
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap">
                          <div class="flex items-center gap-2">
                            <span
                              class="text-black dark:text-white font-semibold w-12 text-right shrink-0"
                            >
                              {{ holder.percent.toFixed(2) }}%
                            </span>
                            <Progress :model-value="holder.percent" class="h-1.5 w-28" />
                          </div>
                        </td>
                        <td
                          class="py-2 px-3 whitespace-nowrap text-right text-black dark:text-white"
                        >
                          {{ formatTokenNumber(holder.balance) }}
                        </td>
                        <td class="py-2 px-3 whitespace-nowrap text-right">
                          <a
                            :href="`${explorerUrl}/address/${holder.address}`"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-zinc-400 hover:text-emerald-400 transition-colors inline-flex items-center"
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
                    class="py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-center bg-zinc-50/50 dark:bg-zinc-900/30"
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
                <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {{
                    currentToken.description ||
                    `Fixed-supply launchpad token on ${activeNetwork.name}.`
                  }}
                </p>

                <!-- Contract addresses -->
                <div class="space-y-2">
                  <p
                    class="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400"
                  >
                    Contract Addresses
                  </p>
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-3">
                      <span class="text-xs text-zinc-500 dark:text-zinc-400 font-mono shrink-0"
                        >Token</span
                      >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-mono text-black dark:text-white truncate">{{
                          currentToken.address
                        }}</span>
                        <button
                          type="button"
                          aria-label="Copy token address"
                          class="text-zinc-400 hover:text-emerald-400 shrink-0 cursor-pointer"
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
                          class="text-zinc-400 hover:text-emerald-400 shrink-0"
                        >
                          <ExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div
                      v-if="currentToken.poolAddress"
                      class="flex items-center justify-between gap-3"
                    >
                      <span class="text-xs text-zinc-500 dark:text-zinc-400 font-mono shrink-0"
                        >Pool</span
                      >
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-xs font-mono text-black dark:text-white truncate">{{
                          currentToken.poolAddress
                        }}</span>
                        <a
                          :href="`${explorerUrl}/address/${currentToken.poolAddress}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View pool on explorer"
                          class="text-zinc-400 hover:text-emerald-400 shrink-0"
                        >
                          <ExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Market data grid -->
                <div
                  class="grid grid-cols-3 gap-4 pt-3 border-t border-zinc-200 dark:border-zinc-800"
                >
                  <div>
                    <p
                      class="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                    >
                      Price
                    </p>
                    <p class="text-sm font-bold font-mono mt-0.5 text-black dark:text-white">
                      {{ formatPriceUsd(currentMarketData.priceUsd) }}
                    </p>
                  </div>
                  <div>
                    <p
                      class="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                    >
                      Mkt Cap
                    </p>
                    <p class="text-sm font-bold font-mono mt-0.5 text-black dark:text-white">
                      {{ formatCompactUsd(currentMarketData.marketCapUsd) }}
                    </p>
                  </div>
                  <div>
                    <p
                      class="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                    >
                      24h Vol
                    </p>
                    <p class="text-sm font-bold font-mono mt-0.5 text-black dark:text-white">
                      {{ formatCompactUsd(currentMarketData.volume24hUsd) }}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
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
  ShieldCheck,
  Sparkles,
  Rocket,
  Flame,
  MessageSquare,
  Send,
  Heart,
  RefreshCw,
} from 'lucide-vue-next';
import { useSwap, SLIPPAGE_WARN_THRESHOLD } from '../composables/useSwap';
import { useWallet } from '../composables/useWallet';
import { getPublicClient } from '../lib/viem-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Jazzicon } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { TradingChart } from '@/components/ui/chart';
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
  launchpadTokenAbi,
  type LaunchedTokenEntity,
  type TokenMarketData,
  type TokenCommentEntity,
  type TokenVotesSummary,
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

const isArcToken = computed(() => {
  const paired = currentToken.value.pairedToken?.toLowerCase();
  const pool = currentToken.value.poolAddress?.toLowerCase();
  const curve = currentToken.value.curveAddress?.toLowerCase();
  const arcFactory = ARC_CHAIN.contracts.factory.toLowerCase();
  const arcWeth = ARC_CHAIN.contracts.weth.toLowerCase();

  return (
    paired === arcWeth ||
    pool === arcFactory ||
    curve === ARC_PROTO_CURVE_ADDRESS.toLowerCase() ||
    (currentToken.value.version === 'v2' && activeNetwork.value.chainId === ARC_CHAIN.chainId)
  );
});

const tokenNetwork = computed(() => {
  if (isArcToken.value) return ARC_CHAIN;
  return ROBINHOOD_CHAIN;
});

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

const devBadgeVariant = computed(() => {
  return devInfo.value.creatorStatus === 'holding' ? 'default' : 'secondary';
});

const devBadgeText = computed(() => {
  if (devInfo.value.creatorStatus === 'holding') {
    return `Dev ${devInfo.value.currentHoldPercent.toFixed(1)}%`;
  }
  if (devInfo.value.creatorStatus === 'sold') return 'Dev Sold';
  return 'Dev 0%';
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
const amountIn = ref('10');
const tokenNotFound = ref(false);
const swapSuccessTx = ref<string | null>(null);
const copied = ref(false);
const copiedId = ref<string | null>(null);
const tokenLoading = ref(true);
const activeBottomTab = ref<'thread' | 'trades' | 'top-traders' | 'holders' | 'about'>('thread');

// Trades
const trades = ref<LiveTrade[]>([]);
const tradesLoading = ref(false);
const userTokenBalance = ref<bigint>(0n);
const isTokenBalanceLoading = ref(false);

// Slippage
const isCustomSlippage = ref(false);
const customSlippageInput = ref('');

// Comments & Discussion State
const comments = ref<TokenCommentEntity[]>([]);
const commentsLoading = ref(false);
const newCommentText = ref('');
const isPostingComment = ref(false);
const commentError = ref<string | null>(null);

// Sentiment Votes State
const votesSummary = ref<TokenVotesSummary>({
  tokenAddress: '',
  bullishCount: 0,
  bearishCount: 0,
  totalVotes: 0,
  bullishPercent: 50,
});

// Pagination state for bottom tabs (Trades, Top Traders, Holders, Comments)
const tradesPage = ref(1);
const tradesPageSize = 10;
const paginatedTrades = computed(() => {
  const start = (tradesPage.value - 1) * tradesPageSize;
  return trades.value.slice(start, start + tradesPageSize);
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

const commentsPage = ref(1);
const commentsPageSize = 10;
const paginatedComments = computed(() => {
  const start = (commentsPage.value - 1) * commentsPageSize;
  return comments.value.slice(start, start + commentsPageSize);
});

// Reset current page when lists update and exceed max pages
watch(trades, (list) => {
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
watch(comments, (list) => {
  const max = Math.max(1, Math.ceil(list.length / commentsPageSize));
  if (commentsPage.value > max) commentsPage.value = 1;
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
const selectedResolution = ref(60);
const candlestickData = ref<
  Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
>([]);
let liveCandleTimer: ReturnType<typeof setInterval> | null = null;

// -----------------------------------------------------------------------
// Bonding curve AMM preview math
// -----------------------------------------------------------------------
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
  const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
  const isArc = currencySymbol.value === 'USDC';
  const baseVirtualEth = isArc ? 3.0 : 3.0;
  return {
    vEth: baseVirtualEth + currentRaised,
    vToken: 1_000_000_000,
  };
}

function computeCurveBuyOutput(ethIn: number): number {
  if (ethIn <= 0) return 0;
  const { vEth, vToken } = getVirtualReserves();
  const netEth = ethIn * 0.99;
  const k = vEth * vToken;
  const newEthReserve = vEth + netEth;
  const newTokenReserve = k / newEthReserve;
  return Math.max(0, vToken - newTokenReserve);
}

function computeCurveSellOutput(tokensIn: number): number {
  if (tokensIn <= 0) return 0;
  const { vEth, vToken } = getVirtualReserves();
  const k = vEth * vToken;
  const newTokenReserve = vToken + tokensIn;
  const newEthReserve = k / newTokenReserve;
  const grossEth = Math.max(0, vEth - newEthReserve);
  return grossEth * 0.99;
}

const estimatedOutput = computed(() => {
  const input = parseFloat(amountIn.value) || 0;
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
  const input = parseFloat(amountIn.value) || 0;
  if (!amountIn.value || input <= 0) return 'Enter an amount';

  if (!isBuy.value) {
    const tokenBal = Number(userTokenBalance.value) / 10 ** (currentToken.value.decimals || 18);
    if (tokenBal <= 0 || input > tokenBal) {
      return `Insufficient ${currentToken.value.symbol} balance`;
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
    const tokenBal = Number(userTokenBalance.value) / 10 ** (currentToken.value.decimals || 18);
    return tokenBal <= 0 || input > tokenBal;
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
    const isArc = currencySymbol.value === 'USDC';
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance <= 0) {
      amountIn.value = '0';
      return;
    }
    if (percent === 100) {
      const reserveGas = isArc ? 0.05 : 0.005;
      const maxEth = Math.max(0, ethBalance - reserveGas);
      amountIn.value = (maxEth > 0 ? maxEth : ethBalance).toFixed(isArc ? 2 : 4);
    } else {
      amountIn.value = (ethBalance * (percent / 100)).toFixed(isArc ? 2 : 4);
    }
  } else {
    const decimals = currentToken.value.decimals || 18;
    const tokenBal = Number(userTokenBalance.value) / 10 ** decimals;
    if (tokenBal <= 0) {
      amountIn.value = '0';
      return;
    }
    if (percent === 100) {
      const whole = userTokenBalance.value / 10n ** BigInt(decimals);
      const frac = userTokenBalance.value % 10n ** BigInt(decimals);
      const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
      amountIn.value = fracStr ? `${whole}.${fracStr}` : whole.toString();
    } else {
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

function copyAddress() {
  navigator.clipboard.writeText(currentToken.value.address);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
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
// Discussion Comments & Sentiment Votes Fetchers
// -----------------------------------------------------------------------
async function fetchComments(address: string) {
  commentsLoading.value = true;
  try {
    const viewerParam = account.value ? `?viewer=${account.value}` : '';
    const res = await fetch(`/api/tokens/${address}/comments${viewerParam}`);
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      comments.value = envelope.data;
    }
  } catch {
    comments.value = [];
  } finally {
    commentsLoading.value = false;
  }
}

async function postComment() {
  if (!account.value) {
    openWallet();
    return;
  }
  const content = newCommentText.value.trim();
  if (!content || isPostingComment.value) return;

  isPostingComment.value = true;
  commentError.value = null;
  try {
    const res = await fetch(`/api/tokens/${currentToken.value.address}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: account.value,
        content,
      }),
    });
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      newCommentText.value = '';
      commentError.value = null;
      await fetchComments(currentToken.value.address);
    } else {
      commentError.value = envelope.error?.message || 'Failed to post comment.';
    }
  } catch (e) {
    commentError.value = (e as Error).message || 'Network error.';
  } finally {
    isPostingComment.value = false;
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
      const comment = comments.value.find((c) => c.id === commentId);
      if (comment) {
        comment.isLikedByViewer = envelope.data.liked;
        comment.likesCount = envelope.data.likesCount;
      }
    }
  } catch {
    // Non-blocking
  }
}

async function fetchVotes(address: string) {
  try {
    const viewerParam = account.value ? `?viewer=${account.value}` : '';
    const res = await fetch(`/api/tokens/${address}/votes${viewerParam}`);
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      votesSummary.value = envelope.data;
    }
  } catch {
    // Non-blocking
  }
}

async function castVote(type: 'bullish' | 'bearish') {
  if (!account.value) {
    openWallet();
    return;
  }
  try {
    const res = await fetch(`/api/tokens/${currentToken.value.address}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: account.value,
        voteType: type,
      }),
    });
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      votesSummary.value = envelope.data;
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

      // If only 1 candle returned (e.g. token just launched), append current candle
      if (parsed.length === 1 && currentMarketData.value.priceUsd > 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec > parsed[0].time) {
          parsed.push({
            time: nowSec,
            open: parsed[0].close,
            high: Math.max(parsed[0].close, currentMarketData.value.priceUsd),
            low: Math.min(parsed[0].close, currentMarketData.value.priceUsd),
            close: currentMarketData.value.priceUsd,
            volume: 0,
          });
        }
      }
      candlestickData.value = parsed;
      return;
    }

    // Client-side gap-filling fallback if API has no trades yet:
    // Generate a sequence of candles from launch time up to now!
    if (currentMarketData.value.priceUsd > 0) {
      const tokenCreatedSec = currentToken.value.createdAt
        ? Math.floor(currentToken.value.createdAt / 1000)
        : Math.floor(Date.now() / 1000) - 3600;
      const nowSec = Math.floor(Date.now() / 1000);
      const step = resolutionSeconds;
      const price = currentMarketData.value.priceUsd;
      const synthetic: Array<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }> = [];
      const start = Math.floor(tokenCreatedSec / step) * step;
      const end = Math.floor(nowSec / step) * step;
      for (let t = start; t <= end; t += step) {
        synthetic.push({
          time: t,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
        });
      }
      if (synthetic.length === 1) {
        synthetic.push({
          time: end + step,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
        });
      }
      candlestickData.value = synthetic;
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
  const input = parseFloat(amountIn.value) || 0;
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

  const hash = await executeSwap({
    tokenAddress: currentToken.value.address,
    isBuy: isBuy.value,
    amountInEth: amountIn.value,
    slippagePercent: slippage.value,
    expectedAmountOut,
    version: currentToken.value.version,
    curveAddress: currentToken.value.curveAddress,
    isGraduated: currentMarketData.value.isGraduated,
    chainId: tokenNetwork.value.chainId,
  });

  if (hash) {
    swapSuccessTx.value = hash;
    try {
      await fetch(`/api/tokens/${currentToken.value.address}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash }),
      });
    } catch {
      // non-blocking
    }
    await Promise.allSettled([
      updateBalance(),
      fetchUserTokenBalance(),
      loadTokenData(currentToken.value.address),
      fetchTrades(currentToken.value.address),
      fetchCandlesticks(currentToken.value.address, selectedResolution.value),
      fetchHolders(currentToken.value.address),
      fetchTopTraders(currentToken.value.address),
    ]);
  }
}

async function loadTokenData(address: `0x${string}`) {
  tokenLoading.value = true;
  tokenNotFound.value = false;
  try {
    const res = await fetch(`/api/tokens/${address}`);
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      currentToken.value = envelope.data.token;
      currentMarketData.value = envelope.data.marketData;
    } else if (res.status === 404) {
      tokenNotFound.value = true;
    }
  } catch {
    // non-blocking fallback
  } finally {
    await Promise.allSettled([
      fetchCandlesticks(address, selectedResolution.value),
      fetchTrades(address),
      fetchTopTraders(address),
      fetchDevActivity(address),
      fetchHolders(address),
      fetchComments(address),
      fetchVotes(address),
    ]);
    tokenLoading.value = false;
  }
}

// Reset amount and success state when switching between buy and sell tabs
// to avoid unit confusion (ETH vs token amount).
watch(tradeTab, (newTab) => {
  amountIn.value = '';
  swapSuccessTx.value = null;
  if (newTab === 'sell' && userTokenBalance.value === 0n) {
    fetchUserTokenBalance();
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
      Promise.allSettled([
        fetchUserTokenBalance(true),
        fetchComments(currentToken.value.address),
        fetchVotes(currentToken.value.address),
      ]);
    } else if (!newAcc) {
      userTokenBalance.value = 0n;
    }
  },
);

onMounted(async () => {
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
