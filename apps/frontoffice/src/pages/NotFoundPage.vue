<template>
  <section
    class="flex flex-col items-center justify-center text-center py-16 sm:py-24 px-4 space-y-6"
    aria-labelledby="not-found-title"
  >
    <p class="text-7xl sm:text-8xl font-black tracking-tighter text-primary select-none">404</p>
    <div class="space-y-2 max-w-md">
      <h1 id="not-found-title" class="text-2xl font-bold tracking-tight text-foreground">
        {{ t('notFoundTitle') }}
      </h1>
      <p class="text-sm text-muted-foreground leading-relaxed">{{ t('notFoundBody') }}</p>
      <p class="text-xs font-mono text-muted-foreground/80 break-all">{{ route.fullPath }}</p>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-3">
      <RouterLink to="/launchpad" :class="buttonVariants()">
        <Home />
        {{ t('notFoundHome') }}
      </RouterLink>
      <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="goBack">
        <ArrowLeft />
        {{ t('notFoundBack') }}
      </button>
      <a
        :href="docsUrl"
        target="_blank"
        rel="noopener noreferrer"
        :class="buttonVariants({ variant: 'ghost' })"
      >
        <BookOpen />
        {{ t('notFoundDocs') }}
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BookOpen, Home } from 'lucide-vue-next';
import { buttonVariants } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { resolveDocsUrl } from '@/lib/site';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const docsUrl = resolveDocsUrl();

function goBack(): void {
  if (window.history.length > 1) router.back();
  else router.push('/launchpad');
}

// The SPA answers every path with 200, so tell crawlers not to index this view.
let robotsMeta: HTMLMetaElement | null = null;
onMounted(() => {
  robotsMeta = document.createElement('meta');
  robotsMeta.name = 'robots';
  robotsMeta.content = 'noindex';
  document.head.appendChild(robotsMeta);
});
onUnmounted(() => robotsMeta?.remove());
</script>
