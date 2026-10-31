<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden text-xs flex flex-col max-h-[92vh]"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 class="text-sm font-bold text-foreground">{{ t('pnlShareTitle') }}</h2>
        <div class="flex items-center gap-1">
          <RouterLink
            v-if="wallet && token"
            :to="`/pnl/${wallet.toLowerCase()}/${token.toLowerCase()}`"
            class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            :title="t('pnlOpenPage')"
            @click="emit('close')"
          >
            <ExternalLink class="w-4 h-4" />
          </RouterLink>
          <button
            type="button"
            class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            :aria-label="t('closeModal')"
            @click="emit('close')"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="p-5 overflow-y-auto">
        <PnlShareCard :wallet="wallet" :token="token" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExternalLink, X } from 'lucide-vue-next';
import { PnlShareCard } from '@/components/pnl';
import { useI18n } from '@/lib/i18n';

/** The PnL card of `wallet` on `token`, with its share actions. */
defineProps<{
  isOpen: boolean;
  wallet?: string;
  token?: string;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();
</script>
