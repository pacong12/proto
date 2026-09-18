<template>
  <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div
      v-if="tokenLoading"
      class="lg:col-span-3 flex items-center justify-center py-20 text-black dark:text-white"
    >
      <Loader2 class="w-6 h-6 text-emerald-400 animate-spin" />
      <span class="ml-3 text-sm font-medium">Loading token data...</span>
    </div>

    <template v-else>
      <!-- Left Column: Candlestick Chart & Tabs (Trades, Holders, About) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Candlestick Chart Card with Resolution Switcher -->
        <Card class="p-4 sm:p-6 space-y-4">
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3"
          >
            <div class="flex items-center gap-3">
              <OptimizedImage
                :src="currentToken.logo"
                :alt="currentToken.name"
                :fallback-text="currentToken.symbol"
                :width="44"
                :height="44"
                :chain-badge="
                  tokenNetwork.chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'
                "
                :currency-badge="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                class="rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0"
              />
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h1 class="text-xl font-bold tracking-tight text-black dark:text-white">
                    {{ currentToken.name }}
                  </h1>
                  <span class="font-mono text-sm text-zinc-500"> ${{ currentToken.symbol }} </span>
                  <Badge
                    :variant="currentToken.version === 'v2' ? 'outline' : 'default'"
                    class="text-[10px] font-mono"
                  >
                    {{ currentToken.version === 'v2' ? 'V2 Curve' : 'V1 Direct Pool' }}
                  </Badge>
                  <Badge
                    variant="secondary"
                    class="text-[10px] font-mono border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10"
                  >
                    {{
                      currentToken.version === 'v2'
                        ? currentMarketData.isGraduated
                          ? 'Uniswap v4 Pool'
                          : 'Curve Active (Target: v4)'
                        : 'Uniswap V3'
                    }}
                  </Badge>
                  <Badge :variant="devBadgeVariant" class="text-[10px] font-mono">
                    {{ devBadgeText }}
                  </Badge>
                </div>
              </div>

              <!-- External Trading Terminal & Bot Shortcuts -->
              <div class="hidden sm:flex items-center gap-1.5 ml-2">
                <a
                  :href="`https://t.me/GMGN_sol01_bot?start=rh_${currentToken.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="h-6 px-2 text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-500/20 transition inline-flex items-center gap-1"
                  title="Snipe & Copy Trade on GMGN Telegram Bot"
                >
                  GMGN Bot
                </a>
                <a
                  :href="
                    isArcToken
                      ? `https://dexscreener.com/arc/${currentToken.poolAddress}`
                      : `https://dexscreener.com/robinhood/${currentToken.poolAddress}`
                  "
                  target="_blank"
                  rel="noopener noreferrer"
                  class="h-6 px-2 text-[10px] font-mono font-semibold bg-zinc-800/80 text-zinc-300 border border-zinc-700/80 rounded-md hover:text-white hover:bg-zinc-700 transition inline-flex items-center gap-1"
                  title="View on DexScreener"
                >
                  DexScreener
                </a>
                <a
                  :href="
                    isArcToken
                      ? `https://www.geckoterminal.com/arc/pools/${currentToken.poolAddress}`
                      : `https://www.geckoterminal.com/robinhood/pools/${currentToken.poolAddress}`
                  "
                  target="_blank"
                  rel="noopener noreferrer"
                  class="h-6 px-2 text-[10px] font-mono font-semibold bg-zinc-800/80 text-zinc-300 border border-zinc-700/80 rounded-md hover:text-white hover:bg-zinc-700 transition inline-flex items-center gap-1"
                  title="View on GeckoTerminal"
                >
                  GeckoTerminal
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="copyTradeLink"
                  class="h-6 px-2 text-[10px] font-mono font-semibold bg-zinc-800/80 text-zinc-300 border border-zinc-700/80 rounded-md hover:text-white hover:bg-zinc-700 transition inline-flex items-center gap-1 cursor-pointer"
                  title="Copy Trade URL"
                >
                  {{ copiedTradeLink ? 'Copied!' : 'Copy Trade' }}
                </Button>
              </div>
            </div>

            <!-- Resolution Switcher (1m, 5m, 15m, 1h, 1d) -->
            <div
              class="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800"
            >
              <Button
                v-for="res in resolutions"
                :key="res.label"
                size="sm"
                :variant="selectedResolution === res.seconds ? 'default' : 'ghost'"
                class="h-7 px-2.5 text-xs font-mono text-black dark:text-white"
                @click="changeResolution(res.seconds)"
              >
                {{ res.label }}
              </Button>
            </div>
          </div>

          <!-- GMGN-style Security & Anti-Rug Metrics Row -->
          <div
            class="flex flex-wrap items-center gap-1.5 py-1 text-[11px] font-mono border-b border-zinc-200/60 dark:border-zinc-800/60"
          >
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20"
            >
              <ShieldCheck class="w-3 h-3" />
              Fixed Supply (No Mint)
            </span>
            <span
              :class="
                devHoldingPercent === 0
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
              "
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border"
            >
              {{
                devHoldingPercent === 0
                  ? 'Dev 0% (Dumped / Clean)'
                  : `Dev Hold: ${devHoldingPercent.toFixed(1)}%`
              }}
            </span>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700"
            >
              Top 10: {{ top10HoldingPercent.toFixed(1) }}%
            </span>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700"
            >
              Anti-Snipe Active
            </span>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700"
            >
              LP 48h Timelock
            </span>
          </div>

          <!-- Trading Chart Component -->
          <TradingChart :data="candlestickData" :token-symbol="currentToken.symbol" :height="360" />
        </Card>

        <!-- Bottom Tabs: [Trades], [Holders], [About] -->
        <Card class="p-4 sm:p-6 space-y-4">
          <Tabs v-model="activeBottomTab" class="w-full">
            <div
              class="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3"
            >
              <TabsList
                class="grid grid-cols-4 w-full sm:w-[400px] bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <TabsTrigger
                  value="trades"
                  class="text-xs font-semibold text-black dark:text-white"
                >
                  {{ t('trades') }}
                </TabsTrigger>
                <TabsTrigger
                  value="top-traders"
                  class="text-xs font-semibold text-black dark:text-white"
                >
                  {{ t('topTraders') }}
                </TabsTrigger>
                <TabsTrigger
                  value="holders"
                  class="text-xs font-semibold text-black dark:text-white"
                >
                  {{ t('holders') }}
                </TabsTrigger>
                <TabsTrigger value="about" class="text-xs font-semibold text-black dark:text-white">
                  {{ t('about') }}
                </TabsTrigger>
              </TabsList>

              <div v-if="activeBottomTab === 'trades'" class="hidden sm:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs font-mono text-black dark:text-white flex items-center gap-1"
                  @click="fetchTrades(currentToken.address)"
                >
                  <span>Refresh</span>
                </Button>
              </div>
            </div>

            <!-- Tab 1: Live Trades History -->
            <TabsContent value="trades" class="mt-4 space-y-2">
              <div
                v-if="tradesLoading && trades.length === 0"
                class="py-12 text-center text-black dark:text-white"
              >
                <Loader2 class="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
                <span class="text-xs">Loading live trades...</span>
              </div>

              <div
                v-else-if="trades.length === 0"
                class="py-12 text-center text-black dark:text-white"
              >
                <p class="text-xs font-mono">No trades found for this token yet.</p>
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-xs font-mono">
                  <thead>
                    <tr
                      class="border-b border-zinc-200 dark:border-zinc-800 text-black dark:text-white"
                    >
                      <th class="py-2.5 px-3 font-semibold">Type</th>
                      <th class="py-2.5 px-3 font-semibold">Price (USD)</th>
                      <th class="py-2.5 px-3 font-semibold">{{ currencySymbol }}</th>
                      <th class="py-2.5 px-3 font-semibold">{{ currentToken.symbol }}</th>
                      <th class="py-2.5 px-3 font-semibold">Trader</th>
                      <th class="py-2.5 px-3 font-semibold">Time</th>
                      <th class="py-2.5 px-3 font-semibold text-right">Tx</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr
                      v-for="trade in trades"
                      :key="trade.id || trade.transactionHash"
                      class="hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <!-- Type Badge -->
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold"
                          :class="
                            trade.isBuy
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          "
                        >
                          {{ trade.isBuy ? 'BUY' : 'SELL' }}
                        </span>
                      </td>

                      <!-- Price USD -->
                      <td
                        class="py-2.5 px-3 whitespace-nowrap text-black dark:text-white font-medium"
                      >
                        ${{
                          trade.priceUsd < 0.0001
                            ? trade.priceUsd.toFixed(8)
                            : trade.priceUsd.toFixed(4)
                        }}
                      </td>

                      <!-- Asset Amount -->
                      <td class="py-2.5 px-3 whitespace-nowrap text-black dark:text-white">
                        {{ parseFloat(trade.wethAmount).toFixed(4) }} {{ currencySymbol }}
                      </td>

                      <!-- Token Amount -->
                      <td
                        class="py-2.5 px-3 whitespace-nowrap text-black dark:text-white font-medium"
                      >
                        {{ formatTokenNumber(trade.tokenAmount) }}
                      </td>

                      <!-- Trader Address with Jazzicon & Copy -->
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <div class="flex items-center gap-2 text-black dark:text-white">
                          <Jazzicon
                            :address="trade.trader"
                            :size="16"
                            class="border border-zinc-200 dark:border-zinc-700"
                          />
                          <span>{{ truncateAddress(trade.trader) }}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="h-5 w-5 p-0 hover:text-emerald-400 rounded cursor-pointer"
                            title="Copy address"
                            @click="copyText(trade.trader, trade.id + '-trader')"
                          >
                            <Check
                              v-if="copiedId === trade.id + '-trader'"
                              class="w-3 h-3 text-emerald-400"
                            />
                            <Copy v-else class="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                      <!-- Relative Time -->
                      <td class="py-2.5 px-3 whitespace-nowrap text-black dark:text-white">
                        {{ formatRelativeTime(trade.timestamp) }}
                      </td>

                      <!-- Explorer Icon -->
                      <td class="py-2.5 px-3 whitespace-nowrap text-right">
                        <a
                          :href="`${explorerUrl}/tx/${trade.transactionHash}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center text-black dark:text-white hover:text-emerald-400 transition-colors"
                          title="View on Explorer"
                        >
                          <ExternalLink class="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <!-- Tab: Top Traders & Positions (GMGN Style) -->
            <TabsContent value="top-traders" class="mt-4 space-y-2">
              <div
                v-if="topTradersLoading && topTraders.length === 0"
                class="py-12 text-center text-black dark:text-white"
              >
                <Loader2 class="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
                <span class="text-xs">Loading top traders...</span>
              </div>

              <div
                v-else-if="topTraders.length === 0"
                class="py-12 text-center text-black dark:text-white"
              >
                <p class="text-xs font-mono">No trading activity recorded yet.</p>
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-xs font-mono">
                  <thead>
                    <tr
                      class="border-b border-zinc-200 dark:border-zinc-800 text-black dark:text-white"
                    >
                      <th class="py-2.5 px-3 font-semibold w-12">Rank</th>
                      <th class="py-2.5 px-3 font-semibold">Trader</th>
                      <th class="py-2.5 px-3 font-semibold">Tag</th>
                      <th class="py-2.5 px-3 font-semibold">First Buy</th>
                      <th class="py-2.5 px-3 font-semibold text-right">Avg Cost</th>
                      <th class="py-2.5 px-3 font-semibold text-right">Buy / Sell</th>
                      <th class="py-2.5 px-3 font-semibold text-center">Position</th>
                      <th class="py-2.5 px-3 font-semibold text-right">Est. PnL</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr
                      v-for="(trader, idx) in topTraders"
                      :key="trader.address"
                      class="hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <td class="py-2.5 px-3 text-zinc-500 font-bold">#{{ idx + 1 }}</td>
                      <td class="py-2.5 px-3">
                        <div class="flex items-center gap-2">
                          <Jazzicon
                            :address="trader.address"
                            :size="16"
                            class="border border-zinc-700"
                          />
                          <span class="text-black dark:text-white font-medium">{{
                            truncateAddress(trader.address)
                          }}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            @click="copyText(trader.address, `trader-${trader.address}`)"
                            class="h-5 w-5 p-0 text-zinc-500 hover:text-emerald-400 rounded cursor-pointer"
                            title="Copy address"
                          >
                            <Copy class="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                      <td class="py-2.5 px-3">
                        <Badge
                          :variant="
                            trader.isDev
                              ? 'default'
                              : trader.walletTag === 'smart_degen'
                                ? 'outline'
                                : 'secondary'
                          "
                          class="text-[9px] px-1.5 py-0 uppercase"
                        >
                          {{ trader.isDev ? 'Dev' : trader.walletTag }}
                        </Badge>
                      </td>
                      <td class="py-2.5 px-3 text-zinc-400 text-[11px]">
                        {{ formatRelativeTime(trader.firstBuyTimestamp || Date.now()) }}
                      </td>
                      <td class="py-2.5 px-3 text-right text-zinc-300">
                        ${{ (trader.avgCostUsd || 0).toFixed(6) }}
                      </td>
                      <td class="py-2.5 px-3 text-right">
                        <span class="text-emerald-400 font-medium"
                          >${{ trader.buyVolumeUsd.toLocaleString() }}</span
                        >
                        <span class="text-zinc-500 mx-1">/</span>
                        <span class="text-rose-400 font-medium"
                          >${{ trader.sellVolumeUsd.toLocaleString() }}</span
                        >
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        <Badge
                          :variant="
                            trader.positionStatus === 'holding'
                              ? 'default'
                              : trader.positionStatus === 'clean_all'
                                ? 'destructive'
                                : 'outline'
                          "
                          class="text-[9px] px-1.5 py-0 uppercase"
                        >
                          {{
                            trader.positionStatus === 'holding'
                              ? 'Holding'
                              : trader.positionStatus === 'clean_all'
                                ? 'Clean All'
                                : 'Partial'
                          }}
                        </Badge>
                      </td>
                      <td
                        class="py-2.5 px-3 text-right font-bold"
                        :class="trader.profitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                      >
                        {{
                          trader.profitUsd >= 0
                            ? `+$${trader.profitUsd.toLocaleString()}`
                            : `-$${Math.abs(trader.profitUsd).toLocaleString()}`
                        }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <!-- Tab 2: Top Holders Distribution List -->
            <TabsContent value="holders" class="mt-4 space-y-2">
              <div
                v-if="holdersLoading && holders.length === 0"
                class="py-12 text-center text-black dark:text-white"
              >
                <Loader2 class="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
                <span class="text-xs">Loading token holders...</span>
              </div>

              <div
                v-else-if="holders.length === 0"
                class="py-12 text-center text-black dark:text-white"
              >
                <p class="text-xs font-mono">No holder data available.</p>
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-xs font-mono">
                  <thead>
                    <tr
                      class="border-b border-zinc-200 dark:border-zinc-800 text-black dark:text-white"
                    >
                      <th class="py-2.5 px-3 font-semibold w-14">Rank</th>
                      <th class="py-2.5 px-3 font-semibold">Holder</th>
                      <th class="py-2.5 px-3 font-semibold w-48">Percentage</th>
                      <th class="py-2.5 px-3 font-semibold text-right">Balance</th>
                      <th class="py-2.5 px-3 font-semibold text-right w-12"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
                    <tr
                      v-for="(holder, idx) in holders"
                      :key="holder.address"
                      class="hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <!-- Rank -->
                      <td
                        class="py-2.5 px-3 whitespace-nowrap text-black dark:text-white font-bold"
                      >
                        #{{ idx + 1 }}
                      </td>

                      <!-- Address + Tags -->
                      <!-- Address + Jazzicon + Tags -->
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <Jazzicon
                            :address="holder.address"
                            :size="18"
                            class="border border-zinc-200 dark:border-zinc-700"
                          />
                          <span class="text-black dark:text-white font-medium">
                            {{ truncateAddress(holder.address) }}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="h-5 w-5 p-0 text-black dark:text-white hover:text-emerald-400 rounded cursor-pointer"
                            title="Copy address"
                            @click="copyText(holder.address, 'holder-' + idx)"
                          >
                            <Check
                              v-if="copiedId === 'holder-' + idx"
                              class="w-3 h-3 text-emerald-400"
                            />
                            <Copy v-else class="w-3 h-3" />
                          </Button>

                          <!-- Special Tag Badges -->
                          <Badge
                            v-if="getHolderBadge(holder.address)"
                            variant="outline"
                            class="text-[10px] px-1.5 py-0 font-semibold border-zinc-300 dark:border-zinc-700 text-black dark:text-white"
                          >
                            {{ getHolderBadge(holder.address) }}
                          </Badge>
                        </div>
                      </td>

                      <!-- Percentage & Progress -->
                      <td class="py-2.5 px-3 whitespace-nowrap">
                        <div class="space-y-1">
                          <div
                            class="flex items-center justify-between text-[11px] text-black dark:text-white font-semibold"
                          >
                            <span>{{ holder.percent.toFixed(2) }}%</span>
                          </div>
                          <Progress :model-value="holder.percent" class="h-1.5 w-36" />
                        </div>
                      </td>

                      <!-- Balance -->
                      <td
                        class="py-2.5 px-3 whitespace-nowrap text-right text-black dark:text-white font-medium"
                      >
                        {{ formatTokenNumber(holder.balance) }} {{ currentToken.symbol }}
                      </td>

                      <!-- Explorer Link -->
                      <td class="py-2.5 px-3 whitespace-nowrap text-right">
                        <a
                          :href="`${explorerUrl}/address/${holder.address}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center text-black dark:text-white hover:text-emerald-400 transition-colors"
                          title="View on Explorer"
                        >
                          <ExternalLink class="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <!-- Tab 3: About Token Details -->
            <TabsContent value="about" class="mt-4 space-y-6">
              <!-- Token Header Details with P4 External Analytics Links -->
              <div
                class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div class="flex items-start gap-4">
                  <Avatar class="w-14 h-14 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <AvatarFallback
                      class="bg-zinc-100 dark:bg-zinc-900 text-emerald-400 font-bold text-xl rounded-xl"
                    >
                      {{ currentToken.symbol.slice(0, 3) }}
                    </AvatarFallback>
                  </Avatar>

                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2.5">
                      <h1 class="text-xl font-bold truncate text-black dark:text-white">
                        {{ currentToken.name }}
                      </h1>
                      <Badge variant="outline" class="text-xs font-mono text-black dark:text-white">
                        ${{ currentToken.symbol }}
                      </Badge>
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                      <p class="text-xs font-mono truncate text-black dark:text-white">
                        {{ currentToken.address }}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-5 w-5 text-black dark:text-white hover:text-emerald-400"
                        @click="copyAddress"
                        title="Copy address"
                      >
                        <Check v-if="copied" class="w-3 h-3 text-emerald-400" />
                        <Copy v-else class="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- P4: External Analytics & Explorer Links -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <a
                    :href="
                      isArcToken
                        ? `https://dexscreener.com/arc/${currentToken.poolAddress}`
                        : `https://dexscreener.com/robinhood/${currentToken.poolAddress}`
                    "
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 px-2 text-[11px] font-mono flex items-center gap-1 text-black dark:text-white border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <span>DexScreener</span>
                    </Button>
                  </a>

                  <a
                    :href="
                      isArcToken
                        ? `https://www.geckoterminal.com/arc/pools/${currentToken.poolAddress}`
                        : `https://www.geckoterminal.com/robinhood/pools/${currentToken.poolAddress}`
                    "
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 px-2 text-[11px] font-mono flex items-center gap-1 text-black dark:text-white border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <span>GeckoTerminal</span>
                    </Button>
                  </a>

                  <a
                    :href="`${explorerUrl}/address/${currentToken.address}`"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 px-2 text-[11px] font-mono flex items-center gap-1 text-black dark:text-white border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <ExternalLink class="w-3 h-3" />
                      <span>Explorer</span>
                    </Button>
                  </a>

                  <a
                    :href="`${explorerUrl}/address/${currentToken.poolAddress}`"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 px-2 text-[11px] font-mono flex items-center gap-1 text-black dark:text-white border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <span>Pool</span>
                    </Button>
                  </a>
                </div>
              </div>

              <p class="text-xs leading-relaxed text-black dark:text-white">
                {{
                  currentToken.description ||
                  `Fixed-supply launchpad token on ${activeNetwork.name}.`
                }}
              </p>

              <!-- Market Stats Grid -->
              <div
                class="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800"
              >
                <div>
                  <p class="text-xs text-black dark:text-white font-medium">Price (USD)</p>
                  <p
                    class="text-sm sm:text-base font-bold font-mono mt-0.5 text-black dark:text-white"
                  >
                    {{ formatPriceUsd(currentMarketData.priceUsd) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-black dark:text-white font-medium">Market Cap</p>
                  <p
                    class="text-sm sm:text-base font-bold font-mono mt-0.5 text-black dark:text-white"
                  >
                    {{ formatCompactUsd(currentMarketData.marketCapUsd) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-black dark:text-white font-medium">24h Volume</p>
                  <p
                    class="text-sm sm:text-base font-bold font-mono mt-0.5 text-black dark:text-white"
                  >
                    {{ formatCompactUsd(currentMarketData.volume24hUsd) }}
                  </p>
                </div>
              </div>

              <!-- Graduation Progress Bar with Shadcn Progress -->
              <div class="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <div class="flex justify-between text-xs text-black dark:text-white">
                  <span class="font-medium">
                    Graduation Progress ({{ currentMarketData.pairedPrincipalWeth }} /
                    {{ currentMarketData.graduationThresholdWeth }} {{ currencySymbol }})
                  </span>
                  <span class="font-mono font-bold text-emerald-400">
                    {{ (currentMarketData.graduationProgress * 100).toFixed(1) }}%
                  </span>
                </div>
                <Progress :model-value="currentMarketData.graduationProgress * 100" class="h-2" />
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <!-- Swap Column with Quick Percentages & Slippage Popover -->
      <div class="space-y-6">
        <!-- V2 Bonding Curve / V1 DEX Status Card -->
        <Card
          class="p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-xs font-semibold text-black dark:text-white flex items-center gap-1.5"
            >
              <Activity class="w-3.5 h-3.5 text-emerald-400" />
              {{
                currentToken.version === 'v2' ? 'Bonding Curve Progress' : 'Uniswap V3 Liquidity'
              }}
            </span>
            <span class="text-[11px] font-mono font-bold text-emerald-500 dark:text-emerald-400">
              {{ (currentMarketData.graduationProgress * 100).toFixed(1) }}%
            </span>
          </div>
          <Progress :model-value="currentMarketData.graduationProgress * 100" class="h-2" />

          <!-- GMGN-style Milestone remaining indicator -->
          <div
            v-if="currentToken.version === 'v2' && !currentMarketData.isGraduated"
            class="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[11px] font-mono flex items-center justify-between text-emerald-600 dark:text-emerald-400"
          >
            <span class="flex items-center gap-1.5 font-bold">
              <Sparkles class="w-3.5 h-3.5 shrink-0" />
              Need {{ remainingToGraduate }} {{ currencySymbol }} to graduate
            </span>
            <span class="text-zinc-500 dark:text-zinc-400 text-[10px]">Target: Uniswap DEX</span>
          </div>

          <div
            class="flex justify-between text-[11px] text-zinc-500 font-mono pt-1 border-t border-zinc-200 dark:border-zinc-800"
          >
            <span>
              {{ currentMarketData.pairedPrincipalWeth }} /
              {{ currentMarketData.graduationThresholdWeth }} {{ currencySymbol }}
            </span>
            <span>
              {{
                currentToken.version === 'v2'
                  ? currentMarketData.isGraduated
                    ? 'Graduated to v4'
                    : 'Migrating to v4 at 100%'
                  : 'Permanently Locked'
              }}
            </span>
          </div>
        </Card>

        <Card class="p-6 space-y-4">
          <!-- Graduation Banner & DEX Routing Notice (H-03) -->
          <div
            v-if="currentMarketData.isGraduated"
            class="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1"
          >
            <div class="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Check class="w-4 h-4" />
              <span>Token Graduated to Uniswap DEX</span>
            </div>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              Bonding curve complete! Liquidity is permanently locked in Uniswap. Swaps route
              through canonical DEX pools.
            </p>
          </div>

          <div
            class="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800"
          >
            <Tabs v-model="tradeTab" class="flex-row">
              <TabsList
                class="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <TabsTrigger value="buy" class="text-xs font-semibold text-black dark:text-white">{{
                  t('buy')
                }}</TabsTrigger>
                <TabsTrigger
                  value="sell"
                  class="text-xs font-semibold text-black dark:text-white"
                  >{{ t('sell') }}</TabsTrigger
                >
              </TabsList>
            </Tabs>

            <!-- P1: Slippage Popover Button -->
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 px-2 text-xs font-mono flex items-center gap-1 text-black dark:text-white border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <Settings class="w-3.5 h-3.5" />
                  <span>{{ slippage }}%</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                class="w-64 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl space-y-3"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-black dark:text-white"
                    >Slippage Tolerance</span
                  >
                  <span class="text-xs font-mono font-bold text-emerald-400">{{ slippage }}%</span>
                </div>

                <!-- Preset Slippage Buttons: [0.5%], [1.0%], [2.0%] and Custom -->
                <div class="grid grid-cols-4 gap-1">
                  <Button
                    v-for="preset in [0.5, 1.0, 2.0]"
                    :key="preset"
                    size="sm"
                    :variant="slippage === preset && !isCustomSlippage ? 'default' : 'outline'"
                    class="h-7 px-1 text-xs font-mono font-semibold text-black dark:text-white border-zinc-200 dark:border-zinc-800"
                    @click="selectSlippagePreset(preset)"
                  >
                    {{ preset }}%
                  </Button>
                  <Button
                    size="sm"
                    :variant="isCustomSlippage ? 'default' : 'outline'"
                    class="h-7 px-1 text-xs font-mono font-semibold text-black dark:text-white border-zinc-200 dark:border-zinc-800"
                    @click="isCustomSlippage = true"
                  >
                    Custom
                  </Button>
                </div>

                <!-- Custom Slippage Input -->
                <div v-if="isCustomSlippage" class="space-y-1.5">
                  <div class="relative">
                    <Input
                      v-model="customSlippageInput"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="49"
                      placeholder="1.0"
                      class="h-8 text-xs font-mono pr-7 text-black dark:text-white bg-transparent border-zinc-200 dark:border-zinc-800"
                      @input="handleCustomSlippageInput"
                    />
                    <span
                      class="absolute right-2.5 top-2 text-xs font-mono font-bold text-black dark:text-white"
                      >%</span
                    >
                  </div>
                  <!-- High slippage warning (fix LOW-02) -->
                  <div
                    v-if="slippage > 5"
                    class="text-[11px] font-mono text-amber-500 flex items-center gap-1"
                  >
                    <span>Warning: high slippage increases sandwich attack risk.</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <!-- You Pay Input -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs text-black dark:text-white font-medium">
              <span>You pay</span>
              <div class="flex items-center gap-1 font-mono">
                <span>Bal:</span>
                <span class="font-bold">
                  {{ isBuy ? formatEthBalance(balanceWei) : formatTokenBalance(userTokenBalance) }}
                </span>
                <span>{{ isBuy ? currencySymbol : currentToken.symbol }}</span>
              </div>
            </div>

            <Input
              v-model="amountIn"
              type="number"
              step="0.001"
              placeholder="0.0"
              class="text-lg font-mono text-black dark:text-white bg-transparent border-zinc-200 dark:border-zinc-800"
            />

            <!-- Quick Buy Presets (Only in Buy mode) -->
            <div v-if="isBuy" class="grid grid-cols-4 gap-1.5 pt-1">
              <Button
                v-for="ethVal in buyPresets"
                :key="ethVal"
                size="sm"
                variant="secondary"
                class="h-7 text-xs font-mono font-semibold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30"
                @click="applyQuickBuy(ethVal)"
              >
                {{ ethVal }} {{ currencySymbol }}
              </Button>
            </div>

            <!-- Percentage Buttons: [25%], [50%], [75%], [100%] -->
            <div class="grid grid-cols-4 gap-1.5 pt-1">
              <Button
                v-for="percent in [25, 50, 75, 100]"
                :key="percent"
                size="sm"
                variant="outline"
                class="h-7 text-xs font-mono font-semibold text-black dark:text-white border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                @click="applyPercentage(percent)"
              >
                {{ percent === 100 ? 'Max' : `${percent}%` }}
              </Button>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between text-xs text-black dark:text-white">
              <span>You receive (estimated)</span>
              <span class="font-mono">{{ isBuy ? currentToken.symbol : currencySymbol }}</span>
            </div>
            <div
              class="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-3.5 py-3 text-lg font-mono text-black dark:text-white"
            >
              {{ estimatedOutput }}
            </div>
          </div>

          <!-- Execute Swap Action Button -->
          <Button
            v-if="!isConnected"
            class="w-full font-bold h-11 bg-emerald-500 hover:bg-emerald-600 text-black shadow-sm cursor-pointer"
            size="lg"
            @click="openWallet"
          >
            Connect Wallet to Trade
          </Button>

          <Button
            v-else-if="activeNetwork.chainId !== tokenNetwork.chainId"
            class="w-full font-bold h-11 bg-amber-500 hover:bg-amber-600 text-black shadow-sm cursor-pointer"
            size="lg"
            @click="switchOrAddNetwork(tokenNetwork)"
          >
            Switch to {{ tokenNetwork.name }} ({{ currencySymbol }})
          </Button>

          <Button
            v-else
            @click="handleSwap"
            :disabled="isSwapping || !amountIn || parseFloat(amountIn) <= 0"
            :variant="isBuy ? 'default' : 'destructive'"
            size="lg"
            class="w-full font-bold"
          >
            <ArrowUpDown class="w-4 h-4 mr-1" />
            {{
              isSwapping
                ? 'Executing Swap...'
                : isBuy
                  ? `Buy ${currentToken.symbol}`
                  : `Sell ${currentToken.symbol}`
            }}
          </Button>

          <!-- Status Notifications -->
          <div
            v-if="!isConnected"
            class="text-xs text-black dark:text-white bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>Connect your wallet to trade on {{ tokenNetwork.name }}.</span>
          </div>

          <div
            v-if="swapSuccessTx"
            class="text-xs text-black dark:text-white bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 break-all flex flex-col gap-1.5"
          >
            <div class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <Check class="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Swap Confirmed!</span>
            </div>
            <a
              :href="`${explorerUrl}/tx/${swapSuccessTx}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] font-mono underline hover:text-emerald-400 transition flex items-center gap-1 text-zinc-600 dark:text-zinc-300"
            >
              <span>View on Explorer</span>
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>

          <div
            v-if="swapError"
            class="text-xs text-black dark:text-white bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{{ swapError }}</span>
          </div>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { parseAbi } from 'viem';
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
} from 'lucide-vue-next';
import { useSwap, SLIPPAGE_WARN_THRESHOLD } from '../composables/useSwap';
import { useWallet } from '../composables/useWallet';
import { getPublicClient } from '../lib/viem-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, Jazzicon } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
  launchpadTokenAbi,
  type LaunchedTokenEntity,
  type TokenMarketData,
} from '@proto/shared-types';
const props = defineProps<{
  tokenAddress?: string;
}>();

const { t } = useI18n();

const copiedTradeLink = ref(false);
function copyTradeLink() {
  if (typeof window === 'undefined') return;
  navigator.clipboard.writeText(window.location.href);
  copiedTradeLink.value = true;
  setTimeout(() => {
    copiedTradeLink.value = false;
  }, 2000);
}

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
const { isConnected, account, balanceWei, activeNetwork, switchOrAddNetwork, openWallet } =
  useWallet();

const isArcToken = computed(() => {
  const paired = currentToken.value.pairedToken?.toLowerCase();
  const pool = currentToken.value.poolAddress?.toLowerCase();
  const curve = currentToken.value.curveAddress?.toLowerCase();
  const arcFactory = ARC_CHAIN.contracts.factory.toLowerCase();
  const arcWeth = ARC_CHAIN.contracts.weth.toLowerCase();

  return (
    paired === arcWeth ||
    pool === arcFactory ||
    curve === '0x6c1c1a77771bf8961e27ea5b21f575eb17a7626e' ||
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

const remainingToGraduate = computed(() => {
  const current = Number(currentMarketData.value.pairedPrincipalWeth || 0);
  const target = Number(
    currentMarketData.value.graduationThresholdWeth ||
      (currencySymbol.value === 'USDC' ? 69000 : 4.2),
  );
  const diff = Math.max(0, target - current);
  return currencySymbol.value === 'USDC' ? diff.toFixed(0) : diff.toFixed(3);
});

const tradeTab = ref<'buy' | 'sell'>('buy');
const isBuy = computed(() => tradeTab.value === 'buy');
const amountIn = ref('0.05');
const swapSuccessTx = ref<string | null>(null);
const copied = ref(false);
const copiedId = ref<string | null>(null);
const tokenLoading = ref(true);

// Bottom Tabs: trades | holders | about
const activeBottomTab = ref<'trades' | 'holders' | 'about'>('trades');

// Trades & Holders State
const trades = ref<LiveTrade[]>([]);
const tradesLoading = ref(false);
const holders = ref<TokenHolder[]>([]);
const holdersLoading = ref(false);
const userTokenBalance = ref<bigint>(0n);

// Slippage Settings State
const isCustomSlippage = ref(false);
const customSlippageInput = ref('');

const resolutions = [
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '1d', seconds: 86400 },
];
const selectedResolution = ref(60);

const candlestickData = ref<
  Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
>([]);

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

const devBadgeVariant = computed(() => {
  return devInfo.value.creatorStatus === 'holding' ? 'default' : 'secondary';
});

const devBadgeText = computed(() => {
  if (devInfo.value.creatorStatus === 'holding') {
    return `Dev Holding (${devInfo.value.currentHoldPercent.toFixed(1)}%)`;
  }
  if (devInfo.value.creatorStatus === 'sold') {
    return 'Dev Sold';
  }
  return 'Dev 0%';
});

function computeCurveBuyOutput(ethIn: number): number {
  if (ethIn <= 0) return 0;
  const netEth = ethIn * 0.99; // 1% fee
  const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
  const isArc = currencySymbol.value === 'USDC';
  // Minara Arc standard: 4,200 USDC opening FDV virtual reserve
  const virtualEth = (isArc ? 4200.0 : 3.0) + currentRaised;
  const virtualTokens = 1000000000;
  const currentK = virtualEth * virtualTokens;
  const newEthReserve = virtualEth + netEth;
  const newTokenReserve = currentK / newEthReserve;
  return Math.max(0, virtualTokens - newTokenReserve);
}

function computeCurveSellOutput(tokensIn: number): number {
  if (tokensIn <= 0) return 0;
  const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
  const isArc = currencySymbol.value === 'USDC';
  const virtualEth = (isArc ? 4200.0 : 3.0) + currentRaised;
  const virtualTokens = 1000000000;
  const currentK = virtualEth * virtualTokens;
  const newTokenReserve = virtualTokens + tokensIn;
  const newEthReserve = currentK / newTokenReserve;
  const grossEth = Math.max(0, virtualEth - newEthReserve);
  return grossEth * 0.99; // 1% fee
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
function applyQuickBuy(val: string) {
  amountIn.value = val;
}

// P1: Quick Percentage Buttons Handler
function applyPercentage(percent: number) {
  if (isBuy.value) {
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance <= 0) {
      amountIn.value = '0.0';
      return;
    }
    if (percent === 100) {
      // Leave tiny gas buffer for transaction execution
      const maxEth = Math.max(0, ethBalance - 0.005);
      amountIn.value = (maxEth > 0 ? maxEth : ethBalance).toFixed(4);
    } else {
      amountIn.value = (ethBalance * (percent / 100)).toFixed(4);
    }
  } else {
    const tokenBal = Number(userTokenBalance.value) / 10 ** (currentToken.value.decimals || 18);
    if (tokenBal <= 0) {
      amountIn.value = '0.0';
      return;
    }
    amountIn.value = (tokenBal * (percent / 100)).toFixed(2);
  }
}

// P1: Slippage Handlers
function selectSlippagePreset(val: number) {
  slippage.value = val;
  isCustomSlippage.value = false;
  customSlippageInput.value = '';
}

function handleCustomSlippageInput() {
  const val = parseFloat(customSlippageInput.value);
  // Batas max 49% untuk mencegah sandwich attack ekstrem (fix LOW-02)
  if (!isNaN(val) && val > 0 && val <= 49) {
    slippage.value = val;
  } else if (!isNaN(val) && val > 49) {
    slippage.value = 49;
    customSlippageInput.value = '49';
  }
}

function formatEthBalance(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth < 0.0001 ? eth.toFixed(6) : eth.toFixed(4);
}

function formatTokenBalance(wei: bigint): string {
  const val = Number(wei) / 10 ** (currentToken.value.decimals || 18);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return val.toFixed(2);
}

function truncateAddress(addr: string): string {
  return shortenAddress(addr);
}

function getHolderBadge(addr: string): string | null {
  const lower = addr.toLowerCase();
  if (lower === ROBINHOOD_CHAIN.contracts.locker.toLowerCase()) return 'Liquidity Locker';
  if (lower === currentToken.value.deployer.toLowerCase()) return 'Creator';
  if (lower === currentToken.value.poolAddress.toLowerCase()) return 'Pool';
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

async function fetchUserTokenBalance() {
  if (!account.value || !currentToken.value.address) {
    userTokenBalance.value = 0n;
    return;
  }
  try {
    const bal = await getPublicClient().readContract({
      address: currentToken.value.address as `0x${string}`,
      abi: launchpadTokenAbi,
      functionName: 'balanceOf',
      args: [account.value as `0x${string}`],
    });
    userTokenBalance.value = bal as bigint;
  } catch {
    userTokenBalance.value = 0n;
  }
}

// P2: Fetch Live Trades History
async function fetchTrades(address: string) {
  tradesLoading.value = true;
  try {
    const res = await fetch(`/api/tokens/${address}/trades?limit=50`);
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      trades.value = envelope.data;
    } else {
      trades.value = [];
    }
  } catch {
    trades.value = [];
  } finally {
    tradesLoading.value = false;
  }
}

// P3: Fetch Top Token Holders
async function fetchHolders(address: string) {
  holdersLoading.value = true;
  try {
    const res = await fetch(`/api/tokens/${address}/holders?limit=50`);
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      holders.value = envelope.data;
    } else {
      holders.value = [];
    }
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
    if (envelope.success && Array.isArray(envelope.data)) {
      topTraders.value = envelope.data;
    } else {
      topTraders.value = [];
    }
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
    if (envelope.success && envelope.data) {
      devInfo.value = envelope.data;
    }
  } catch {
    // Ignore
  }
}

async function fetchCandlesticks(address: string, resolutionSeconds = 60) {
  try {
    const res = await fetch(`/api/tokens/${address}/ohlcv?resolution=${resolutionSeconds}`);
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data) && envelope.data.length > 0) {
      candlestickData.value = envelope.data.map(
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

  // Calculate expectedAmountOut in wei to enforce on-chain slippage bounds
  let expectedAmountOut: bigint | undefined;
  const input = parseFloat(amountIn.value) || 0;
  const isV2OnCurve = currentToken.value.version === 'v2' && !currentMarketData.value.isGraduated;

  if (input > 0 && currentMarketData.value.priceInWeth > 0) {
    if (isBuy.value) {
      const estimatedTokens = isV2OnCurve
        ? computeCurveBuyOutput(input)
        : input / (currentMarketData.value.priceInWeth || 0.000001);
      expectedAmountOut = BigInt(Math.floor(estimatedTokens * 1e18));
    } else {
      const estimatedEth = isV2OnCurve
        ? computeCurveSellOutput(input)
        : input * (currentMarketData.value.priceInWeth || 0);
      expectedAmountOut = BigInt(Math.floor(estimatedEth * 1e18));
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
    // Refresh user balance & trades after successful swap
    await fetchUserTokenBalance();
    await fetchTrades(currentToken.value.address);
  }
}

async function loadTokenData(address: `0x${string}`) {
  tokenLoading.value = true;
  try {
    const res = await fetch(`/api/tokens/${address}`);
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      currentToken.value = envelope.data.token;
      currentMarketData.value = envelope.data.marketData;
    }
  } catch {
    // Non-blocking fallback
  } finally {
    tokenLoading.value = false;
    await fetchCandlesticks(address, selectedResolution.value);
    await fetchTrades(address);
    await fetchTopTraders(address);
    await fetchDevActivity(address);
    await fetchHolders(address);
    await fetchUserTokenBalance();
  }
}

watch(
  () => props.tokenAddress,
  async (newAddress) => {
    if (newAddress && newAddress !== currentToken.value.address) {
      currentToken.value.address = newAddress as `0x${string}`;
      await loadTokenData(newAddress as `0x${string}`);
    }
  },
);

watch(
  () => account.value,
  async () => {
    await fetchUserTokenBalance();
  },
);

onMounted(async () => {
  await loadTokenData(currentToken.value.address);
});
</script>
