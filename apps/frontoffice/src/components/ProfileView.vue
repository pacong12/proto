<template>
  <div class="max-w-4xl mx-auto space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <User class="w-6 h-6 text-emerald-400" />
          <h1 class="text-3xl font-bold tracking-tight">Creator &amp; Holder Profile</h1>
        </div>
        <p class="text-sm mt-1">
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
          <p class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono">
            <Coins class="w-4 h-4 text-emerald-400" />
            Claimable WETH Fees
          </p>
          <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">0.4250 ETH</p>
          <p class="text-xs mt-1">70% creator share</p>
        </Card>

        <Card class="p-5">
          <p class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono">
            <Rocket class="w-4 h-4 text-emerald-400" />
            My Token Launches
          </p>
          <p class="text-2xl font-bold font-mono mt-2">{{ myLaunches.length }}</p>
          <p class="text-xs mt-1">Active in Uniswap V3</p>
        </Card>

        <Card class="p-5">
          <p class="text-xs uppercase font-semibold flex items-center gap-1.5 font-mono">
            <ShieldCheck class="w-4 h-4 text-emerald-400" />
            Liquidity Lock Status
          </p>
          <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">100% Locked</p>
          <p class="text-xs mt-1">Permanent Locker Contract</p>
        </Card>
      </div>

      <!-- Launches Table & Actions using Shadcn Card & Button -->
      <Card class="p-6 space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold flex items-center gap-2">
            <Flame class="w-5 h-5 text-emerald-400" />
            My Launched Tokens &amp; Creator Fees
          </h2>
          <span class="text-xs">Live on Robinhood Chain</span>
        </div>

        <div v-if="myLaunches.length === 0" class="py-8 text-center text-xs">
          No tokens launched from this address yet.
        </div>

        <div v-else class="space-y-4">
          <Card
            v-for="token in myLaunches"
            :key="token.address"
            class="bg-zinc-950 border-zinc-800/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="flex items-start gap-3.5">
              <Avatar class="w-12 h-12 rounded-lg border border-zinc-700">
                <AvatarFallback class="bg-zinc-800 text-emerald-400 font-bold text-base rounded-lg">
                  {{ token.symbol.slice(0, 3) }}
                </AvatarFallback>
              </Avatar>

              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-base">{{ token.name }}</h3>
                  <span class="text-xs font-mono">${{ token.symbol }}</span>
                </div>
                <p class="text-xs font-mono mt-0.5">{{ token.address }}</p>
                <div class="flex items-center gap-3 mt-2 text-xs">
                  <span
                    >Accrued:
                    <strong class="text-emerald-400 font-mono"
                      >{{ token.unclaimedWeth }} ETH</strong
                    ></span
                  >
                  <span>•</span>
                  <span
                    >Redirect:
                    <strong class="font-mono">{{
                      token.redirect ? `${token.redirect.slice(0, 6)}...` : 'None (Self)'
                    }}</strong></span
                  >
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
              <DialogTitle>Community Takeover (CTO)</DialogTitle>
            </div>
            <DialogDescription>
              Redirect this token's 70% creator fee stream to an active community multisig or
              treasury wallet. Locked pool liquidity is unaffected.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label>Target Token</Label>
              <Input :value="selectedCtoToken" disabled class="font-mono text-xs" />
            </div>

            <div class="space-y-1.5">
              <Label for="cto-recipient">New Fee Recipient Address</Label>
              <Input
                id="cto-recipient"
                v-model="newRecipientAddress"
                type="text"
                placeholder="0x..."
                class="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter class="gap-2">
            <Button variant="outline" @click="ctoModalOpen = false"> Cancel </Button>
            <Button
              variant="default"
              :disabled="loading || !newRecipientAddress"
              @click="handleSetRedirect"
            >
              {{ loading ? 'Submitting...' : 'Confirm Redirect' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Success Notification using Shadcn Card -->
      <Card
        v-if="successTx"
        class="border-emerald-800 bg-emerald-950/40 p-4 text-xs text-emerald-400 break-all flex items-start gap-2"
      >
        <Check class="w-4 h-4 shrink-0 mt-0.5" />
        <span>Transaction Successful: {{ successTx }}</span>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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
} from 'lucide-vue-next';
import { useLaunchpad } from '../composables/useLaunchpad';
import { walletAddress } from '../lib/wallet-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

interface MyLaunchItem {
  address: string;
  name: string;
  symbol: string;
  unclaimedWeth: string;
  redirect: string | null;
}

const myLaunches = ref<MyLaunchItem[]>([]);

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
