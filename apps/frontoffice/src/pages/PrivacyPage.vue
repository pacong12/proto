<template>
  <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
    <div class="border-b border-border pb-4">
      <h1 class="text-2xl font-bold tracking-tight text-foreground">
        {{ t('privacyPolicy') }}
      </h1>
      <p class="text-xs text-muted-foreground font-mono mt-1">Last Updated: September 2026</p>
    </div>

    <div class="space-y-6 text-sm text-muted-foreground leading-relaxed">
      <section class="space-y-2">
        <h2 class="text-base font-bold text-foreground">1. Information We Do Not Collect</h2>
        <p>
          We do not collect, store, or sell personal identifying information such as names, emails,
          physical addresses, or government identification. We do not use commercial advertising or
          behavioural tracking pixels.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-foreground">2. Onchain Public Data</h2>
        <p>
          When you connect your cryptographic wallet and execute blockchain transactions, your
          public wallet address, transaction amounts, and token balances become part of the publicly
          visible, immutable distributed ledger (Robinhood Chain).
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-foreground">3. Local Storage</h2>
        <p>
          We strictly use browser local storage (localStorage) to store interface preferences, such
          as selected theme (light/dark), preferred language, and terms consent acknowledgement.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/lib/i18n';

const { t } = useI18n();
</script>
