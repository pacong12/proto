# Release redeploy checklist

The launch release replaces every contract and starts with no tokens. The contracts deployed
before it (owner `0x555C…b0c2`, keeper `0x13cE…73c1`) were for testing; nothing from them carries
over. Work through the steps in order: several settings are immutable once deployed.

## 1. Keys and owners

- [ ] New deployer key, kept in a Foundry keystore (`cast wallet import deployer --interactive`)
      or on a hardware wallet. Never in `.env`. Fund it with only what the deploy costs
      (about 19M gas on Robinhood Chain for the full stack).
- [ ] Safe multisig on each chain with hardware-wallet signers. It becomes every owner and the
      default treasury (`OWNER_SAFE`).
- [x] New keeper key for the API (`KEEPER_PRIVATE_KEY`); it only pays gas. Prepared on the VPS
      (`0xBD9b…88E3`, funded with the old keeper's balance); it starts with the release deploy.
- [ ] Optional incident-response guardian (`EMERGENCY_GUARDIAN`). It can pause launches and curve
      buys, never exits or graduation.

## 2. Contracts

Exact commands for every step below, including the Safe and the ownership handover:
`docs/CONTRACT-DEPLOY-RUNBOOK.md`.

Dry-run each script on a fork first (`--fork-url … --sender <deployer>`), then broadcast with
`--account deployer` (keystore) or `--ledger`.

- [ ] Robinhood Chain: `OWNER_SAFE=… forge script script/robinhood/DeployRobinhoodV2.s.sol`.
      `LaunchpadV2Factory.protocolFeeRecipient` is **immutable**; check the logged fee recipient
      before broadcasting.
- [ ] Arc: `OWNER_SAFE=… forge script script/arc/DeployArc.s.sol`.
- [ ] Limit orders, per chain, with the addresses just deployed (no defaults on purpose):
      `CURVE_FACTORY=… ROUTER=… HOOK=… forge script script/DeployLimitOrders.s.sol`
      (Arc: no `CURVE_FACTORY`; USDC and its 1e12 scale are picked from the chain id).
- [ ] Team splitter factory per chain: `script/DeployTeamSplitterFactory.s.sol`.
- [ ] The Safe calls `acceptOwnership()` on the Robinhood factory, graduator and buyback, and on
      the Arc factory and buyback. Until then the deployer is still the owner.
- [ ] Verify the contracts on the explorers. Both chains use Blockscout, which imports Sourcify:
      run `bash scripts/verify-sourcify.sh <chainId> <address> <path:Contract>` in `contracts/`
      from the deploy commit for each contract (constructor arguments are read from the creation
      transaction).

## 3. Addresses in the apps

Update the defaults in `packages/shared-types/src/chains/robinhood.ts` and `arc.ts`, so nothing
can fall back to the previous stack. Env vars override them (`ROBINHOOD_FACTORY_V2_ADDRESS`,
`ROBINHOOD_GRADUATOR`, `ROBINHOOD_V4_HOOK`, `ROBINHOOD_V4_ROUTER`, `ROBINHOOD_V4_BUYBACK`,
`ROBINHOOD_LIMIT_ORDERS`, `ROBINHOOD_TEAM_SPLITTER_FACTORY`, and the `ARC_*` equivalents), with a
`VITE_` prefix for the frontend build.

- [ ] Defaults updated and `bun nx run-many -t test typecheck` passes.
- [ ] There is no start-block setting: an empty database indexes from the chain head minus
      `INDEXER_MAX_BLOCK_RANGE` (2,000 blocks, about 3.5 minutes on Robinhood Chain). Start the API
      before the first launch, or recover earlier launches with `POST /api/admin/backfill`.

## 4. API (VPS)

- [ ] Back up `/app/data/proto.sqlite`, then start from an empty database (tokens, trades, candles,
      limit orders and the indexer cursors). The site, the sitemap and the keepers read tokens
      from it, so old test tokens would otherwise stay listed.
- [ ] `TRUST_PROXY=true`: nginx only accepts Cloudflare, so without it every visitor shares the
      nginx address and one client can exhaust everyone's rate limit.
- [ ] `KEEPER_PRIVATE_KEY` (new key), `SESSION_SECRET`, `DEVOPS_AUTH_TOKEN`, `ADMIN_SECRET` set.

## 5. Order of the switch

1. Contracts deployed and owned by the Safe (sections 1–2).
2. API with the new addresses and an empty database.
3. Frontend with the new addresses, **together with** the API: taxed launches call
   `launchTokenV2WithConfig`, which only the new Robinhood factory has, and image uploads need the
   frontend's type fix before the API's content check.
4. Smoke checks: `bun scripts/smoke.ts` (18 checks), one launch with tax and split on each chain,
   a curve buy, sell and graduation on Robinhood Chain.
5. Verify the first launch of each new factory: its token (`src/core/LaunchpadToken.sol:LaunchpadToken`)
   and, on Robinhood Chain, its curve (`src/core/BondingCurve.sol:BondingCurve`), with
   `contracts/scripts/verify-sourcify.sh`. Blockscout only borrows the ABI of a contract with the
   same bytecode, so every later launch must be submitted too: the API does that within minutes
   through Sourcify's similarity search (`[SourceVerify]` in its log, `SOURCE_VERIFY_INTERVAL_MS`).
   Check that the second launch shows as verified.

## 6. Retire the testing stack

- [ ] Move what is left in `0x555C…b0c2` and `0x13cE…73c1`, then delete them from `.env` and the VPS.
- [ ] Re-submit `https://goton.fun/sitemap.xml` in Search Console; old `/token/…` pages now 404.
