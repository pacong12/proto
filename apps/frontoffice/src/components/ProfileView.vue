<template>
  <div class="max-w-5xl mx-auto space-y-8">
    <!-- Profile Hero & Identity Card -->
    <Card
      class="p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 backdrop-blur space-y-6"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="relative group cursor-pointer" @click="editModalOpen = true">
            <Avatar
              class="w-16 h-16 rounded-full border-2 border-emerald-500/40 overflow-hidden shadow-lg transition group-hover:opacity-85"
            >
              <img
                v-if="resolvedAvatarUrl"
                :src="resolvedAvatarUrl"
                :alt="profileData.displayName"
                class="w-full h-full object-cover rounded-full"
              />
              <Jazzicon
                v-else
                :address="userAddress"
                :size="64"
                class="w-full h-full rounded-full"
              />
            </Avatar>
            <div
              class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Update profile photo"
            >
              <Camera class="w-5 h-5 text-white" />
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold tracking-tight text-black dark:text-white">
                {{
                  profileData.displayName ||
                  (userAddress ? shortenAddress(userAddress) : 'Anonymous Creator')
                }}
              </h1>
            </div>

            <p class="text-xs text-zinc-400 max-w-md">
              {{
                profileData.bio ||
                'Non-custodial creator and trader on Proto multi-chain launchpad.'
              }}
            </p>

            <div class="flex items-center gap-4 pt-1 text-xs text-zinc-400">
              <a
                v-if="profileData.twitter"
                :href="`https://x.com/${profileData.twitter}`"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-emerald-400 transition flex items-center gap-1 font-mono"
              >
                <span>@{{ profileData.twitter }}</span>
              </a>
              <a
                v-if="profileData.telegram"
                :href="`https://t.me/${profileData.telegram}`"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-emerald-400 transition flex items-center gap-1 font-mono"
              >
                <span>t.me/{{ profileData.telegram }}</span>
              </a>
              <span class="font-mono text-zinc-500">
                {{ userAddress ? shortenAddress(userAddress) : 'Not Connected' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons: Edit Profile & Share Profile -->
        <div class="flex items-center gap-2.5 self-start sm:self-center">
          <Button
            @click="editModalOpen = true"
            variant="outline"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-black dark:text-white"
          >
            <Edit3 class="w-3.5 h-3.5" />
            Edit Profile
          </Button>

          <Button
            @click="shareProfile"
            variant="default"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
          >
            <Share2 class="w-3.5 h-3.5" />
            {{ copiedShare ? 'Copied Link!' : 'Share Profile' }}
          </Button>
        </div>
      </div>
    </Card>

    <!-- Disconnected Warning Banner -->
    <Card
      v-if="!userAddress"
      class="border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-400 flex items-start gap-3"
    >
      <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
      <span
        >Connect your wallet to view your token launches, portfolio positions, and activity.</span
      >
    </Card>

    <template v-else>
      <!-- Stats Summary Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card class="p-5 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-zinc-400"
          >
            <Coins class="w-4 h-4 text-emerald-400" />
            {{ t('claimableFees') }}
          </p>
          <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {{ totalClaimableWeth }} {{ activeNetwork.nativeCurrency.symbol }}
          </p>
          <p class="text-xs text-zinc-500 mt-1">70% creator share</p>
        </Card>

        <Card class="p-5 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-zinc-400"
          >
            <Rocket class="w-4 h-4 text-emerald-400" />
            {{ t('createdTokens') }}
          </p>
          <p class="text-2xl font-bold font-mono text-black dark:text-white mt-2">
            {{ myLaunches.length }}
          </p>
          <p class="text-xs text-zinc-500 mt-1">Deployed by your wallet</p>
        </Card>

        <Card class="p-5 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-zinc-400"
          >
            <PieChart class="w-4 h-4 text-emerald-400" />
            Active Positions
          </p>
          <p class="text-2xl font-bold font-mono text-black dark:text-white mt-2">
            {{ portfolioPositions.length }}
          </p>
          <p class="text-xs text-zinc-500 mt-1">Tokens currently held</p>
        </Card>

        <Card class="p-5 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-zinc-400"
          >
            <Activity class="w-4 h-4 text-emerald-400" />
            Total Trades
          </p>
          <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {{ userActivities.length }}
          </p>
          <p class="text-xs text-zinc-500 mt-1">Buys & Sells executed</p>
        </Card>
      </div>

      <!-- Success Notification -->
      <div
        v-if="successTx"
        class="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 flex items-start gap-2 break-all"
      >
        <Check class="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        <span>Transaction Successful! Tx Hash: {{ successTx }}</span>
      </div>

      <!-- Main Profile Tabs: Created Tokens, Portfolio, Activity -->
      <Card
        class="p-4 sm:p-6 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/90 space-y-6"
      >
        <Tabs v-model="activeTab" class="w-full">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3"
          >
            <TabsList
              class="flex flex-wrap sm:inline-flex w-full sm:w-auto bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 gap-1 h-auto"
            >
              <TabsTrigger
                value="created"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-black dark:text-white"
              >
                {{ t('createdTokens') }} ({{ myLaunches.length }})
              </TabsTrigger>
              <TabsTrigger
                value="portfolio"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-black dark:text-white"
              >
                {{ t('portfolio') }} ({{ portfolioPositions.length }})
              </TabsTrigger>
              <TabsTrigger
                value="dividends"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-black dark:text-white"
              >
                {{ t('dividendsAndVesting') }}
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-black dark:text-white"
              >
                {{ t('activity') }} ({{ userActivities.length }})
              </TabsTrigger>
            </TabsList>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 text-xs text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white self-end sm:self-auto border border-zinc-200 dark:border-zinc-800"
              @click="refreshAllData"
            >
              <RefreshCw class="w-3.5 h-3.5 mr-1" :class="{ 'animate-spin': loadingLaunches }" />
              Refresh
            </Button>
          </div>

          <!-- TAB 1: CREATED TOKENS -->
          <TabsContent value="created" class="mt-4 space-y-4">
            <div v-if="loadingLaunches" class="py-12 text-center text-xs text-zinc-400">
              <Loader2 class="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
              Loading created tokens...
            </div>
            <div
              v-else-if="myLaunches.length === 0"
              class="py-12 text-center text-xs text-zinc-500"
            >
              No tokens launched from this address yet.
            </div>
            <div v-else class="space-y-4">
              <Card
                v-for="token in myLaunches"
                :key="token.address"
                class="bg-zinc-50/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div class="flex items-start gap-3.5">
                  <OptimizedImage
                    :src="token.logo"
                    :alt="token.name"
                    :fallback-text="token.symbol"
                    :width="48"
                    :height="48"
                    class="rounded-lg border border-zinc-700"
                  />

                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-bold text-base text-black dark:text-white">
                        {{ token.name }}
                      </h3>
                      <span class="text-xs font-mono text-zinc-400">${{ token.symbol }}</span>
                      <Badge
                        :variant="token.version === 'v2' ? 'outline' : 'secondary'"
                        class="text-[9px] px-1.5 py-0 h-4 font-mono uppercase"
                      >
                        {{ token.version === 'v2' ? 'v2 Curve' : 'v1 Direct' }}
                      </Badge>
                    </div>
                    <p class="text-xs font-mono text-zinc-500 mt-0.5">{{ token.address }}</p>
                    <div class="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                      <span>
                        Accrued:
                        <strong class="text-emerald-400 font-mono"
                          >{{ token.unclaimedWeth }}
                          {{ activeNetwork.nativeCurrency.symbol }}</strong
                        >
                      </span>
                      <span>•</span>
                      <span>
                        Redirect:
                        <strong class="font-mono text-zinc-300">
                          {{ token.redirect ? `${token.redirect.slice(0, 6)}...` : 'None (Self)' }}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    @click="handleClaim(token.address)"
                    :disabled="loading"
                    variant="default"
                    size="sm"
                  >
                    <ArrowDownToLine class="w-3.5 h-3.5 mr-1" />
                    Claim Fees
                  </Button>
                  <Button @click="openCtoModal(token.address)" variant="outline" size="sm">
                    <Share2 class="w-3.5 h-3.5 mr-1" />
                    CTO Redirect
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          <!-- TAB 2: PORTFOLIO & POSITIONS -->
          <TabsContent value="portfolio" class="mt-4 space-y-4">
            <div
              v-if="portfolioPositions.length === 0"
              class="py-12 text-center text-xs text-zinc-500"
            >
              No active token holdings found for this wallet.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs font-mono">
                <thead>
                  <tr class="border-b border-zinc-800 text-zinc-400">
                    <th class="py-2.5 px-3 font-semibold">Asset</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Balance</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Price (USD)</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Value (USD)</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800">
                  <tr
                    v-for="pos in portfolioPositions"
                    :key="pos.tokenAddress"
                    class="hover:bg-zinc-100/40 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <td class="py-2.5 px-3">
                      <div class="flex items-center gap-2">
                        <Avatar class="w-6 h-6 rounded border border-zinc-700 overflow-hidden">
                          <AvatarFallback class="text-[9px] bg-zinc-800 text-emerald-400">
                            {{ pos.symbol.slice(0, 3) }}
                          </AvatarFallback>
                        </Avatar>
                        <span class="font-bold text-black dark:text-white">{{ pos.name }}</span>
                        <span class="text-zinc-500">${{ pos.symbol }}</span>
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-right text-black dark:text-white font-medium">
                      {{ pos.balanceFormatted }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-zinc-400">
                      ${{ pos.priceUsd.toFixed(8) }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-emerald-400 font-bold">
                      ${{
                        pos.valueUsd.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      }}
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <Button
                        as-child
                        variant="outline"
                        size="sm"
                        class="h-7 px-2.5 text-xs font-semibold gap-1 border-zinc-200 dark:border-zinc-800"
                      >
                        <RouterLink :to="`/launchpad/${pos.tokenAddress}`">
                          Trade
                          <ExternalLink class="w-3 h-3" />
                        </RouterLink>
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          <!-- TAB 3: ACTIVITY HISTORY -->
          <TabsContent value="activity" class="mt-4 space-y-4">
            <div v-if="userActivities.length === 0" class="py-12 text-center text-xs text-zinc-500">
              No recent transactions recorded for this wallet.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs font-mono">
                <thead>
                  <tr class="border-b border-zinc-800 text-zinc-400">
                    <th class="py-2.5 px-3 font-semibold">Action</th>
                    <th class="py-2.5 px-3 font-semibold">Token</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Amount ETH</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Tokens</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Time</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Explorer</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800">
                  <tr
                    v-for="act in userActivities"
                    :key="act.txHash"
                    class="hover:bg-zinc-100/40 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <td class="py-2.5 px-3">
                      <Badge
                        :variant="act.isBuy ? 'default' : 'destructive'"
                        class="text-[9px] uppercase px-1.5 py-0"
                      >
                        {{ act.isBuy ? 'Buy' : 'Sell' }}
                      </Badge>
                    </td>
                    <td class="py-2.5 px-3 text-black dark:text-white font-medium">
                      ${{ act.tokenSymbol }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-emerald-400 font-medium">
                      {{ act.ethAmount }} {{ activeNetwork.nativeCurrency.symbol }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-zinc-300">
                      {{ act.tokenAmount }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-zinc-500">
                      {{ formatTimeAgo(act.timestamp) }}
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <a
                        :href="`${activeNetwork.blockExplorer}/tx/${act.txHash}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-zinc-500 hover:text-emerald-400 inline-flex items-center"
                      >
                        <ExternalLink class="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          <!-- TAB 4: HOLDER DIVIDENDS & VESTING VAULT -->
          <TabsContent value="dividends" class="mt-4 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Holder Fee Dividends Card -->
              <Card
                class="p-5 bg-zinc-50/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Coins class="w-4 h-4 text-emerald-400" />
                    <h3 class="text-sm font-bold text-black dark:text-white">
                      Holder Fee Sharing Dividends
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    class="text-[10px] font-mono text-emerald-400 border-emerald-500/30"
                  >
                    70% Split
                  </Badge>
                </div>
                <p class="text-xs text-zinc-400">
                  Pro-rata trading fee rewards accrued from tokens you hold that enabled Holder Fee
                  Sharing.
                </p>
                <div
                  class="flex items-end justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800"
                >
                  <div>
                    <span class="text-[10px] text-zinc-500 uppercase font-mono"
                      >Claimable Reward</span
                    >
                    <p class="text-lg font-bold font-mono text-emerald-400">0.0000 WETH</p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    :disabled="true"
                    class="h-8 text-xs font-semibold"
                  >
                    <ArrowDownToLine class="w-3.5 h-3.5 mr-1" />
                    Claim Dividends
                  </Button>
                </div>
              </Card>

              <!-- Linear Vesting Schedule Card -->
              <Card
                class="p-5 bg-zinc-50/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Lock class="w-4 h-4 text-emerald-400" />
                    <h3 class="text-sm font-bold text-black dark:text-white">
                      Linear Vesting Vault
                    </h3>
                  </div>
                  <Badge variant="outline" class="text-[10px] font-mono text-zinc-400">
                    Continuous Release
                  </Badge>
                </div>
                <p class="text-xs text-zinc-400">
                  Tokens locked in linear vesting schedules (buybacks, team allocations, migration
                  claims).
                </p>
                <div
                  class="flex items-end justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800"
                >
                  <div>
                    <span class="text-[10px] text-zinc-500 uppercase font-mono"
                      >Unlocked Tokens</span
                    >
                    <p class="text-lg font-bold font-mono text-black dark:text-white">0 DIV</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="true"
                    class="h-8 text-xs font-semibold"
                  >
                    Claim Unlocked
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <!-- Edit Profile Modal -->
      <Dialog v-model:open="editModalOpen">
        <DialogContent
          class="w-full max-w-md overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-black dark:text-white"
        >
          <DialogHeader>
            <div class="flex items-center gap-2 text-emerald-400 mb-1">
              <Edit3 class="w-5 h-5" />
              <DialogTitle>Edit Creator Profile</DialogTitle>
            </div>
            <DialogDescription class="text-xs text-zinc-400">
              Customize your public creator identity, social handles, and bio.
            </DialogDescription>
          </DialogHeader>

          <div
            class="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-[11px] text-zinc-500"
          >
            Profile metadata is stored in your local browser session for this wallet address.
          </div>

          <form @submit.prevent="saveProfile" class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="display-name" class="text-xs font-medium">Display Name</Label>
              <Input
                id="display-name"
                v-model="editForm.displayName"
                placeholder="e.g. Satoshi Degen"
                maxlength="32"
                class="text-xs"
              />
            </div>

            <div class="space-y-1.5">
              <Label for="bio" class="text-xs font-medium">Bio / Description</Label>
              <Textarea
                id="bio"
                v-model="editForm.bio"
                placeholder="Short bio about yourself or your projects..."
                :maxlength="120"
                class="text-xs resize-none h-16"
              />
            </div>

            <!-- Profile Photo Upload Zone -->
            <div class="space-y-1.5">
              <Label class="text-xs font-medium">Profile Photo</Label>
              <div
                @dragover.prevent="dragOverAvatar = true"
                @dragleave.prevent="dragOverAvatar = false"
                @drop.prevent="handleAvatarDrop"
                :class="[
                  'relative border-2 border-dashed rounded-xl p-3.5 transition-all flex items-center gap-3.5 text-left cursor-pointer min-w-0 overflow-hidden',
                  dragOverAvatar
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700',
                ]"
                @click="triggerAvatarUpload"
              >
                <input
                  ref="avatarFileRef"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  class="hidden"
                  @change="handleAvatarFileChange"
                />

                <!-- Circular Avatar Preview -->
                <Avatar
                  class="w-14 h-14 rounded-full border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0 shadow-xs"
                >
                  <img
                    v-if="editResolvedAvatar"
                    :src="editResolvedAvatar"
                    alt="Preview"
                    class="w-full h-full object-cover rounded-full"
                  />
                  <div
                    v-else-if="isUploadingAvatar"
                    class="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"
                  >
                    <Loader2 class="w-5 h-5 text-emerald-500 animate-spin" />
                  </div>
                  <Jazzicon
                    v-else
                    :address="userAddress"
                    :size="56"
                    class="w-full h-full rounded-full"
                  />
                </Avatar>

                <!-- Status & Action Copy -->
                <div class="flex-1 min-w-0 overflow-hidden space-y-0.5">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span
                      class="text-xs font-bold text-black dark:text-white truncate block max-w-[160px] sm:max-w-[210px]"
                      :title="
                        avatarFileName ||
                        (editForm.avatarUrl ? 'Custom Photo' : 'Upload from device')
                      "
                    >
                      {{
                        avatarFileName ||
                        (editForm.avatarUrl ? 'Custom Photo' : 'Upload from device')
                      }}
                    </span>
                    <Badge
                      v-if="isUploadingAvatar"
                      variant="outline"
                      class="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-500 border-amber-500/30 flex items-center gap-1 shrink-0"
                    >
                      <Loader2 class="w-2.5 h-2.5 animate-spin" />
                      Optimizing...
                    </Badge>
                    <Badge
                      v-else-if="editForm.avatarUrl"
                      variant="outline"
                      class="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shrink-0"
                    >
                      Active
                    </Badge>
                  </div>
                  <p class="text-[11px] text-zinc-400 truncate">
                    Click or drag image (PNG, JPG, WEBP max 5MB).
                  </p>
                </div>

                <!-- Remove Photo Button -->
                <Button
                  v-if="editForm.avatarUrl"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-zinc-400 hover:text-rose-500 rounded cursor-pointer"
                  title="Remove photo"
                  @click.stop="removeAvatar"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label for="edit-x" class="text-xs font-medium">X (Twitter)</Label>
                <div class="relative">
                  <span class="absolute left-2.5 top-2 text-xs font-mono text-zinc-400 select-none"
                    >@</span
                  >
                  <Input
                    id="edit-x"
                    v-model="editForm.twitter"
                    placeholder="handle"
                    class="text-xs pl-7"
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <Label for="edit-tg" class="text-xs font-medium">Telegram</Label>
                <div class="relative">
                  <span class="absolute left-2.5 top-2 text-xs font-mono text-zinc-400 select-none"
                    >t.me/</span
                  >
                  <Input
                    id="edit-tg"
                    v-model="editForm.telegram"
                    placeholder="handle"
                    class="text-xs pl-11"
                  />
                </div>
              </div>
            </div>

            <DialogFooter class="pt-3 gap-2">
              <Button type="button" variant="outline" size="sm" @click="editModalOpen = false">
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm">Save Profile</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <!-- CTO Modal -->
      <Dialog v-model:open="ctoModalOpen">
        <DialogContent
          class="max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-black dark:text-white"
        >
          <DialogHeader>
            <div class="flex items-center gap-2 text-emerald-400 mb-1">
              <ShieldAlert class="w-5 h-5" />
              <DialogTitle>Community Takeover (CTO) Redirect</DialogTitle>
            </div>
            <DialogDescription class="text-xs text-zinc-400">
              Permanently route all future 70% creator fees for this token to a community treasury
              wallet.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="token-addr" class="text-xs font-medium">Target Token Address</Label>
              <Input
                id="token-addr"
                :model-value="selectedCtoToken"
                readonly
                disabled
                class="font-mono text-xs text-zinc-500"
              />
            </div>

            <div class="space-y-1.5">
              <Label for="new-recipient" class="text-xs font-medium">New Community Recipient</Label>
              <Input
                id="new-recipient"
                v-model="newRecipientAddress"
                placeholder="0x..."
                class="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter class="gap-2">
            <Button variant="outline" size="sm" @click="ctoModalOpen = false">Cancel</Button>
            <Button
              variant="default"
              size="sm"
              :disabled="loading || !newRecipientAddress.startsWith('0x')"
              @click="handleSetRedirect"
            >
              Confirm CTO Redirect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  User,
  Coins,
  Rocket,
  Lock,
  ShieldCheck,
  Flame,
  Share2,
  ShieldAlert,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Edit3,
  PieChart,
  Activity,
  ExternalLink,
  Camera,
  Trash2,
  UploadCloud,
} from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useWallet } from '../composables/useWallet';
import { walletAddress } from '../lib/wallet-store';
import { shortenAddress } from '@/lib/utils';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';

const { t } = useI18n();
const { activeNetwork } = useWallet();
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, Jazzicon } from '@/components/ui/avatar';
import OptimizedImage from '@/components/ui/OptimizedImage.vue';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { LaunchedTokenEntity, TokenMarketData } from '@proto/shared-types';

const { claimFees, setFeeRedirect, loading } = useLaunchpad();

const userAddress = walletAddress;
const activeTab = ref('created');
const editModalOpen = ref(false);
const ctoModalOpen = ref(false);
const selectedCtoToken = ref<string>('');
const newRecipientAddress = ref<string>('');
const successTx = ref<string | null>(null);
const loadingLaunches = ref(false);
const copiedShare = ref(false);

const avatarFileRef = ref<HTMLInputElement | null>(null);
const isUploadingAvatar = ref(false);
const dragOverAvatar = ref(false);
const avatarFileName = ref('');

function triggerAvatarUpload() {
  avatarFileRef.value?.click();
}

async function handleAvatarFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    await processAvatarFile(input.files[0]);
  }
}

async function handleAvatarDrop(e: DragEvent) {
  dragOverAvatar.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    await processAvatarFile(e.dataTransfer.files[0]);
  }
}

async function processAvatarFile(file: File) {
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPG, WEBP, GIF).');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Image file size must be less than 5MB.');
    return;
  }

  avatarFileName.value = file.name;
  try {
    isUploadingAvatar.value = true;
    const processed = await compressAndConvertToWebp(file, 256, 0.85);
    editForm.value.avatarUrl = processed.dataUrl;

    const formData = new FormData();
    formData.append('file', processed.file);

    const res = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.cid) {
        editForm.value.avatarUrl = `ipfs://${data.data.cid}`;
      }
    }
  } catch (err) {
    console.warn('[Profile] Avatar upload/compression error, keeping preview:', err);
  } finally {
    isUploadingAvatar.value = false;
  }
}

function removeAvatar() {
  editForm.value.avatarUrl = '';
  avatarFileName.value = '';
  if (avatarFileRef.value) avatarFileRef.value.value = '';
}

interface ProfileStorageData {
  displayName: string;
  bio: string;
  avatarUrl: string;
  twitter: string;
  telegram: string;
}

const profileData = ref<ProfileStorageData>({
  displayName: '',
  bio: '',
  avatarUrl: '',
  twitter: '',
  telegram: '',
});

const editForm = ref<ProfileStorageData>({
  displayName: '',
  bio: '',
  avatarUrl: '',
  twitter: '',
  telegram: '',
});

const resolvedAvatarUrl = computed(() => {
  if (!profileData.value.avatarUrl) return '';
  if (profileData.value.avatarUrl.startsWith('ipfs://')) {
    const hash = profileData.value.avatarUrl.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return profileData.value.avatarUrl;
});

const editResolvedAvatar = computed(() => {
  if (!editForm.value.avatarUrl) return '';
  if (editForm.value.avatarUrl.startsWith('ipfs://')) {
    const hash = editForm.value.avatarUrl.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return editForm.value.avatarUrl;
});

interface MyLaunchItem {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  version?: 'v1' | 'v2';
  unclaimedWeth: string;
  redirect: string | null;
}

interface PortfolioPosition {
  tokenAddress: string;
  name: string;
  symbol: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
}

interface UserActivity {
  txHash: string;
  isBuy: boolean;
  tokenSymbol: string;
  ethAmount: string;
  tokenAmount: string;
  timestamp: number;
}

const myLaunches = ref<MyLaunchItem[]>([]);
const portfolioPositions = ref<PortfolioPosition[]>([]);
const userActivities = ref<UserActivity[]>([]);

const totalClaimableWeth = computed(() => {
  const sum = myLaunches.value.reduce(
    (acc, item) => acc + parseFloat(item.unclaimedWeth || '0'),
    0,
  );
  return sum.toFixed(4);
});

function loadLocalProfile() {
  if (typeof window === 'undefined' || !userAddress.value) return;
  try {
    const raw = localStorage.getItem(`proto_profile_${userAddress.value.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      profileData.value = parsed;
      editForm.value = { ...parsed };
    } else {
      profileData.value = { displayName: '', bio: '', avatarUrl: '', twitter: '', telegram: '' };
      editForm.value = { displayName: '', bio: '', avatarUrl: '', twitter: '', telegram: '' };
    }
  } catch {
    // Non-blocking
  }
}

function saveProfile() {
  if (typeof window === 'undefined' || !userAddress.value) return;
  profileData.value = { ...editForm.value };
  try {
    localStorage.setItem(
      `proto_profile_${userAddress.value.toLowerCase()}`,
      JSON.stringify(profileData.value),
    );
  } catch {
    // Non-blocking
  }
  editModalOpen.value = false;
}

function shareProfile() {
  if (typeof window === 'undefined') return;
  const url = window.location.href;
  navigator.clipboard.writeText(url);
  copiedShare.value = true;
  setTimeout(() => {
    copiedShare.value = false;
  }, 2000);
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${Math.max(1, diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchMyLaunches() {
  if (!userAddress.value) {
    myLaunches.value = [];
    return;
  }

  loadingLaunches.value = true;
  try {
    const res = await fetch(`/api/tokens?deployer=${userAddress.value}`);
    const envelope = (await res.json()) as {
      success: boolean;
      data: Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>;
    };
    if (envelope.success && Array.isArray(envelope.data)) {
      myLaunches.value = envelope.data.map((item) => ({
        address: item.token.address,
        name: item.token.name,
        symbol: item.token.symbol,
        logo: item.token.logo,
        version: item.token.version ?? 'v1',
        unclaimedWeth: '0.0000',
        redirect: null,
      }));
    }
  } catch {
    // Keep empty
  } finally {
    loadingLaunches.value = false;
  }
}

async function fetchUserPositionsAndActivity() {
  if (!userAddress.value) {
    portfolioPositions.value = [];
    userActivities.value = [];
    return;
  }

  try {
    const res = await fetch('/api/tokens');
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      const allTokens = envelope.data;
      const positions: PortfolioPosition[] = [];
      const activities: UserActivity[] = [];

      for (const t of allTokens) {
        try {
          const tradesRes = await fetch(`/api/tokens/${t.token.address}/trades`);
          const tradesEnv = await tradesRes.json();
          if (tradesEnv.success && Array.isArray(tradesEnv.data)) {
            let userTokenBal = 0;
            for (const tr of tradesEnv.data) {
              if (tr.trader.toLowerCase() === userAddress.value.toLowerCase()) {
                activities.push({
                  txHash: tr.transactionHash,
                  isBuy: tr.isBuy,
                  tokenSymbol: t.token.symbol,
                  ethAmount: tr.wethAmount,
                  tokenAmount: (Number(BigInt(tr.tokenAmount || '0')) / 1e18).toFixed(2),
                  timestamp: tr.timestamp,
                });
                const tokNum = Number(BigInt(tr.tokenAmount || '0')) / 1e18;
                if (tr.isBuy) {
                  userTokenBal += tokNum;
                } else {
                  userTokenBal = Math.max(0, userTokenBal - tokNum);
                }
              }
            }

            if (userTokenBal > 0) {
              positions.push({
                tokenAddress: t.token.address,
                name: t.token.name,
                symbol: t.token.symbol,
                balanceFormatted: userTokenBal.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                }),
                priceUsd: t.marketData.priceUsd,
                valueUsd: userTokenBal * t.marketData.priceUsd,
              });
            }
          }
        } catch {
          // Continue
        }
      }

      portfolioPositions.value = positions;
      activities.sort((a, b) => b.timestamp - a.timestamp);
      userActivities.value = activities;
    }
  } catch {
    // Non-blocking
  }
}

async function refreshAllData() {
  await Promise.all([fetchMyLaunches(), fetchUserPositionsAndActivity()]);
}

watch(userAddress, () => {
  loadLocalProfile();
  refreshAllData();
});

onMounted(() => {
  loadLocalProfile();
  refreshAllData();
});

function openCtoModal(tokenAddress: string) {
  selectedCtoToken.value = tokenAddress;
  newRecipientAddress.value = '';
  ctoModalOpen.value = true;
}

async function handleClaim(tokenAddress: string) {
  successTx.value = null;
  const hash = await claimFees(tokenAddress as `0x${string}`);
  if (hash) {
    successTx.value = hash;
  }
}

async function handleSetRedirect() {
  if (!selectedCtoToken.value || !newRecipientAddress.value) return;
  successTx.value = null;
  const hash = await setFeeRedirect(
    selectedCtoToken.value as `0x${string}`,
    newRecipientAddress.value as `0x${string}`,
  );
  if (hash) {
    successTx.value = hash;
    ctoModalOpen.value = false;
  }
}
</script>
