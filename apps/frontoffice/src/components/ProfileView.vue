<template>
  <div class="max-w-4xl mx-auto space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <User class="w-6 h-6 text-emerald-400" />
          <h1 class="text-3xl font-bold tracking-tight">Creator &amp; Holder Profile</h1>
        </div>
        <p class="text-sm mt-1 text-zinc-400">
          Manage your launches, claim accrued trading fees (70% creator split), and configure
          community takeovers.
        </p>
      </div>

      <div
        class="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-mono"
      >
        <Jazzicon :address="userAddress" :size="20" class="border border-zinc-700" />
        <span>
          Connected:
          {{
            userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Not connected'
          }}
        </span>
      </div>
    </div>

    <!-- Disconnected Warning Banner -->
    <Card
      v-if="!userAddress"
      class="border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-400 flex items-start gap-3"
    >
      <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
      <span>Connect your wallet to view your launches and claim creator fees.</span>
    </Card>

    <template v-else>
      <!-- Stats Grid using Shadcn Card -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card class="p-5">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-zinc-400"
          >
            <Coins class="w-4 h-4 text-emerald-400" />
            Claimable WETH Fees
          </p>
          <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {{ totalClaimableWeth }} ETH
          </p>
          <p class="text-xs text-zinc-500 mt-1">70% creator share</p>
        </Card>

        <Card class="p-5">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-zinc-400"
          >
            <Rocket class="w-4 h-4 text-emerald-400" />
            My Token Launches
          </p>
          <p class="text-2xl font-bold font-mono text-white mt-2">{{ myLaunches.length }}</p>
          <p class="text-xs text-zinc-500 mt-1">Active on Robinhood Chain</p>
        </Card>

        <Card class="p-5">
          <p
            class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono text-zinc-400"
          >
            <ShieldCheck class="w-4 h-4 text-emerald-400" />
            Liquidity Lock Status
          </p>
          <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">100% Locked</p>
          <p class="text-xs text-zinc-500 mt-1">Permanent Nonfungible Locker</p>
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

      <!-- Loading State -->
      <div v-if="loadingLaunches" class="flex items-center justify-center py-12">
        <Loader2 class="w-6 h-6 text-emerald-400 animate-spin" />
        <span class="ml-3 text-sm text-zinc-400">Loading your launches from blockchain...</span>
      </div>

      <!-- User Launches List with Action Buttons -->
      <Card v-else class="p-6 space-y-6">
        <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 class="text-base font-bold flex items-center gap-2">
            <Flame class="w-4 h-4 text-emerald-400" />
            Tokens You Launched
          </h2>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs text-zinc-400 hover:text-white"
            @click="fetchMyLaunches"
          >
            <RefreshCw class="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>

        <div v-if="myLaunches.length === 0" class="py-8 text-center text-xs text-zinc-500">
          No tokens launched from this address yet.
        </div>

        <div v-else class="space-y-4">
          <Card
            v-for="token in myLaunches"
            :key="token.address"
            class="bg-zinc-950 border-zinc-800/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-start gap-3.5">
              <Avatar class="w-12 h-12 rounded-lg border border-zinc-700 overflow-hidden">
                <img
                  v-if="token.logo && token.logo.startsWith('http')"
                  :src="token.logo"
                  :alt="token.name"
                  class="w-full h-full object-cover"
                />
                <AvatarFallback class="bg-zinc-800 text-emerald-400 font-bold text-base rounded-lg">
                  {{ token.symbol.slice(0, 3) }}
                </AvatarFallback>
              </Avatar>

              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-base text-white">{{ token.name }}</h3>
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
                      >{{ token.unclaimedWeth }} ETH</strong
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
      </Card>

      <!-- CTO Community Takeover Modal using Shadcn Dialog -->
      <Dialog v-model:open="ctoModalOpen">
        <DialogContent class="max-w-md">
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
                class="font-mono text-xs text-zinc-400"
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
              <p class="text-[11px] text-zinc-500">
                Ensure this address is accurate. This will redirect future creator fees.
              </p>
            </div>
          </div>

          <DialogFooter class="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" @click="ctoModalOpen = false">Cancel</Button>
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
  ShieldCheck,
  Flame,
  ArrowDownToLine,
  Share2,
  ShieldAlert,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-vue-next';
import { useLaunchpad } from '../composables/useLaunchpad';
import { walletAddress } from '../lib/wallet-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, Jazzicon } from '@/components/ui/avatar';
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

const { claimFees, setFeeRedirect, loading } = useLaunchpad();

const userAddress = walletAddress;
const ctoModalOpen = ref(false);
const selectedCtoToken = ref<string>('');
const newRecipientAddress = ref<string>('');
const successTx = ref<string | null>(null);
const loadingLaunches = ref(false);

interface MyLaunchItem {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  version?: 'v1' | 'v2';
  unclaimedWeth: string;
  redirect: string | null;
}

const myLaunches = ref<MyLaunchItem[]>([]);

const totalClaimableWeth = computed(() => {
  const sum = myLaunches.value.reduce(
    (acc, item) => acc + parseFloat(item.unclaimedWeth || '0'),
    0,
  );
  return sum.toFixed(4);
});

async function fetchMyLaunches() {
  if (!userAddress.value) {
    myLaunches.value = [];
    return;
  }

  loadingLaunches.value = true;
  try {
    const res = await fetch(`/api/tokens?deployer=${userAddress.value}`);
    const envelope = await res.json();
    if (envelope.success && Array.isArray(envelope.data)) {
      myLaunches.value = envelope.data.map((item: any) => ({
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

watch(userAddress, () => {
  fetchMyLaunches();
});

onMounted(() => {
  fetchMyLaunches();
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
