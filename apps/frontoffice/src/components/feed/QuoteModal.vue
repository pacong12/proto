<template>
  <div
    v-if="isOpen && targetCall"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[90vh]"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div class="flex items-center gap-2">
          <Quote class="w-4 h-4 text-primary" />
          <h2 class="text-sm font-bold text-foreground">Quote Callout</h2>
        </div>
        <button
          type="button"
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 overflow-y-auto">
        <!-- Quote commentary input -->
        <div class="flex items-start gap-3">
          <Jazzicon
            :address="account || '0x0000000000000000000000000000000000000000'"
            :size="32"
            class="shrink-0 rounded-full mt-1"
          />
          <div class="flex-1 min-w-0 space-y-2">
            <textarea
              v-model="quoteContent"
              rows="3"
              maxlength="500"
              placeholder="Add your thoughts or commentary on this call..."
              class="w-full text-xs font-sans p-3 rounded-xl border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
            />
            <div class="flex justify-end">
              <span class="text-[10px] text-muted-foreground font-mono">
                {{ quoteContent.length }}/500
              </span>
            </div>
          </div>
        </div>

        <!-- Embedded Quoted Callout Card Preview -->
        <div class="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Jazzicon :address="targetCall.authorAddress" :size="18" />
              <span class="font-bold text-foreground">
                {{ shortenAddress(targetCall.authorAddress, 6, 4) }}
              </span>
              <span v-if="targetCall.tokenSymbol" class="text-primary font-bold">
                ${{ targetCall.tokenSymbol }}
              </span>
            </div>
            <span class="text-[10px] text-muted-foreground">
              {{ formatRelativeTime(targetCall.createdAt) }}
            </span>
          </div>
          <p class="text-xs text-foreground font-sans line-clamp-3">
            {{ targetCall.content }}
          </p>
        </div>

        <!-- Position Warning if required -->
        <div
          v-if="account && callerBalance <= 0 && !checkingBalance"
          class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center gap-2 text-[11px]"
        >
          <AlertCircle class="w-3.5 h-3.5 shrink-0" />
          <span>
            You need a position in ${{ targetCall.tokenSymbol || 'this token' }} to quote this call.
          </span>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-border flex items-center justify-between bg-card">
        <Button
          variant="outline"
          size="sm"
          class="h-8 text-xs font-mono font-bold cursor-pointer"
          @click="emit('close')"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          class="h-8 px-4 text-xs font-mono font-bold gap-1.5 cursor-pointer shadow-xs"
          :disabled="isSubmitting || !quoteContent.trim() || callerBalance <= 0"
          @click="submitQuote"
        >
          <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
          <Quote v-else class="w-3.5 h-3.5" />
          <span>Post Quote</span>
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Quote, X, AlertCircle, Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Jazzicon } from '@/components/ui/avatar';
import { shortenAddress, formatRelativeTime } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { FeedCalloutItem } from '@proto/shared-types';

const props = defineProps<{
  isOpen: boolean;
  targetCall: FeedCalloutItem | null;
  account?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'quote-posted', callout: FeedCalloutItem): void;
}>();

const quoteContent = ref('');
const isSubmitting = ref(false);
const callerBalance = ref(1); // default 1 if not checked
const checkingBalance = ref(false);

watch(
  () => [props.targetCall, props.account],
  async () => {
    if (props.targetCall && props.account && props.isOpen) {
      checkingBalance.value = true;
      try {
        const res = await fetch(
          `/api/tokens/${props.targetCall.tokenAddress}/balance?account=${props.account}`,
        );
        const data = await res.json();
        if (data.success && data.data) {
          callerBalance.value = Number(data.data.balance || 0);
        } else {
          callerBalance.value = 0;
        }
      } catch {
        callerBalance.value = 0;
      } finally {
        checkingBalance.value = false;
      }
    }
  },
  { immediate: true },
);

async function submitQuote(): Promise<void> {
  if (!props.account) {
    toast.error('Connect wallet to post');
    return;
  }
  if (!props.targetCall || !quoteContent.value.trim()) return;

  isSubmitting.value = true;
  try {
    const res = await fetch(`/api/tokens/${props.targetCall.tokenAddress}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorAddress: props.account,
        content: quoteContent.value.trim(),
        quotedCalloutId: props.targetCall.id,
        callType: 'call',
      }),
    });
    const data = await res.json();
    if (data.success && data.data) {
      toast.success('Quote posted!');
      quoteContent.value = '';
      emit('quote-posted', data.data);
      emit('close');
    } else {
      toast.error(data.message || 'Failed to post quote');
    }
  } catch {
    toast.error('Failed to post quote');
  } finally {
    isSubmitting.value = false;
  }
}
</script>
