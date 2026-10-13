# Audit Keamanan Proto — Muse (13 Okt 2026)

> Scope: `contracts/` (Foundry) + `apps/api` (Bun/SQLite/Redis) + `apps/frontoffice` (Vue 3/Vite) + config/supply-chain.
> Metode: 4 audit paralel (kontrak, API, frontend, config). Semua temuan dikutip `file:line`.
> Bahasa: Indonesia.

## Ringkasan Eksekutif

| Severity | Jumlah | Contoh |
|----------|--------|--------|
| Kritis | 4 | Owner bisa kuras curve, flash-loan distributor, squat vesting, `.env` asli ikut folder |
| Tinggi | 13 | Pajak snipe 99% kreator, anti-snipe mati saat initial buy, sandwich V1, buyback tanpa TWAP, API tulis tanpa auth, DevOps fail-open, XSS SVG IPFS, href `javascript:`, approval unlimited, Docker root, gitleaks buta |
| Sedang | ~20 | Window timestamp, reserve mismatch, lock permanen, header/CSP lemah, rate-limit, slippage 49% |
| Rendah/Info | ~10 | Dust, silent-zero, deps floating |

**Jangan deploy ke mainnet sebelum Kritis + H-7/H-8/H-9 diperbaiki dan semua key dirotasi.**

---

## Kritis

### C-1 — Owner factory bisa kuras curve mana pun ke alamat bebas
**File:** `contracts/src/BondingCurve.sol:338`, `contracts/src/LaunchpadV2Factory.sol:240-241`
```solidity
function migrateToV4(address payable recipient) external nonReentrant onlyFactory
function migrateCurveToV4(address curve, address payable recipient) external onlyOwner {
    BondingCurve(payable(curve)).migrateToV4(recipient);
}
```
Pola sama `emergencyWithdraw`: `BondingCurve.sol:366`, `LaunchpadV2Factory.sol:253`, `LaunchpadV2FactoryArc.sol:265,273`, `BaseLaunchpadFactory.sol:213,221`.
`recipient` bebas, `onlyOwner` satu EOA, tanpa timelock/multisig/allowlist. Owner yang bocor menguras `address(this).balance + token.balanceOf` semua curve.
**Perbaikan:** recipient immutable ke locker/router V4; hapus parameter atau allowlist + timelock.

### C-2 — `HolderFeeDistributor` bisa dicuri via flash-loan satu blok
**File:** `contracts/src/HolderFeeDistributor.sol:111-114,140-142`
```solidity
uint256 liveBalance = ILaunchpadToken(token).balanceOf(holder);
uint256 snap = snapshotBalance[token][holder];
uint256 balance = FeeMath.calculateEffectiveBalance(snap, liveBalance); // min(snap,live)
function checkpoint(address token, address holder) external nonReentrant { _updateReward(token, holder); }
```
`_updateReward` set `paid=cum` + `snapshot=live`. Serangan: pinjam N token → `checkpoint()` (snap=N) → tunggu `locker.depositRewards()` di blok sama → `claimReward()` dapat `N*(newCum-oldCum)/1e36`. `min()` hanya menolong jika dijual sebelum claim.
**Perbaikan:** snapshot efektif setelah jeda N blok; atau blokir `checkpoint` di blok yang sama dengan deposit.

### C-3 — DoS squatting slot vesting
**File:** `contracts/src/VestingVault.sol:84`
```solidity
if (vestingSchedules[token][beneficiary].exists) revert ScheduleExists();
```
Kunci `token=>beneficiary` satu slot, `createVestingSchedule` permissionless. Attacker frontrun `create(token,korban,1e18,dur)` dengan `create(token,korban,1,dur)` → yang asli revert selamanya.
**Perbaikan:** `mapping(token=>beneficiary=>nonce=>Schedule)` atau allowlist kreator + `revoke+recreate`.

### C-4 — `.env` asli ikut folder (bukan di git, tapi ada di disk)
**File:** `proto/.env:8,11,12,109,114`
- `:8` `VITE_REOWN_PROJECT_ID=4832fd78…` — publik by-design tapi asli.
- `:11` `PRIVATE_KEY=0x2e28…` — kunci deployer mainnet. Kuasai penuh deploy factory/locker.
- `:12` `PINATA_JWT=eyJhbGciOi…` — kontrol pin IPFS penuh.
- `:109` `COINGECKO_API_KEY=CG-2eeE…` — kuota berbayar bisa dicuri.
- `:114` `ADMIN_SECRET=dev-secret-change-me` — default lemah, kemungkinan dipakai di prod.
- `:112` `REDIS_URL=redis://127.0.0.1:6380` — tanpa password, tidak cocok dengan alur `REDIS_PASSWORD` compose.

Terverifikasi tidak di-track: `git ls-files | grep .env` kosong, `check-ignore .env` → `.gitignore:29:**/.env`. Tapi siapa pun yang menerima copy `Downloads/` ini dapat kuncinya. Anggap bocor.
**Perbaikan:** hapus sebelum zip/share; rotasi `PRIVATE_KEY`, `PINATA_JWT` (revoke di dashboard Pinata + Reown), `COINGECKO_API_KEY`; pakai `.env.example` + secret manager (Doppler/Vault/GH secrets); tambah pre-commit `gitleaks protect`.

---

## Tinggi

### H-1 — Initial buy kreator selalu kena pajak snipe 99%
**File:** `contracts/src/BondingCurve.sol:201-205`, `contracts/src/LaunchpadV2Factory.sol:223-226`
```solidity
uint256 snipeBps = currentSnipeTaxBps(); // elapsed==0 -> 9900
curve.initialize(..., block.timestamp as launchTime);
if (initialBuyEth > 0) { curve.buyFor{value:initialBuyEth}(msg.sender, minInitialTokensOut); }
```
`launchTime==block.timestamp`, `elapsed==0` → 99% token initial buy ke `protocolFeeRecipient`.
**Perbaikan:** kecualikan `buyFor` factory di tx yang sama dengan `initialize`, atau `launchTime = block.timestamp+3` / whitelist initial buy dari snipe.

### H-2 — Anti-snipe sengaja nonaktif saat initial buy + bypass kontrak sepele
**File:** `contracts/src/LaunchpadToken.sol:308,318`, `contracts/src/LaunchpadV2Factory.sol:228`, `contracts/src/LaunchpadV2FactoryArc.sol:258`
```solidity
if (block.number <= restrictionsEndBlock && from == liquidityPool && liquidityPool != address(0)) {
if (to.code.length > 0) revert MaxBuyExceeded();
```
`token.setLiquidityPool(curveAddress)` dipanggil **setelah** `curve.buyFor`. Sebelum di-set, `liquidityPool==0` → caps dan pajak di-skip. Initial buy kreator tak terbatas (lewati `MAX_BUY 55M`/`MAX_HOLD 50M` di `LaunchpadToken.sol:29-30`). Tidak konsisten: `BaseLaunchpadFactory.sol:183` set **sebelum** buy. Cek `to.code.length` bisa bypass via buy saat constructor (`code.length==0`) atau pecah via EOA.
**Perbaikan:** set pool sebelum buy + pengecualian cap eksplisit untuk initial buy; ganti `code.length` dengan `tx.origin==msg.sender` + hitungan buy per blok, atau hapus.

### H-3 — V1 initial buy `amountOutMinimum:0` bisa di-sandwich
**File:** `contracts/src/LaunchpadFactory.sol:244-253`, `contracts/src/BondingCurve.sol:191`
```solidity
ISwapRouter.ExactInputSingleParams({ amountIn: initialBuyAmount, amountOutMinimum: 0, sqrtPriceLimitX96: 0 });
```
Deadline 20 menit `block.timestamp+1200` (`LaunchpadFactory.sol:250`). Sandwich mempool di pool fee 1% yang tipis.
**Perbaikan:** wajibkan `minInitialTokensOut>0` dari quoter (seperti V2) + `sqrtPriceLimitX96 != 0` + deadline pendek.

### H-4 — Buyback pertama tanpa proteksi + racun `lastKnownRate` = DoS
**File:** `contracts/src/BuybackBurner.sol:184-187,214,175,95-98`
```solidity
if (lastKnownRate > 0) {
  uint256 requiredMin = (wethBalance * lastKnownRate * (10_000 - maxSlippageBps)) / 1e22;
  if (minAmountOut < requiredMin) revert SlippageExceeded();
}
lastKnownRate = (tokensBurned * 1e18) / wethBalance;
```
Call pertama `lastKnownRate==0` → hanya `minAmountOut>0` yang jaga; owner/MEV bisa isi `1 wei` lalu sandwich seluruh `wethBalance`. Sebaliknya attacker pompa harga sebelum buyback pertama → `lastKnownRate` membengkak → `requiredMin` mustahil selamanya → DoS. `setCooldown` tanpa batas bawah → owner bisa set `0` dan hapus TWAP/cooldown.
**Perbaikan:** seed `lastKnownRate` via TWAP/quoter saat deploy; `cooldown>=15 mnt`; batasi `wethBalance` per buyback.

### H-5 — Vesting revocable = rug
**File:** `contracts/src/VestingVault.sol:108-131`
```solidity
function revokeVesting(address token, address beneficiary) external nonReentrant {
  if (msg.sender != s.creator) revert Unauthorized();
  ...
  if (unvested > 0) { ILaunchpadToken(token).transfer(s.creator, unvested); }
}
```
Kreator ambil 100% unvested kapan saja. Jika dipasarkan sebagai team-lock, tidak ada jaminan trustless.
**Perbaikan:** flag `revocable` saat create; jika `false` tolak revoke; emit event + kunci.

### H-6 — Hak owner tak terbatas / fee recipient immutable
**File:** `contracts/src/LaunchpadFactory.sol:104-107`, `contracts/src/LaunchpadV2Factory.sol:95-99,84-92,220`
```solidity
function setLocker(address _locker) external onlyOwner { locker = _locker; }
function setLaunchFee(uint256 _newFee) external onlyOwner { launchFee=_newFee; }
protocolFeeRecipient.call{value:launchFee}
```
`setLocker` bisa alihkan lock ke attacker. `setLaunchFee` tanpa cap → `type(uint256).max` mematikan launchpad atau `0` bikin spam. `protocolFeeRecipient` immutable dan jika revert, semua `launchTokenV2` revert. `LiquidityLocker.setProtocolFeeRecipient` `onlyOwner` alihkan semua fee ke depan.
**Perbaikan:** batasi fee (`<=0.01 ether`), `setProtocolFeeRecipient` dua tahap + timelock, hapus/`timelock` `setLocker`. V1 `launchToken:156` belum `nonReentrant` (V2 sudah) — tambah guard, pakai pull-fee atau escrow agar fee gagal tidak revert.

### H-7 — Route API ubah state tanpa auth
**File:** `apps/api/src/server.ts:695-725,710-718,851-1038,1045-1101`
- `POST /api/tokens/:address/sync` tanpa auth. Picu `indexTradeFromReceipt` + `pollEvents` dua chain. Amplifier DoS/biaya RPC.
- Handler sama: `if(body.taxConfig) await repository.save({...existing,taxConfig})` — siapa pun timpa `taxConfig` token mana pun (`sqlite-token.repository.ts:355-392`).
- `POST .../comments`, `.../like`, `.../repost`, `.../view` hanya cek regex `^0x[a-fA-F0-9]{40}$` pada `authorAddress/userAddress` yang klaim sendiri. Bisa impersonasi, farming like/view.
**Perbaikan:** kunci `sync` + `taxConfig` di belakang `ADMIN_SECRET` (pakai `safeTokenCompare` di `server.ts:185-188,1357-1361`); wajibkan verifikasi `personal_sign` EIP-191 untuk `authorAddress/userAddress`; tambah CAPTCHA / tier ketat untuk comment/like/view.

### H-8 — Auth DevOps fail-open di luar `production`
**File:** `apps/api/src/server.ts:457-535`, `apps/api/src/devops.controller.ts:253-256`
`if(!devopsToken && NODE_ENV==='production') 403`; `if(devopsToken){check}`. Jika `DEVOPS_AUTH_TOKEN` kosong dan `NODE_ENV!=production`, lolos ke `server.ts:536-558` sajikan dashboard + `getTelemetry()` (RSS/heap, ring request, histori error) + metrik Prometheus tanpa cek.
**Perbaikan:** fail-closed di semua env: `if(!devopsToken) 403;`. Server hanya baca `Authorization` (`server.ts:467-468`), dashboard kirim `?token=` juga — samakan header-only atau compare query constant-time.

### H-9 — Stored XSS via serve SVG IPFS
**File:** `apps/api/src/server.ts:1455-1474`, `apps/api/src/ipfs.controller.ts:39-49,84-89,133-138`, `apps/api/src/ipfs.service.ts:150-153`
Scanner upload bagus (blok `<script`, `javascript:`, `<foreignobject`, `on*=`, 5MiB `MAX_UPLOAD_BYTES:32`, allowlist MIME `24-30`), tapi serve kembalikan bytes tersimpan dengan MIME tersimpan, `Cache-Control: immutable`, `ACAO:*`, tanpa `Content-Security-Policy: sandbox`, tanpa `X-Content-Type-Options`, tanpa `Content-Disposition: attachment`. SVG poliglot = XSS persisten.
**Perbaikan:** saji dengan `Content-Security-Policy: sandbox; object-src 'none'`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline; filename=cid` atau `attachment`, atau rasterisasi/paksa `image/png`.

### H-10 — Href sosial token tak disanitasi (`javascript:` XSS)
**File:** `apps/frontoffice/src/components/trade/TradeHeader.vue:195-228`, `apps/frontoffice/src/components/TradeView.vue:226,240,250`
```vue
:href="currentToken.socials.twitter" / :href="currentToken.socials.telegram" / :href="currentToken.socials.website"
```
`socials.*` dikontrol kreator (onchain/API). Vue tidak blokir `javascript:alert(1)` di `:href`. Satu token jahat → klik korban = XSS di origin app.
**Perbaikan:**
```ts
function isSafeExternalUrl(u:string){try{const p=new URL(u);return p.protocol==='https:'}catch{return false}}
```
Validasi saat create + render; render `<span>` jika tak aman.

### H-11 — `approve(maxUint256)` tanpa batas
**File:** `apps/frontoffice/src/chains/robinhood/robinhood.adapter.ts:302-307,366-371`, `apps/frontoffice/src/chains/arc/arc.adapter.ts:286-291,350-355`
```ts
const maxUint256 = 2n ** 256n - 1n;
... functionName:'approve', args:[curveAddress!,maxUint256]
```
Tanpa jalur jumlah pas, tanpa UI revoke. Curve/router yang kompromi kuras seluruh saldo.
**Perbaikan:** `approve(sellTokenAmount)` (atau +buffer), cek `allowance` dulu, tampilkan spender/jumlah di UI, tambah tombol revoke (`approve 0`).

### H-12 — Container jalan sebagai root + `chmod 777`
**File:** `Dockerfile.api:1,30-31`, `Dockerfile.frontoffice:1,22`, `Dockerfile.docs:1,19`, `apps/api/entrypoint.sh:5-6`
`FROM oven/bun:1-alpine` floating, tanpa `USER`. `chmod 777 /app/data` (dir SQLite world-writable) + `mkdir -p; chmod -R 777`.
**Perbaikan:** `FROM oven/bun:1.2.5-alpine@sha256:…` + `RUN adduser…; USER appuser`; `755 + chown appuser`.

### H-13 — Gitleaks buta terhadap key asli
**File:** `.gitleaks.toml:1-2,7-10,19`
`useDefault=true` bagus; allowlist hanya `test/.*` bagus. Tapi `:19` `stopwords=["…","4832fd788725bf7c34d6bc2ca2d54a85"]` = persis Reown ID di `.env:8` → gitleaks tak akan pernah flag key asli. Tanpa `[[rules]]` untuk `PRIVATE_KEY=0x[0-9a-f]{64}` atau `PINATA_JWT=eyJ…`.
**Perbaikan:** hapus stopword itu, tambah aturan eksplisit + jalankan `gitleaks detect --source . -v` di `security.yml:26-30` (saat ini tanpa arg `config-path`).

---

## Sedang

### Kontrak
- **M-1 Window snipe 3 detik bisa dimanipulasi** — `libraries/AntiSnipeLogic.sol:30-34` + `BondingCurve.sol:157`: `elapsed>=3 → 0`, `elapsed==0 → 9900`. Validator geser `~2 dtk` → `9900→300→0` bypass. `launchTime` dari timestamp `initialize`, bukan nomor blok. Perbaikan: pakai window `block.number` (mis. 10 blok) seperti `LaunchpadToken.restrictionsEndBlock`.
- **M-2 Virtual reserve tidak cocok / double-account fee** — `LaunchpadV2Factory.sol:25` `VIRTUAL_TOKEN_RESERVE=1_073_000_000*1e18` vs `BondingCurve.sol:35-36` `800M+200M=1B`. `CurveMath.sol:47-49` batasi `tokenOut` ke `curveAvailable` tapi `virtualTokenReserve-=grossTokensOut` (`BondingCurve.sol:212`) bikin invarian `k` meleset. Arc: virtual 1B tapi dokumen bilang curve `738.6M`, kode kirim `totalSupply` (`LaunchpadV2FactoryArc.sol:225`) → tak sisa untuk LP V4. Perbaikan: virtual == saldo curve aktual; assert saat init.
- **M-3 Lock permanen tanpa migrasi** — `LiquidityLocker.sol:101-116` hanya `lockPosition`, `claimFees`; tanpa `unlock/burn/migrate`. V1 full-range `-887200..887200` (`LaunchpadFactory.sol:39-40`) fee 1% macet jika tier mati. `onERC721Received` terima NFT spam apa pun. Perbaikan: `burnAfter(TIMELOCK)` atau migrasi owner + timelock.
- **M-4 `totalEthRaised` bisa dimainkan + bypass `receive`** — `BondingCurve.sol:269,396-398,345`: jual kurangi counter → loop beli-jual tekan di bawah target, tunda graduasi (grief). `receive` tolak jika `graduated` tapi bisa force-feed via `selfdestruct`/coinbase → `migrateToV4` teruskan balance membengkak. Perbaikan: counter monotonik (jangan dikurangi) + hitung migrasi dari `totalRaised-withdrawn`, bukan `balance`.
- **M-6 Klaim cek EOA tak ada** — `LaunchpadToken.sol:193-210` `proposeTaxConfig` tanpa cek `code.length` meski header klaim ada fix L-02. Maks `MAX_TAX_BPS=1000` (10%) tiap sisi setelah 24 jam (`LaunchpadToken.sol:31-32,199`). Pajak dikredit via saldo (`:346`) bukan transfer. Perbaikan: `if(recipient.code.length>0) revert`, turunkan maks mis. 500bps, emit timelock.
- **M-7 Eksternal Uniswap tak dicek** — `LaunchpadFactory.sol:185,194`: `createPool` + `initialize` (sqrtPrice hardcode) tanpa cek eksistensi; `getPool` di `graduationStatus:312-316` kirim `(token,pairedToken)` tak di-sort — V3 `getPool` butuh sort, bisa return `0` → `graduated=false` palsu. `BondingCurve.sol:310-314`: `try initialize catch{}` telan gagal tapi tetap set `graduatedPoolId` + emit `Graduated` dengan harga salah. `CurveMath.computeSqrtPriceX96` presisi ganda-`sqrt` hilang (`CurveMath.sol:94-98`). Perbaikan: sort token, verifikasi `pool.slot0`, revert jika init V4 gagal, pakai sqrt presisi penuh.

### API
- **Header tak konsisten / CORS wildcard** — baseline bagus `cors.middleware.ts:32-44` (`nosniff,DENY,Referrer-Policy,CSP default-src 'self',HSTS,Vary:Origin`). Dilewati: `GET /api/ipfs/:cid` (`server.ts:1463-1470` `ACAO:*` tanpa hardening), SSE `server.ts:1183-1192`, HTML `/devops` `536-544`, handler 500 `1909-1914` (`ACAO:*`). `cors.middleware.ts:7-10` + `rate-limit.middleware.ts:10`: `/dex/*,/api/v1/* => ACAO:*` + tier crawler 600/mnt. Perbaikan: satu `buildSecurityHeaders()` untuk semua route; tambah `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy`; pertahankan `ACAO:*` hanya untuk GET publik anonim.
- **Celah rate-limit** — helper duplikat `rate-limit.middleware.ts:48-58` `return true` saat dua cache gagal (fail-open); `server.ts:442` `isHealthProbe` lewati limit; tier `crawler/terminal 600/mnt`, `api 300/mnt` per-IP via `cf-connecting-ip/x-forwarded-for||127.0.0.1` (`server.ts:1886-1889`) bisa spoof di belakang proxy tak tepercaya; bug `NaN`: `server.ts:665,686,784,813,830` `Math.min(100,Math.max(1,parseInt(...)))` tanpa guard `isNaN` (hanya `/api/tokens:579-582` yang jaga) → `?limit=abc => NaN` ke repository/cache. Perbaikan: hapus helper fail-open, percaya `cf-connecting-ip` hanya di belakang Cloudflare, satu `clampInt(raw,def,min,max)`.
- **SQL injection: AMAN** — semua akses pakai `db.prepare(... ? ...)` + `.get/.all(...params)` mis. `sqlite-token.repository.ts:394-401,403-428,501-514,557-586,703-730,752-758`. Tanpa `knex/raw`. Pertahankan; jangan interpolasi `limit/offset`.
- **SSRF: RENDAH** — outbound `fetch` hardcode: CoinGecko `coingecko-price-feed.adapter.ts:44-47`, Coinbase `:74`, Pinata `ipfs.service.ts:83`, gateway `:162-167`. CID disanitasi `cid.replace(/[^a-zA-Z0-9]/g,'')` (`ipfs.service.ts:137`). RPC dari env operator (`shared-types/src/chains/robinhood.ts:18,arc.ts:23`) via `http(cfg.rpcUrl,{retryCount:0,timeout:10_000})` (`server.ts:75`). Perbaikan: pertahankan allowlist; pin `IPFS_GATEWAY` ke allowlist `https://`.
- **Path traversal: AMAN dengan satu catatan** — `path.join(dir,cleanCid)` setelah strip alnum (`ipfs.service.ts:137-141`); `x-file-name` (`ipfs.controller.ts:166`) hanya di `${cid}.meta.json`, bukan path (`ipfs.service.ts:22-23`). Catatan `ipfs.service.ts:93-95`: `cid=data.IpfsHash` dari Pinata disimpan via `saveLocalFile` tanpa sanitasi. Percaya Pinata; sanitasi sama + assert kontainmen `path.resolve`.
- **Disclosure error** — top-level `handleRequest` generik `INTERNAL_SERVER_ERROR` (`server.ts:1915-1922`) bagus. Tapi controller gema internals: `token.controller.ts:65,81,99,115` `(error as Error).message`, `server.ts:723 SYNC_ERROR`, `:776 RPC_ERROR`, `trade.controller.ts:31,44,56,72` (bocor path tabel/viem). Perbaikan: petakan ke kode generik; `logger.error` detail di server, klien dapat `FETCH_FAILED`.
- **Validasi input longgar** — regex alamat `^0x[a-fA-F0-9]{40}$` di banyak route, `deployer` (`server.ts:587`), `txHash` 66-char (`:706`), `fromBlock/toBlock ^\d+$` (`:1375-1381,1598-1603`), cap JSON `parseJsonBody(req,4096/32k/65k)` (`parse-body.ts:7-16`) bagus. Celah: query `viewer/author/trader` (`:832-833,667`) tanpa validasi (aman SQL tapi bloat cache-key); param `chain/network` diam-diam default Robinhood (`resolveNetworkByParam:274-278`); `imageUrl` allowlist `https://|ipfs://` (`:893`) bagus tapi `targetMcap/content` mentah — tambah HTML-encode/strip `<>\"` sisi server. `apps/api/package.json:11-16` tanpa `zod` — tambah skema untuk tiap `searchParams/body`.
- **Default ops** — `DB_PATH||.../proto.sqlite` (`sqlite-token.repository.ts:75-76`), `PORT 3001` (`server.ts:83-86`), `hostname:0.0.0.0` (`:1931-1932`) oke di container jika orchestrator bind localhost + firewall; `proto.sqlite*` ikut folder (DB token/komen dunia-baca). `redis-cache.adapter.ts:13` tanpa Redis → no-cache diam-diam (aman-availability) tapi cache-poison via `x-cache:HIT` bertahan 3–60 dtk; tambah cache-key per versi + purge saat `sync`.

### Frontend
- **`resolveSafeUrl()` tidak konsisten** — versi aman hanya di `ProfileView.vue:421-443` + `EditProfileModal.vue:353-362` (cek `https/http/ipfs/data:image/blob:/api/ipfs`). Passthrough tanpa cek skema di `FeedView.vue:922-930`, `TradeView.vue:1851-1859`, `PostDetailPage.vue:616-624`, `ThreadModal.vue:407-415`, `ProfilePostsTab.vue:270-278`, `FeedCalloutCard.vue:361-368`. Sink `:src` (`FeedCalloutCard.vue:75`, `ThreadModal.vue:87`, `ProfilePostsTab.vue:70`, `TradeView.vue:901`, `PostDetailPage.vue:130`) dan `window.open(...,'_blank','noopener,noreferrer')` (`FeedView.vue:934`, `PostDetailPage.vue:628`, `ThreadModal.vue:419`, `ProfilePostsTab.vue:282`). `window.open('javascript:…')` **eksekusi** di origin halaman. `OptimizedImage.vue:41-50` teruskan `props.src` mentah untuk non-`ipfs://`. Perbaikan: satu `lib/safe-url.ts`, validasi hash `ipfs://` (`/^[A-Za-z0-9]+$/`) sebelum ``/api/ipfs/${hash}``.
- **Concat handle** — `ProfileHero.vue:119,128` ``:href="`https://x.com/${profileData.twitter}`"`` / `t.me` tanpa validasi/encoding. Perbaikan: whitelist `^[A-Za-z0-9_]{1,15}$` (X) / `^[A-Za-z0-9_]{5,}$` (TG) + `encodeURIComponent`.
- **SVG upload** — `lib/image-optimizer.ts:20-23` teruskan `image/svg+xml` tanpa sanitasi; `<img>` blokir script, tapi link gateway langsung (`TradeHeader.vue:171`, `TradeView.vue:200` → `https://ipfs.filebase.io/ipfs/…`) render SVG di origin gateway → phishing. Perbaikan: raster via canvas (atau tolak/sanitasi `DOMPurify`), saji dengan `nosniff`.
- **Slippage sampai 49% + gating lemah** — `composables/useSwap.ts:57,34-35` (`slippage=1.0`, `WARN 5.0`, `MAX 49.0`); clamp `robinhood.adapter.ts:41`, `arc.adapter.ts:40`; input custom `TradeView.vue:2494-2501` cap 49. Peringatan hanya `console.warn` (`useSwap.ts:86-88`); banner `TradeView.vue:683-697` kondisinya terbalik (`activeNetwork!==tokenNetwork` → sembunyi di network benar). `deadline: BigInt(...+1200)` (`robinhood.adapter.ts:395`, `arc.adapter.ts:379`) = jendela MEV 20 mnt. Perbaikan: modal konfirmasi + tampilkan `minAmountOut` pra-sign saat `>WARN`; cap custom ~10–15% kecuali mode advanced; betulkan banner; deadline 5–10 mnt; re-quote sebelum `writeContract`.
- **CSP/header** — `nginx.conf:12` ada CSP tapi lemah: `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, `connect-src 'self' https: wss:` (exfil ke host mana pun), tanpa `object-src 'none'`, `base-uri`, `frame-ancestors`. `server.js:33-42` (server prod Bun) **nol** header + `'./dist'+url.pathname` mentah (sanitasi `..`/`%2e`). `wrangler.toml:1-3` tanpa file `_headers` Pages. Perbaikan: hapus `unsafe-eval`, nonce/hash inline, `object-src 'none'; base-uri 'self'; frame-ancestors 'none'`, sempitkan `connect-src` ke host API/RPC/IPFS/WalletConnect, mirror header di `server.js` + `_headers`, sanitasi path statis.

### Supply-chain / CI
- `docker-compose.yml:5` `redis:7-alpine` pin major saja, tanpa digest → mutable. `docker-compose.yml:20,22,45` default publik lemah `proto_redis_default_secure_pass` + tampil di `healthcheck redis-cli -a …` (bocor di process-list). Port BAGUS: `:10,:68,:96,:121` semua `127.0.0.1`. ENV BAGUS: `:41-62` semua `${VAR:-default}`.
- `Dockerfile.frontoffice:4-5` `ARG VITE_REOWN…/ENV…` bakar ID ke layer (`docker history`). LOW/MEDIUM — maklum (key publik) atau pakai mount `--secret`.
- `bun.lock` / `package.json` — `viem ^2.23.0 → viem@2.56.3` (`bun.lock:1486`), `vue@3.5.42`, `vite@6.4.3` (pasca-CVE-2025-31125) sehat. Nested `vitepress@1.6.4 → vite@5.4.21` — pastikan `>=5.4.14`. `overrides: source-map-js ^1.2.2` bagus. Hindari `setup-bun@v2 bun-version:latest` (`ci.yml:21-23`) — pin `1.2.x`.
- CI `.github/` (13 workflow) — tanpa bocor secret (hanya skip-message `deploy-vps.yml:66`, `deploy-frontoffice.yml:56`; `permissions: contents:read`; secret via `${{ secrets.* }}`). Masalah: `security-audit.yml:25` `trivy-action@master` mutable — pin `@v0.24.0` + SHA. `deploy-vps.yml:33` fallback host literal `31.97.189.81` bocorkan IP infra — wajibkan secret, hapus literal. `foundry-toolchain@v1`, `setup-bun` floating — pin SHA.
- `.gitignore` kuat (`.env`, `*.sqlite*`, `*.log`, `*.pid` semua ignored+untracked) dengan 1 celah: ` .env.production/.env.staging` tak cocok (hanya `.env.*.local`). Perbaikan: tambah `.env*` + `!.env.example`.

---

## Rendah / Info

- **Dust ke kreator** — `HolderFeeDistributor.sol:95`, `FeeMath.sol:38-39`: `(amount*PRECISION)/supply` truncate; `protocolFee=(total*percent)/100; creator=total-protocol` → dust selalu ke kreator. Perbaikan: track sisa `dust` ke deposit berikut.
- **`claimVested` nol diam-diam** — `VestingVault.sol:159`: `if(!s.exists||s.revoked) return 0;` bukan revert → UI kira sukses. Perbaikan: `revert ScheduleNotFound()`.
- **Tanpa pause/upgrade** — tanpa proxy/pausable; curve pegang ETH sampai `GRADUATION_TARGET 4.2 ether` (`LaunchpadV2Factory.sol:23`) / `69k` Arc dengan `MIGRATION_DEADLINE` 180 hari (`BondingCurve.sol:40`) tanpa rescue pra-graduasi. Perbaikan: `pause()` factory + rescue timelock.
- **Secrets di log: AMAN** — tanpa `ADMIN_SECRET/DEVOPS/PINATA/COINGECKO` di log; redaksi prod `server.ts:1902-1905`, hash IP `sha256.slice(0,16)` (`http-request-tracker.ts:73,93,110`). Minor: `ipfs.service.ts:105-107` log `response.text()` Pinata — potong 500 char, jangan log `Authorization`.
- **Frontend PASS:** `v-html/innerHTML` 0; `privateKey/mnemonic/seedPhrase` 0 (non-custodial via `@reown/appkit` `lib/appkit.ts:6,54-101`); open redirect 0 (`router/index.ts:15,55,96` statis); `postMessage` 0 (hanya `BroadcastChannel('proto_wallet_sync')` `lib/wallet-store.ts:64-87` — validasi `chainId ∈ SUPPORTED_CHAINS` sebelum `useWallet.ts:352-354`); `localStorage` hanya non-sensitif (`proto_wallet_*`, registry, pin, resolusi chart) tapi `JSON.parse` tanpa skema (`username.ts:227`, `ProfileView.vue:451`) — validasi skema saat load. `VITE_*` non-rahasia kecuali Reown ID (publik by-design, rotasi + batasi origin).
- **SQLite/Log di repo** — `proto.sqlite` (0B basi), `apps/api/proto.sqlite` (172K) + `-shm` (32K) + `-wal` (4.1M, tulis aktif) ignored+untracked tapi ikut folder; WAL bisa muat token/komen/PII. `server.log,api.log,docs.log,frontoffice.log` + `*.pid` ignored+untracked, grep key 0 hit. Perbaikan: `rm` sebelum share; andalkan volume `proto_api_data:/app/data`.

---

## Rencana Perbaikan

| Prioritas | Aksi | Effort |
|-----------|------|--------|
| Segera | Rotasi `PRIVATE_KEY/PINATA/COINGECKO`, hapus dump dari folder, kunci `sync`/taxConfig + DevOps fail-closed, `CSP sandbox` IPFS, update kontrak C-1/C-2/C-3 | Rendah |
| Minggu ini | Snipe/initial-buy, TWAP buyback, lib safe-URL, approval pas + revoke, image rootless ter-pin, aturan gitleaks, sentralisasi header, betulkan banner slippage + deadline | Sedang |
| Bulan ini | Migrasi locker, counter monotonik, cap fee + multisig, skema zod, cap slippage, Dependabot + `bun audit`, `_headers` Pages | Sedang |

---

## Referensi File Utama

- Kontrak: `contracts/src/BondingCurve.sol`, `HolderFeeDistributor.sol`, `VestingVault.sol`, `LaunchpadV2Factory.sol`, `LaunchpadV2FactoryArc.sol`, `LaunchpadToken.sol`, `BuybackBurner.sol`, `LiquidityLocker.sol`, `libraries/AntiSnipeLogic.sol`, `libraries/CurveMath.sol`
- API: `apps/api/src/server.ts`, `apps/api/src/cors.middleware.ts`, `apps/api/src/rate-limit.middleware.ts`, `apps/api/src/ipfs.service.ts`, `apps/api/src/ipfs.controller.ts`, `apps/api/src/sqlite-token.repository.ts`
- Frontend: `apps/frontoffice/src/components/trade/TradeHeader.vue`, `apps/frontoffice/src/components/TradeView.vue`, `apps/frontoffice/src/chains/robinhood/robinhood.adapter.ts`, `apps/frontoffice/src/chains/arc/arc.adapter.ts`, `apps/frontoffice/src/composables/useSwap.ts`, `apps/frontoffice/nginx.conf`, `apps/frontoffice/server.js`
- Config: `.env`, `.env.example`, `.gitignore`, `.gitleaks.toml`, `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.frontoffice`, `Dockerfile.docs`, `.github/workflows/`
