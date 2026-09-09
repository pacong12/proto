<template>
  <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
    <div class="border-b border-zinc-200 dark:border-zinc-800 pb-4">
      <h1 class="text-2xl font-bold tracking-tight text-black dark:text-white">Terms of Service</h1>
      <p class="text-xs text-zinc-500 font-mono mt-1">Last Updated: September 2026</p>
    </div>

    <div class="space-y-6 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
      <section class="space-y-2">
        <h2 class="text-base font-bold text-black dark:text-white">1. Non-Custodial Protocol</h2>
        <p>
          Proto is a decentralized, non-custodial software protocol deployed on Robinhood Chain
          (Chain ID: 4663). Proto Labs does not take custody of user assets, tokens, or private keys
          at any point. Every token launch, liquidity lock, swap, or fee claim is executed directly
          between your cryptographic wallet and open-source smart contracts.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-black dark:text-white">
          2. Token Creation & Risk Disclosures
        </h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>
            <strong>User-Generated Assets:</strong> Tokens created through Proto are experimental,
            community-driven, and launched permissionlessly. Anyone may create a token with any
            name, ticker, or symbol.
          </li>
          <li>
            <strong>No Guarantees:</strong> Proto does not endorse, verify, audit, or guarantee the
            value, legality, or future liquidity of any launched token.
          </li>
          <li>
            <strong>Market Volatility:</strong> Digital assets are subject to extreme market
            volatility and total risk of loss. Never trade funds you cannot afford to lose.
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-black dark:text-white">
          3. Fee Structure & Protocol Rules
        </h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>
            <strong>Launch Fee:</strong> A fixed protocol fee of 0.0005 ETH is required upon
            deploying a token to cover contract deployment and liquidity lock initialization.
          </li>
          <li>
            <strong>Liquidity Lock:</strong> Liquidity pool positions created by the Factory are
            permanently locked in non-custodial locker contracts. No party possesses backdoors or
            unlock functions.
          </li>
          <li>
            <strong>Trading Fee Split:</strong> Standard trading fees generated in liquidity pools
            are split 70% to the token creator and 30% to protocol maintenance and automated
            buybacks.
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-bold text-black dark:text-white">4. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Proto Labs, its contributors, and developers shall
          not be liable for any direct, indirect, incidental, or consequential damages resulting
          from your use of the smart contracts, RPC providers, wallet connection interfaces, or
          third-party decentralized protocols.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Terms of Service Page
</script>
