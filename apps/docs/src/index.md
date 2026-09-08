---
layout: home

hero:
  name: 'Proto Docs'
  text: 'Direct-Pool Uniswap V3 Launchpad Protocol'
  tagline: 'Atomic token launches, permanently locked liquidity, and fair 70/30 fee distribution on Robinhood Chain.'
  actions:
    - theme: brand
      text: Explore Protocol
      link: /protocol/overview
    - theme: alt
      text: Developer Integration
      link: /integration/network
    - theme: alt
      text: View Contracts
      link: /integration/contracts

features:
  - title: Atomic 1-Tx Launch
    details: Deploy a fixed-supply token, create a Uniswap V3 pool, provide full liquidity, and permanently lock it in a single atomic transaction.
  - title: Permanent Liquidity Lock
    details: Liquidity positions are minted directly into the LiquidityLocker contract on block 0 and cannot be withdrawn or migrated.
  - title: 2-Block Anti-Snipe Protection
    details: Hardcoded smart contract limits (5.5% max buy, 5.0% max wallet) prevent sniper bots from draining initial pool depth.
  - title: 70/30 Trading Fee Split
    details: 70% of accrued pool fees stream directly to token creators with Community Takeover (CTO) delegation support.
  - title: Automated TWAP Buyback & Burn
    details: 80% of protocol revenue is automatically executed via Uniswap V3 TWAP swaps to buy and burn the native utility token.
  - title: Self-Describing Onchain Metadata
    details: Token names, tickers, IPFS logos, descriptions, and social links live directly onchain without off-chain database dependencies.
---
