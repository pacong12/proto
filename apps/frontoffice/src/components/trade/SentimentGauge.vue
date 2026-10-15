<template>
  <div class="p-2.5 sm:p-3 rounded-2xl bg-card border border-border shadow-2xs space-y-2">
    <!-- Header: Title and Vote Stats -->
    <div class="flex items-center justify-between text-xs">
      <div class="flex items-center gap-1.5 font-bold text-foreground">
        <Flame class="w-3.5 h-3.5 text-primary" />
        <span>{{ t('communitySentiment') || 'Community Sentiment' }}</span>
      </div>
      <span class="text-[11px] font-mono text-muted-foreground">
        {{ totalVotes.toLocaleString() }} {{ totalVotes === 1 ? 'vote' : 'votes' }}
      </span>
    </div>

    <!-- Gauge Bar (Semantic emerald for Bull, rose for Bear) -->
    <div class="space-y-1">
      <div class="w-full h-2 rounded-full bg-muted/60 overflow-hidden flex">
        <div
          class="h-full bg-emerald-500 transition-all duration-500 rounded-l-full"
          :style="{ width: `${bullPercent}%` }"
        />
        <div
          class="h-full bg-rose-500 transition-all duration-500 rounded-r-full"
          :style="{ width: `${bearPercent}%` }"
        />
      </div>

      <div class="flex items-center justify-between text-[11px] font-mono font-bold">
        <span class="text-emerald-500 flex items-center gap-1">
          <TrendingUp class="w-3 h-3" />
          {{ bullPercent }}% Bullish
        </span>
        <span class="text-rose-500 flex items-center gap-1">
          {{ bearPercent }}% Bearish
          <TrendingDown class="w-3 h-3" />
        </span>
      </div>
    </div>

    <!-- Voting Buttons -->
    <div class="grid grid-cols-2 gap-2 pt-0.5">
      <Button
        variant="outline"
        size="sm"
        class="h-7 text-xs font-bold gap-1 rounded-xl transition cursor-pointer"
        :class="
          userVote === 'bull'
            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-500'
            : 'hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-500'
        "
        :disabled="isVoting"
        @click="castVote('bull')"
      >
        <Loader2 v-if="isVoting && votingTarget === 'bull'" class="w-3 h-3 animate-spin" />
        <TrendingUp v-else class="w-3 h-3" />
        <span>Bullish</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        class="h-7 text-xs font-bold gap-1 rounded-xl transition cursor-pointer"
        :class="
          userVote === 'bear'
            ? 'border-rose-500/60 bg-rose-500/15 text-rose-500'
            : 'hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-500'
        "
        :disabled="isVoting"
        @click="castVote('bear')"
      >
        <Loader2 v-if="isVoting && votingTarget === 'bear'" class="w-3 h-3 animate-spin" />
        <TrendingDown v-else class="w-3 h-3" />
        <span>Bearish</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Flame, TrendingUp, TrendingDown, Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/sonner';

interface Props {
  tokenAddress: string;
  account?: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const bullVotes = ref(0);
const bearVotes = ref(0);
const totalVotes = ref(0);
const bullPercent = ref(50);
const bearPercent = ref(50);
const userVote = ref<'bull' | 'bear' | null>(null);
const isVoting = ref(false);
const votingTarget = ref<'bull' | 'bear' | null>(null);

const STORAGE_PREFIX = 'proto_sentiment_vote_';

function getLocalVote(tokenAddr: string): 'bull' | 'bear' | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(`${STORAGE_PREFIX}${tokenAddr.toLowerCase()}`);
    return v === 'bull' || v === 'bear' ? v : null;
  } catch {
    return null;
  }
}

function setLocalVote(tokenAddr: string, vote: 'bull' | 'bear'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tokenAddr.toLowerCase()}`, vote);
  } catch {
    // ignore
  }
}

async function fetchSentiment(): Promise<void> {
  if (!props.tokenAddress) return;
  userVote.value = getLocalVote(props.tokenAddress);

  try {
    const userParam = props.account ? `?user=${props.account}` : '';
    const res = await apiFetch<{
      success: boolean;
      data: {
        bullVotes: number;
        bearVotes: number;
        totalVotes: number;
        bullPercent: number;
        bearPercent: number;
        userVote?: 'bull' | 'bear';
      };
    }>(`/api/tokens/${props.tokenAddress}/sentiment${userParam}`);

    if (res?.success && res.data) {
      bullVotes.value = res.data.bullVotes;
      bearVotes.value = res.data.bearVotes;
      totalVotes.value = res.data.totalVotes;
      bullPercent.value = res.data.bullPercent;
      bearPercent.value = res.data.bearPercent;
      if (res.data.userVote) {
        userVote.value = res.data.userVote;
        setLocalVote(props.tokenAddress, res.data.userVote);
      }
    }
  } catch {
    // Non-blocking fallback to local state
  }
}

async function castVote(vote: 'bull' | 'bear'): Promise<void> {
  if (isVoting.value || !props.tokenAddress) return;
  const voterAddr =
    props.account ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('proto_anon_voter') ||
        (() => {
          const gen = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
          localStorage.setItem('proto_anon_voter', gen);
          return gen;
        })()
      : '0x0000000000000000000000000000000000000001');

  isVoting.value = true;
  votingTarget.value = vote;

  try {
    const res = await apiFetch<{
      success: boolean;
      data: {
        bullVotes: number;
        bearVotes: number;
        totalVotes: number;
        bullPercent: number;
        bearPercent: number;
        userVote: 'bull' | 'bear';
      };
    }>(`/api/tokens/${props.tokenAddress}/sentiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: voterAddr, sentiment: vote }),
    });

    if (res?.success && res.data) {
      bullVotes.value = res.data.bullVotes;
      bearVotes.value = res.data.bearVotes;
      totalVotes.value = res.data.totalVotes;
      bullPercent.value = res.data.bullPercent;
      bearPercent.value = res.data.bearPercent;
      userVote.value = vote;
      setLocalVote(props.tokenAddress, vote);
      toast.success(vote === 'bull' ? 'Voted Bullish!' : 'Voted Bearish!');
    }
  } catch (err) {
    toast.error('Failed to register vote: ' + (err as Error).message);
  } finally {
    isVoting.value = false;
    votingTarget.value = null;
  }
}

onMounted(() => {
  fetchSentiment();
});

watch(
  () => [props.tokenAddress, props.account],
  () => {
    fetchSentiment();
  },
);
</script>
