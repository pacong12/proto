<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Cookie, ShieldCheck, X } from 'lucide-vue-next';

const COOKIE_CONSENT_KEY = 'proto_cookie_consent_accepted_v1';

const visible = ref(false);

onMounted(() => {
  if (typeof window === 'undefined') return;
  try {
    const accepted = localStorage.getItem(COOKIE_CONSENT_KEY) === 'true';
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
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-4"
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
            Cookie &amp; Storage Preferences
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
        Proto uses local storage strictly for essential interface settings (theme, wallet state, and
        privacy agreement). We do not track you or use commercial ad cookies.
      </p>

      <div class="flex items-center justify-between pt-1 text-xs">
        <a
          href="http://localhost:3002/cookie-policy"
          target="_blank"
          rel="noopener noreferrer"
          class="text-zinc-500 hover:text-emerald-400 underline underline-offset-2 transition"
        >
          Cookie Policy
        </a>

        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-7 text-xs text-zinc-400 hover:text-white"
            @click="dismissBanner"
          >
            Decline
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            class="h-7 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-black px-3.5"
            @click="acceptCookies"
          >
            <ShieldCheck class="w-3.5 h-3.5 mr-1" />
            Accept
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>
