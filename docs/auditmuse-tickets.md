# Tiket Perbaikan — Audit Proto (13 Okt 2026)

Sumber: `docs/auditmuse.md`. Format: ID | Severity | Komponen | Estimasi.

## Daftar Cepat

| ID | Severity | Judul | File Utama | Prioritas |
|----|----------|-------|------------|-----------|
| T-C1 | Kritis | Owner bisa kuras curve via recipient bebas | `contracts/src/BondingCurve.sol:338`, `LaunchpadV2Factory.sol:240-241` | P0 |
| T-C2 | Kritis | Flash-loan curi fee distributor | `contracts/src/HolderFeeDistributor.sol:111-114,140-142` | P0 |
| T-C3 | Kritis | Squatting slot vesting DoS | `contracts/src/VestingVault.sol:84` | P0 |
| T-C4 | Kritis | Rotasi `.env` bocor + hapus dari folder | `proto/.env:11,12,109,114` | P0 |
| T-H1 | Tinggi | Initial buy kena pajak 99% | `BondingCurve.sol:201-205`, `LaunchpadV2Factory.sol:223-226` | P0 |
| T-H2 | Tinggi | Anti-snipe mati saat initial buy | `LaunchpadToken.sol:308,318`, `LaunchpadV2Factory.sol:228` | P0 |
| T-H3 | Tinggi | Sandwich V1 `minOut:0` | `LaunchpadFactory.sol:244-253` | P0 |
| T-H4 | Tinggi | Buyback tanpa TWAP + racun rate | `BuybackBurner.sol:184-187,214` | P1 |
| T-H5 | Tinggi | Vesting revocable rug | `VestingVault.sol:108-131` | P1 |
| T-H6 | Tinggi | Owner tak terbatas + fee immutable | `LaunchpadFactory.sol:104-107`, `LaunchpadV2Factory.sol:95-99` | P1 |
| T-H7 | Tinggi | API sync/taxConfig/komen tanpa auth | `apps/api/src/server.ts:695-725,851-1101` | P0 |
| T-H8 | Tinggi | DevOps fail-open | `apps/api/src/server.ts:457-535` | P0 |
| T-H9 | Tinggi | Stored XSS SVG IPFS | `apps/api/src/server.ts:1455-1474` | P0 |
| T-H10 | Tinggi | Href sosial `javascript:` XSS | `TradeHeader.vue:195-228`, `TradeView.vue:226` | P0 |
| T-H11 | Tinggi | Approval unlimited | `robinhood.adapter.ts:302-307`, `arc.adapter.ts:286-291` | P1 |
| T-H12 | Tinggi | Docker root + chmod 777 | `Dockerfile.api:1,30-31`, `entrypoint.sh:5-6` | P1 |
| T-H13 | Tinggi | Gitleaks buta key asli | `.gitleaks.toml:19` | P1 |
| T-M1 | Sedang | Window snipe timestamp | `AntiSnipeLogic.sol:30-34` | P2 |
| T-M2 | Sedang | Virtual reserve mismatch | `LaunchpadV2Factory.sol:25`, `BondingCurve.sol:35-36` | P2 |
| T-M3 | Sedang | Lock permanen tanpa migrasi | `LiquidityLocker.sol:101-116` | P2 |
| T-M4 | Sedang | `totalEthRaised` gameable | `BondingCurve.sol:269,345` | P2 |
| T-M5 | Sedang | Header/CSP/rate-limit/error-leak | `cors.middleware.ts`, `rate-limit.middleware.ts`, `server.ts` | P1 |
| T-M6 | Sedang | Safe-URL + slippage 49% + banner | `FeedView.vue:922-930`, `useSwap.ts:57`, `TradeView.vue:683-697` | P1 |
| T-M7 | Sedang | Supply-chain floating + IP literal | `docker-compose.yml:5`, `ci.yml:21-23`, `deploy-vps.yml:33` | P2 |
| T-L1 | Rendah | Dust, silent-zero, tanpa pause | `HolderFeeDistributor.sol:95`, `VestingVault.sol:159` | P3 |

---

## T-C1 — Kuras curve via recipient bebas [P0]
- **Severity:** Kritis | **Komponen:** contracts
- **Deskripsi:** `migrateCurveToV4(curve, recipient)` dan `emergencyWithdraw` terima alamat bebas, hanya `onlyOwner` EOA.
- **Aksi:**
  1. Buat recipient immutable ke locker/router V4, hapus parameter.
  2. Jika perlu fleksibel: allowlist + timelock 48 jam + multisig.
  3. Tambah test Foundry: non-owner revert, recipient non-allowlist revert.
- **Acceptance:** tidak ada path owner satu-tx menguras ke EOA bebas; `forge test` hijau.

## T-C2 — Flash-loan distributor [P0]
- **Severity:** Kritis | **Komponen:** contracts
- **Aksi:**
  1. Snapshot efektif setelah jeda N blok (mis. 2 blok).
  2. Blokir `checkpoint` di blok yang sama dengan `depositRewards`.
  3. Test PoC: flash-loan → checkpoint → deposit → claim harus gagal/untung ~0.
- **Acceptance:** PoC gagal; fuzz 256 run tanpa theft.

## T-C3 — Squat vesting [P0]
- **Severity:** Kritis | **Komponen:** contracts
- **Aksi:** ubah ke `mapping(token=>beneficiary=>nonce=>Schedule)` atau allowlist kreator + revoke/recreate. Tambah test frontrun.
- **Acceptance:** dua jadwal untuk beneficiary sama bisa dibuat tanpa DoS.

## T-C4 — Rotasi secrets [P0]
- **Severity:** Kritis | **Komponen:** ops/config
- **Aksi:**
  1. `rm .env proto.sqlite* *.log *.pid` sebelum share.
  2. Rotasi: `PRIVATE_KEY`, `PINATA_JWT` (revoke dashboard), `COINGECKO_API_KEY`, Reown ID (batasi origin).
  3. Ganti `ADMIN_SECRET=dev-secret-change-me` dengan `openssl rand -hex 32`.
  4. Pindah ke Vault/GH secrets + `gitleaks protect` pre-commit.
- **Acceptance:** tidak ada key lama valid; `.env` baru tidak ada di disk share.

## T-H1 — Pajak 99% initial buy [P0]
- **Aksi:** kecualikan `buyFor` factory di tx `initialize`, atau `launchTime+3 dtk`. Test: initial buy terima ~penuh, snipe blok berikutnya tetap kena pajak.
- **Acceptance:** test V2 launch + initial buy hijau.

## T-H2 — Anti-snipe mati [P0]
- **Aksi:** set pool sebelum buy + pengecualian cap eksplisit; ganti `code.length` dengan `tx.origin` check + hitungan per blok. Test constructor-buy revert.
- **Acceptance:** initial buy lolos cap secara eksplisit, sniper kontrak terblokir.

## T-H3 — Sandwich V1 [P0]
- **Aksi:** wajibkan `minInitialTokensOut>0` dari quoter, `sqrtPriceLimit!=0`, deadline 5 mnt.
- **Acceptance:** launch dengan `minOut=0` revert.

## T-H4 — Buyback [P1]
- **Aksi:** seed `lastKnownRate` via TWAP saat deploy; `cooldown>=15 mnt`; cap per-tx; test rate-racun → tidak DoS permanen.

## T-H5 — Revocable vesting [P1]
- **Aksi:** flag `revocable` saat create; tolak revoke jika false; event.

## T-H6 — Owner tak terbatas [P1]
- **Aksi:** cap fee `<=0.01 ether`, setter dua tahap + timelock, escrow jika fee gagal, `nonReentrant` di V1 `launchToken`.

## T-H7 — API tanpa auth [P0]
- **File:** `apps/api/src/server.ts:695-725,710-718,851-1101`
- **Aksi:** kunci `sync` + tulis `taxConfig` di belakang `ADMIN_SECRET`; verifikasi EIP-191 untuk komen/like/view; tier rate ketat + CAPTCHA.
- **Acceptance:** `POST /sync` tanpa token → 403; komen alamat orang lain → 401.

## T-H8 — DevOps fail-open [P0]
- **Aksi:** `if(!devopsToken) 403` di semua env; samakan baca `Authorization` header-only.
- **Acceptance:** dashboard tanpa token → 403 di dev maupun prod.

## T-H9 — XSS SVG IPFS [P0]
- **Aksi:** saji dengan `CSP: sandbox; object-src 'none'`, `nosniff`, `Content-Disposition`; atau raster paksa PNG.
- **Acceptance:** upload SVG `<script>` → dieksekusi tidak jalan saat di-GET.

## T-H10 — Href `javascript:` [P0]
- **Aksi:** satu `lib/safe-url.ts` (`https:` only), pakai di TradeHeader/TradeView/ProfileHero/Feed; validasi hash `ipfs://`.
- **Acceptance:** token dengan `socials.website=javascript:…` render sebagai span, tidak klikable.

## T-H11 — Approval unlimited [P1]
- **Aksi:** approve jumlah pas + cek allowance, tampilkan spender/jumlah, tombol revoke `approve 0`.

## T-H12 — Docker root [P1]
- **Aksi:** pin `bun:1.2.5-alpine@sha256`, `USER appuser`, `755+chown`, `REDIS_PASSWORD:?required` (hapus default lemah), pin `redis:7.4.1-alpine@sha256`.

## T-H13 — Gitleaks [P1]
- **Aksi:** hapus stopword Reown ID, tambah rule `PRIVATE_KEY`/`PINATA_JWT`, jalankan dengan `--config-path` di CI.

## T-M1..T-M7, T-L1 [P1-P3]
- **T-M1:** window snipe pakai `block.number` 10 blok.
- **T-M2:** virtual == saldo curve aktual + assert init.
- **T-M3:** `burnAfter(TIMELOCK)` / migrasi timelock locker.
- **T-M4:** counter monotonik + migrasi dari `raised-withdrawn`.
- **T-M5:** satu `buildSecurityHeaders()` semua route; hapus helper fail-open; `clampInt`; pesan error generik; tambah zod.
- **T-M6:** sentralisasi safe-URL; cap slippage 10-15% + betulkan banner; deadline 5-10 mnt; CSP tanpa `unsafe-eval`, `connect-src` sempit, header di `server.js` + `_headers`.
- **T-M7:** pin semua action (`trivy@v0.24.0`+SHA, bun, foundry), hapus IP literal `31.97.189.81`, tambah `.env*` ke gitignore.
- **T-L1:** track `dust`, `revert` bukan return 0, tambah `pause()` + rescue timelock.

---

## Urutan Sprint

- **Sprint 1 (P0):** T-C1, T-C2, T-C3, T-C4, T-H1, T-H2, T-H3, T-H7, T-H8, T-H9, T-H10
- **Sprint 2 (P1):** T-H4, T-H5, T-H6, T-H11, T-H12, T-H13, T-M5, T-M6
- **Sprint 3 (P2-P3):** T-M1, T-M2, T-M3, T-M4, T-M7, T-L1
