<template>
  <div class="max-w-4xl mx-auto space-y-8 py-2 sm:py-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">{{ t('launchToken') }}</h1>
      <p class="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
        {{ selectedVersion === 'v2' ? t('v2Subtitle') : t('v1Subtitle') }}
      </p>
    </div>

    <!-- Form container using Shadcn Card -->
    <Card class="p-4 sm:p-8 lg:p-10 border border-border bg-card shadow-sm rounded-3xl">
      <!-- Dual Launch Architecture Tabs (v2 / v1) -->
      <div class="mb-8 p-1.5 bg-muted rounded-2xl flex gap-2 border border-border">
        <Button
          type="button"
          @click="selectedVersion = 'v2'"
          :variant="selectedVersion === 'v2' ? 'default' : 'ghost'"
          size="sm"
          class="flex-1 text-xs font-semibold transition-all cursor-pointer"
        >
          <span>{{ t('v2BondingCurveTab') }}</span>
        </Button>
        <Button
          type="button"
          @click="selectedVersion = 'v1'"
          :variant="selectedVersion === 'v1' ? 'default' : 'ghost'"
          size="sm"
          class="flex-1 text-xs font-semibold transition-all cursor-pointer"
        >
          <span>{{ t('v1DirectPoolTab') }}</span>
        </Button>
      </div>

      <form @submit.prevent="handleLaunch" class="space-y-7">
        <!-- Top Info Section: Image on the side + Name, Ticker, Description -->
        <div class="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          <!-- Token Image Dropzone (Side Column) -->
          <div class="space-y-2 w-full sm:w-48 shrink-0">
            <Label>{{ t('tokenImage') }}</Label>
            <div
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="handleDrop"
              :class="[
                'relative border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden p-3 aspect-square w-full sm:w-48 h-48 group',
                dragOver
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/60 bg-muted/30',
              ]"
              @click="triggerFileInput"
            >
              <input
                ref="fileInputRef"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="hidden"
                @change="handleFileChange"
              />

              <!-- Preview with Trash Icon Button on top right -->
              <template v-if="imagePreview">
                <img
                  :src="imagePreview"
                  alt="Preview"
                  class="w-full h-full object-cover rounded-xl"
                />

                <!-- Trash button on top-right of image using Shadcn Button -->
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  class="absolute top-2 right-2 z-10 w-7 h-7 rounded-full shadow-md cursor-pointer border border-white/20"
                  title="Remove image"
                  @click.stop="clearImage"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </Button>
              </template>

              <!-- Empty Upload Prompt -->
              <div
                v-else
                class="flex flex-col items-center justify-center p-2 text-zinc-400 space-y-1.5"
              >
                <div
                  class="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"
                >
                  <UploadCloud class="w-5 h-5 text-zinc-400" />
                </div>
                <span class="text-xs font-semibold text-black dark:text-white">Upload Logo</span>
                <span class="text-[10px] text-zinc-400 leading-tight"
                  >PNG, JPG, WEBP (Max 5MB)</span
                >
              </div>
            </div>

            <!-- Minimal Uploading Spinner Indicator -->
            <div
              v-if="isUploadingIpfs"
              class="flex items-center gap-1.5 text-[11px] font-mono text-amber-500 pt-0.5"
            >
              <Loader2 class="w-3 h-3 animate-spin shrink-0" />
              <span>{{ t('pinningIpfs') }}</span>
            </div>

            <!-- Image Error -->
            <div
              v-if="imageError"
              class="text-[11px] text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2"
            >
              {{ imageError }}
            </div>
          </div>

          <!-- Name, Ticker, and Description (Main Columns) -->
          <div class="flex-1 w-full space-y-5">
            <!-- Name & Ticker Row -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-2 sm:col-span-2">
                <Label for="token-name">{{ t('tokenName') }}</Label>
                <Input
                  id="token-name"
                  v-model="form.name"
                  type="text"
                  :placeholder="t('namePlaceholder')"
                  maxlength="60"
                  required
                />
              </div>

              <div class="space-y-2">
                <Label for="token-symbol">{{ t('ticker') }}</Label>
                <Input
                  id="token-symbol"
                  v-model="form.symbol"
                  type="text"
                  :placeholder="t('symbolPlaceholder')"
                  maxlength="10"
                  required
                  class="font-mono uppercase"
                />
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-2">
              <Label for="token-description">{{ t('description') }}</Label>
              <Textarea
                id="token-description"
                v-model="form.description"
                :placeholder="t('descriptionPlaceholder')"
                class="min-h-[92px] resize-none"
                :rows="3"
              />
            </div>
          </div>
        </div>

        <!-- Social Links (X, Telegram, Website) -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 pt-1">
          <div class="space-y-2">
            <Input
              id="token-x"
              v-model="form.twitter"
              type="text"
              placeholder="https://x.com/yourproject"
              class="font-mono text-xs"
            />
          </div>

          <div class="space-y-2">
            <Input
              id="token-tg"
              v-model="form.telegram"
              type="text"
              placeholder="https://t.me/yourproject"
              class="font-mono text-xs"
            />
          </div>

          <div class="space-y-2">
            <Input
              id="token-web"
              v-model="form.website"
              type="text"
              placeholder="https://yourproject.com"
              class="font-mono text-xs"
            />
          </div>
        </div>

        <!-- Paired Asset (Tied to active network selected in navigation) -->
        <div class="space-y-2 pt-1">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono text-zinc-400">
              {{ activeNetwork.name }}
            </span>
          </div>

          <div
            id="paired-asset"
            class="w-full flex items-center justify-between px-4 py-3 h-12 rounded-xl border border-border bg-card text-foreground"
          >
            <div class="flex items-center gap-2 font-mono">
              <img
                :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                :alt="currencySymbol"
                class="w-5 h-5 rounded-full object-contain shrink-0"
              />
              <span class="font-bold text-sm text-black dark:text-white">{{ currencySymbol }}</span>
            </div>
            <span class="text-[11px] font-mono text-zinc-400">
              Locked on {{ activeNetwork.name }}
            </span>
          </div>

          <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
            {{
              selectedVersion === 'v2'
                ? activeNetwork.chainId === 5042
                  ? 'Graduates once the curve raises 69,000 USDC into Uniswap liquidity.'
                  : t('v2GraduatesHint')
                : t('v1PairsHint')
            }}
          </p>
        </div>

        <!-- Developer buy -->
        <div class="space-y-2 pt-1">
          <div class="flex justify-between items-center">
            <span class="text-[11px] text-zinc-500 font-mono">
              {{ t('boughtInLaunchNotice') }}
            </span>
          </div>
          <div class="relative">
            <Input
              id="developer-buy"
              v-model="form.initialBuyEth"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00"
              class="font-mono text-sm pr-16"
            />
            <span class="absolute right-3 top-2.5 text-xs font-semibold text-zinc-400">
              {{ currencySymbol }}
            </span>
          </div>
        </div>

        <!-- Advanced Accordion -->
        <Card class="rounded-2xl border border-border bg-card overflow-hidden p-0 shadow-xs">
          <Button
            type="button"
            variant="ghost"
            @click="advancedOpen = !advancedOpen"
            class="w-full flex items-center justify-between px-5 py-4 h-auto text-xs font-semibold transition hover:bg-muted/40 cursor-pointer rounded-none"
          >
            <span>{{ t('advanced') }}</span>
            <ChevronDown
              class="w-3.5 h-3.5 transition-transform duration-200 opacity-60"
              :class="advancedOpen ? 'rotate-180' : ''"
            />
          </Button>

          <div v-show="advancedOpen" class="p-6 sm:p-7 space-y-7 border-t border-border">
            <!-- Connected Creator Wallet -->
            <div class="space-y-2">
              <div class="flex items-center gap-1.5">
                <Label class="text-xs font-semibold">{{ t('creatorWallet') }}</Label>
                <InfoTooltip
                  text="Receives creator fees, initial token supply allocations, and governance permissions. Defaults to the deployer wallet if left blank."
                />
              </div>
              <div
                class="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-border bg-muted/30 font-mono text-xs"
              >
                <span class="truncate">{{ account || t('connectWallet') }}</span>
                <Badge variant="secondary" class="text-[10px] shrink-0"
                  >Deployer (msg.sender)</Badge
                >
              </div>
              <p class="text-[10px] text-zinc-400">
                {{ t('creatorWalletDesc') }}
              </p>
            </div>

            <!-- Trading Taxes (Buy & Sell Tax) with Quick Presets -->
            <div class="space-y-3.5 pt-4 border-t border-border">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <Label class="text-xs font-semibold text-black dark:text-white"
                    >Trading Taxes</Label
                  >
                  <InfoTooltip
                    text="Taxes collected on automated market maker (DEX) swaps (max 10% per trade). Funds project development, liquidity deepening, and holder dividends."
                  />
                </div>
                <span class="text-[10px] font-mono text-zinc-400">Max 10% per trade</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <!-- Buy Tax with Slider -->
                <div class="space-y-3.5 p-4 sm:p-5 rounded-2xl border border-border bg-card">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1">
                      <span class="text-xs font-medium text-black dark:text-white">Buy Tax</span>
                      <InfoTooltip
                        text="Fee deducted when users purchase tokens. Recommended: 1% - 5%."
                      />
                    </div>
                    <span class="text-xs font-mono font-bold text-[#34C759]"
                      >{{ form.buyTax }}%</span
                    >
                  </div>
                  <Slider
                    :model-value="[parseFloat(form.buyTax || '0')]"
                    :max="10"
                    :min="0"
                    :step="0.5"
                    range-class="bg-[#34C759]"
                    thumb-class="border-[#34C759] focus-visible:ring-[#34C759]"
                    class="py-1"
                    @update:model-value="form.buyTax = String($event ? $event[0] : 0)"
                  />
                  <div class="flex items-center gap-1.5 pt-1">
                    <Button
                      v-for="p in [1, 2, 5, 10]"
                      :key="p"
                      type="button"
                      size="sm"
                      :variant="form.buyTax === String(p) ? 'default' : 'outline'"
                      class="flex-1 h-7 text-xs font-mono p-0 cursor-pointer"
                      @click="form.buyTax = String(p)"
                    >
                      {{ p }}%
                    </Button>
                  </div>
                </div>

                <!-- Sell Tax with Slider -->
                <div class="space-y-3.5 p-4 sm:p-5 rounded-2xl border border-border bg-card">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1">
                      <span class="text-xs font-medium text-black dark:text-white">Sell Tax</span>
                      <InfoTooltip
                        text="Fee deducted when users sell tokens back into the pool. Discourages immediate dumping."
                      />
                    </div>
                    <span class="text-xs font-mono font-bold text-[#FF3B30]"
                      >{{ form.sellTax }}%</span
                    >
                  </div>
                  <Slider
                    :model-value="[parseFloat(form.sellTax || '0')]"
                    :max="10"
                    :min="0"
                    :step="0.5"
                    range-class="bg-[#FF3B30]"
                    thumb-class="border-[#FF3B30] focus-visible:ring-[#FF3B30]"
                    class="py-1"
                    @update:model-value="form.sellTax = String($event ? $event[0] : 0)"
                  />
                  <div class="flex items-center gap-1.5 pt-1">
                    <Button
                      v-for="p in [1, 2, 5, 10]"
                      :key="p"
                      type="button"
                      size="sm"
                      :variant="form.sellTax === String(p) ? 'destructive' : 'outline'"
                      class="flex-1 h-7 text-xs font-mono p-0 cursor-pointer"
                      @click="form.sellTax = String(p)"
                    >
                      {{ p }}%
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Revenue Split Allocation -->
            <div class="space-y-4 pt-4 border-t border-border">
              <div class="flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-1.5">
                    <Label class="text-xs font-semibold text-black dark:text-white"
                      >Revenue Split</Label
                    >
                    <InfoTooltip
                      text="Specifies how collected trading taxes are distributed on-chain. Allocations must sum to exactly 100% to launch."
                    />
                  </div>
                  <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Fee allocation (must total 100%)
                  </p>
                </div>
                <Badge
                  :variant="totalSplit === 100 ? 'default' : 'outline'"
                  class="font-mono text-xs"
                  :class="totalSplit !== 100 ? 'border-amber-500 text-amber-500' : ''"
                >
                  {{ totalSplit }}/100%
                </Badge>
              </div>

              <!-- Quick Presets with Shadcn Button -->
              <div class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  :variant="
                    revenueSplit.creator === 50 &&
                    revenueSplit.holders === 50 &&
                    revenueSplit.buyback === 0 &&
                    revenueSplit.growth === 0
                      ? 'default'
                      : 'outline'
                  "
                  class="h-7 text-xs font-mono cursor-pointer"
                  @click="applySplitPreset(50, 0, 50, 0)"
                >
                  <span class="hidden sm:inline">50/50 Creator & Holders</span>
                  <span class="sm:hidden">50/50 Split</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  :variant="
                    revenueSplit.creator === 100 &&
                    revenueSplit.holders === 0 &&
                    revenueSplit.buyback === 0 &&
                    revenueSplit.growth === 0
                      ? 'default'
                      : 'outline'
                  "
                  class="h-7 text-xs font-mono cursor-pointer"
                  @click="applySplitPreset(100, 0, 0, 0)"
                >
                  100% Creator
                </Button>
                <Button
                  type="button"
                  size="sm"
                  :variant="
                    revenueSplit.creator === 40 &&
                    revenueSplit.holders === 40 &&
                    revenueSplit.buyback === 20 &&
                    revenueSplit.growth === 0
                      ? 'default'
                      : 'outline'
                  "
                  class="h-7 text-xs font-mono cursor-pointer"
                  @click="applySplitPreset(40, 20, 40, 0)"
                >
                  <span class="hidden sm:inline">40/40/20 Buyback</span>
                  <span class="sm:hidden">40/40/20</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  :variant="
                    revenueSplit.creator === 25 &&
                    revenueSplit.holders === 25 &&
                    revenueSplit.buyback === 25 &&
                    revenueSplit.growth === 25
                      ? 'default'
                      : 'outline'
                  "
                  class="h-7 text-xs font-mono cursor-pointer"
                  @click="applySplitPreset(25, 25, 25, 25)"
                >
                  25% Equal
                </Button>
              </div>

              <!-- Donut Chart & Sliders Section -->
              <div
                class="flex flex-col lg:flex-row gap-8 items-center lg:items-start p-6 sm:p-7 rounded-2xl border border-border bg-card"
              >
                <!-- Circular Donut Chart -->
                <div class="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    <!-- Background ring -->
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="currentColor"
                      stroke-width="12"
                      fill="transparent"
                      class="text-zinc-100 dark:text-zinc-800"
                    />
                    <!-- Creator segment (Emerald) -->
                    <circle
                      v-if="revenueSplit.creator > 0"
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#34C759"
                      stroke-width="12"
                      fill="transparent"
                      :stroke-dasharray="`${creatorStroke} ${donutCircumference}`"
                      :stroke-dashoffset="creatorOffset"
                      class="transition-all duration-300"
                    />
                    <!-- Buyback segment (Rose) -->
                    <circle
                      v-if="revenueSplit.buyback > 0"
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#FF3B30"
                      stroke-width="12"
                      fill="transparent"
                      :stroke-dasharray="`${buybackStroke} ${donutCircumference}`"
                      :stroke-dashoffset="buybackOffset"
                      class="transition-all duration-300"
                    />
                    <!-- Holders segment (Violet) -->
                    <circle
                      v-if="revenueSplit.holders > 0"
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#5856D6"
                      stroke-width="12"
                      fill="transparent"
                      :stroke-dasharray="`${holdersStroke} ${donutCircumference}`"
                      :stroke-dashoffset="holdersOffset"
                      class="transition-all duration-300"
                    />
                    <!-- Growth segment (Sky) -->
                    <circle
                      v-if="revenueSplit.growth > 0"
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#5AC8FA"
                      stroke-width="12"
                      fill="transparent"
                      :stroke-dasharray="`${growthStroke} ${donutCircumference}`"
                      :stroke-dashoffset="growthOffset"
                      class="transition-all duration-300"
                    />
                  </svg>

                  <!-- Center Text inside Donut -->
                  <div
                    class="absolute inset-0 flex flex-col items-center justify-center text-center select-none"
                  >
                    <span
                      class="text-lg font-mono font-bold leading-tight"
                      :class="totalSplit === 100 ? 'text-emerald-500' : 'text-amber-500'"
                    >
                      {{ totalSplit }}%
                    </span>
                    <span class="text-[9px] font-mono text-zinc-400 uppercase tracking-wider"
                      >Split</span
                    >
                  </div>
                </div>

                <!-- 4 Allocation Share Sliders -->
                <div class="flex-1 w-full space-y-5">
                  <!-- Creator Share Slider -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2 font-semibold text-foreground">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#34C759] shrink-0" />
                        <span>Creator</span>
                        <InfoTooltip
                          text="Portion of swap taxes sent directly to the creator wallet."
                        />
                      </div>
                      <span class="font-mono font-bold text-[#34C759]">
                        {{ revenueSplit.creator }}%
                      </span>
                    </div>
                    <Slider
                      :model-value="[revenueSplit.creator]"
                      :max="100"
                      :min="0"
                      :step="1"
                      range-class="bg-[#34C759]"
                      thumb-class="border-[#34C759] focus-visible:ring-[#34C759]"
                      @update:model-value="updateShare('creator', $event ? $event[0] : 0)"
                    />
                    <div
                      class="flex items-center justify-between text-[10px] text-zinc-400 font-mono"
                    >
                      <span>max {{ maxCreator }}%: the other shares leave this much</span>
                      <span>{{ revenueSplit.creator }}/{{ maxCreator }}%</span>
                    </div>
                  </div>

                  <!-- Buyback & Burn Slider -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2 font-semibold text-foreground">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#FF3B30] shrink-0" />
                        <span>Buyback & Burn</span>
                        <InfoTooltip
                          text="Automatically buys tokens off the pool and permanently burns them to reduce supply."
                        />
                      </div>
                      <span class="font-mono font-bold text-[#FF3B30]">
                        {{ revenueSplit.buyback }}%
                      </span>
                    </div>
                    <Slider
                      :model-value="[revenueSplit.buyback]"
                      :max="100"
                      :min="0"
                      :step="1"
                      range-class="bg-[#FF3B30]"
                      thumb-class="border-[#FF3B30] focus-visible:ring-[#FF3B30]"
                      @update:model-value="updateShare('buyback', $event ? $event[0] : 0)"
                    />
                    <div
                      class="flex items-center justify-between text-[10px] text-zinc-400 font-mono"
                    >
                      <span>max {{ maxBuyback }}%: the other shares leave this much</span>
                      <span>{{ revenueSplit.buyback }}/{{ maxBuyback }}%</span>
                    </div>
                  </div>

                  <!-- Holder Dividends Slider -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2 font-semibold text-foreground">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#5856D6] shrink-0" />
                        <span>Holder Dividends</span>
                        <InfoTooltip
                          text="Distributed proportionally in native currency to all token holders as passive yield."
                        />
                      </div>
                      <span class="font-mono font-bold text-[#5856D6]">
                        {{ revenueSplit.holders }}%
                      </span>
                    </div>
                    <Slider
                      :model-value="[revenueSplit.holders]"
                      :max="100"
                      :min="0"
                      :step="1"
                      range-class="bg-[#5856D6]"
                      thumb-class="border-[#5856D6] focus-visible:ring-[#5856D6]"
                      @update:model-value="updateShare('holders', $event ? $event[0] : 0)"
                    />
                    <div
                      class="flex items-center justify-between text-[10px] text-zinc-400 font-mono"
                    >
                      <span>max {{ maxHolders }}%: the other shares leave this much</span>
                      <span>{{ revenueSplit.holders }}/{{ maxHolders }}%</span>
                    </div>
                  </div>

                  <!-- Liquidity Growth Slider -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2 font-semibold text-foreground">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#5AC8FA] shrink-0" />
                        <span>Liquidity Growth</span>
                        <InfoTooltip
                          text="Permanently injected into the liquidity pool to deepen market depth and reduce slippage."
                        />
                      </div>
                      <span class="font-mono font-bold text-[#5AC8FA]">
                        {{ revenueSplit.growth }}%
                      </span>
                    </div>
                    <Slider
                      :model-value="[revenueSplit.growth]"
                      :max="100"
                      :min="0"
                      :step="1"
                      range-class="bg-[#5AC8FA]"
                      thumb-class="border-[#5AC8FA] focus-visible:ring-[#5AC8FA]"
                      @update:model-value="updateShare('growth', $event ? $event[0] : 0)"
                    />
                    <div
                      class="flex items-center justify-between text-[10px] text-zinc-400 font-mono"
                    >
                      <span>max {{ maxGrowth }}%: the other shares leave this much</span>
                      <span>{{ revenueSplit.growth }}/{{ maxGrowth }}%</span>
                    </div>
                  </div>

                  <!-- Bottom summary info matching Argus -->
                  <div
                    class="pt-4 mt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <span class="text-zinc-500 dark:text-zinc-400">
                      Each share stops where the others leave off. They must total 100% to launch.
                    </span>
                    <span
                      class="font-mono font-semibold shrink-0"
                      :class="totalSplit === 100 ? 'text-emerald-500' : 'text-amber-500'"
                    >
                      {{
                        totalSplit === 100
                          ? 'Allocation totals 100%'
                          : `${100 - totalSplit}% remaining`
                      }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Anti-Snipe Notice -->
            <div
              class="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5"
            >
              <div
                class="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
              >
                <span>Fair Launch Anti-Snipe Safeguard</span>
                <InfoTooltip
                  text="Applies a decaying 99% snipe tax on block 0 that drops smoothly to 0% in 3 seconds to defend against MEV bots."
                />
              </div>
              <p>
                Connected creator wallet is automatically exempt from the initial 99% snipe tax.
                External purchases decay smoothly to 0% in 3 seconds.
              </p>
            </div>
          </div>
        </Card>

        <!-- Form Footer Rate & Submit Button -->
        <div class="pt-6 border-t border-border space-y-4">
          <!-- Launch Cost Summary Breakdown -->
          <div class="rounded-2xl border border-border bg-muted/40 p-4 space-y-3 text-xs font-mono">
            <div class="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span>{{ t('platformCreationFee') }}</span>
              <span class="font-bold text-black dark:text-white">
                {{ launchFeeFormatted }} {{ currencySymbol }}
              </span>
            </div>

            <div class="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span>{{ t('developerBuy') }}</span>
              <span class="font-semibold text-black dark:text-white">
                {{
                  form.initialBuyEth
                    ? Number(form.initialBuyEth).toFixed(currencySymbol === 'USDC' ? 2 : 4)
                    : (0).toFixed(currencySymbol === 'USDC' ? 2 : 4)
                }}
                {{ currencySymbol }}
              </span>
            </div>

            <div class="pt-3 border-t border-border flex items-center justify-between">
              <span
                class="font-bold text-black dark:text-white uppercase tracking-wider text-[11px]"
              >
                {{ t('totalDue') }}
              </span>
              <span class="text-sm font-bold text-emerald-500 dark:text-emerald-400">
                {{ totalPairDue }}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            :disabled="
              loading || isUploadingIpfs || !form.name || !form.symbol || totalSplit !== 100
            "
            class="w-full font-bold py-3.5 text-base h-12 rounded-xl shadow-md cursor-pointer transition active:scale-[0.99]"
            size="lg"
          >
            <Loader2 v-if="loading || isUploadingIpfs" class="w-4 h-4 mr-2 animate-spin" />
            {{
              isUploadingIpfs
                ? t('pinningIpfs')
                : loading
                  ? t('launchTokenBtn') + '...'
                  : !isConnected
                    ? t('connectWallet')
                    : totalSplit !== 100
                      ? `Allocation must total 100% (${totalSplit}%)`
                      : `${t('launchTokenBtn')} (${totalPairDue})`
            }}
          </Button>

          <div
            v-if="error"
            class="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <span>{{ error }}</span>
          </div>
        </div>
      </form>
    </Card>

    <!-- Step-by-Step Launch Progress Modal -->
    <Dialog
      :open="isModalOpen"
      @update:open="
        (val: boolean) => {
          if (!loading) closeModal();
        }
      "
    >
      <DialogContent
        class="w-[calc(100vw-2rem)] sm:max-w-lg p-6 bg-white dark:bg-[#181818] border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl"
      >
        <DialogHeader class="mb-4">
          <DialogTitle
            class="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2"
          >
            <Rocket class="w-5 h-5 text-emerald-500" />
            <span>{{ t('launchingModalTitle') }}</span>
          </DialogTitle>
          <DialogDescription class="text-xs text-stone-500 dark:text-stone-400">
            {{ form.name || 'Token' }} ({{ form.symbol || 'SYMBOL' }}) &middot;
            {{ activeNetwork.name }}
          </DialogDescription>
        </DialogHeader>

        <!-- Stepper Progress -->
        <div class="space-y-3 my-2">
          <!-- Step 1: Wallet Signature -->
          <div
            class="flex items-start gap-3 p-3 rounded-xl transition-colors"
            :class="
              launchStep === 'awaiting_signature'
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-stone-50 dark:bg-stone-900/50 border border-transparent'
            "
          >
            <div class="mt-0.5 shrink-0">
              <Loader2
                v-if="launchStep === 'awaiting_signature'"
                class="w-5 h-5 text-emerald-500 animate-spin"
              />
              <CheckCircle
                v-else-if="
                  ['broadcasting', 'confirming', 'indexing', 'success'].includes(launchStep)
                "
                class="w-5 h-5 text-emerald-500"
              />
              <Clock v-else class="w-5 h-5 text-stone-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div
                class="text-sm font-semibold text-stone-900 dark:text-white flex items-center justify-between"
              >
                <span>{{ t('launchStepSign') }}</span>
                <Badge
                  v-if="launchStep === 'awaiting_signature'"
                  variant="secondary"
                  class="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse"
                >
                  Action Required
                </Badge>
              </div>
              <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {{ t('launchStepSignDesc') }}
              </p>
            </div>
          </div>

          <!-- Step 2: Transaction Broadcasted & Block Confirmation -->
          <div
            class="flex items-start gap-3 p-3 rounded-xl transition-colors"
            :class="
              ['broadcasting', 'confirming'].includes(launchStep)
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-stone-50 dark:bg-stone-900/50 border border-transparent'
            "
          >
            <div class="mt-0.5 shrink-0">
              <Loader2
                v-if="['broadcasting', 'confirming'].includes(launchStep)"
                class="w-5 h-5 text-emerald-500 animate-spin"
              />
              <CheckCircle
                v-else-if="['indexing', 'success'].includes(launchStep)"
                class="w-5 h-5 text-emerald-500"
              />
              <AlertCircle
                v-else-if="launchStep === 'error' && launchTxHash"
                class="w-5 h-5 text-rose-500"
              />
              <Clock v-else class="w-5 h-5 text-stone-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div
                class="text-sm font-semibold text-stone-900 dark:text-white flex items-center justify-between"
              >
                <span>{{ t('launchStepConfirm') }}</span>
                <span
                  v-if="['broadcasting', 'confirming'].includes(launchStep)"
                  class="text-[10px] text-emerald-500 animate-pulse font-mono"
                >
                  Confirming...
                </span>
              </div>
              <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {{ t('launchStepConfirmDesc') }}
              </p>
              <!-- Tx Hash link -->
              <div v-if="launchTxHash" class="mt-2 flex items-center gap-2">
                <a
                  :href="txExplorerUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:text-emerald-500 text-xs font-mono transition-colors"
                >
                  <span>Tx: {{ formatHash(launchTxHash) }}</span>
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <!-- Step 3: Protocol Finalization -->
          <div
            class="flex items-start gap-3 p-3 rounded-xl transition-colors"
            :class="
              launchStep === 'indexing'
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-stone-50 dark:bg-stone-900/50 border border-transparent'
            "
          >
            <div class="mt-0.5 shrink-0">
              <Loader2
                v-if="launchStep === 'indexing'"
                class="w-5 h-5 text-emerald-500 animate-spin"
              />
              <CheckCircle v-else-if="launchStep === 'success'" class="w-5 h-5 text-emerald-500" />
              <Clock v-else class="w-5 h-5 text-stone-400" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-stone-900 dark:text-white">
                {{ t('launchStepIndexing') }}
              </div>
              <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {{ t('launchStepIndexingDesc') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Success State Details -->
        <div
          v-if="launchStep === 'success'"
          class="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center"
        >
          <CheckCircle class="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h4 class="text-sm font-bold text-stone-900 dark:text-white">
            {{ t('launchSuccessTitle') }}
          </h4>
          <p class="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {{ t('launchSuccessDesc') }}
          </p>
          <div v-if="launchTokenAddress" class="mt-3 flex items-center justify-center gap-2">
            <span
              class="text-xs font-mono text-stone-600 dark:text-stone-300 bg-white/50 dark:bg-stone-800/50 px-2 py-1 rounded"
            >
              {{ formatHash(launchTokenAddress) }}
            </span>
            <a
              :href="tokenExplorerUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <span>{{ t('viewOnExplorer') }}</span>
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>

        <!-- Error State Details -->
        <div
          v-if="launchStep === 'error'"
          class="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20"
        >
          <div class="flex items-start gap-2.5">
            <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0 text-xs">
              <h5 class="font-bold text-rose-500">{{ t('launchFailedTitle') }}</h5>
              <p class="text-stone-600 dark:text-stone-300 mt-1 break-words leading-relaxed">
                {{ error || t('launchFailedDesc') }}
              </p>
              <div v-if="launchTxHash" class="mt-2.5">
                <a
                  :href="txExplorerUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-600 dark:text-rose-400 font-medium transition-colors"
                >
                  <span>{{ t('viewOnExplorer') }}</span>
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="mt-6 flex items-center justify-end gap-3">
          <Button
            v-if="launchStep === 'error'"
            variant="outline"
            size="sm"
            @click="closeModal"
            class="h-9 px-4 text-xs font-medium"
          >
            {{ t('closeModal') }}
          </Button>
          <Button
            v-if="launchStep === 'success'"
            size="sm"
            @click="goToTrade"
            class="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
          >
            <span>{{ t('tradeToken') }}</span>
            <ArrowRight class="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  AlertCircle,
  UploadCloud,
  ChevronDown,
  Loader2,
  Check,
  CheckCircle,
  ExternalLink,
  Clock,
  ArrowRight,
  Trash2,
} from 'lucide-vue-next';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useWallet } from '../composables/useWallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { InfoTooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';

const { t } = useI18n();
const emit = defineEmits<{
  (e: 'tokenCreated', address: string): void;
}>();

const {
  launchToken,
  loading,
  error,
  launchStep,
  launchTxHash,
  launchTokenAddress,
  resetLaunchState,
} = useLaunchpad();
const { isConnected, account, activeNetwork, switchOrAddNetwork } = useWallet();

const isModalOpen = ref(false);

const txExplorerUrl = computed(() => {
  if (!launchTxHash.value) return '';
  const base = activeNetwork.value.blockExplorer.replace(/\/$/, '');
  return `${base}/tx/${launchTxHash.value}`;
});

const tokenExplorerUrl = computed(() => {
  if (!launchTokenAddress.value) return '';
  const base = activeNetwork.value.blockExplorer.replace(/\/$/, '');
  return `${base}/token/${launchTokenAddress.value}`;
});

function formatHash(hash: string | null) {
  if (!hash) return '';
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function closeModal() {
  isModalOpen.value = false;
  resetLaunchState();
}

function goToTrade() {
  if (launchTokenAddress.value) {
    emit('tokenCreated', launchTokenAddress.value);
    isModalOpen.value = false;
  }
}

const currencySymbol = computed(() => activeNetwork.value.nativeCurrency.symbol);
const launchFeeFormatted = computed(() => {
  const feeWei = activeNetwork.value.launchConfig.launchFeeWei;
  // All EVM native msg.value (including Arc USDC gas) use 18 decimals per Circle Arc specs
  const val = Number(feeWei) / 10 ** 18;
  return val < 0.001 ? val.toFixed(4) : val.toFixed(2);
});
const totalPairDue = computed(() => {
  const buyAmount = parseFloat(form.value.initialBuyEth) || 0;
  const fee = parseFloat(launchFeeFormatted.value) || 0;
  const total = fee + buyAmount;
  return `${total.toFixed(currencySymbol.value === 'USDC' ? 2 : 4)} ${currencySymbol.value}`;
});

interface RevenueSplit {
  creator: number;
  buyback: number;
  holders: number;
  growth: number;
}

const revenueSplit = ref<RevenueSplit>({
  creator: 50,
  buyback: 0,
  holders: 50,
  growth: 0,
});

const totalSplit = computed(() => {
  return (
    Number(revenueSplit.value.creator || 0) +
    Number(revenueSplit.value.buyback || 0) +
    Number(revenueSplit.value.holders || 0) +
    Number(revenueSplit.value.growth || 0)
  );
});

const donutRadius = 38;
const donutCircumference = 2 * Math.PI * donutRadius; // 238.761

const creatorStroke = computed(
  () => (Number(revenueSplit.value.creator || 0) / 100) * donutCircumference,
);
const buybackStroke = computed(
  () => (Number(revenueSplit.value.buyback || 0) / 100) * donutCircumference,
);
const holdersStroke = computed(
  () => (Number(revenueSplit.value.holders || 0) / 100) * donutCircumference,
);
const growthStroke = computed(
  () => (Number(revenueSplit.value.growth || 0) / 100) * donutCircumference,
);

const creatorOffset = 0;
const buybackOffset = computed(() => -creatorStroke.value);
const holdersOffset = computed(() => -(creatorStroke.value + buybackStroke.value));
const growthOffset = computed(
  () => -(creatorStroke.value + buybackStroke.value + holdersStroke.value),
);

const maxCreator = computed(() => {
  const others =
    Number(revenueSplit.value.buyback || 0) +
    Number(revenueSplit.value.holders || 0) +
    Number(revenueSplit.value.growth || 0);
  return Math.max(0, 100 - others);
});

const maxBuyback = computed(() => {
  const others =
    Number(revenueSplit.value.creator || 0) +
    Number(revenueSplit.value.holders || 0) +
    Number(revenueSplit.value.growth || 0);
  return Math.max(0, 100 - others);
});

const maxHolders = computed(() => {
  const others =
    Number(revenueSplit.value.creator || 0) +
    Number(revenueSplit.value.buyback || 0) +
    Number(revenueSplit.value.growth || 0);
  return Math.max(0, 100 - others);
});

const maxGrowth = computed(() => {
  const others =
    Number(revenueSplit.value.creator || 0) +
    Number(revenueSplit.value.buyback || 0) +
    Number(revenueSplit.value.holders || 0);
  return Math.max(0, 100 - others);
});

function applySplitPreset(creator: number, buyback: number, holders: number, growth: number) {
  revenueSplit.value = { creator, buyback, holders, growth };
}

function updateShare(key: keyof RevenueSplit, val: unknown): void {
  const allKeys: (keyof RevenueSplit)[] = ['creator', 'buyback', 'holders', 'growth'];
  const otherKeys = allKeys.filter((k) => k !== key);
  const others = otherKeys.reduce((sum, k) => sum + Number(revenueSplit.value[k] || 0), 0);
  const maxAllowed = Math.max(0, 100 - others);
  const requested = Math.max(0, Math.round(Number(val) || 0));

  // Each share stops where the others leave off; no ghost slider movement
  revenueSplit.value[key] = Math.min(requested, maxAllowed);
}

const selectedVersion = ref<'v1' | 'v2'>('v2');
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');
const imagePreview = ref('');
const dragOver = ref(false);
const isUploadingIpfs = ref(false);
const imageError = ref('');
const advancedOpen = ref(false);
const holderFeeSharing = ref(false);

function clearImage() {
  selectedFileName.value = '';
  imagePreview.value = '';
  form.value.logo = '';
  imageError.value = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

const form = ref({
  name: '',
  symbol: '',
  description: '',
  logo: '',
  website: '',
  twitter: '',
  telegram: '',
  initialBuyEth: '',
  buyTax: '1',
  sellTax: '1',
  creatorWallet: '',
});

function triggerFileInput() {
  fileInputRef.value?.click();
}

async function processImageFile(file: File) {
  imageError.value = '';
  if (!file.type.startsWith('image/')) {
    imageError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    imageError.value = 'Image file size must be less than 5MB.';
    return;
  }

  selectedFileName.value = file.name;
  try {
    isUploadingIpfs.value = true;
    // Compress and convert photo to modern WebP (max 512x512) before IPFS pinning
    const processed = await compressAndConvertToWebp(file, 512, 0.85);
    imagePreview.value = processed.dataUrl;

    const formData = new FormData();
    formData.append('file', processed.file);

    const res = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.success && data.data?.uri) {
      form.value.logo = data.data.uri;
    } else {
      form.value.logo = '';
    }
  } catch {
    form.value.logo = '';
  } finally {
    isUploadingIpfs.value = false;
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    processImageFile(file);
  }
}

function handleDrop(event: DragEvent) {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    processImageFile(file);
  }
}

async function handleLaunch() {
  if (totalSplit.value !== 100) return;
  isModalOpen.value = true;
  const result = await launchToken(
    {
      name: form.value.name.trim(),
      symbol: form.value.symbol.trim().toUpperCase(),
      description: form.value.description.trim(),
      logo: form.value.logo.trim(),
      socials: {
        website: form.value.website.trim(),
        twitter: form.value.twitter.trim(),
        telegram: form.value.telegram.trim(),
      },
      initialBuyAmountEth: form.value.initialBuyEth || '0',
    },
    selectedVersion.value,
  );

  if (result) {
    emit('tokenCreated', result.tokenAddress);
  }
}
</script>
