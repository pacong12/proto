<template>
  <div
    v-if="visible"
    role="status"
    class="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-300"
  >
    <div class="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
      <Wrench class="w-4 h-4 shrink-0" aria-hidden="true" />
      <p class="flex-1 leading-snug">{{ message || t('maintenanceBanner') }}</p>
      <button
        type="button"
        class="p-1 rounded-md hover:bg-amber-500/20 transition"
        :aria-label="t('maintenanceDismiss')"
        @click="dismiss"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Wrench, X } from 'lucide-vue-next';
import { useI18n } from '@/lib/i18n';

/**
 * Shows the maintenance notice published by the edge worker at /site-status.json
 * (MAINTENANCE_MODE=banner in the Cloudflare dashboard). Dismissal lasts for the browser session
 * and only for the current message, so a new notice is shown again.
 */
const { t } = useI18n();
const mode = ref<'off' | 'banner' | 'full'>('off');
const message = ref('');
const dismissedKey = ref<string | null>(null);

const storageKey = computed(() => `maintenance_dismissed:${message.value}`);
const visible = computed(() => mode.value === 'banner' && dismissedKey.value !== storageKey.value);

onMounted(async () => {
  try {
    const res = await fetch('/site-status.json', { cache: 'no-store' });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
    const status = (await res.json()) as { maintenance?: string; message?: string };
    mode.value = status.maintenance === 'banner' ? 'banner' : 'off';
    message.value = status.message ?? '';
    if (sessionStorage.getItem(storageKey.value)) dismissedKey.value = storageKey.value;
  } catch {
    // No status endpoint (local dev) or storage unavailable: show nothing.
  }
});

function dismiss(): void {
  dismissedKey.value = storageKey.value;
  try {
    sessionStorage.setItem(storageKey.value, '1');
  } catch {
    // Storage unavailable: dismissal lasts until reload.
  }
}
</script>
