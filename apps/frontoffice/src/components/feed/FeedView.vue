<template>
  <div class="max-w-6xl mx-auto space-y-4 font-sans">
    <!-- Top Live Dex & Alpha Ticker Ribbon (Pump.fun x DexScreener Style) -->
    <div
      v-if="hotTokens.length > 0"
      class="p-2 sm:p-2.5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md flex items-center justify-between gap-3 overflow-x-auto no-scrollbar select-none text-xs shadow-2xs"
    >
      <div class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-bold shrink-0 font-mono text-[11px] border border-primary/20">
        <Flame class="w-3.5 h-3.5 fill-current" />
        <span>ALPHA RADAR</span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          v-for="(tItem, idx) in hotTokens"
          :key="tItem.token.address"
          type="button"
          class="flex items-center gap-2 px-3 py-1 rounded-xl border border-border bg-black hover:bg-zinc-950 hover:border-foreground/30 transition cursor-pointer shrink-0 font-mono text-xs group"
          @click="navigateToToken(tItem.token.address)"
        >
          <span class="text-[10px] text-muted-foreground font-bold">#{{ idx + 1 }}</span>
          <OptimizedImage
            :src="tItem.token.logo"
            :alt="tItem.token.name"
            :fallback-text="tItem.token.symbol"
            :width="18"
            :height="18"
            class="rounded-full shrink-0 border border-border/50"
          />
          <span class="font-black text-foreground group-hover:text-primary transition-colors">
            ${{ tItem.token.symbol }}
          </span>
          <span class="text-muted-foreground text-[11px]">
            ${{ formatCompactUsd(tItem.marketData?.marketCapUsd || 4200) }}
          </span>
          <span
            class="text-[11px] font-bold"
            :class="(tItem.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'"
          >
            {{ (tItem.marketData?.priceChange24h ?? 0) >= 0 ? '+' : '' }}{{ (tItem.marketData?.priceChange24h ?? 0).toFixed(1) }}%
          </span>
        </button>
      </div>
    </div>

    <!-- Main Two-Column Hybrid Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <!-- ============================================================
           LEFT: Social Alpha Stream (Hybrid Timeline)
           ============================================================ -->
      <div class="space-y-4 min-w-0">
        <!-- 1. Feed Filter Tabs Bar (Shadcn Tabs variant="line") -->
        <div class="px-3 pt-2 pb-0 border-b border-border bg-card/60 rounded-2xl">
          <Tabs v-model="activeFilter" class="w-full">
            <TabsList variant="line" class="font-mono text-xs overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-b-0">
              <TabsTrigger
                v-for="flt in filterTabs"
                :key="flt.key"
                :value="flt.key"
                @click="handleFilterClick(flt.key)"
              >
                {{ flt.label }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <!-- 2. Hybrid Alpha Terminal Composer -->
        <div class="rounded-2xl border border-border/80 bg-card/90 shadow-2xs p-4 sm:p-5 space-y-3.5">
          <div class="flex items-start gap-3">
            <div class="relative shrink-0">
              <Jazzicon
                :address="account || '0x0000000000000000000000000000000000000000'"
                :size="40"
                class="rounded-full ring-2 ring-border/80"
              />
              <span
                v-if="account"
                class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background"
                title="Wallet Connected"
              />
            </div>

            <div class="flex-1 min-w-0 space-y-3 relative">
              <!-- Textarea with Live $ Cashtag Autocomplete -->
              <div class="relative">
                <textarea
                  ref="composerTextarea"
                  v-model="composerContent"
                  rows="3"
                  maxlength="500"
                  placeholder="Call a token or share alpha... (type $ to select a token, e.g. $SPIDER!)"
                  class="w-full text-xs sm:text-sm p-3 rounded-xl border border-border bg-black text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground focus:border-border resize-none leading-relaxed"
                  @input="handleComposerInput"
                  @keydown="handleComposerKeydown"
                />

                <!-- Floating $ Cashtag Live Autocomplete Popup -->
                <div
                  v-if="showCashtagSuggestions && cashtagSuggestions.length > 0"
                  class="absolute left-0 right-0 top-full mt-1 bg-card border border-border/90 rounded-2xl shadow-2xl p-2 z-50 space-y-1 font-mono text-xs max-h-56 overflow-y-auto"
                >
                  <div class="px-2 py-1 text-[10px] text-muted-foreground uppercase font-bold flex items-center justify-between border-b border-border/50">
                    <span class="flex items-center gap-1">
                      <Sparkles class="w-3 h-3 text-primary" />
                      Select Token for Callout ${{ cashtagQuery || '' }}
                    </span>
                    <span class="text-[9px]">Tab / Enter to pick</span>
                  </div>

                  <button
                    v-for="(tItem, sIdx) in cashtagSuggestions"
                    :key="tItem.token.address"
                    type="button"
                    class="w-full flex items-center justify-between p-2 rounded-xl transition cursor-pointer text-left"
                    :class="sIdx === selectedSuggestionIndex ? 'bg-zinc-900 text-foreground font-bold' : 'hover:bg-zinc-950 text-foreground'"
                    @click="selectCashtagToken(tItem.token)"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <OptimizedImage
                        :src="tItem.token.logo"
                        :alt="tItem.token.name"
                        :fallback-text="tItem.token.symbol"
                        :width="22"
                        :height="22"
                        class="rounded-full shrink-0 border border-border/50"
                      />
                      <div class="min-w-0">
                        <span class="font-black text-foreground block text-xs truncate">
                          ${{ tItem.token.symbol }}
                        </span>
                        <span class="text-[10px] text-muted-foreground truncate block font-sans">
                          {{ tItem.token.name }}
                        </span>
                      </div>
                    </div>

                    <div class="text-right shrink-0">
                      <span class="text-xs font-bold block text-foreground">
                        ${{ formatCompactUsd(tItem.marketData?.marketCapUsd || 4200) }}
                      </span>
                      <span
                        class="text-[10px] font-bold"
                        :class="(tItem.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                      >
                        {{ (tItem.marketData?.priceChange24h ?? 0) >= 0 ? '+' : '' }}{{ (tItem.marketData?.priceChange24h ?? 0).toFixed(1) }}%
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Twitter / X Style Attached Image Preview Card -->
              <div
                v-if="composerImagePreview"
                class="relative rounded-2xl overflow-hidden border border-border/80 bg-muted/20 max-h-72 w-full group"
              >
                <img
                  :src="composerImagePreview"
                  alt="Attached Preview"
                  class="w-full h-full object-cover max-h-72"
                />

                <!-- Top-Right Remove (X) Button like Twitter -->
                <button
                  type="button"
                  class="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition cursor-pointer shadow-md backdrop-blur-xs"
                  title="Remove image"
                  @click="removeAttachedImage"
                >
                  <X class="w-4 h-4" />
                </button>

                <!-- Uploading / Pinning Status Banner -->
                <div
                  v-if="isUploadingMedia"
                  class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs text-white font-mono"
                >
                  <Loader2 class="w-4 h-4 animate-spin text-primary" />
                  <span>Uploading to IPFS...</span>
                </div>
              </div>

              <!-- Media Attachment Input -->
              <div v-if="showMediaInput" class="pt-1 font-mono">
                <Input
                  v-model="composerImageUrl"
                  type="text"
                  placeholder="Image / Chart URL (https://... or ipfs://...)"
                  class="h-8 text-xs rounded-xl"
                />
              </div>

              <!-- On-Chain Balance Verifier (Holder Badge) -->
              <div
                v-if="account && selectedToken && callerPositionUsd >= 1.0"
                class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between gap-2 text-xs font-mono"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck class="w-4 h-4 shrink-0 text-emerald-400" />
                  <span class="truncate">
                    Verified Holder (${{ callerPositionUsd.toFixed(2) }}): <strong>{{ callerTokenBalance.toLocaleString() }} ${{ selectedToken.symbol }}</strong>
                  </span>
                </div>
              </div>

              <div
                v-else-if="account && selectedToken && callerPositionUsd < 1.0 && !checkingBalance"
                class="p-2 rounded-xl bg-black border border-border text-muted-foreground flex items-center justify-between gap-2 text-xs font-sans"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-[11px]">
                    Mentioning ${{ selectedToken.symbol }} &middot; Hold $1+ to earn a Verified Holder badge.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  class="h-6 px-2 text-[10px] font-mono shrink-0 rounded-lg cursor-pointer border-border hover:bg-zinc-900"
                  @click="navigateToToken(selectedToken.address)"
                >
                  Buy ${{ selectedToken.symbol }}
                </Button>
              </div>

              <!-- Composer Footer Toolbar -->
              <div class="flex items-center justify-between pt-1 border-t border-border/50">
                <div class="flex items-center gap-2">
                  <!-- Hidden File Input for Device Photo Upload like Twitter -->
                  <input
                    ref="mediaFileInputRef"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="hidden"
                    @change="handleMediaFileChange"
                  />

                  <button
                    type="button"
                    class="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer flex items-center gap-1.5"
                    :class="composerImagePreview ? 'border-primary/40 bg-primary/10 text-primary' : ''"
                    title="Upload photo from device (like Twitter)"
                    @click="triggerMediaUpload"
                  >
                    <ImageIcon class="w-4 h-4" />
                    <span class="text-[11px] font-mono hidden sm:inline">Photo</span>
                  </button>

                  <button
                    type="button"
                    class="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                    :class="showMediaInput ? 'border-primary/40 bg-primary/10 text-primary' : ''"
                    title="Paste Image or Chart URL"
                    @click="showMediaInput = !showMediaInput"
                  >
                    <Link2 class="w-4 h-4" />
                  </button>

                  <span class="text-[11px] text-muted-foreground font-mono">
                    {{ composerContent.length }}/500
                  </span>
                </div>

                <Button
                  size="sm"
                  class="rounded-xl px-5 h-8 font-bold text-xs cursor-pointer shadow-xs font-mono gap-1.5"
                  :disabled="
                    isPostingCall ||
                    !composerContent.trim() ||
                    (selectedToken !== null && callerTokenBalance <= 0)
                  "
                  @click="submitCallout"
                >
                  <Loader2 v-if="isPostingCall" class="w-3.5 h-3.5 animate-spin" />
                  <Megaphone v-else class="w-3.5 h-3.5" />
                  <span>Post Call</span>
                </Button>
              </div>

              <div
                v-if="composerError"
                class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-2.5 mt-2 font-mono"
              >
                {{ composerError }}
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Hybrid Timeline Cards (Card-based with X / Twitter conversation mechanics) -->
        <div v-if="loading && callouts.length === 0" class="py-20 text-center text-muted-foreground font-mono">
          <Loader2 class="w-7 h-7 animate-spin mx-auto mb-3 text-primary" />
          <p class="text-xs">Loading community alpha...</p>
        </div>

        <Empty
          v-else-if="networkCallouts.length === 0"
          :title="`No callouts on ${activeNetwork.name}`"
          :description="`Be the first to post alpha on ${activeNetwork.name} using the box above!`"
          class="py-14"
        >
          <template #icon>
            <Megaphone class="w-6 h-6 text-muted-foreground" />
          </template>
        </Empty>

        <div v-else class="space-y-3.5">
          <!-- The Hybrid Post Card -->
          <article
            v-for="call in paginatedCallouts"
            :key="call.id"
            class="rounded-2xl border border-border/80 bg-card/80 hover:border-foreground/30 hover:bg-card/95 transition-all p-4 sm:p-5 space-y-3 shadow-2xs relative group"
          >
            <!-- Card Header: Author + Badges + Timestamp + More Menu -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <Jazzicon
                  :address="call.authorAddress"
                  :size="36"
                  class="rounded-full ring-1 ring-border shrink-0 cursor-pointer"
                  @click.stop="navigateToCaller(call.authorAddress)"
                />
                <div class="min-w-0 leading-tight">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                      class="font-bold text-foreground text-xs sm:text-sm hover:underline cursor-pointer font-mono"
                      @click.stop="navigateToCaller(call.authorAddress)"
                    >
                      {{ getUserIdentity(call.authorAddress).displayName }}
                    </span>

                    <!-- Caller Whale Badge with GMGN/Web3Icons SVG -->
                    <TraderTagBadge
                      v-if="isWhaleCaller(call)"
                      tag="whale"
                      size="sm"
                    />
                  </div>
                  <span class="text-[10px] text-muted-foreground font-mono">
                    Verified Caller
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] text-muted-foreground font-mono">
                  {{ formatRelativeTime(call.createdAt) }}
                </span>
              </div>
            </div>

            <!-- Post Message Text with Styled Interactive Cashtags -->
            <p class="text-xs sm:text-sm leading-relaxed text-foreground font-sans font-medium whitespace-pre-wrap break-words">
              <CashtagText :text="call.content" :tokens="allTokens" />
            </p>

            <!-- Quoted Callout Embed (Twitter / Pump.fun Hybrid Quote) -->
            <div
              v-if="call.quotedCallout"
              class="rounded-xl border border-border p-3 bg-black hover:bg-zinc-950 transition text-xs space-y-1.5 cursor-pointer"
              @click.stop="router.push(`/post/${call.quotedCallout.id}`)"
            >
              <div class="flex items-center gap-1.5">
                <Jazzicon :address="call.quotedCallout.authorAddress" :size="16" class="rounded-full" />
                <span class="font-bold text-foreground font-mono">
                  {{ getUserIdentity(call.quotedCallout.authorAddress).displayName }}
                </span>
                <span v-if="call.quotedCallout.tokenSymbol" class="text-primary font-bold font-mono">
                  ${{ call.quotedCallout.tokenSymbol }}
                </span>
                <span class="text-muted-foreground text-[10px]">&middot;</span>
                <span class="text-[10px] text-muted-foreground font-mono">
                  {{ formatRelativeTime(call.quotedCallout.createdAt) }}
                </span>
              </div>
              <p class="text-xs text-muted-foreground font-sans">
                <CashtagText :text="call.quotedCallout.content" :tokens="allTokens" />
              </p>
            </div>

            <!-- Attached Media Image -->
            <div
              v-if="call.imageUrl"
              class="rounded-xl overflow-hidden border border-border max-h-72 cursor-pointer bg-black"
              @click.stop="openImage(call.imageUrl)"
            >
              <img :src="resolveSafeUrl(call.imageUrl)" alt="Attachment" class="w-full h-full object-cover hover:scale-[1.01] transition-transform" />
            </div>

            <!-- Signature Web3 Token Card Widget -->
            <div
              class="p-3.5 rounded-xl border border-border bg-black hover:bg-zinc-950 transition cursor-pointer flex items-center justify-between gap-3 text-xs font-mono shadow-2xs"
              @click.stop="navigateToToken(call.tokenAddress)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <OptimizedImage
                  :src="call.tokenLogo"
                  :alt="call.tokenName || 'Token'"
                  :fallback-text="call.tokenSymbol || 'TOK'"
                  :width="36"
                  :height="36"
                  class="rounded-full border border-border/70 shrink-0 shadow-2xs"
                />
                <div class="min-w-0 leading-tight space-y-0.5">
                  <div class="flex items-center gap-1.5">
                    <span class="font-black text-foreground text-xs sm:text-sm">
                      ${{ call.tokenSymbol || 'TOKEN' }}
                    </span>
                    <button
                      type="button"
                      class="p-0.5 rounded transition-transform hover:scale-110 cursor-pointer select-none"
                      :class="isPinned(call.tokenAddress) ? 'text-amber-400' : 'text-muted-foreground/35 hover:text-amber-400'"
                      :title="isPinned(call.tokenAddress) ? 'Unpin coin' : 'Pin to Watchlist'"
                      @click.stop="togglePin(call.tokenAddress)"
                    >
                      <Star
                        class="w-3.5 h-3.5"
                        :class="isPinned(call.tokenAddress) ? 'fill-amber-400 text-amber-400' : ''"
                      />
                    </button>
                    <!-- GMGN Chain Badge -->
                    <span
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-mono font-bold"
                      :class="
                        getTokenNetwork(call.tokenAddress).chainId === 5042
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      "
                      :title="getTokenNetwork(call.tokenAddress).name"
                    >
                      <img
                        :src="getTokenNetwork(call.tokenAddress).chainId === 5042 ? '/chains/arc.svg' : '/chains/robinhood.svg'"
                        :alt="getTokenNetwork(call.tokenAddress).name"
                        class="w-2.5 h-2.5 object-contain"
                      />
                      {{ getTokenNetwork(call.tokenAddress).chainId === 5042 ? 'ARC' : 'RH' }}
                    </span>
                    <span class="text-[10px] text-muted-foreground truncate hidden sm:inline font-sans">
                      {{ call.tokenName }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>MC: <strong class="text-foreground">${{ formatCompactUsd(call.tokenMarketCapUsd ?? 4200) }}</strong></span>
                    <span v-if="call.targetMcap" class="text-emerald-500 font-bold truncate">
                      Target: {{ call.targetMcap }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Caller Financial Position & Trade Button -->
              <div class="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <span class="text-[9px] text-muted-foreground block uppercase font-bold">Position</span>
                  <span class="text-xs font-bold text-foreground">
                    {{ call.positionUsd ? `$${call.positionUsd.toFixed(1)}` : 'Holding' }}
                  </span>
                </div>
                <div v-if="call.profitUsd !== undefined">
                  <span class="text-[9px] text-muted-foreground block uppercase font-bold">Profit</span>
                  <span
                    class="text-xs font-bold"
                    :class="call.profitUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                  >
                    {{ call.profitUsd >= 0 ? '+' : '' }}${{ call.profitUsd.toFixed(1) }}
                  </span>
                </div>
                <Button
                  size="sm"
                  class="h-7 px-3 text-xs font-bold rounded-lg cursor-pointer bg-primary text-primary-foreground hover:opacity-90 shadow-2xs"
                  @click.stop="navigateToToken(call.tokenAddress)"
                >
                  Trade
                </Button>
              </div>
            </div>

            <!-- Hybrid Social Action Bar -->
            <div
              class="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground font-mono"
              @click.stop
            >
              <!-- 1. Reply / Thread -->
              <button
                type="button"
                class="flex items-center gap-1.5 hover:text-foreground transition cursor-pointer select-none"
                title="View discussion thread & replies"
                @click="openThreadModal(call)"
              >
                <MessageCircle class="w-3.5 h-3.5" />
                <span>{{ call.repliesCount || 0 }}</span>
              </button>

              <!-- 2. Repost & Quote Dropdown -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    type="button"
                    class="flex items-center gap-1.5 hover:text-emerald-500 transition cursor-pointer select-none"
                    :class="call.isRepostedByViewer ? 'text-emerald-500 font-bold' : ''"
                    title="Repost or Quote"
                  >
                    <Repeat class="w-3.5 h-3.5" />
                    <span>{{ (call.repostsCount || 0) + (call.quotesCount || 0) }}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" class="w-36 font-mono text-xs">
                  <DropdownMenuItem class="cursor-pointer gap-2" @click="handleRepost(call.id)">
                    <Repeat class="w-3.5 h-3.5 text-emerald-500" />
                    <span>{{ call.isRepostedByViewer ? 'Undo Repost' : 'Repost' }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem class="cursor-pointer gap-2" @click="openQuoteModal(call)">
                    <Quote class="w-3.5 h-3.5 text-primary" />
                    <span>Quote</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <!-- 3. Like -->
              <button
                type="button"
                class="flex items-center gap-1.5 hover:text-rose-500 transition cursor-pointer select-none"
                :class="call.isLikedByViewer ? 'text-rose-500 font-bold' : ''"
                title="Like"
                @click="handleLike(call.id)"
              >
                <Heart
                  class="w-3.5 h-3.5"
                  :class="call.isLikedByViewer ? 'fill-rose-500 text-rose-500' : ''"
                />
                <span>{{ call.likesCount }}</span>
              </button>

              <!-- 4. Total Views (Display only, strictly NOT clickable) -->
              <div
                class="flex items-center gap-1.5 text-muted-foreground select-none cursor-default"
                title="Total impressions & views"
              >
                <BarChart2 class="w-3.5 h-3.5 opacity-70" />
                <span>{{ formatViews(call.viewsCount || 0) }}</span>
              </div>

              <!-- 5. Share Sheet -->
              <button
                type="button"
                class="flex items-center gap-1 hover:text-foreground transition cursor-pointer select-none"
                title="Share Sheet"
                @click="openShareModal(call)"
              >
                <Share2 class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Share</span>
              </button>
            </div>
          </article>
        </div>

        <!-- Pagination -->
        <div v-if="networkCallouts.length > pageSize" class="flex justify-center p-3 font-mono">
          <Pagination
            :total="networkCallouts.length"
            :items-per-page="pageSize"
            :page="currentPage"
            @update:page="currentPage = $event"
          />
        </div>
      </div>

      <!-- ============================================================
           RIGHT: Hybrid Alpha Radar & Trending Movers
           ============================================================ -->
      <aside class="space-y-4 font-mono text-xs">
        <!-- Quick Search Pill -->
        <div class="relative w-full">
          <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search feed, cashtags..."
            class="w-full h-9 pl-9 pr-4 text-xs rounded-xl bg-card border border-border/80 focus:border-primary focus:bg-background outline-none transition text-foreground placeholder:text-muted-foreground shadow-2xs font-mono"
          />
        </div>

        <!-- Hot Movers on Call Widget -->
        <div class="rounded-2xl border border-border/80 bg-card/70 p-4 space-y-3 shadow-2xs">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-xs text-foreground flex items-center gap-1.5">
              <Flame class="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Hot Tokens on Call</span>
            </h2>
            <span class="text-[9px] text-muted-foreground uppercase font-bold">Dex Movers</span>
          </div>

          <Empty
            v-if="hotTokens.length === 0"
            title="No hot movers"
            description="No trending tokens on this chain today."
            class="py-6 border-none bg-muted/20"
          >
            <template #icon>
              <Flame class="w-5 h-5 text-muted-foreground" />
            </template>
          </Empty>
          <div v-else class="space-y-2">
            <div
              v-for="(tItem, idx) in hotTokens"
              :key="tItem.token.address"
              class="flex items-center justify-between hover:bg-muted/50 p-2 rounded-xl transition cursor-pointer"
              @click="navigateToToken(tItem.token.address)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-[10px] font-bold text-muted-foreground w-4 text-center">
                  #{{ idx + 1 }}
                </span>
                <OptimizedImage
                  :src="tItem.token.logo"
                  :alt="tItem.token.name"
                  :fallback-text="tItem.token.symbol"
                  :width="26"
                  :height="26"
                  class="rounded-full shrink-0 border border-border/60"
                />
                <div class="min-w-0">
                  <span class="font-black text-foreground text-xs block">
                    ${{ tItem.token.symbol }}
                  </span>
                  <span class="text-[10px] text-muted-foreground truncate block font-sans">
                    {{ tItem.token.name }}
                  </span>
                </div>
              </div>

              <div class="text-right shrink-0">
                <span class="font-bold text-foreground block text-xs">
                  ${{ formatCompactUsd(tItem.marketData?.marketCapUsd || 4200) }}
                </span>
                <span
                  class="text-[10px] font-bold"
                  :class="(tItem.marketData?.priceChange24h ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                >
                  {{ (tItem.marketData?.priceChange24h ?? 0) >= 0 ? '+' : '' }}{{ (tItem.marketData?.priceChange24h ?? 0).toFixed(1) }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Modals & Sheets -->
    <ShareModal
      :is-open="isShareModalOpen"
      :call="activeShareCall"
      @close="isShareModalOpen = false"
    />

    <ThreadModal
      :is-open="isThreadModalOpen"
      :target-call="activeThreadCall"
      :account="account"
      :tokens="allTokens"
      @close="isThreadModalOpen = false"
      @toggle-like="handleLike"
      @toggle-repost="handleRepost"
      @share="openShareModal"
      @reply-posted="onReplyPosted"
    />

    <QuoteModal
      :is-open="isQuoteModalOpen"
      :target-call="activeQuoteCall"
      :account="account"
      @close="isQuoteModalOpen = false"
      @quote-posted="onQuotePosted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useWallet } from '@/composables/useWallet';
import { useTokenStore } from '@/composables/useTokenStore';
import { useFeed, isWhaleCaller, type FeedFilterType } from '@/composables/useFeed';
import {
  Search,
  Loader2,
  Heart,
  Repeat,
  Quote,
  Share2,
  BarChart2,
  Sparkles,
  ChevronDown,
  MessageCircle,
  Image as ImageIcon,
  AlertCircle,
  Megaphone,
  Flame,
  ShieldCheck,
  X,
  Link2,
  Star,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Badge, TraderTagBadge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Jazzicon } from '@/components/ui/avatar';
import CashtagText from './CashtagText.vue';
import ShareModal from './ShareModal.vue';
import ThreadModal from './ThreadModal.vue';
import QuoteModal from './QuoteModal.vue';
import { shortenAddress, formatRelativeTime, formatCompactUsd } from '@/lib/utils';
import { getUserIdentity } from '@/lib/username';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';
import { toast } from '@/components/ui/sonner';
import type { FeedCalloutItem, LaunchedTokenEntity } from '@proto/shared-types';

const emit = defineEmits<{
  (e: 'select-token', address: string): void;
}>();

const router = useRouter();
const { account, openWallet, activeNetwork } = useWallet();
const {
  tokens: allTokens,
  networkTokens,
  isTokenOnActiveNetwork,
  getTokenNetwork,
  fetchTokens,
} = useTokenStore();
const {
  callouts,
  loading,
  activeFilter,
  searchQuery,
  currentPage,
  pageSize,
  filteredCallouts,
  fetchFeed,
  postCallout,
  toggleLike,
  toggleRepost,
} = useFeed();

// Centralized network-filtered callouts (driven by Navbar active network)
const networkCallouts = computed(() => {
  if (allTokens.value.length === 0) return filteredCallouts.value;
  return filteredCallouts.value.filter((c) => isTokenOnActiveNetwork(c.tokenAddress));
});

const paginatedCallouts = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return networkCallouts.value.slice(start, start + pageSize);
});

watch(activeNetwork, () => {
  currentPage.value = 1;
  if (networkTokens.value.length > 0) {
    selectedToken.value = networkTokens.value[0].token;
    checkCallerPosition(selectedToken.value.address);
  } else {
    selectedToken.value = null;
  }
});

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

// Social Modals state
const isShareModalOpen = ref(false);
const activeShareCall = ref<FeedCalloutItem | null>(null);

const isThreadModalOpen = ref(false);
const activeThreadCall = ref<FeedCalloutItem | null>(null);

const isQuoteModalOpen = ref(false);
const activeQuoteCall = ref<FeedCalloutItem | null>(null);

function openShareModal(call: FeedCalloutItem): void {
  activeShareCall.value = call;
  isShareModalOpen.value = true;
}

function openThreadModal(call: FeedCalloutItem): void {
  activeThreadCall.value = call;
  isThreadModalOpen.value = true;
}

function openQuoteModal(call: FeedCalloutItem): void {
  activeQuoteCall.value = call;
  isQuoteModalOpen.value = true;
}

async function handleRepost(commentId: string): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  const result = await toggleRepost(commentId, account.value);
  if (result) {
    toast.success(result.reposted ? 'Reposted!' : 'Removed repost');
  }
}

function onReplyPosted(reply: FeedCalloutItem): void {
  if (activeThreadCall.value) {
    activeThreadCall.value.repliesCount = (activeThreadCall.value.repliesCount || 0) + 1;
  }
  const rootItem = callouts.value.find((c) => c.id === reply.parentId);
  if (rootItem) {
    rootItem.repliesCount = (rootItem.repliesCount || 0) + 1;
  }
}

async function onQuotePosted(): Promise<void> {
  await fetchFeed(account.value || undefined);
}

// Composer state
const composerContent = ref('');
const composerTargetMcap = ref('$100K MC');
const composerImageUrl = ref('');
const composerImagePreview = ref('');
const pendingMediaFile = ref<File | null>(null);
const mediaFileInputRef = ref<HTMLInputElement | null>(null);
const isUploadingMedia = ref(false);
const showMediaInput = ref(false);
const isPostingCall = ref(false);
const composerError = ref<string | null>(null);
const isTokenPickerOpen = ref(false);
const tokenSearchQuery = ref('');
const selectedToken = ref<LaunchedTokenEntity | null>(null);
const callerTokenBalance = ref<number>(0);
const checkingBalance = ref(false);

function triggerMediaUpload(): void {
  mediaFileInputRef.value?.click();
}

async function handleMediaFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    await processMediaFile(input.files[0]);
  }
}

async function processMediaFile(file: File): Promise<void> {
  composerError.value = null;
  if (!file.type.startsWith('image/')) {
    composerError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    composerError.value = 'Image size must be less than 8MB.';
    return;
  }

  try {
    // Generate instant local preview immediately (zero delay / no immediate network upload)
    const processed = await compressAndConvertToWebp(file, 1200, 0.85);
    composerImagePreview.value = processed.dataUrl;
    pendingMediaFile.value = processed.file;
  } catch (err) {
    console.warn('[Feed] Local compression failed, using direct object URL preview:', err);
    composerImagePreview.value = URL.createObjectURL(file);
    pendingMediaFile.value = file;
  }
}

function removeAttachedImage(): void {
  composerImagePreview.value = '';
  composerImageUrl.value = '';
  pendingMediaFile.value = null;
  if (mediaFileInputRef.value) mediaFileInputRef.value.value = '';
}

// Live Cashtag ($) Autocomplete State
const composerTextarea = ref<HTMLTextAreaElement | null>(null);
const showCashtagSuggestions = ref(false);
const cashtagQuery = ref('');
const selectedSuggestionIndex = ref(0);

const cashtagSuggestions = computed(() => {
  if (!showCashtagSuggestions.value) return [];
  const q = cashtagQuery.value.trim().toLowerCase();
  const pool = networkTokens.value;
  if (!q) return pool.slice(0, 8);
  return pool
    .filter(
      (t) =>
        t.token.symbol.toLowerCase().includes(q) ||
        t.token.name.toLowerCase().includes(q) ||
        t.token.address.toLowerCase().includes(q),
    )
    .slice(0, 8);
});

function handleComposerInput(): void {
  const textarea = composerTextarea.value;
  const cursor = textarea ? textarea.selectionStart : composerContent.value.length;
  const textBeforeCursor = composerContent.value.slice(0, cursor);

  // Match the latest $ trigger (e.g. "$", "$SP", etc.)
  const match = textBeforeCursor.match(/(?:^|\s)\$([a-zA-Z0-9_]*)$/);

  if (match) {
    showCashtagSuggestions.value = true;
    cashtagQuery.value = match[1];
    selectedSuggestionIndex.value = 0;
  } else {
    showCashtagSuggestions.value = false;
  }

  // Auto-detect if user typed full cashtag, e.g. $SPIDER
  const symbols = networkTokens.value;
  for (const item of symbols) {
    const regex = new RegExp(`\\$${item.token.symbol}\\b`, 'i');
    if (regex.test(composerContent.value)) {
      selectedToken.value = item.token;
      checkCallerPosition(item.token.address);
      break;
    }
  }
}

function handleComposerKeydown(e: KeyboardEvent): void {
  if (!showCashtagSuggestions.value || cashtagSuggestions.value.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggestionIndex.value =
      (selectedSuggestionIndex.value + 1) % cashtagSuggestions.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggestionIndex.value =
      (selectedSuggestionIndex.value - 1 + cashtagSuggestions.value.length) %
      cashtagSuggestions.value.length;
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    const token = cashtagSuggestions.value[selectedSuggestionIndex.value]?.token;
    if (token) {
      selectCashtagToken(token);
    }
  } else if (e.key === 'Escape') {
    showCashtagSuggestions.value = false;
  }
}

function selectCashtagToken(token: LaunchedTokenEntity): void {
  const textarea = composerTextarea.value;
  const cursor = textarea ? textarea.selectionStart : composerContent.value.length;
  const textBeforeCursor = composerContent.value.slice(0, cursor);
  const textAfterCursor = composerContent.value.slice(cursor);

  // Replace the latest $... trigger with the full $SYMBOL
  const replacedBefore = textBeforeCursor.replace(/(?:^|\s)\$([a-zA-Z0-9_]*)$/, (m) => {
    const leadingSpace = m.startsWith(' ') || m.startsWith('\n') ? m[0] : '';
    return `${leadingSpace}$${token.symbol} `;
  });

  composerContent.value = `${replacedBefore}${textAfterCursor}`;
  selectedToken.value = token;
  showCashtagSuggestions.value = false;
  checkCallerPosition(token.address);

  setTimeout(() => {
    if (textarea) {
      textarea.focus();
      const nextPos = replacedBefore.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }
  }, 10);
}

function formatViews(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val || 0);
}

async function checkCallerPosition(tokenAddress: string): Promise<void> {
  if (!account.value || !tokenAddress) {
    callerTokenBalance.value = 0;
    return;
  }
  checkingBalance.value = true;
  try {
    const res = await fetch(`/api/tokens/${tokenAddress}/balance?account=${account.value}`);
    const data = await res.json();
    if (data.success && data.data) {
      callerTokenBalance.value = Number(data.data.balance || 0);
    } else {
      callerTokenBalance.value = 0;
    }
  } catch {
    callerTokenBalance.value = 0;
  } finally {
    checkingBalance.value = false;
  }
}

const filterTabs = computed<Array<{ key: FeedFilterType; label: string }>>(() => [
  { key: 'all', label: 'All Calls' },
  { key: 'target', label: 'Targets' },
  { key: 'whale', label: 'Whales' },
  { key: 'profit', label: 'In Profit' },
  { key: 'media', label: 'Media' },
]);

function handleFilterClick(key: FeedFilterType): void {
  activeFilter.value = key;
  currentPage.value = 1;
}

const availableTokensList = computed(() => {
  if (!networkTokens.value) return [];
  if (!tokenSearchQuery.value.trim()) return networkTokens.value.slice(0, 15);
  const q = tokenSearchQuery.value.trim().toLowerCase();
  return networkTokens.value
    .filter(
      (tItem) =>
        tItem.token.symbol.toLowerCase().includes(q) ||
        tItem.token.name.toLowerCase().includes(q) ||
        tItem.token.address.toLowerCase().includes(q),
    )
    .slice(0, 15);
});

const hotTokens = computed(() => {
  if (!networkTokens.value) return [];
  return [...networkTokens.value]
    .sort((a, b) => (b.marketData?.marketCapUsd ?? 0) - (a.marketData?.marketCapUsd ?? 0))
    .slice(0, 5);
});

function detectTokenFromContent(text: string): LaunchedTokenEntity | null {
  const match = text.match(/\$([a-zA-Z0-9_]+)/);
  if (!match) return null;
  const symbol = match[1].toLowerCase();
  const pool = networkTokens.value;
  const found = pool.find(
    (t) => t.token.symbol.toLowerCase() === symbol || t.token.name.toLowerCase() === symbol,
  );
  return found ? found.token : null;
}

watch(composerContent, (newVal) => {
  const detected = detectTokenFromContent(newVal);
  if (detected && (!selectedToken.value || selectedToken.value.address !== detected.address)) {
    selectedToken.value = detected;
    checkCallerPosition(detected.address);
  } else if (!detected && !newVal.includes('$')) {
    selectedToken.value = null;
    callerTokenBalance.value = 0;
  }
});

const callerPositionUsd = computed(() => {
  if (!selectedToken.value || callerTokenBalance.value <= 0) return 0;
  const item = networkTokens.value.find((t) => t.token.address === selectedToken.value?.address);
  const price = item?.marketData?.priceUsd || 0;
  return callerTokenBalance.value * price;
});

function pickToken(token: LaunchedTokenEntity): void {
  selectedToken.value = token;
  isTokenPickerOpen.value = false;
  checkCallerPosition(token.address);
  if (!composerContent.value) {
    composerContent.value = `$${token.symbol} `;
  }
}

async function submitCallout(): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  const content = composerContent.value.trim();
  if (!content) return;

  const targetToken = selectedToken.value || detectTokenFromContent(content) || (networkTokens.value?.[0]?.token ?? null);
  if (!targetToken) {
    composerError.value = 'Please mention a token (e.g. $TOKEN) or launch one first.';
    return;
  }

  isPostingCall.value = true;
  composerError.value = null;

  try {
    let finalImageUrl = composerImageUrl.value.trim() || undefined;

    // Upload pending media in background on submit
    if (pendingMediaFile.value) {
      isUploadingMedia.value = true;
      try {
        const formData = new FormData();
        formData.append('file', pendingMediaFile.value);
        const res = await fetch('/api/ipfs/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const ipfsUri =
            data.data?.cid ? `ipfs://${data.data.cid}` : data.data?.uri || data.data?.url || '';
          if (ipfsUri) {
            finalImageUrl = ipfsUri;
          }
        }
      } catch (uploadErr) {
        console.warn('[Feed] IPFS upload on submit fallback:', uploadErr);
        if (!finalImageUrl && composerImagePreview.value) {
          finalImageUrl = composerImagePreview.value;
        }
      } finally {
        isUploadingMedia.value = false;
      }
    }

    const created = await postCallout({
      tokenAddress: targetToken.address,
      authorAddress: account.value,
      content,
      imageUrl: finalImageUrl,
      targetMcap: composerTargetMcap.value,
    });
    if (created) {
      toast.success(`Posted call on $${targetToken.symbol}!`);
      composerContent.value = '';
      composerImageUrl.value = '';
      composerImagePreview.value = '';
      pendingMediaFile.value = null;
      showMediaInput.value = false;
      await fetchFeed(account.value);
    }
  } catch (err) {
    composerError.value = (err as Error).message || 'Failed to post callout.';
  } finally {
    isPostingCall.value = false;
  }
}

async function handleLike(commentId: string): Promise<void> {
  if (!account.value) {
    openWallet();
    return;
  }
  await toggleLike(commentId, account.value);
}

function navigateToToken(address: string): void {
  if (address) {
    emit('select-token', address);
    router.push(`/launchpad/${address}`);
  }
}

function navigateToCaller(address: string): void {
  if (address) {
    router.push(`/${getUserIdentity(address).name}`);
  }
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

function openImage(url?: string): void {
  if (url && typeof window !== 'undefined') {
    window.open(resolveSafeUrl(url), '_blank', 'noopener,noreferrer');
  }
}

onMounted(async () => {
  loadPinnedTokens();
  await Promise.allSettled([fetchFeed(account.value || undefined), fetchTokens()]);
  if (networkTokens.value?.length > 0 && !selectedToken.value) {
    selectedToken.value = networkTokens.value[0].token;
  }
});
</script>
