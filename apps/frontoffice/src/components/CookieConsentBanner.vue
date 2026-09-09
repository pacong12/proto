<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Cookie, ShieldCheck, X } from 'lucide-vue-next';

const { t } = useI18n();

const COOKIE_CONSENT_KEY = 'proto_cookie_consent_accepted_v1';

const visible = ref(false);

onMounted(() => {
  if (typeof window === 'undefined') return;
  try {
    const accepted = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!accepted) {
      visible.value = true;
    }
  } catch {
    // Non-blocking
  }
});

function acceptCookies() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    } catch {
      // Non-blocking
    }
  }
  visible.value = false;
}

function dismissBanner() {
  visible.value = false;
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-4 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-4 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-zinc-950/95 dark:bg-zinc-950/95 border border-zinc-800 backdrop-blur-md rounded-2xl p-4 shadow-2xl space-y-3"
      role="dialog"
      aria-label="Cookie consent banner"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2 text-emerald-400">
          <Cookie class="w-5 h-5 shrink-0" />
          <h3 class="text-xs font-bold text-white uppercase tracking-wider">
            {{ t('cookieBannerTitle') }}
          </h3>
        </div>
        <button
          type="button"
          @click="dismissBanner"
          class="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition"
          aria-label="Dismiss cookie notice"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <p class="text-xs text-zinc-400 leading-relaxed">
        {{ t('cookieBannerDesc') }}
      </p>

      <div class="flex items-center justify-between pt-1 text-xs">
        <a
          href="/cookie-policy"
          target="_blank"
          rel="noopener noreferrer"
          class="text-zinc-500 hover:text-emerald-400 underline underline-offset-2 transition"
        >
          {{ t('cookiePolicy') }}
        </a>

        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-7 text-xs text-zinc-400 hover:text-white"
            @click="dismissBanner"
          >
            {{ t('decline') }}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            class="h-7 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black px-3.5"
            @click="acceptCookies"
          >
            <ShieldCheck class="w-3.5 h-3.5 mr-1" />
            {{ t('accept') }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>
