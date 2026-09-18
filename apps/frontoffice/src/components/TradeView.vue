<template>
  <!-- Full-width terminal layout, no outer max-width constraints -->
  <div class="w-full">
    <!-- Loading state -->
    <div
      v-if="tokenLoading"
      class="flex items-center justify-center py-32 text-zinc-500 dark:text-zinc-400 gap-3"
    >
      <Loader2 class="w-5 h-5 animate-spin text-emerald-500" />
      <span class="text-sm font-medium">Loading token data...</span>
    </div>

    <template v-else>
      <!-- ============================================================
           ROW 1: Token Identity Bar (full width)
           ============================================================ -->
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
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
            class="text-[10px] font-mono h-5 px-2"
            :class="
              currentMarketData.isGraduated
                ? 'bg-violet-500/15 text-violet-500 border border-violet-500/30'
                : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
            "
          >
            {{ currentMarketData.isGraduated ? 'Graduated' : 'Bonding Curve' }}
          </Badge>
          <Badge :variant="devBadgeVariant" class="text-[10px] font-mono h-5 px-2">
            {{ devBadgeText }}
          </Badge>
        </div>

        <!-- Sentiment Voting (Bullish / Bearish) -->
        <div
          class="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
        >
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer"
            :class="
              votesSummary.viewerVote === 'bullish'
                ? 'bg-emerald-500 text-black'
                : 'text-emerald-500 hover:bg-emerald-500/15'
            "
            title="Vote Bullish"
            @click="castVote('bullish')"
          >
            <Rocket class="w-3 h-3" />
            <span>{{ votesSummary.bullishCount }}</span>
          </button>

          <span class="text-zinc-400 text-[10px] font-bold"
            >{{ votesSummary.bullishPercent }}%</span
          >

          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer"
            :class="
              votesSummary.viewerVote === 'bearish'
                ? 'bg-rose-500 text-white'
                : 'text-rose-500 hover:bg-rose-500/15'
            "
            title="Vote Bearish"
            @click="castVote('bearish')"
          >
            <Flame class="w-3 h-3" />
            <span>{{ votesSummary.bearishCount }}</span>
          </button>
        </div>

        <!-- Live market stats pill row -->
        <div class="flex items-center gap-4 ml-auto font-mono text-xs flex-wrap">
          <div class="flex flex-col items-end">
            <span class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider"
              >Price</span
            >
            <span class="font-bold text-black dark:text-white">{{
              formatPriceUsd(currentMarketData.priceUsd)
            }}</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider"
              >Mkt Cap</span
            >
            <span class="font-bold text-black dark:text-white">{{
              formatCompactUsd(currentMarketData.marketCapUsd)
            }}</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider"
              >24h Vol</span
            >
            <span class="font-bold text-black dark:text-white">{{
              formatCompactUsd(currentMarketData.volume24hUsd)
            }}</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider"
              >Raised</span
            >
            <span class="font-bold text-black dark:text-white">
              {{ currentMarketData.pairedPrincipalWeth }} /
              {{ currentMarketData.graduationThresholdWeth }} {{ currencySymbol }}
            </span>
          </div>
        </div>
      </div>

      <!-- ============================================================
           ROW 2: Main Trading Layout — Chart (left) + Swap Panel (right)
           ============================================================ -->
      <div class="flex flex-col lg:flex-row gap-0 min-h-[600px]">
        <!-- ============================================================
             LEFT: Chart column (flex-1)
             ============================================================ -->
        <div class="flex-1 min-w-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800">
          <!-- Timeframe switcher bar -->
          <div
            class="flex items-center gap-0 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
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
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              >
                <ShieldCheck class="w-3 h-3" />
                No Mint
              </span>
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
                :class="
                  devHoldingPercent === 0
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                "
              >
                Dev {{ devHoldingPercent === 0 ? '0%' : `${devHoldingPercent.toFixed(1)}%` }}
              </span>
              <span
                class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
              >
                Top10: {{ top10HoldingPercent.toFixed(1) }}%
              </span>
              <span
                class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
              >
                Anti-Snipe
              </span>
            </div>
          </div>

          <!-- TradingChart (full width, continuous timeline from launch to now) -->
          <div class="flex-1 px-3 py-3 bg-white dark:bg-zinc-950">
            <TradingChart
              :data="candlestickData"
              :token-symbol="currentToken.symbol"
              :token-address="currentToken.address"
              :height="420"
            />
          </div>

          <!-- ============================================================
               Bottom Tabs: Thread | Trades | Top Traders | Holders | About
               ============================================================ -->
          <div class="border-t border-zinc-200 dark:border-zinc-800">
            <Tabs v-model="activeBottomTab" class="w-full">
              <!-- Tab headers -->
              <div
                class="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3"
              >
                <TabsList class="flex gap-0 bg-transparent border-0 rounded-none h-auto p-0">
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
                    class="px-4 py-2.5 text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white bg-transparent transition-all"
                  >
                    {{ tab.label }}
                    <span
                      v-if="tab.value === 'thread' && comments.length > 0"
                      class="ml-1 px-1 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px]"
                    >
                      {{ comments.length }}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <Button
                  v-if="activeBottomTab === 'trades'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                  @click="fetchTrades(currentToken.address)"
                >
                  Refresh
                </Button>
                <Button
                  v-if="activeBottomTab === 'thread'"
                  variant="ghost"
                  size="sm"
                  class="ml-auto h-7 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
                  @click="fetchComments(currentToken.address)"
                >
                  Refresh
                </Button>
              </div>

              <!-- Tab: Discussion Thread & Comments -->
              <TabsContent value="thread" class="mt-0 max-h-[380px] overflow-y-auto p-4 space-y-4">
                <!-- Post Comment Form -->
                <div
                  class="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-2.5"
                >
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
                    v-for="cmt in comments"
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
                  <table class="w-full text-left text-xs font-mono">
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
                        v-for="trade in trades"
                        :key="trade.id || trade.transactionHash"
                        class="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <td class="py-2 px-3 whitespace-nowrap">
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
                            :class="
                              trade.isBuy
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-rose-500/10 text-rose-500'
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
                            class="text-zinc-400 hover:text-emerald-400 transition-colors inline-flex items-center"
                          >
                            <ExternalLink class="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
                  <table class="w-full text-left text-xs font-mono">
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
                        v-for="(trader, idx) in topTraders"
                        :key="trader.address"
                        class="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <td class="py-2 px-3 text-zinc-500 font-bold">#{{ idx + 1 }}</td>
                        <td class="py-2 px-3">
                          <div class="flex items-center gap-1.5">
                            <Jazzicon :address="trader.address" :size="14" />
                            <span class="text-black dark:text-white font-medium">{{
                              truncateAddress(trader.address)
                            }}</span>
                            <button
                              type="button"
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
                  <table class="w-full text-left text-xs font-mono">
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
                        v-for="(holder, idx) in holders"
                        :key="holder.address"
                        class="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <td class="py-2 px-3 text-zinc-500 font-bold">#{{ idx + 1 }}</td>
                        <td class="py-2 px-3 whitespace-nowrap">
                          <div class="flex items-center gap-1.5">
                            <Jazzicon :address="holder.address" :size="14" />
                            <span class="text-black dark:text-white font-medium">{{
                              truncateAddress(holder.address)
                            }}</span>
                            <button
                              type="button"
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

        <!-- ============================================================
             RIGHT: Swap Panel (fixed width 340px)
             ============================================================ -->
        <div
          class="w-full lg:w-[340px] shrink-0 flex flex-col border-t lg:border-t-0 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
        >
          <!-- Graduation progress card -->
          <div class="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-black dark:text-white">
                {{ currentToken.version === 'v2' ? 'Bonding Curve' : 'Uniswap V3 Liquidity' }}
              </span>
              <span class="text-xs font-mono font-bold text-emerald-500">
                {{ (currentMarketData.graduationProgress * 100).toFixed(1) }}%
              </span>
            </div>
            <Progress
              :model-value="currentMarketData.graduationProgress * 100"
              class="h-1.5 mb-2"
            />
            <div
              class="flex justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400"
            >
              <span
                >{{ currentMarketData.pairedPrincipalWeth }} /
                {{ currentMarketData.graduationThresholdWeth }} {{ currencySymbol }}</span
              >
              <span>{{
                currentMarketData.isGraduated
                  ? 'Graduated'
                  : `Need ${remainingToGraduate} ${currencySymbol}`
              }}</span>
            </div>
            <!-- Graduation call-to-action banner -->
            <div
              v-if="currentToken.version === 'v2' && !currentMarketData.isGraduated"
              class="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20 text-[10px] font-mono flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
            >
              <Sparkles class="w-3 h-3 shrink-0" />
              <span>Graduates to Uniswap v4 at 100%</span>
            </div>
            <div
              v-else-if="currentMarketData.isGraduated"
              class="mt-2 px-2.5 py-1.5 rounded-lg bg-violet-500/8 border border-violet-500/20 text-[10px] font-mono flex items-center gap-1.5 text-violet-500"
            >
              <Check class="w-3 h-3 shrink-0" />
              <span>Liquidity locked in Uniswap DEX</span>
            </div>
          </div>

          <!-- Swap panel -->
          <div class="flex-1 p-4 space-y-4">
            <!-- Wrong network warning banner -->
            <div
              v-if="isConnected && activeNetwork.chainId !== tokenNetwork.chainId"
              class="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2"
            >
              <AlertCircle class="w-3.5 h-3.5 shrink-0" />
              <span>Switch to {{ tokenNetwork.name }} to trade.</span>
            </div>

            <!-- Buy / Sell tabs + Slippage gear -->
            <div class="flex items-center justify-between">
              <div
                class="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"
              >
                <button
                  type="button"
                  class="px-4 py-1.5 text-xs font-bold transition cursor-pointer"
                  :class="
                    isBuy
                      ? 'bg-emerald-500 text-black'
                      : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                  "
                  @click="tradeTab = 'buy'"
                >
                  {{ t('buy') }}
                </button>
                <button
                  type="button"
                  class="px-4 py-1.5 text-xs font-bold transition cursor-pointer"
                  :class="
                    !isBuy
                      ? 'bg-rose-500 text-white'
                      : 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'
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
                    class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer bg-white dark:bg-zinc-900"
                  >
                    <Settings class="w-3.5 h-3.5" />
                    <span>{{ slippage }}%</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  class="w-60 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl space-y-3"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-black dark:text-white"
                      >Slippage Tolerance</span
                    >
                    <span class="text-xs font-mono font-bold text-emerald-500"
                      >{{ slippage }}%</span
                    >
                  </div>
                  <div class="grid grid-cols-4 gap-1">
                    <Button
                      v-for="preset in [0.5, 1.0, 2.0]"
                      :key="preset"
                      size="sm"
                      :variant="slippage === preset && !isCustomSlippage ? 'default' : 'outline'"
                      class="h-7 px-1 text-xs font-mono text-black dark:text-white border-zinc-200 dark:border-zinc-800"
                      @click="selectSlippagePreset(preset)"
                    >
                      {{ preset }}%
                    </Button>
                    <Button
                      size="sm"
                      :variant="isCustomSlippage ? 'default' : 'outline'"
                      class="h-7 px-1 text-xs font-mono text-black dark:text-white border-zinc-200 dark:border-zinc-800"
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
                        class="h-8 text-xs font-mono pr-7 text-black dark:text-white bg-transparent border-zinc-200 dark:border-zinc-800"
                        @input="handleCustomSlippageInput"
                      />
                      <span
                        class="absolute right-2.5 top-2 text-xs font-mono font-bold text-zinc-500"
                        >%</span
                      >
                    </div>
                    <div
                      v-if="slippage > 5"
                      class="text-[10px] font-mono text-amber-500 flex items-center gap-1"
                    >
                      <AlertCircle class="w-3 h-3 shrink-0" />
                      High slippage — sandwich attack risk.
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <!-- You Pay input -->
            <div class="space-y-2">
              <div class="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>You pay</span>
                <span class="font-mono">
                  Bal:
                  <span class="font-bold text-black dark:text-white">{{
                    isBuy ? formatEthBalance(balanceWei) : formatTokenBalance(userTokenBalance)
                  }}</span>
                  {{ isBuy ? currencySymbol : currentToken.symbol }}
                </span>
              </div>
              <div class="relative">
                <Input
                  v-model="amountIn"
                  type="number"
                  step="0.001"
                  placeholder="0.0"
                  class="text-xl font-mono font-bold text-black dark:text-white bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 h-14 pr-20"
                />
                <span
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400 select-none"
                >
                  {{ isBuy ? currencySymbol : currentToken.symbol }}
                </span>
              </div>

              <!-- Quick buy presets (buy mode only) -->
              <div v-if="isBuy" class="grid grid-cols-4 gap-1">
                <button
                  v-for="ethVal in buyPresets"
                  :key="ethVal"
                  type="button"
                  class="py-1.5 text-xs font-mono font-semibold rounded-lg border transition cursor-pointer text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-500/25 hover:bg-emerald-500/15"
                  @click="applyQuickBuy(ethVal)"
                >
                  {{ ethVal }}
                </button>
              </div>

              <!-- Percentage buttons -->
              <div class="grid grid-cols-4 gap-1">
                <button
                  v-for="percent in [25, 50, 75, 100]"
                  :key="percent"
                  type="button"
                  class="py-1.5 text-xs font-mono font-semibold rounded-lg border transition cursor-pointer text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  @click="applyPercentage(percent)"
                >
                  {{ percent === 100 ? 'Max' : `${percent}%` }}
                </button>
              </div>
            </div>

            <!-- You receive output -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>You receive (est.)</span>
                <span class="font-mono">{{ isBuy ? currentToken.symbol : currencySymbol }}</span>
              </div>
              <div
                class="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-4 py-3.5 text-base font-mono font-bold text-black dark:text-white min-h-[52px] flex items-center"
              >
                {{ estimatedOutput }}
              </div>
            </div>

            <!-- CTA Swap button -->
            <Button
              v-if="!isConnected"
              class="w-full font-bold h-12 bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer rounded-xl text-sm"
              @click="openWallet"
            >
              Connect Wallet to Trade
            </Button>
            <Button
              v-else-if="activeNetwork.chainId !== tokenNetwork.chainId"
              class="w-full font-bold h-12 bg-amber-500 hover:bg-amber-400 text-black cursor-pointer rounded-xl text-sm"
              @click="switchOrAddNetwork(tokenNetwork)"
            >
              Switch to {{ tokenNetwork.name }}
            </Button>
            <Button
              v-else
              :disabled="isSwapping || !amountIn || parseFloat(amountIn) <= 0"
              class="w-full font-bold h-12 cursor-pointer rounded-xl text-sm transition"
              :class="
                isBuy
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50'
                  : 'bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-50'
              "
              @click="handleSwap"
            >
              <Loader2 v-if="isSwapping" class="w-4 h-4 mr-2 animate-spin" />
              <ArrowUpDown v-else class="w-4 h-4 mr-2" />
              {{
                isSwapping
                  ? 'Executing...'
                  : isBuy
                    ? `Buy ${currentToken.symbol}`
                    : `Sell ${currentToken.symbol}`
              }}
            </Button>

            <!-- Status messages -->
            <div
              v-if="swapSuccessTx"
              class="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5"
            >
              <div
                class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold"
              >
                <Check class="w-3.5 h-3.5" />
                Swap Confirmed
              </div>
              <a
                :href="`${explorerUrl}/tx/${swapSuccessTx}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-[10px] text-zinc-500 hover:text-emerald-500 transition underline flex items-center gap-1"
              >
                View on Explorer <ExternalLink class="w-3 h-3" />
              </a>
            </div>
            <div
              v-if="swapError"
              class="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-start gap-2"
            >
              <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{{ swapError }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
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
  Rocket,
  Flame,
  MessageSquare,
  Send,
  Heart,
} from 'lucide-vue-next';
import { useSwap, SLIPPAGE_WARN_THRESHOLD } from '../composables/useSwap';
import { useWallet } from '../composables/useWallet';
import { getPublicClient } from '../lib/viem-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Jazzicon } from '@/components/ui/avatar';
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
  type TokenCommentEntity,
  type TokenVotesSummary,
} from '@proto/shared-types';

const props = defineProps<{
  tokenAddress?: string;
}>();

const { t } = useI18n();

// Suppress unused import warning — SLIPPAGE_WARN_THRESHOLD used in template logic
void SLIPPAGE_WARN_THRESHOLD;
// Suppress parseAbi — used in fetchUserTokenBalance readContract fallback
void parseAbi;

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
const amountIn = ref('0.05');
const swapSuccessTx = ref<string | null>(null);
const copied = ref(false);
const copiedId = ref<string | null>(null);
const tokenLoading = ref(true);
const activeBottomTab = ref<'thread' | 'trades' | 'top-traders' | 'holders' | 'about'>('thread');

// Trades
const trades = ref<LiveTrade[]>([]);
const tradesLoading = ref(false);
const userTokenBalance = ref<bigint>(0n);

// Slippage
const isCustomSlippage = ref(false);
const customSlippageInput = ref('');

// Comments & Discussion State
const comments = ref<TokenCommentEntity[]>([]);
const commentsLoading = ref(false);
const newCommentText = ref('');
const isPostingComment = ref(false);

// Sentiment Votes State
const votesSummary = ref<TokenVotesSummary>({
  tokenAddress: '',
  bullishCount: 0,
  bearishCount: 0,
  totalVotes: 0,
  bullishPercent: 50,
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
function computeCurveBuyOutput(ethIn: number): number {
  if (ethIn <= 0) return 0;
  const netEth = ethIn * 0.99;
  const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
  const isArc = currencySymbol.value === 'USDC';
  const virtualEth = (isArc ? 4200.0 : 3.0) + currentRaised;
  const virtualTokens = 1_000_000_000;
  const k = virtualEth * virtualTokens;
  const newEthReserve = virtualEth + netEth;
  const newTokenReserve = k / newEthReserve;
  return Math.max(0, virtualTokens - newTokenReserve);
}

function computeCurveSellOutput(tokensIn: number): number {
  if (tokensIn <= 0) return 0;
  const currentRaised = parseFloat(currentMarketData.value.pairedPrincipalWeth) || 0;
  const isArc = currencySymbol.value === 'USDC';
  const virtualEth = (isArc ? 4200.0 : 3.0) + currentRaised;
  const virtualTokens = 1_000_000_000;
  const k = virtualEth * virtualTokens;
  const newTokenReserve = virtualTokens + tokensIn;
  const newEthReserve = k / newTokenReserve;
  return Math.max(0, virtualEth - newEthReserve) * 0.99;
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

// -----------------------------------------------------------------------
// UI Helpers
// -----------------------------------------------------------------------
function applyQuickBuy(val: string) {
  amountIn.value = val;
}

function applyPercentage(percent: number) {
  if (isBuy.value) {
    const ethBalance = Number(balanceWei.value) / 1e18;
    if (ethBalance <= 0) {
      amountIn.value = '0.0';
      return;
    }
    if (percent === 100) {
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
      await fetchComments(currentToken.value.address);
    }
  } catch {
    // Non-blocking
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
    await fetchUserTokenBalance();
    await fetchTrades(currentToken.value.address);
    await fetchCandlesticks(currentToken.value.address, selectedResolution.value);
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
      fetchUserTokenBalance(),
    ]);
    tokenLoading.value = false;
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
    await Promise.allSettled([
      fetchUserTokenBalance(),
      fetchComments(currentToken.value.address),
      fetchVotes(currentToken.value.address),
    ]);
  },
);

onMounted(async () => {
  const addr = (props.tokenAddress as `0x${string}`) || currentToken.value.address;
  if (addr && addr !== '0x0000000000000000000000000000000000000000') {
    currentToken.value.address = addr;
    await loadTokenData(addr);
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
