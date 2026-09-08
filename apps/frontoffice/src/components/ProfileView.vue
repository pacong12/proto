<template>
  <div class="max-w-4xl mx-auto space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <User class="w-6 h-6 text-emerald-400" />
          <h1 class="text-3xl font-bold tracking-tight text-white">Creator & Holder Profile</h1>
        </div>
        <p class="text-zinc-400 text-sm mt-1">
          Manage your launches, claim accrued trading fees (70% creator split), and configure
          community takeovers.
        </p>
      </div>

      <div
        class="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs font-mono"
      >
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-zinc-300"
          >Connected:
          {{
            userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : '0x1111...1111'
          }}</span
        >
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p class="text-xs text-zinc-500 uppercase font-semibold flex items-center gap-1.5">
          <Coins class="w-4 h-4 text-emerald-400" />
          Claimable WETH Fees
        </p>
        <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">0.4250 ETH</p>
        <p class="text-xs text-zinc-500 mt-1">70% creator share</p>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p class="text-xs text-zinc-500 uppercase font-semibold flex items-center gap-1.5">
          <Rocket class="w-4 h-4 text-emerald-400" />
          My Token Launches
        </p>
        <p class="text-2xl font-bold font-mono text-white mt-2">{{ myLaunches.length }}</p>
        <p class="text-xs text-zinc-500 mt-1">Active in Uniswap V3</p>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p class="text-xs text-zinc-500 uppercase font-semibold flex items-center gap-1.5">
          <ShieldCheck class="w-4 h-4 text-emerald-400" />
          Liquidity Lock Status
        </p>
        <p class="text-2xl font-bold font-mono text-emerald-400 mt-2">100% Locked</p>
        <p class="text-xs text-zinc-500 mt-1">Permanent Locker Contract</p>
      </div>
    </div>

    <!-- Launches Table & Actions -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <Flame class="w-5 h-5 text-emerald-400" />
          My Launched Tokens & Creator Fees
        </h2>
        <span class="text-xs text-zinc-500">Live on Robinhood Chain</span>
      </div>

      <div class="space-y-4">
        <div
          v-for="token in myLaunches"
          :key="token.address"
          class="bg-zinc-950 border border-zinc-800/80 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="flex items-start gap-3.5">
            <div
              class="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-base text-emerald-400 border border-zinc-700"
            >
              {{ token.symbol.slice(0, 3) }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-white text-base">{{ token.name }}</h3>
                <span class="text-xs font-mono text-zinc-400">${{ token.symbol }}</span>
              </div>
              <p class="text-xs font-mono text-zinc-500 mt-0.5">{{ token.address }}</p>
              <div class="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                <span
                  >Accrued:
                  <strong class="text-emerald-400 font-mono"
                    >{{ token.unclaimedWeth }} ETH</strong
                  ></span
                >
                <span>•</span>
                <span
                  >Redirect:
                  <strong class="text-zinc-300 font-mono">{{
                    token.redirect ? `${token.redirect.slice(0, 6)}...` : 'None (Self)'
                  }}</strong></span
                >
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-center">
            <button
              @click="handleClaim(token.address)"
              :disabled="loading"
              class="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold text-xs px-3.5 py-2 rounded-lg transition"
            >
              <ArrowDownToLine class="w-3.5 h-3.5" />
              Claim Fees
            </button>
            <button
              @click="openCtoModal(token.address)"
              class="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3.5 py-2 rounded-lg transition"
            >
              <Share2 class="w-3.5 h-3.5" />
              CTO Redirect
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CTO Community Takeover Modal -->
    <div
      v-if="ctoModalOpen"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <ShieldAlert class="w-5 h-5 text-emerald-400" />
            <h3 class="text-lg font-bold text-white">Community Takeover (CTO)</h3>
          </div>
          <button @click="ctoModalOpen = false" class="text-zinc-500 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-zinc-400 leading-relaxed">
          Redirect this token's 70% creator fee stream to an active community multisig or treasury
          wallet. Locked pool liquidity is unaffected.
        </p>

        <div class="space-y-1.5">
          <label class="block text-xs font-semibold uppercase text-zinc-400">Target Token</label>
          <input
            :value="selectedCtoToken"
            disabled
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-400"
          />
        </div>

        <div class="space-y-1.5">
          <label class="block text-xs font-semibold uppercase text-zinc-400"
            >New Fee Recipient Address</label
          >
          <input
            v-model="newRecipientAddress"
            type="text"
            placeholder="0x..."
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="flex gap-3 pt-2">
          <button
            @click="ctoModalOpen = false"
            class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2.5 rounded-lg text-xs transition"
          >
            Cancel
          </button>
          <button
            @click="handleSetRedirect"
            :disabled="loading || !newRecipientAddress"
            class="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg text-xs transition"
          >
            {{ loading ? 'Submitting...' : 'Confirm Redirect' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Success Message -->
    <div
      v-if="successTx"
      class="flex items-start gap-2 bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-xs text-emerald-400 break-all"
    >
      <Check class="w-4 h-4 shrink-0 mt-0.5" />
      <span>Transaction Successful: {{ successTx }}</span>
    </div>
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
  X,
  Check,
} from 'lucide-vue-next';
import { useLaunchpad } from '../composables/useLaunchpad';

const { claimFees, setFeeRedirect, loading } = useLaunchpad();

const userAddress = ref<string | null>('0x1111111111111111111111111111111111111111');
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

const myLaunches = ref<MyLaunchItem[]>([
  {
    address: '0x39dBED3a2bd333467115dE45665cC57F813C4571',
    name: 'Pons Token',
    symbol: 'PONS',
    unclaimedWeth: '0.3500',
    redirect: null,
  },
  {
    address: '0xab093dEF657F15dF31b33922A95e047aDd645B29',
    name: 'Robinhood Alpha',
    symbol: 'RALPHA',
    unclaimedWeth: '0.0750',
    redirect: null,
  },
]);

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
