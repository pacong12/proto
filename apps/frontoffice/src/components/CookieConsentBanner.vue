<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from '@/lib/i18n';
import { legalUrl } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-vue-next';
import { cookieChoice, cookieSettingsOpen, setCookieChoice } from '@/lib/consent';

const { t, locale } = useI18n();

// The close button hides the banner for this page view only; no choice is stored.
const dismissed = ref(false);
const visible = computed(
  () => cookieSettingsOpen.value || (cookieChoice.value === null && !dismissed.value),
);

function dismissBanner() {
  dismissed.value = true;
  cookieSettingsOpen.value = false;
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
      class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-card/95 border border-border backdrop-blur-md rounded-2xl p-4 shadow-2xl space-y-3 transition-colors"
      role="dialog"
      aria-label="Cookie consent banner"
    >
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-xs font-bold text-foreground uppercase tracking-wider">
          {{ t('cookieBannerTitle') }}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
          aria-label="Dismiss cookie notice"
          @click="dismissBanner"
        >
          <X class="w-3.5 h-3.5" />
        </Button>
      </div>

      <p class="text-xs text-muted-foreground leading-relaxed">
        {{ t('cookieBannerDesc') }}
      </p>
      <p v-if="cookieSettingsOpen && cookieChoice" class="text-xs text-foreground">
        {{ t(cookieChoice === 'accepted' ? 'cookieChoiceAccepted' : 'cookieChoiceDeclined') }}
      </p>

      <div class="flex items-center justify-between pt-1 text-xs">
        <a
          :href="legalUrl('cookie-policy', locale)"
          target="_blank"
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-foreground underline underline-offset-2 transition"
        >
          {{ t('cookiePolicy') }}
        </a>

        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            @click="setCookieChoice('declined')"
          >
            {{ t('decline') }}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            class="h-7 text-xs font-bold px-3.5 shadow-sm cursor-pointer"
            @click="setCookieChoice('accepted')"
          >
            {{ t('accept') }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>
