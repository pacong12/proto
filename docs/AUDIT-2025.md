# Proto — Production Readiness Audit

**Tanggal audit**: 2025-07-14
**Auditor**: Internal
**Commit terakhir**: `f29326b` (feat: add dex screener partner api)
**Cakupan**: Arc Network integration, Backend API, Frontend, Smart Contracts, CI/CD

---

## Executive Summary

Sistem Proto secara keseluruhan telah mencapai fondasi arsitektur yang solid dengan
92 unit test lulus, typecheck bersih, dan lint/format bersih. Namun ditemukan
**3 CRITICAL**, **6 HIGH**, **8 MEDIUM**, dan **5 LOW** isu yang harus
ditangani sebelum sistem dapat dinyatakan siap produksi penuh.

Isu paling mendesak: **Arc Network event polling tidak berjalan sama sekali**
(backend hanya memantau Robinhood Chain), **kontrak Arc di-deploy dengan
LAUNCH_FEE yang salah** (0.0005 ETH bukan 1 USDC), dan **`launchTokenV2`
tidak memiliki reentrancy guard**.

---

## Risk Matrix

| Severity | Jumlah | Area Terdampak                               |
| -------- | ------ | -------------------------------------------- |
| CRITICAL | 3      | Arc Integration, Smart Contract              |
| HIGH     | 6      | Arc Integration, Backend API, CI/CD          |
| MEDIUM   | 8      | Backend API, Frontend, Smart Contract, CI/CD |
| LOW      | 5      | Frontend, CI/CD, Dokumentasi                 |

---

## Findings by Area

---

### Area 1: Arc Network Integration

#### [CRITICAL] Arc chain tidak di-poll oleh Event Poller

- **File**: `apps/api/src/modules/tokens/infrastructure/indexer/event-poller.service.ts`
- **Detail**: `EventPollerService` hanya menggunakan satu `PublicClient` yang
  dikonfigurasi terhadap `ROBINHOOD_CHAIN.rpcUrl`. Tidak ada polling terhadap
  Arc Mainnet (`https://rpc.mainnet.arc.io`, chain ID 5042). Seluruh token yang
  diluncurkan melalui factory Arc
  (`0x48844223aBDceeb1Ce502F54d559681358E68200`) tidak akan pernah masuk ke
  database, tidak muncul di explore feed, dan tidak terdeksi oleh DEX Screener
  endpoint `/dex/events`.
- **Fix**: Instansiasi `PublicClient` kedua untuk Arc Chain di `server.ts`.
  Jalankan `EventPollerService` kedua secara paralel dengan client Arc.
  Masing-masing poller menyimpan `lastPolledBlock` terpisah per chain.

---

#### [CRITICAL] LAUNCH_FEE di kontrak Arc salah — 0.0005 ETH bukan 1 USDC

- **File**: `contracts/src/LaunchpadV2Factory.sol` line 19, deployed ke Arc
  Mainnet (`0x48844223aBDceeb1Ce502F54d559681358E68200`)
- **Detail**: Kontrak yang sudah di-deploy ke Arc Mainnet memiliki konstanta:
  ```solidity
  uint256 public constant LAUNCH_FEE = 0.0005 ether;
  // = 500_000_000_000_000 wei
  ```
  Sementara `network.ts` untuk Arc menetapkan:
  ```ts
  launchFeeWei: 1_000_000_000_000_000_000n, // 1 USDC (18 decimal native)
  ```
  Frontend akan mengirim `value: 1e18` tetapi kontrak hanya membutuhkan
  `5e14`. Transaksi akan tetap berhasil karena `msg.value >= LAUNCH_FEE`
  terpenuhi, **namun kelebihan `value` (999_500_000_000_000_000 wei ≈ 0.9995
  USDC) akan ter-forward sepenuhnya ke bonding curve sebagai `initialBuyEth`**
  tanpa sepengetahuan user. Ini adalah bug finansial yang merugikan user.
- **Fix**:
  - **Jangka pendek**: Sesuaikan `ARC_CHAIN.launchConfig.launchFeeWei` di
    `network.ts` menjadi `500_000_000_000_000n` (sama dengan nilai kontrak).
  - **Jangka panjang**: Re-deploy kontrak Arc dengan `LAUNCH_FEE` yang benar
    untuk Arc (misalnya `1_000_000_000_000_000_000` = 1 USDC).

---

#### [CRITICAL] `launchTokenV2` tidak memiliki reentrancy guard

- **File**: `contracts/src/LaunchpadV2Factory.sol` function `launchTokenV2`
- **Detail**: Fungsi `launchTokenV2` adalah `external payable` dan melakukan
  external call ke `protocolFeeRecipient.call{value: LAUNCH_FEE}("")` sebelum
  state mutation selesai (`launches[tokenAddress]` belum di-set saat fee
  dikirim). Tidak ada modifier `nonReentrant`. Jika `protocolFeeRecipient`
  adalah kontrak jahat atau contract yang bisa di-trigger ulang, ini membuka
  vektor re-entrancy. `BondingCurve.sol` sudah memiliki `nonReentrant` sendiri,
  tapi factory tidak.
- **Fix**: Tambahkan reentrancy guard ke factory. Ikuti pola yang sama dengan
  `BondingCurve.sol` (custom `nonReentrant` modifier sudah ada di codebase):
  ```solidity
  bool private _locked;
  modifier nonReentrant() {
      require(!_locked, "Reentrant");
      _locked = true;
      _;
      _locked = false;
  }
  function launchTokenV2(...) external payable nonReentrant returns (...) {
  ```
  Atau pindahkan `protocolFeeRecipient.call` ke akhir fungsi setelah semua
  state mutation selesai (Checks-Effects-Interactions pattern).

---

#### [HIGH] DEX Screener `/dex/events` tidak mengembalikan data Arc

- **File**: `apps/api/src/server.ts` — `/dex/events` endpoint
- **Detail**: Endpoint `/dex/events` memanggil `repository.findAll()` yang
  hanya berisi token dari Robinhood Chain (karena Arc tidak di-poll, lihat
  CRITICAL-1). DEX Screener tidak akan melihat aktivitas trading dari Arc.
- **Fix**: Selesaikan CRITICAL-1 terlebih dahulu (dual EventPoller). Setelah
  Arc token masuk ke repository, endpoint ini otomatis berfungsi untuk Arc.

---

#### [HIGH] `GRADUATION_TARGET` Arc kontrak salah — hardcoded 4.2 ETH bukan USDC

- **File**: `contracts/src/LaunchpadV2Factory.sol` line 20
- **Detail**:
  ```solidity
  uint256 public constant GRADUATION_TARGET = 4.2 ether; // = 4.2e18
  ```
  Di Arc Network, nilai `4.2e18 native wei` setara dengan **4.2 USDC** (bukan
  8.000 USDC seperti di `network.ts`). Ini berarti token Arc akan graduation
  jauh lebih cepat dari yang direncanakan, dengan liquidity yang sangat sedikit.
- **Fix**: Re-deploy kontrak Arc dengan `GRADUATION_TARGET` yang sesuai.
  Berdasarkan `network.ts`, target adalah `8_000_000_000_000_000_000_000n`
  (8.000 USDC dalam 18-decimal native wei). Revisi nilai di
  `DeployArc.s.sol`.

---

#### [HIGH] `ARC_CHAIN.contracts.quoterV2` sama dengan Robinhood — tidak diverifikasi

- **File**: `packages/shared-types/src/constants/network.ts` line 163
- **Detail**: `ARC_CHAIN.contracts.quoterV2` diisi dengan
  `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7` yang adalah alamat QuoterV2
  Robinhood Chain. Belum dikonfirmasi apakah alamat yang sama valid di Arc
  Network (chain ID 5042).
- **Fix**: Verifikasi alamat QuoterV2 resmi di Arc Network melalui dokumentasi
  Circle Arc (`docs.arc.io`) atau Uniswap V3 deployment registry. Jika berbeda,
  update konstanta.

---

#### [MEDIUM] `ARC_CHAIN.contracts.locker` diisi dengan alamat owner, bukan kontrak locker

- **File**: `packages/shared-types/src/constants/network.ts` line 156
- **Detail**: `locker: '0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2'` adalah
  alamat EOA (owner), bukan kontrak `LiquidityLocker`. Jika ada kode yang
  memanggil fungsi on-chain dari `locker` address, panggilan tersebut akan
  gagal karena EOA tidak memiliki ABI.
- **Fix**: Deploy `LiquidityLocker.sol` ke Arc Mainnet dan update konstanta
  dengan alamat kontrak yang terverifikasi.

---

#### [MEDIUM] Arc tidak memiliki workflow CI/CD deploy kontrak terpisah

- **File**: `.github/workflows/` — tidak ada `deploy-arc.yml`
- **Detail**: Robinhood Chain memiliki `contracts-guard.yml` untuk contract
  testing. Tidak ada workflow otomatis untuk deploy atau verify kontrak di Arc.
  Deployment Arc saat ini dilakukan manual via `DeployArc.s.sol`.
- **Fix**: Buat `.github/workflows/deploy-arc.yml` dengan trigger
  `workflow_dispatch` yang menjalankan `forge script contracts/script/DeployArc.s.sol`
  dan verifikasi kontrak via Blockscout API Arc.

---

### Area 2: Backend API

#### [HIGH] Rate limit 120 req/menit akan memblokir DEX Screener crawler

- **File**: `apps/api/src/server.ts` line 165
- **Detail**: Semua path kecuali `/health` dan `/` terkena rate limit 120
  req/menit per IP. DEX Screener crawler, GeckoTerminal, dan GMGN akan
  mengirim request dari IP tunggal dalam burst tinggi saat pertama kali
  melakukan indexing (bisa ratusan request per menit). Crawler akan mendapat
  `429 Too Many Requests` dan dinyatakan offline oleh agregator.
- **Fix**: Exempt path `/dex/*` dan `/api/v1/*` dari rate limit, atau naikkan
  limit untuk path tersebut menjadi 600 req/menit:
  ```ts
  const isDexCrawler =
    url.pathname.startsWith('/dex/') ||
    url.pathname.startsWith('/api/v1/');
  if (!isHealthProbe && !isDexCrawler &&
      !(await checkRateLimit(clientIp, 120, 60_000))) {
  ```

---

#### [HIGH] CORS `CORS_ALLOWED_ORIGINS` akan memblokir DEX Screener jika diset

- **File**: `apps/api/src/server.ts` lines 110-122
- **Detail**: Jika `CORS_ALLOWED_ORIGINS` diisi di production (yang dianjurkan
  untuk keamanan), semua request dari crawler DEX Screener/GeckoTerminal akan
  mendapat CORS error karena origin mereka tidak dikenal. Endpoint `/dex/*`
  dan `/api/v1/*` harus selalu `Access-Control-Allow-Origin: *`.
- **Fix**: Terapkan logika CORS yang berbeda per path:
  ```ts
  const isPublicCrawlerPath =
    url.pathname.startsWith('/dex/') || url.pathname.startsWith('/api/v1/');
  const corsOrigin = isPublicCrawlerPath
    ? '*'
    : allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin)
      ? requestOrigin || '*'
      : '';
  ```

---

#### [HIGH] Tidak ada workflow deploy frontoffice ke Cloudflare Pages

- **File**: `.github/workflows/` — tidak ada `deploy-frontoffice.yml`
- **Detail**: `wrangler.toml` sudah dikonfigurasi untuk Cloudflare Pages, tapi
  tidak ada workflow CI/CD yang men-trigger build dan deploy otomatis ke
  Cloudflare Pages saat push ke `main`. Deploy frontoffice saat ini harus
  dilakukan manual.
- **Fix**: Buat `.github/workflows/deploy-frontoffice.yml` menggunakan
  `cloudflare/wrangler-action@v3` dengan `CLOUDFLARE_API_TOKEN` dan
  `CLOUDFLARE_ACCOUNT_ID` sebagai GitHub Secrets.

---

#### [MEDIUM] OpenAPI spec tidak mencakup endpoint DEX Screener dan GeckoTerminal

- **File**: `apps/api/openapi.yaml`
- **Detail**: Endpoint `/dex/latest-block`, `/dex/asset`, `/dex/pair`,
  `/dex/events`, dan seluruh `/api/v1/networks/*` tidak terdokumentasi di
  `openapi.yaml`. Ini mempersulit onboarding agregator baru dan testing
  internal.
- **Fix**: Tambahkan path baru ke `openapi.yaml` sesuai spesifikasi yang sudah
  diimplementasikan.

---

#### [MEDIUM] `EventPollerService` hanya poll 100 token terakhir untuk swap events

- **File**: `apps/api/src/modules/tokens/infrastructure/indexer/event-poller.service.ts`
  line 88
- **Detail**: `repository.findAll(100, 0)` membatasi polling swap events pada
  100 token pertama saja. Ketika jumlah token melampaui 100, token-token
  berikutnya tidak akan pernah mendapat data trading terbaru.
- **Fix**: Paginasi atau gunakan `findAll()` tanpa limit untuk memastikan semua
  token aktif dipantau. Atau simpan daftar pool address secara terpisah dengan
  index untuk query efisien.

---

#### [MEDIUM] CoinGecko price feed tidak cocok untuk Arc (USDC, bukan ETH)

- **File**: `apps/api/src/modules/tokens/infrastructure/adapters/coingecko-price-feed.adapter.ts`
- **Detail**: `getEthPriceUsd()` selalu mengambil harga ETH dari CoinGecko.
  Di Arc Network, quote asset adalah USDC (bukan ETH). Semua kalkulasi harga
  token Arc yang menggunakan `ethPriceUsd` akan menghasilkan nilai yang salah
  (harga token dalam USD akan dihitung berdasarkan ETH price, padahal
  seharusnya 1 USDC = $1.00).
- **Fix**: Tambahkan method `getQuoteAssetPriceUsd(chainId: number)` ke
  `PriceFeedPort`. Untuk Arc, return `1.0` (USDC = $1 USD). Untuk Robinhood,
  return ETH price dari CoinGecko.

---

#### [LOW] `deploy-vps.yml` menggunakan Docker, bukan native Bun

- **File**: `.github/workflows/deploy-vps.yml`
- **Detail**: Workflow deploy ke VPS menggunakan `docker compose up` yang
  memerlukan Docker daemon aktif di VPS. Keputusan arsitektur sebelumnya
  menetapkan native Bun sebagai runtime. Inkonsistensi ini bisa menyebabkan
  kebingungan dan overhead Docker yang tidak perlu.
- **Fix**: Pertimbangkan migrasi VPS deploy ke `pm2` atau `systemd` unit yang
  menjalankan `bun run apps/api/src/server.ts` langsung, atau dokumentasikan
  secara eksplisit bahwa Docker digunakan di VPS saja.

---

### Area 3: Frontend

#### [MEDIUM] `getWalletClient()` Bitget isolation: tidak menangani semua skenario

- **File**: `apps/frontoffice/src/lib/viem-client.ts`
- **Detail**: Logika bypass OKX hanya aktif jika Bitget terpasang DAN provider
  saat ini adalah OKX (`isOkxWallet`). Jika user menggunakan Reown AppKit
  social login (Google/Apple) dan kemudian mencoba launch token, `storedId`
  adalah `'appkit'` — tidak mengandung `'bitget'` atau `'okx'`. Dalam kasus
  ini provider fallback ke `walletProvider.value` yang bisa saja masih OKX
  tergantung urutan inisialisasi AppKit.
- **Fix**: Pisahkan Bitget isolation ke composable terpisah dan tangani kasus
  AppKit social login secara eksplisit.

---

#### [MEDIUM] Tidak ada error boundary di level aplikasi Vue

- **File**: `apps/frontoffice/src/App.vue` dan `apps/frontoffice/src/main.ts`
- **Detail**: Tidak ada `app.config.errorHandler` atau Vue `<ErrorBoundary>`
  component. Jika terjadi uncaught error di composable (misalnya saat fetch
  data token gagal), seluruh aplikasi bisa crash tanpa pesan yang berguna.
- **Fix**: Tambahkan global error handler di `main.ts`:
  ```ts
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Proto] Uncaught Vue error:', err, info);
  };
  ```

---

#### [LOW] `sourcemap: false` di vite.config.ts menyulitkan debugging production

- **File**: `apps/frontoffice/vite.config.ts` line 11
- **Detail**: Source map dinonaktifkan sepenuhnya. Ketika terjadi error di
  production (Cloudflare Pages), stack trace yang dilaporkan user tidak bisa
  di-trace ke source code.
- **Fix**: Gunakan `sourcemap: 'hidden'` agar source map di-generate tapi tidak
  di-expose ke publik. Upload ke Sentry atau layanan error tracking.

---

#### [LOW] Tidak ada PWA manifest icon berukuran 512x512

- **File**: `apps/frontoffice/public/manifest.json`
- **Detail**: Manifest belum dikonfirmasi memiliki icon `512x512` yang
  dibutuhkan untuk installable PWA dan splash screen Android.
- **Fix**: Tambahkan entry icon `512x512` di `manifest.json` dan sediakan file
  PNG yang sesuai.

---

### Area 4: Smart Contracts

#### [HIGH] Kontrak Arc belum diverifikasi di block explorer

- **File**: `contracts/script/DeployArc.s.sol`
- **Detail**: Factory `0x48844223aBDceeb1Ce502F54d559681358E68200` sudah
  di-deploy di Arc Mainnet tapi source code belum terverifikasi di
  `explorer.arc.io`. Token yang diluncurkan tidak bisa diaudit oleh user,
  dan DEX Screener/GeckoTerminal tidak akan menampilkan metadata kontrak.
- **Fix**: Jalankan verifikasi via Foundry:
  ```bash
  forge verify-contract \
    0x48844223aBDceeb1Ce502F54d559681358E68200 \
    contracts/src/LaunchpadV2Factory.sol:LaunchpadV2Factory \
    --chain-id 5042 \
    --verifier blockscout \
    --verifier-url https://explorer.arc.io/api
  ```

---

#### [MEDIUM] Factory Robinhood Chain: `factory` dan `factoryV2` menggunakan alamat yang sama

- **File**: `packages/shared-types/src/constants/network.ts` lines 56-57
- **Detail**:
  ```ts
  factory: '0x48844223aBDceeb1Ce502F54d559681358E68200',   // ROBINHOOD_CHAIN
  factoryV2: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', // berbeda — OK
  ```
  ```ts
  factory: '0x48844223aBDceeb1Ce502F54d559681358E68200',   // ARC_CHAIN
  factoryV2: '0x48844223aBDceeb1Ce502F54d559681358E68200', // SAMA — suspicious
  ```
  Di Arc Chain, `factory` dan `factoryV2` menunjuk ke alamat yang identik.
  Ini berarti tidak ada factory V1 terpisah di Arc, yang mungkin memang
  disengaja. Namun perlu konfirmasi eksplisit agar tidak membingungkan.
- **Fix**: Tambahkan komentar eksplisit di `network.ts`:
  ```ts
  // Arc Network hanya memiliki V2 (bonding curve). factory = factoryV2 by design.
  factory: '0x48844223aBDceeb1Ce502F54d559681358E68200',
  factoryV2: '0x48844223aBDceeb1Ce502F54d559681358E68200',
  ```

---

#### [LOW] Tidak ada ownership transfer test di `LaunchpadV2.t.sol`

- **File**: `contracts/test/LaunchpadV2.t.sol`
- **Detail**: Test coverage tidak mencakup skenario: (1) `transferOwnership`
  ke address baru, (2) `acceptOwnership` 2-step flow, (3) mencoba panggil
  `onlyOwner` function dari non-owner.
- **Fix**: Tambahkan test case untuk ownership management.

---

### Area 5: CI/CD dan Infrastructure

#### [MEDIUM] Tidak ada smoke test untuk frontoffice build di CI

- **File**: `.github/workflows/ci.yml`
- **Detail**: CI menjalankan `bun run build` untuk semua workspace tapi tidak
  ada validasi bahwa output `dist/` benar-benar bisa di-serve (tidak corrupt,
  tidak missing asset penting seperti `index.html`).
- **Fix**: Tambahkan step setelah build:
  ```yaml
  - name: Validate frontoffice build output
    run: |
      test -f apps/frontoffice/dist/index.html
      test -f apps/frontoffice/dist/manifest.json
      du -sh apps/frontoffice/dist/
  ```

---

#### [LOW] Secret `VPS_SSH_KEY` menggunakan fallback ke `secrets.DEPLOY`

- **File**: `.github/workflows/deploy-vps.yml` line 23
- **Detail**: `key: ${{ secrets.VPS_SSH_KEY || secrets.DEPLOY }}` menggunakan
  fallback ke secret bernama `DEPLOY` yang ambigu. Nama secret yang tidak
  deskriptif meningkatkan risiko salah konfigurasi.
- **Fix**: Standarisasi ke satu nama secret: `VPS_SSH_KEY`. Hapus referensi
  ke `secrets.DEPLOY`.

---

## Critical Blockers (Harus Diselesaikan Sebelum Launch)

### CRITICAL-1: Arc Event Poller tidak berjalan

**Dampak**: Semua token yang diluncurkan di Arc tidak akan terindex.
Explore feed Arc akan selalu kosong. DEX Screener tidak bisa mengambil data Arc.

**Fix konkret** — tambahkan ke `apps/api/src/server.ts`:

```ts
import { ARC_CHAIN } from '@proto/shared-types';

const arcChainDef = defineChain({
  id: ARC_CHAIN.chainId,
  name: ARC_CHAIN.name,
  nativeCurrency: ARC_CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [ARC_CHAIN.rpcUrl] } },
});

const arcPublicClient = createPublicClient({
  chain: arcChainDef,
  transport: http(ARC_CHAIN.rpcUrl),
});

const arcEventPoller = new EventPollerService(
  arcPublicClient,
  repository, // shared repository
  chainIndexer,
  calculatePricing,
  priceFeed,
);

// Di polling loop, jalankan keduanya paralel:
// await Promise.all([eventPoller.pollEvents(), arcEventPoller.pollEvents()]);
```

---

### CRITICAL-2: LAUNCH_FEE Arc mismatch — user kehilangan dana

**Dampak**: User yang launch token di Arc akan kehilangan ~0.9995 USDC
setiap launch karena kelebihan `value` masuk ke bonding curve sebagai buy
otomatis yang tidak diminta.

**Fix segera** (tanpa re-deploy kontrak) — di `network.ts`:

```ts
// ARC_CHAIN.launchConfig
launchFeeWei: 500_000_000_000_000n, // sesuaikan ke nilai kontrak: 0.0005 ether
```

---

### CRITICAL-3: Reentrancy risk di `launchTokenV2`

**Dampak**: Potensi eksploitasi reentrancy jika `protocolFeeRecipient`
diganti ke kontrak berbahaya. Saat ini `feeRecipient` adalah EOA milik owner
sehingga risiko rendah, tapi harus diperbaiki sebelum kontrak di-audit publik.

**Fix** — di `LaunchpadV2Factory.sol`, ikuti Checks-Effects-Interactions:

```solidity
// Pindahkan fee transfer KE BAWAH setelah semua state mutation:
launches[tokenAddress] = V2Launch({...});
allLaunches.push(tokenAddress);
emit TokenLaunchedV2(...);

// Baru transfer fee
(bool feeOk,) = protocolFeeRecipient.call{value: LAUNCH_FEE}("");
if (!feeOk) revert TransferFailed();

// Baru initial buy
if (initialBuyEth > 0) {
    curve.buyFor{value: initialBuyEth}(msg.sender, 0);
}
```

---

## Production Launch Checklist

### Contracts

- [ ] **[CRITICAL]** Re-deploy `LaunchpadV2Factory` ke Arc Mainnet dengan
      `LAUNCH_FEE = 1e18` (1 USDC) dan `GRADUATION_TARGET = 8_000e18` (8.000 USDC)
- [x] **[CRITICAL]** Perbaiki urutan CEI (Checks-Effects-Interactions) di
      `launchTokenV2` dan tambahkan reentrancy guard
- [ ] Verifikasi source code factory Arc di `explorer.arc.io`
- [ ] Deploy `LiquidityLocker.sol` ke Arc Mainnet dan update `locker` address
- [ ] Konfirmasi `quoterV2` address Arc di `network.ts` valid di chain ID 5042
- [x] Tambahkan test ownership management ke `LaunchpadV2.t.sol`

### Backend

- [ ] **[CRITICAL]** Tambahkan Arc `EventPollerService` di `server.ts`
- [ ] **[HIGH]** Exempt `/dex/*` dan `/api/v1/*` dari rate limit 120/menit
- [ ] **[HIGH]** Terapkan CORS `*` khusus untuk `/dex/*` dan `/api/v1/*`
- [ ] Tambahkan `getQuoteAssetPriceUsd(chainId)` ke `PriceFeedPort` untuk Arc
- [ ] Update `EventPollerService` untuk poll semua token (bukan hanya 100)
- [ ] Update `openapi.yaml` dengan endpoint DEX Screener dan GeckoTerminal
- [ ] Set `CORS_ALLOWED_ORIGINS` di production VPS environment

### Frontend

- [ ] **[HIGH]** Buat `.github/workflows/deploy-frontoffice.yml` untuk Cloudflare Pages
- [ ] Tambahkan global Vue error handler di `main.ts`
- [ ] Sesuaikan `launchFeeWei` Arc di `network.ts` setelah kontrak baru di-deploy
- [ ] Tambahkan `manifest.json` icon 512x512

### Infrastructure

- [ ] Set semua GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
      `VPS_HOST`, `VPS_SSH_KEY`, `VPS_APP_DIR`
- [ ] Pastikan `CORS_ALLOWED_ORIGINS` di `.env` production berisi domain yang benar
- [ ] Pastikan `DEVOPS_AUTH_TOKEN` di-set di VPS environment
- [ ] Transfer ~1.1 USDC ke tester account `0xa2b2...` untuk end-to-end test Arc
- [ ] Lakukan end-to-end launch test di Arc Mainnet setelah kontrak baru di-deploy
- [ ] Submit ke DEX Screener via email `partners@dexscreener.com`
- [ ] Submit ke GeckoTerminal via form `geckoterminal.com/new-network-requests`

---

## Arc Network Specific Gaps

| #   | Isu                                                              | Severity | Status                 |
| --- | ---------------------------------------------------------------- | -------- | ---------------------- |
| 1   | Arc event tidak di-poll oleh backend                             | CRITICAL | Belum diperbaiki       |
| 2   | `LAUNCH_FEE` kontrak Arc salah (0.0005 ETH bukan 1 USDC)         | CRITICAL | Perlu re-deploy        |
| 3   | `GRADUATION_TARGET` Arc salah (4.2 ETH bukan 8.000 USDC)         | HIGH     | Perlu re-deploy        |
| 4   | Source code kontrak Arc belum terverifikasi di explorer          | HIGH     | Belum diverifikasi     |
| 5   | `locker` Arc adalah EOA, bukan kontrak LiquidityLocker           | MEDIUM   | Perlu deploy locker    |
| 6   | `quoterV2` Arc menggunakan alamat Robinhood (tidak diverifikasi) | HIGH     | Perlu konfirmasi       |
| 7   | Price feed Arc menggunakan ETH price (seharusnya USDC = $1)      | MEDIUM   | Perlu perbaikan        |
| 8   | Tidak ada workflow deploy otomatis untuk kontrak Arc             | MEDIUM   | Perlu dibuat           |
| 9   | DEX Screener `/dex/events` kosong untuk Arc                      | HIGH     | Bergantung pada fix #1 |

---

## File Terkait

| File                                                                         | Keterangan                      |
| ---------------------------------------------------------------------------- | ------------------------------- |
| `packages/shared-types/src/constants/network.ts`                             | Konfigurasi semua chain         |
| `apps/api/src/server.ts`                                                     | Routing API + event poller init |
| `apps/api/src/modules/tokens/infrastructure/indexer/event-poller.service.ts` | Core indexer                    |
| `apps/frontoffice/src/composables/useLaunchpad.ts`                           | Launch flow frontend            |
| `apps/frontoffice/src/lib/viem-client.ts`                                    | Wallet client factory           |
| `contracts/src/LaunchpadV2Factory.sol`                                       | Factory contract                |
| `contracts/src/BondingCurve.sol`                                             | Bonding curve logic             |
| `contracts/script/DeployArc.s.sol`                                           | Arc deployment script           |
| `.github/workflows/`                                                         | Semua workflow CI/CD            |
