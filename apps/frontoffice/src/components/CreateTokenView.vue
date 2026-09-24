<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div>
      <div class="flex items-center gap-2">
        <Rocket class="w-6 h-6 text-emerald-400" />
        <h1 class="text-3xl font-bold tracking-tight">{{ t('launchToken') }}</h1>
      </div>
      <p class="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
        {{ selectedVersion === 'v2' ? t('v2Subtitle') : t('v1Subtitle') }}
      </p>
    </div>

    <!-- Form container using Shadcn Card -->
    <Card class="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
      <!-- Dual Launch Architecture Tabs (v2 / v1) -->
      <div class="mb-6 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl flex gap-1">
        <Button
          type="button"
          @click="selectedVersion = 'v2'"
          :variant="selectedVersion === 'v2' ? 'default' : 'ghost'"
          size="sm"
          class="flex-1 text-xs font-semibold gap-2 transition-all cursor-pointer"
        >
          <Rocket class="w-3.5 h-3.5 text-emerald-500" />
          <span>{{ t('v2BondingCurveTab') }}</span>
        </Button>
        <Button
          type="button"
          @click="selectedVersion = 'v1'"
          :variant="selectedVersion === 'v1' ? 'default' : 'ghost'"
          size="sm"
          class="flex-1 text-xs font-semibold gap-2 transition-all cursor-pointer"
        >
          <Lock class="w-3.5 h-3.5 text-zinc-400" />
          <span>{{ t('v1DirectPoolTab') }}</span>
        </Button>
      </div>

      <form @submit.prevent="handleLaunch" class="space-y-5">
        <!-- Name -->
        <div class="space-y-1.5">
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

        <!-- Ticker -->
        <div class="space-y-1.5">
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

        <!-- Description -->
        <div class="space-y-1.5">
          <Label for="token-description">{{ t('description') }}</Label>
          <Textarea
            id="token-description"
            v-model="form.description"
            :placeholder="t('descriptionPlaceholder')"
            :rows="3"
          />
        </div>

        <!-- Token image -->
        <div class="space-y-1.5">
          <Label>{{ t('tokenImage') }}</Label>
          <div
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            :class="[
              'relative border-2 border-dashed rounded-xl p-4 transition-all flex flex-col sm:flex-row items-center gap-4 text-left cursor-pointer min-w-0 overflow-hidden',
              dragOver
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600',
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

            <!-- Thumbnail / Icon -->
            <div
              class="w-14 h-14 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700"
            >
              <img
                v-if="imagePreview"
                :src="imagePreview"
                alt="Preview"
                class="w-full h-full object-cover"
              />
              <UploadCloud v-else class="w-6 h-6 text-zinc-400" />
            </div>

            <!-- Upload copy & status -->
            <div class="flex-1 min-w-0 overflow-hidden space-y-1">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="text-xs font-semibold text-black dark:text-white truncate block flex-1 min-w-0"
                  :title="selectedFileName"
                >
                  {{ selectedFileName || t('noFileChosen') }}
                </span>
                <Badge
                  v-if="isUploadingIpfs"
                  variant="outline"
                  class="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30 flex items-center gap-1 shrink-0"
                >
                  <Loader2 class="w-3 h-3 animate-spin" />
                  {{ t('pinningIpfs') }}
                </Badge>
                <Badge
                  v-else-if="form.logo"
                  variant="outline"
                  class="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shrink-0"
                >
                  {{ t('ipfsReady') }}
                </Badge>
              </div>
              <p class="text-[11px] leading-normal text-zinc-500 dark:text-zinc-400 truncate">
                {{ t('chooseImage') }}
              </p>
            </div>

            <Button
              v-if="imagePreview"
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400"
              @click.stop="clearImage"
            >
              {{ t('remove') }}
            </Button>
          </div>
        </div>

        <!-- Image validation error -->
        <div
          v-if="imageError"
          class="flex items-start gap-2 text-xs text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2"
        >
          <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{{ imageError }}</span>
        </div>

        <div class="space-y-1.5">
          <Label for="token-x">X profile</Label>
          <div class="relative">
            <span class="absolute left-3 top-2 text-xs text-zinc-400 select-none font-mono"
              >x.com/</span
            >
            <Input
              id="token-x"
              v-model="form.twitter"
              type="text"
              :placeholder="t('handlePlaceholder')"
              maxlength="15"
              class="pl-16 font-mono text-xs"
            />
          </div>
        </div>

        <!-- Telegram -->
        <div class="space-y-1.5">
          <Label for="token-tg">Telegram</Label>
          <div class="relative">
            <span class="absolute left-3 top-2 text-xs text-zinc-400 select-none font-mono"
              >t.me/</span
            >
            <Input
              id="token-tg"
              v-model="form.telegram"
              type="text"
              :placeholder="t('communityPlaceholder')"
              maxlength="32"
              class="pl-14 font-mono text-xs"
            />
          </div>
        </div>

        <!-- Paired Asset -->
        <div class="space-y-1.5">
          <Label for="paired-asset">{{ t('pairedAsset') }}</Label>
          <Select
            :model-value="String(activeNetwork.chainId)"
            @update:model-value="handleChainSelect"
          >
            <SelectTrigger
              id="paired-asset"
              class="w-full flex items-center justify-between px-3 py-2.5 h-11 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition text-black dark:text-white"
            >
              <div class="flex items-center gap-2 font-mono">
                <img
                  :src="currencySymbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'"
                  :alt="currencySymbol"
                  class="w-5 h-5 rounded-full object-contain shrink-0"
                />
                <span class="font-bold text-sm text-black dark:text-white">{{
                  currencySymbol
                }}</span>
              </div>
            </SelectTrigger>
            <SelectContent
              align="end"
              class="w-48 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1.5 shadow-lg"
            >
              <SelectItem
                v-for="net in Object.values(SUPPORTED_CHAINS)"
                :key="net.chainId"
                :value="String(net.chainId)"
                class="cursor-pointer text-xs font-mono py-2 px-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition"
              >
                <div class="flex items-center gap-2">
                  <img
                    :src="
                      net.nativeCurrency.symbol === 'USDC' ? '/tokens/usdc.svg' : '/tokens/eth.svg'
                    "
                    :alt="net.nativeCurrency.symbol"
                    class="w-4 h-4 rounded-full object-contain shrink-0"
                  />
                  <span class="font-bold text-sm text-black dark:text-white">
                    {{ net.nativeCurrency.symbol }}
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
            {{
              selectedVersion === 'v2'
                ? activeNetwork.chainId === 5042 || activeNetwork.chainId === 5042002
                  ? 'Graduates once the curve raises 69,000 USDC into Uniswap liquidity.'
                  : t('v2GraduatesHint')
                : t('v1PairsHint')
            }}
          </p>
        </div>

        <!-- Developer buy -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-center">
            <Label for="developer-buy">{{ t('developerBuy') }}</Label>
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
        <Card
          class="rounded-xl border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-950/30 overflow-hidden p-0"
        >
          <Button
            type="button"
            variant="ghost"
            @click="advancedOpen = !advancedOpen"
            class="w-full flex items-center justify-between px-4 py-3 h-auto text-xs font-semibold transition hover:bg-zinc-100 dark:hover:bg-zinc-900/50 cursor-pointer rounded-none"
          >
            <span class="flex items-center gap-2">
              <SlidersHorizontal class="w-3.5 h-3.5 text-zinc-400" />
              {{ t('advanced') }}
            </span>
            <ChevronDown
              class="w-3.5 h-3.5 transition-transform duration-200 opacity-60"
              :class="advancedOpen ? 'rotate-180' : ''"
            />
          </Button>

          <div
            v-show="advancedOpen"
            class="px-4 pb-4 pt-1 space-y-4 border-t border-zinc-200 dark:border-zinc-800/60"
          >
            <!-- Holder fee sharing -->
            <div class="space-y-1 pt-1">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium">{{ t('holderFeeSharing') }}</span>
                <Switch v-model:checked="holderFeeSharing" />
              </div>
              <p class="text-[11px] text-zinc-500">
                {{
                  holderFeeSharing
                    ? 'Creator fees go to token holders pro-rata.'
                    : 'Creator fees go to the creator wallet.'
                }}
              </p>
              <p class="text-[10px] text-zinc-400">
                {{ t('creatorFeeSharingDesc') }}
              </p>
            </div>

            <!-- Connected Creator Wallet -->
            <div class="space-y-1">
              <Label class="text-xs font-medium">{{ t('creatorWallet') }}</Label>
              <div
                class="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900 font-mono text-xs"
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

            <!-- Creator tax -->
            <div class="space-y-1">
              <Label for="creator-tax" class="text-xs font-medium">{{ t('creatorTax') }}</Label>
              <div class="relative">
                <Input
                  id="creator-tax"
                  v-model="form.buyTax"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  placeholder="1"
                  class="font-mono text-xs pr-8"
                />
                <span class="absolute right-3 top-2 text-xs font-semibold text-zinc-400">%</span>
              </div>
              <p class="text-[10px] text-zinc-400">
                Traders pay
                {{
                  (parseFloat(form.buyTax || '0') + (selectedVersion === 'v2' ? 1.0 : 1.0)).toFixed(
                    2,
                  )
                }}% in total, up to 10% of it yours.
              </p>
            </div>

            <!-- Anti-Snipe Notice -->
            <div
              class="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-[11px] text-zinc-400 space-y-0.5"
            >
              <div
                class="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
              >
                <Lock class="w-3 h-3" />
                <span>Fair Launch Anti-Snipe Safeguard</span>
              </div>
              <p>
                Connected creator wallet is automatically exempt from the initial 99% snipe tax.
                External purchases decay smoothly to 0% in 3 seconds.
              </p>
            </div>
          </div>
        </Card>

        <!-- Form Footer Rate & Submit Button -->
        <div class="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          <!-- Launch Cost Summary Breakdown -->
          <div
            class="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-3 space-y-2 text-xs font-mono"
          >
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

            <div
              class="pt-1.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
            >
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
            :disabled="loading || isUploadingIpfs || !form.name || !form.symbol"
            class="w-full font-bold py-3 text-sm h-11"
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
  Rocket,
  Lock,
  AlertCircle,
  UploadCloud,
  ChevronDown,
  SlidersHorizontal,
  Loader2,
  Check,
  CheckCircle,
  ExternalLink,
  Clock,
  ArrowRight,
} from 'lucide-vue-next';
import { SUPPORTED_CHAINS } from '@proto/shared-types';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useWallet } from '../composables/useWallet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
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

function handleChainSelect(val: unknown) {
  const chainId = Number(val);
  const target = SUPPORTED_CHAINS[chainId];
  if (target) {
    switchOrAddNetwork(target);
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
