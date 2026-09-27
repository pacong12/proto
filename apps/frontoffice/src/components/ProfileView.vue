<template>
  <div class="max-w-5xl mx-auto space-y-8">
    <!-- Profile Hero & Identity Card -->
    <Card
      class="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6 sm:space-y-8"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div
            class="relative group"
            :class="isOwnProfile ? 'cursor-pointer' : ''"
            @click="isOwnProfile && (editModalOpen = true)"
          >
            <Avatar
              class="w-16 h-16 rounded-full border-2 border-border overflow-hidden shadow-lg transition"
              :class="isOwnProfile ? 'group-hover:opacity-85' : ''"
            >
              <img
                v-if="resolvedAvatarUrl"
                :src="resolvedAvatarUrl"
                :alt="profileData.displayName"
                class="w-full h-full object-cover rounded-full"
              />
              <Jazzicon
                v-else
                :address="profileAddress || '0x0000000000000000000000000000000000000000'"
                :size="64"
                class="w-full h-full rounded-full"
              />
            </Avatar>
            <div
              v-if="isOwnProfile"
              class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Update profile photo"
            >
              <Camera class="w-5 h-5 text-white" />
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold tracking-tight text-foreground">
                {{
                  profileData.displayName ||
                  (profileAddress ? shortenAddress(profileAddress) : 'Anonymous Creator')
                }}
              </h1>
            </div>

            <p class="text-xs text-muted-foreground max-w-md">
              {{
                profileData.bio ||
                'Non-custodial creator and trader on Proto multi-chain launchpad.'
              }}
            </p>

            <div class="flex items-center gap-4 pt-1 text-xs text-muted-foreground flex-wrap">
              <a
                v-if="profileData.twitter"
                :href="`https://x.com/${profileData.twitter}`"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-foreground transition flex items-center gap-1 font-mono"
              >
                <span>@{{ profileData.twitter }}</span>
              </a>
              <a
                v-if="profileData.telegram"
                :href="`https://t.me/${profileData.telegram}`"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-foreground transition flex items-center gap-1 font-mono"
              >
                <span>t.me/{{ profileData.telegram }}</span>
              </a>
              <span class="font-mono text-muted-foreground">
                {{ profileAddress ? shortenAddress(profileAddress) : 'Not Connected' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons: Edit Profile & Share Profile -->
        <div class="flex items-center gap-2.5 self-start sm:self-center">
          <Button
            v-if="isOwnProfile"
            @click="editModalOpen = true"
            variant="outline"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted text-foreground cursor-pointer"
          >
            <Edit3 class="w-3.5 h-3.5" />
            Edit Profile
          </Button>

          <Button
            @click="shareProfile"
            variant="default"
            size="sm"
            class="h-8 text-xs font-semibold gap-1.5 font-bold cursor-pointer"
          >
            <Share2 class="w-3.5 h-3.5" />
            {{ copiedShare ? 'Copied Link!' : 'Share Profile' }}
          </Button>
        </div>
      </div>
    </Card>

    <!-- Disconnected Warning Banner -->
    <Card
      v-if="!profileAddress"
      class="border-border bg-muted/40 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div class="space-y-0.5 text-xs text-muted-foreground">
          <p class="font-semibold text-foreground text-sm">Wallet Not Connected</p>
          <p>
            Connect your wallet to view your token launches, portfolio positions, and activity
            history.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="default"
        class="h-9 px-4 font-bold text-xs shrink-0 cursor-pointer"
        @click="openWallet"
      >
        Connect Wallet
      </Button>
    </Card>

    <template v-else>
      <!-- Stats Summary Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-muted-foreground"
          >
            <Coins class="w-4 h-4 text-foreground" />
            {{ t('claimableFees') }}
          </p>
          <p class="text-2xl font-bold font-mono text-foreground mt-2">
            {{ totalClaimableWeth }} {{ activeNetwork.nativeCurrency.symbol }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">70% creator share</p>
        </Card>

        <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-muted-foreground"
          >
            <Rocket class="w-4 h-4 text-foreground" />
            {{ t('createdTokens') }}
          </p>
          <p class="text-2xl font-bold font-mono text-foreground mt-2">
            {{ myLaunches.length }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {{ isOwnProfile ? 'Deployed by your wallet' : 'Deployed by this creator' }}
          </p>
        </Card>

        <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-muted-foreground"
          >
            <PieChart class="w-4 h-4 text-foreground" />
            Active Positions
          </p>
          <p class="text-2xl font-bold font-mono text-foreground mt-2">
            {{ portfolioPositions.length }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">Tokens currently held</p>
        </Card>

        <Card class="p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-xs space-y-2">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-muted-foreground"
          >
            <Activity class="w-4 h-4 text-foreground" />
            Total Trades
          </p>
          <p class="text-2xl font-bold font-mono text-foreground mt-2">
            {{ userActivities.length }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">Buys & Sells recorded</p>
        </Card>
      </div>

      <!-- Success Notification -->
      <div
        v-if="successTx"
        class="text-xs text-foreground bg-muted/60 border border-border rounded-xl p-4 flex items-start justify-between gap-2 break-all"
      >
        <div class="flex items-start gap-2">
          <Check class="w-4 h-4 shrink-0 mt-0.5 text-foreground" />
          <span>Transaction Successful! Tx Hash: {{ successTx }}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          @click="successTx = null"
        >
          <X class="w-3.5 h-3.5" />
        </Button>
      </div>

      <!-- Action Error Notification -->
      <div
        v-if="actionError"
        class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start justify-between gap-2 break-words"
      >
        <div class="flex items-start gap-2">
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
          <span>{{ actionError }}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          @click="actionError = null"
        >
          <X class="w-3.5 h-3.5" />
        </Button>
      </div>

      <!-- Main Profile Tabs: Created Tokens, Portfolio, Activity -->
      <Card
        class="p-6 sm:p-8 border border-border bg-card rounded-3xl shadow-sm space-y-6 sm:space-y-8"
      >
        <Tabs v-model="activeTab" class="w-full">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3"
          >
            <TabsList
              class="flex sm:inline-flex w-full sm:w-auto overflow-x-auto no-scrollbar bg-muted p-1 rounded-xl border border-border gap-1 h-auto shrink-0"
            >
              <TabsTrigger
                value="created"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground whitespace-nowrap shrink-0"
              >
                {{ t('createdTokens') }} ({{ myLaunches.length }})
              </TabsTrigger>
              <TabsTrigger
                value="portfolio"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground whitespace-nowrap shrink-0"
              >
                {{ t('portfolio') }} ({{ portfolioPositions.length }})
              </TabsTrigger>
              <TabsTrigger
                value="dividends"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground whitespace-nowrap shrink-0"
              >
                {{ t('dividendsAndVesting') }}
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground whitespace-nowrap shrink-0"
              >
                {{ t('activity') }} ({{ userActivities.length }})
              </TabsTrigger>
            </TabsList>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 text-xs text-muted-foreground hover:text-foreground self-end sm:self-auto border border-border cursor-pointer"
              @click="refreshAllData"
            >
              <RefreshCw class="w-3.5 h-3.5 mr-1" :class="{ 'animate-spin': loadingLaunches }" />
              Refresh
            </Button>
          </div>

          <!-- TAB 1: CREATED TOKENS -->
          <TabsContent value="created" class="mt-4 space-y-4">
            <div v-if="loadingLaunches" class="py-12 text-center text-xs text-muted-foreground">
              <Loader2 class="w-5 h-5 text-foreground animate-spin mx-auto mb-2" />
              Loading created tokens...
            </div>
            <div
              v-else-if="myLaunches.length === 0"
              class="py-12 text-center text-xs text-muted-foreground"
            >
              No tokens launched from this address yet.
            </div>
            <div v-else class="space-y-4">
              <Card
                v-for="token in myLaunches"
                :key="token.address"
                class="bg-card border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div class="flex items-start gap-3.5">
                  <OptimizedImage
                    :src="token.logo"
                    :alt="token.name"
                    :fallback-text="token.symbol"
                    :width="48"
                    :height="48"
                    class="rounded-lg border border-border"
                  />

                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-bold text-base text-foreground">
                        {{ token.name }}
                      </h3>
                      <span class="text-xs font-mono text-muted-foreground"
                        >${{ token.symbol }}</span
                      >
                      <Badge
                        :variant="token.version === 'v2' ? 'outline' : 'secondary'"
                        class="text-[9px] px-1.5 py-0 h-4 font-mono uppercase"
                      >
                        {{ token.version === 'v2' ? 'v2 Curve' : 'v1 Direct' }}
                      </Badge>
                    </div>
                    <p
                      class="text-xs font-mono text-muted-foreground mt-0.5 break-all sm:break-normal"
                    >
                      {{ token.address }}
                    </p>
                    <div
                      class="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap"
                    >
                      <span>
                        Accrued:
                        <strong class="text-foreground font-mono"
                          >{{ token.unclaimedWeth }}
                          {{ activeNetwork.nativeCurrency.symbol }}</strong
                        >
                      </span>
                      <span>•</span>
                      <span>
                        Redirect:
                        <strong class="font-mono text-foreground">
                          {{ token.redirect ? `${token.redirect.slice(0, 6)}...` : 'None (Self)' }}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="isOwnProfile" class="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    @click="handleClaim(token.address)"
                    :disabled="loading || claimingToken === token.address"
                    variant="default"
                    size="sm"
                    class="cursor-pointer"
                  >
                    <Loader2
                      v-if="claimingToken === token.address"
                      class="w-3.5 h-3.5 mr-1 animate-spin"
                    />
                    <ArrowDownToLine v-else class="w-3.5 h-3.5 mr-1" />
                    Claim Fees
                  </Button>
                  <Button
                    @click="openCtoModal(token.address)"
                    variant="outline"
                    size="sm"
                    class="cursor-pointer"
                  >
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
              class="py-12 text-center text-xs text-muted-foreground"
            >
              No active token holdings found for this wallet.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs font-mono">
                <thead>
                  <tr class="border-b border-border text-muted-foreground">
                    <th class="py-2.5 px-3 font-semibold">Asset</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Balance</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Price (USD)</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Value (USD)</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr
                    v-for="pos in portfolioPositions"
                    :key="pos.tokenAddress"
                    class="hover:bg-muted/40 transition-colors"
                  >
                    <td class="py-2.5 px-3">
                      <div class="flex items-center gap-2">
                        <Avatar class="w-6 h-6 rounded border border-border overflow-hidden">
                          <AvatarFallback class="text-[9px] bg-muted text-foreground">
                            {{ pos.symbol.slice(0, 3) }}
                          </AvatarFallback>
                        </Avatar>
                        <span class="font-bold text-foreground">{{ pos.name }}</span>
                        <span class="text-muted-foreground">${{ pos.symbol }}</span>
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-right text-foreground font-medium">
                      {{ pos.balanceFormatted }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-muted-foreground">
                      ${{ pos.priceUsd.toFixed(8) }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-foreground font-bold">
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
                        class="h-7 px-2.5 text-xs font-semibold gap-1 border-border cursor-pointer"
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
            <div
              v-if="userActivities.length === 0"
              class="py-12 text-center text-xs text-muted-foreground"
            >
              No recent transactions recorded for this wallet.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs font-mono">
                <thead>
                  <tr class="border-b border-border text-muted-foreground">
                    <th class="py-2.5 px-3 font-semibold">Action</th>
                    <th class="py-2.5 px-3 font-semibold">Token</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Amount ETH</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Tokens</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Time</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Explorer</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr
                    v-for="act in userActivities"
                    :key="act.txHash"
                    class="hover:bg-muted/40 transition-colors"
                  >
                    <td class="py-2.5 px-3">
                      <Badge
                        :variant="act.isBuy ? 'default' : 'destructive'"
                        class="text-[9px] uppercase px-1.5 py-0"
                      >
                        {{ act.isBuy ? 'Buy' : 'Sell' }}
                      </Badge>
                    </td>
                    <td class="py-2.5 px-3 text-foreground font-medium">${{ act.tokenSymbol }}</td>
                    <td class="py-2.5 px-3 text-right text-foreground font-medium">
                      {{ act.ethAmount }} {{ activeNetwork.nativeCurrency.symbol }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-foreground">
                      {{ act.tokenAmount }}
                    </td>
                    <td class="py-2.5 px-3 text-right text-muted-foreground">
                      {{ formatTimeAgo(act.timestamp) }}
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <a
                        :href="`${activeNetwork.blockExplorer}/tx/${act.txHash}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-muted-foreground hover:text-foreground inline-flex items-center"
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
              <Card class="p-5 bg-card border-border space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Coins class="w-4 h-4 text-foreground" />
                    <h3 class="text-sm font-bold text-foreground">Holder Fee Sharing Dividends</h3>
                  </div>
                  <Badge variant="outline" class="text-[10px] font-mono text-muted-foreground">
                    70% Split
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                  Pro-rata trading fee rewards accrued from tokens you hold that enabled Holder Fee
                  Sharing.
                </p>
                <div class="flex items-end justify-between pt-2 border-t border-border">
                  <div>
                    <span class="text-[10px] text-muted-foreground uppercase font-mono"
                      >Claimable Reward</span
                    >
                    <p class="text-lg font-bold font-mono text-foreground">
                      0.0000 {{ activeNetwork.nativeCurrency.symbol }}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    :disabled="true"
                    class="h-8 text-xs font-semibold opacity-50 cursor-not-allowed"
                  >
                    <ArrowDownToLine class="w-3.5 h-3.5 mr-1" />
                    Claim Dividends
                  </Button>
                </div>
              </Card>

              <!-- Linear Vesting Schedule Card -->
              <Card class="p-5 bg-card border-border space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Lock class="w-4 h-4 text-foreground" />
                    <h3 class="text-sm font-bold text-foreground">Linear Vesting Vault</h3>
                  </div>
                  <Badge variant="outline" class="text-[10px] font-mono text-muted-foreground">
                    Continuous Release
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                  View and claim your non-custodial locked founder and team allocations.
                </p>
                <div class="flex items-end justify-between pt-2 border-t border-border">
                  <div>
                    <span class="text-[10px] text-muted-foreground uppercase font-mono"
                      >Vested Balance</span
                    >
                    <p class="text-lg font-bold font-mono text-foreground">
                      0.00 {{ activeNetwork.nativeCurrency.symbol }}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="true"
                    class="h-8 text-xs font-semibold opacity-50 cursor-not-allowed"
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
          class="w-[calc(100vw-2rem)] sm:max-w-lg bg-card border-border text-foreground transition-all duration-200"
        >
          <DialogHeader>
            <div class="flex items-center gap-2 text-foreground mb-1">
              <Edit3 class="w-5 h-5" />
              <DialogTitle>Edit Creator Profile</DialogTitle>
            </div>
            <DialogDescription class="text-xs text-muted-foreground">
              Customize your public creator identity, social handles, and bio.
            </DialogDescription>
          </DialogHeader>

          <div
            class="p-2.5 rounded-lg border border-border bg-muted/40 text-[11px] text-muted-foreground"
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
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-foreground/50',
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
                  class="w-14 h-14 rounded-full border border-border overflow-hidden shrink-0 shadow-xs"
                >
                  <img
                    v-if="editResolvedAvatar"
                    :src="editResolvedAvatar"
                    alt="Preview"
                    class="w-full h-full object-cover rounded-full"
                  />
                  <div
                    v-else-if="isUploadingAvatar"
                    class="w-full h-full flex items-center justify-center bg-muted"
                  >
                    <Loader2 class="w-5 h-5 text-foreground animate-spin" />
                  </div>
                  <Jazzicon
                    v-else
                    :address="profileAddress || '0x0000000000000000000000000000000000000000'"
                    :size="56"
                    class="w-full h-full rounded-full"
                  />
                </Avatar>

                <!-- Status & Action Copy -->
                <div class="flex-1 min-w-0 space-y-0.5">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span
                      class="text-xs font-bold text-foreground truncate block flex-1 min-w-0"
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
                      class="text-[9px] px-1 py-0 bg-muted text-foreground border-border flex items-center gap-1 shrink-0"
                    >
                      <Loader2 class="w-2.5 h-2.5 animate-spin" />
                      Optimizing...
                    </Badge>
                    <Badge
                      v-else-if="editForm.avatarUrl"
                      variant="outline"
                      class="text-[9px] px-1 py-0 bg-muted text-foreground border-border shrink-0"
                    >
                      Active
                    </Badge>
                  </div>
                  <p class="text-[11px] text-muted-foreground truncate">
                    Click or drag image (PNG, JPG, WEBP max 5MB).
                  </p>
                </div>

                <!-- Remove Photo Button -->
                <Button
                  v-if="editForm.avatarUrl"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded cursor-pointer"
                  title="Remove photo"
                  @click.stop="removeAvatar"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </Button>
              </div>

              <!-- Inline Avatar Error Banner -->
              <div
                v-if="avatarError"
                class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2 flex items-start gap-1.5"
              >
                <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{{ avatarError }}</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label for="edit-x" class="text-xs font-medium">X (Twitter)</Label>
                <div class="relative">
                  <span
                    class="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground select-none"
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
                  <span
                    class="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground select-none"
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                @click="editModalOpen = false"
                class="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" class="cursor-pointer"
                >Save Profile</Button
              >
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <!-- CTO Modal -->
      <Dialog v-model:open="ctoModalOpen">
        <DialogContent
          class="w-[calc(100vw-2rem)] sm:max-w-lg bg-card border-border text-foreground transition-all duration-200"
        >
          <DialogHeader>
            <div class="flex items-center gap-2 text-foreground mb-1">
              <ShieldAlert class="w-5 h-5 text-foreground" />
              <DialogTitle>Community Takeover (CTO) Redirect</DialogTitle>
            </div>
            <DialogDescription class="text-xs text-muted-foreground">
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
                class="font-mono text-xs text-muted-foreground"
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

            <!-- Inline CTO Error -->
            <div
              v-if="ctoError"
              class="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 flex items-start gap-1.5"
            >
              <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
              <span>{{ ctoError }}</span>
            </div>
          </div>

          <DialogFooter class="gap-2">
            <Button variant="outline" size="sm" @click="ctoModalOpen = false" class="cursor-pointer"
              >Cancel</Button
            >
            <Button
              variant="default"
              size="sm"
              :disabled="loading || !isAddressValid(newRecipientAddress)"
              class="cursor-pointer"
              @click="handleSetRedirect"
            >
              <Loader2 v-if="loading" class="w-3.5 h-3.5 mr-1 animate-spin" />
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
import { useRoute } from 'vue-router';
import {
  Coins,
  Rocket,
  Lock,
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
  ArrowDownToLine,
  X,
} from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';
import { useLaunchpad } from '../composables/useLaunchpad';
import { useWallet } from '../composables/useWallet';
import { walletAddress } from '../lib/wallet-store';
import { shortenAddress } from '@/lib/utils';
import { compressAndConvertToWebp } from '@/lib/image-optimizer';

const { t } = useI18n();
const { activeNetwork, openWallet } = useWallet();
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
import { erc20Abi } from 'viem';
import { getPublicClient } from '@/lib/viem-client';
import { liquidityLockerAbi } from '@proto/shared-types';

const route = useRoute();

function isAddressValid(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

// Support viewing either a specific address via route parameter or the currently connected wallet
const profileAddress = computed(() => {
  const param = route.params.address as string | undefined;
  if (param && isAddressValid(param)) {
    return param.toLowerCase();
  }
  return walletAddress.value ? walletAddress.value.toLowerCase() : null;
});

const isOwnProfile = computed(() => {
  if (!walletAddress.value || !profileAddress.value) return false;
  return walletAddress.value.toLowerCase() === profileAddress.value.toLowerCase();
});

const { claimFees, setFeeRedirect, loading, error: launchpadError } = useLaunchpad();

const activeTab = ref('created');
const editModalOpen = ref(false);
const ctoModalOpen = ref(false);
const selectedCtoToken = ref<string>('');
const newRecipientAddress = ref<string>('');
const successTx = ref<string | null>(null);
const actionError = ref<string | null>(null);
const ctoError = ref<string | null>(null);
const avatarError = ref<string | null>(null);
const loadingLaunches = ref(false);
const claimingToken = ref<string | null>(null);
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
  avatarError.value = null;
  if (!file.type.startsWith('image/')) {
    avatarError.value = 'Please select a valid image file (PNG, JPG, WEBP, GIF).';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    avatarError.value = 'Image file size must be less than 5MB.';
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
  avatarError.value = null;
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

function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('ipfs://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  );
}

const resolvedAvatarUrl = computed(() => {
  if (!profileData.value.avatarUrl) return '';
  const url = profileData.value.avatarUrl.trim();
  if (!isSafeImageUrl(url)) return '';
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return url;
});

const editResolvedAvatar = computed(() => {
  if (!editForm.value.avatarUrl) return '';
  const url = editForm.value.avatarUrl.trim();
  if (!isSafeImageUrl(url)) return '';
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return url;
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
  const target = profileAddress.value;
  if (typeof window === 'undefined' || !target) return;
  try {
    const raw = localStorage.getItem(`proto_profile_${target.toLowerCase()}`);
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
  const target = profileAddress.value;
  if (typeof window === 'undefined' || !target) return;
  profileData.value = { ...editForm.value };
  try {
    localStorage.setItem(
      `proto_profile_${target.toLowerCase()}`,
      JSON.stringify(profileData.value),
    );
  } catch {
    // Non-blocking
  }
  editModalOpen.value = false;
}

function shareProfile() {
  if (typeof window === 'undefined' || !profileAddress.value) return;
  const url = `${window.location.origin}/profile/${profileAddress.value}`;
  navigator.clipboard.writeText(url).catch(() => {});
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
  const target = profileAddress.value;
  if (!target) {
    myLaunches.value = [];
    return;
  }

  loadingLaunches.value = true;
  try {
    const res = await fetch(`/api/tokens?deployer=${target}`);
    const envelope = (await res.json()) as {
      success: boolean;
      data: Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }>;
    };
    if (envelope.success && Array.isArray(envelope.data)) {
      const publicClient = getPublicClient(activeNetwork.value.chainId);
      const lockerAddr = activeNetwork.value.contracts.locker;
      const hasLocker = lockerAddr && lockerAddr !== '0x0000000000000000000000000000000000000000';

      const launches = await Promise.all(
        envelope.data.map(async (item) => {
          let redirect: string | null = null;
          if (hasLocker) {
            try {
              const r = (await publicClient.readContract({
                address: lockerAddr,
                abi: liquidityLockerAbi,
                functionName: 'feeRedirects',
                args: [item.token.address as `0x${string}`],
              })) as string;
              if (r && r !== '0x0000000000000000000000000000000000000000') {
                redirect = r;
              }
            } catch {
              // Non-blocking
            }
          }
          return {
            address: item.token.address,
            name: item.token.name,
            symbol: item.token.symbol,
            logo: item.token.logo,
            version: item.token.version ?? 'v1',
            unclaimedWeth: '0.0000',
            redirect,
          };
        }),
      );
      myLaunches.value = launches;
    } else {
      myLaunches.value = [];
    }
  } catch {
    myLaunches.value = [];
  } finally {
    loadingLaunches.value = false;
  }
}

async function fetchUserPositionsAndActivity() {
  const target = profileAddress.value;
  if (!target) {
    portfolioPositions.value = [];
    userActivities.value = [];
    return;
  }

  try {
    // 1. Fetch user trades in ONE single fast request from the API
    const [tradesRes, tokensRes] = await Promise.all([
      fetch(`/api/trades?trader=${target}&limit=100`).catch(() => null),
      fetch('/api/tokens?limit=100').catch(() => null),
    ]);

    const tradesJson = tradesRes?.ok ? await tradesRes.json().catch(() => null) : null;
    const tokensJson = tokensRes?.ok ? await tokensRes.json().catch(() => null) : null;

    const allTokens: Array<{ token: LaunchedTokenEntity; marketData: TokenMarketData }> =
      tokensJson?.success && Array.isArray(tokensJson.data) ? tokensJson.data : [];

    const tokenMap = new Map<string, { token: LaunchedTokenEntity; marketData: TokenMarketData }>();
    for (const item of allTokens) {
      tokenMap.set(item.token.address.toLowerCase(), item);
    }

    const activities: UserActivity[] = [];
    const candidateAddresses = new Set<string>();

    if (tradesJson?.success && Array.isArray(tradesJson.data)) {
      for (const tr of tradesJson.data) {
        const tMeta = tokenMap.get(tr.tokenAddress.toLowerCase());
        const sym = tMeta ? tMeta.token.symbol : 'TOKEN';
        candidateAddresses.add(tr.tokenAddress.toLowerCase());
        activities.push({
          txHash: tr.transactionHash,
          isBuy: tr.isBuy,
          tokenSymbol: sym,
          ethAmount: tr.wethAmount,
          tokenAmount: parseFloat(tr.tokenAmount || '0').toFixed(2),
          timestamp: tr.timestamp,
        });
      }
    }

    // Also include any tokens created by this user as candidates for portfolio
    for (const launch of myLaunches.value) {
      candidateAddresses.add(launch.address.toLowerCase());
    }

    userActivities.value = activities;

    // 2. Query on-chain balances concurrently for candidate tokens
    const client = getPublicClient(activeNetwork.value.chainId);
    const candidateList = Array.from(candidateAddresses);
    const balancePromises = candidateList.map(async (addr) => {
      const meta = tokenMap.get(addr);
      if (!meta) return null;
      try {
        const bal = (await client.readContract({
          address: meta.token.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [target as `0x${string}`],
        })) as bigint;
        if (bal > 0n) {
          const decimals = meta.token.decimals || 18;
          const num = Number(bal) / 10 ** decimals;
          return {
            tokenAddress: meta.token.address,
            name: meta.token.name,
            symbol: meta.token.symbol,
            balanceFormatted: num.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
            priceUsd: meta.marketData.priceUsd,
            valueUsd: num * meta.marketData.priceUsd,
          };
        }
      } catch {
        // Non-blocking
      }
      return null;
    });

    const settled = await Promise.allSettled(balancePromises);
    const validPositions: PortfolioPosition[] = [];
    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value) {
        validPositions.push(res.value);
      }
    }

    portfolioPositions.value = validPositions;
  } catch {
    // Non-blocking
  }
}

async function refreshAllData() {
  await Promise.all([fetchMyLaunches(), fetchUserPositionsAndActivity()]);
}

watch(profileAddress, () => {
  loadLocalProfile();
  refreshAllData();
});

watch(
  () => route.params.address,
  () => {
    loadLocalProfile();
    refreshAllData();
  },
);

onMounted(() => {
  loadLocalProfile();
  refreshAllData();
});

function openCtoModal(tokenAddress: string) {
  selectedCtoToken.value = tokenAddress;
  newRecipientAddress.value = '';
  ctoError.value = null;
  ctoModalOpen.value = true;
}

async function handleClaim(tokenAddress: string) {
  successTx.value = null;
  actionError.value = null;
  claimingToken.value = tokenAddress;
  try {
    const hash = await claimFees(tokenAddress as `0x${string}`);
    if (hash) {
      successTx.value = hash;
      await refreshAllData();
    } else if (launchpadError.value) {
      actionError.value = launchpadError.value;
    }
  } catch (err) {
    actionError.value = (err as Error).message || 'Failed to claim fees';
  } finally {
    claimingToken.value = null;
  }
}

async function handleSetRedirect() {
  if (!selectedCtoToken.value || !newRecipientAddress.value) return;
  if (!isAddressValid(newRecipientAddress.value)) {
    ctoError.value = 'Please enter a valid 20-byte address (0x followed by 40 hex characters).';
    return;
  }
  successTx.value = null;
  actionError.value = null;
  ctoError.value = null;
  try {
    const hash = await setFeeRedirect(
      selectedCtoToken.value as `0x${string}`,
      newRecipientAddress.value as `0x${string}`,
    );
    if (hash) {
      successTx.value = hash;
      ctoModalOpen.value = false;
      await refreshAllData();
    } else if (launchpadError.value) {
      ctoError.value = launchpadError.value;
    }
  } catch (err) {
    ctoError.value = (err as Error).message || 'Failed to set fee redirect';
  }
}
</script>
