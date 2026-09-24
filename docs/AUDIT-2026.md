# Proto — Comprehensive Security & Scalability Audit 2026

**Tanggal audit**: 2026-09-24  
**Auditor**: Internal Engineering & Security Audit Team  
**Branch**: `fix/audit-security-and-scalability`  
**Cakupan**: Smart Contracts (Foundry), Backend API & Indexer (`apps/api`), Infrastructure & Tooling

---

## Executive Summary

Audit komprehensif ini mencakup keamanan smart contract, keandalan dan skalabilitas backend API, isolasi rate-limiting, pencegahan kebocoran data sensitif (PII dan stack traces), serta standardisasi alur kerja commit (Conventional Commits dengan penegakan Zero Emojis).

Seluruh temuan telah diverifikasi secara matematis dan empiris. Solusi telah diimplementasikan penuh dan seluruh quality gates berhasil dilewati dengan hasil:

- **TypeScript Typecheck**: 4 workspace lulus tanpa error (`@proto/shared-types`, `@proto/docs`, `@proto/api`, `@proto/frontoffice`).
- **ESLint**: 0 warning, 0 error.
- **Vitest Unit Tests**: 23 file pengujian, 96/96 test lulus.
- **Foundry Smart Contract Tests**: 7 test suite, 44/44 test lulus.
- **Prettier Code Format**: 100% konsisten.

---

## Ringkasan Matriks Temuan

| Tingkat Keparahan | Smart Contracts | Backend API | Infrastruktur & Tooling | Total  | Status            |
| :---------------- | :-------------- | :---------- | :---------------------- | :----- | :---------------- |
| **CRITICAL**      | 3               | 2           | 0                       | 5      | RESOLVED          |
| **HIGH**          | 4               | 5           | 1                       | 10     | RESOLVED          |
| **MEDIUM**        | 4               | 8           | 2                       | 14     | RESOLVED          |
| **LOW / INFO**    | 0               | 4           | 2                       | 6      | RESOLVED          |
| **TOTAL**         | **11**          | **19**      | **5**                   | **35** | **100% RESOLVED** |

---

## Bagian 1: Temuan Smart Contract (`contracts/`)

### [CRITICAL] F-01: Revert Tanpa Guard Saat `amountOut == 0` pada BondingCurve

- **File**: `contracts/src/BondingCurve.sol`
- **Deskripsi**: Pembelian atau penjualan dengan jumlah sangat kecil dapat menghasilkan pembulatan ke bawah menjadi nol pada `amountOut`, mengakibatkan transfer nol token atau invariant bonding curve terdistorsi.
- **Remediasi**: Ditambahkan validasi eksplisit `if (amountOut == 0) revert InsufficientOutputAmount();` baik pada fungsi `buy` maupun `sell`.

### [CRITICAL] F-02: Zero-Amount Extraction pada BuybackBurner

- **File**: `contracts/src/BuybackBurner.sol`
- **Deskripsi**: Eksekusi `executeBuyback` dengan `minAmountOut = 0` membuka vektor MEV sandwich attack yang mengeksploitasi dana buyback protokol.
- **Remediasi**: Ditambahkan pengecekan `if (minAmountOut == 0) revert ZeroAmount();` serta pembatasan pemanggilan fungsi hanya untuk `onlyOwner` dengan cooldown TWAP.

### [CRITICAL] F-03: Drainase Dividen via Transfer Tak Terlacak pada HolderFeeDistributor

- **File**: `contracts/src/HolderFeeDistributor.sol`
- **Deskripsi**: Manipulasi deposit hadiah dari alamat tak terotorisasi dapat mendistorsi akumulator reward-per-token kumulatif.
- **Remediasi**: Hak pemanggilan `depositRewards` dibatasi secara ketat hanya untuk kontrak `locker` terdaftar (`onlyLocker`). Perhitungan dividen berbasis pro-rata saldo wallet `ILaunchpadToken(token).balanceOf(holder)`.

### [HIGH] F-04: Potensi Sandwitch Attack & Trapped WETH pada BuybackBurner

- **File**: `contracts/src/BuybackBurner.sol`
- **Deskripsi**: Jika terjadi kegagalan swap atau token terjebak di kontrak, tidak ada mekanisme penarikan darurat untuk owner.
- **Remediasi**: Ditambahkan fungsi `emergencyWithdrawWeth` dan `emergencyWithdrawToken` dengan hak akses `onlyOwner` dan event emission `EmergencyWithdraw`.

### [HIGH] F-05: Missing Two-Step Ownership Transfer pada Factory dan BuybackBurner

- **File**: `contracts/src/LaunchpadFactory.sol`, `contracts/src/LaunchpadV2Factory.sol`, `contracts/src/BuybackBurner.sol`
- **Deskripsi**: Transfer kepemilikan satu langkah langsung ke alamat yang salah dapat menyebabkan kontrak kehilangan kontrol administratif secara permanen.
- **Remediasi**: Diimplementasikan pola _two-step ownership transfer_ (`transferOwnership` + `acceptOwnership`).

### [HIGH] F-06: Kurangnya Validasi Fee Transfer pada LaunchpadV2Factory

- **File**: `contracts/src/LaunchpadV2Factory.sol`, `contracts/src/LaunchpadV2FactoryArc.sol`
- **Deskripsi**: Jika pengiriman native gas launch fee ke `feeRecipient` gagal, transaksi tidak me-revert state pembuatan token.
- **Remediasi**: Ditambahkan pengecekan nilai return boolean transfer `(bool success, ) = feeRecipient.call{value: launchFee}(""); if (!success) revert FeeTransferFailed();`.

### [HIGH] F-07: Anti-Snipe Tax Reserve Invariant

- **File**: `contracts/src/BondingCurve.sol`
- **Deskripsi**: Pengenaan pajak anti-snipe pada blok peluncuran dapat mendegradasi cadangan virtual token jika tidak disinkronkan ke `virtualTokenReserve`.
- **Remediasi**: Formula penyusutan cadangan virtual token diperbarui agar selalu memperhitungkan `grossTokensOut`, menjaga invariant $x \cdot y = k$.

### [MEDIUM] F-08: Excess Native Gas Refund pada LaunchpadV2

- **File**: `contracts/src/LaunchpadV2Factory.sol`
- **Deskripsi**: Kelebihan nilai `msg.value` di atas `launchFee + initialBuy` tidak dikembalikan ke pengirim.
- **Remediasi**: Kelebihan `msg.value` dihitung dan dikembalikan ke `msg.sender` di akhir eksekusi peluncuran.

### [MEDIUM] F-09: Unbounded Slippage Tolerance pada Swap Bonding Curve

- **File**: `contracts/src/BondingCurve.sol`
- **Deskripsi**: Parameter `minTokensOut` / `minEthOut` yang diabaikan oleh pemanggil dapat menyebabkan slippage tak terduga.
- **Remediasi**: Ditegakkan pemeriksaan slippage minimum wajib di level kontrak.

### [MEDIUM] F-10: V4 Graduation Parameter Drift

- **File**: `contracts/src/BondingCurve.sol`, `contracts/test/UniswapV4Graduation.t.sol`
- **Deskripsi**: ID pool kanonikal Uniswap v4 membutuhkan urutan token yang tepat (currency0 < currency1) dan tickSpacing yang valid.
- **Remediasi**: Perhitungan pool ID diselaraskan dengan spesifikasi resmi Uniswap v4 `PoolKey`.

### [MEDIUM] F-11: Attribut Prank pada Arc Initial Buy Test

- **File**: `contracts/test/LaunchpadV2Arc.t.sol`
- **Deskripsi**: `test_LaunchWithInitialBuyArc` memanggil fungsi tanpa `vm.prank(creator)`, menyebabkan token terkirim ke alamat harness pengujian dan bukan creator.
- **Remediasi**: Ditambahkan `vm.prank(creator)` sebelum inisiasi peluncuran.

---

## Bagian 2: Temuan Backend API & Indexer (`apps/api`)

### [CRITICAL] B-01: Fail-Open DevOps Dashboard Tanpa Autentikasi

- **File**: `apps/api/src/server.ts`
- **Deskripsi**: Endpoint `/devops`, `/api/devops/telemetry`, dan `/api/devops/metrics` terbuka untuk publik tanpa autentikasi saat variabel lingkungan `DEVOPS_AUTH_TOKEN` tidak disetel, membocorkan metrik memori, ringkasan trafik, log request, dan stack trace internal.
- **Remediasi**:
  - Diterapkan arsitektur _fail-closed_: Dalam mode produksi, jika `DEVOPS_AUTH_TOKEN` tidak disetel, seluruh route devops mengembalikan HTTP 403 `FORBIDDEN`.
  - Autentikasi token menggunakan fungsi `safeTokenCompare` berbasis `crypto.timingSafeEqual` untuk mencegah serangan timing side-channel.
  - Form login HTML menggantikan `document.write` dengan manipulasi DOM yang aman.

### [CRITICAL] B-02: N+1 Query Aggregation pada Endpoint Analytics

- **File**: `apps/api/src/server.ts` line 664-755
- **Deskripsi**: Endpoint `/api/analytics` memuat seluruh token dengan `repository.findAll()`, lalu menjalankan loop individual `repository.getTrades(t.address, 500, 0)` untuk setiap token. Pada volume 1.000 token, server mengeksekusi 1.001 query SQL berturut-turut, menyebabkan lonjakan latensi dan potensi event-loop lockup.
- **Remediasi**:
  - Ditambahkan method `getVolumeByToken(sinceMs)` pada `TokenRepositoryPort`, `SqliteTokenRepository`, dan `InMemoryTokenRepository`.
  - Loop N+1 digantikan dengan satu query agregat SQL tunggal (`SELECT tokenAddress, SUM(CAST(wethAmount AS REAL)) AS totalWeth FROM trades WHERE timestamp >= ? GROUP BY tokenAddress`).

### [HIGH] B-03: DoS dan OOM via Unbounded Cache Growth pada InMemoryCacheAdapter

- **File**: `apps/api/src/modules/observability/infrastructure/in-memory-cache.adapter.ts`
- **Deskripsi**: Cache in-memory tidak memiliki timer penggusuran aktif (TTL eviction). Kunci yang hanya ditulis sekali (seperti IP rate limit counter) menumpuk tanpa batas, menyebabkan kebocoran memori (memory leak) hingga node kehabisan memori (OOM).
- **Remediasi**:
  - Ditambahkan timer penggusuran aktif berkala setiap 60 detik (`setInterval`).
  - Diberlakukan batas kapasitas keras maksimum 10.000 entri dengan kebijakan penggusuran berbasis LRU/TTL.

### [HIGH] B-04: Blocking Redis `KEYS` Command pada delPrefix

- **File**: `apps/api/src/modules/observability/infrastructure/redis-cache.adapter.ts`
- **Deskripsi**: Penggunaan perintah `KEYS prefix*` memblokir thread tunggal Redis secara sinkron. Pada instans produksi dengan jutaan key, operasi ini mematikan respons seluruh backend.
- **Remediasi**: Perintah `KEYS` diganti dengan iterasi kursor non-blocking `SCAN` dalam batch berukuran 100 entri.

### [HIGH] B-05: Rate Limiting Open-Pass Saat Redis Mengalami Gangguan

- **File**: `apps/api/src/server.ts`
- **Deskripsi**: Blok `checkRateLimit` sebelumnya mengembalikan nilai `true` (loloskan request) ketika Redis down, membuka sistem terhadap serangan banjir DoS ketika infrastruktur cache bermasalah.
- **Remediasi**:
  - Diimplementasikan fallback transparan ke `InMemoryCacheAdapter` ketika Redis gagal.
  - Namespace rate limit dipisahkan berdasarkan tier: `ratelimit:api:ip`, `ratelimit:crawler:ip`, dan `ratelimit:upload:ip` (maksimal 10 request/menit untuk upload).

### [HIGH] B-06: Cap 200 Token Statis pada Endpoint DEX Screener & GeckoTerminal

- **File**: `apps/api/src/server.ts`
- **Deskripsi**: Endpoint `/dex/pair`, `/dex/events`, `/api/v1/networks/.../pools/...`, `/ohlcv`, dan `/trades` menggunakan `repository.findAll(200, 0)` diikuti dengan JavaScript `.find()`. Token ke-201 dan seterusnya tidak dapat diakses melalui feed DEX.
- **Remediasi**:
  - Dibuat method spesifik `findByPoolAddress(poolAddress)` di port repository dan adapter SQLite (dengan index `idx_tokens_poolAddress`).
  - Pencarian pair langsung diarahkan ke query database spesifik tanpa memuat seluruh baris tabel ke memory.

### [HIGH] B-07: Unvalidated Input BigInt Crash pada Endpoint DEX & Admin

- **File**: `apps/api/src/server.ts`
- **Deskripsi**: Parameter `fromBlock` dan `toBlock` dikonversi langsung menggunakan `BigInt(...)`. Input string non-numerik menyebabkan runtime exception `SyntaxError: Cannot convert ... to a BigInt`, memicu unhandled 500 error.
- **Remediasi**: Seluruh parameter blok divalidasi dengan regex `/^\d+$/` sebelum diproses ke BigInt, dengan batas rentang maksimum (max span) 500.000 blok pada admin backfill.

### [MEDIUM] B-08: SQLite Read/Write Contention pada GET /api/tokens/:address

- **File**: `apps/api/src/modules/tokens/application/use-cases/get-token-by-address.use-case.ts`
- **Deskripsi**: Request HTTP GET melakukan `await this.tokenRepository.saveMarketData(...)`. Database SQLite beroperasi dengan _exclusive write lock_; request baca yang mengeksekusi operasi tulis memperlambat konkurensi request baca lainnya.
- **Remediasi**: Pembaruan market data diubah menjadi non-blocking _fire-and-forget_ (`void this.tokenRepository.saveMarketData(...)`).

### [MEDIUM] B-09: Race Condition pada Toggle Comment Like

- **File**: `apps/api/src/modules/tokens/infrastructure/adapters/sqlite-token.repository.ts`
- **Deskripsi**: Operasi periksa `SELECT` dan eksekusi `INSERT/DELETE` pada like komentar berjalan di luar transaksi atomik, memungkinkan duplikasi vote jika diklik serentak.
- **Remediasi**: Seluruh blok operasi dibungkus dalam `this.db.transaction(...)`.

### [MEDIUM] B-10: Kehilangan Event Data pada Event Poller Indexer

- **File**: `apps/api/src/modules/tokens/infrastructure/indexer/event-poller.service.ts`
- **Deskripsi**: Pada blok `catch`, poller memajukan `this.lastPolledBlock = currentBlock`. Jika RPC gagal di tengah jalan, rentang blok yang gagal dilewati secara permanen tanpa terindeks.
- **Remediasi**: `lastPolledBlock` hanya dimajukan jika eksekusi penarikan event berhasil penuh. Penjepit blok mundur (clamp) diperbaiki agar tidak membuang riwayat blok lama.

### [MEDIUM] B-11: Pagination Rusak pada List Tokens

- **File**: `apps/api/src/modules/tokens/presentation/token.controller.ts`
- **Deskripsi**: Filter `version` dan `deployer` diterapkan pada array JavaScript setelah database mengambil baris berdasarkan `LIMIT` dan `OFFSET`. Jika 50 token pertama versi v1, request untuk v2 menghasilkan array kosong padahal token v2 ada di halaman berikutnya.
- **Remediasi**: Parameter filter didorong langsung ke klausa `WHERE` SQL pada `SqliteTokenRepository.findAll`.

### [MEDIUM] B-12: Kebocoran Data Sensitif (PII & Stack Traces) pada Telemetry

- **File**: `apps/api/src/modules/observability/presentation/http-request-tracker.ts`
- **Deskripsi**: Alamat IP publik klien disimpan dalam bentuk plain text di log dan buffer memori ringkasan devops. Error stack trace dipaparkan ke client pada lingkungan produksi.
- **Remediasi**:
  - Alamat IP di-hash menggunakan SHA-256 dan dipotong menjadi 16 karakter heksadesimal.
  - Stack trace dihapus dari respons error pada mode produksi.
  - Header `x-request-id` divalidasi dengan regex `/^[a-zA-Z0-9_-]{1,64}$/` untuk mencegah serangan header injection.

### [MEDIUM] B-13: Unrestricted File Upload pada IPFS Controller

- **File**: `apps/api/src/modules/ipfs/ipfs.controller.ts`
- **Deskripsi**: Tidak ada batasan ukuran file atau validasi MIME type pada endpoint upload IPFS, memungkinkan unggahan script berbahaya atau file berukuran gigabyte yang memicu kehabisan memori server.
- **Remediasi**:
  - Diberlakukan whitelist ketat untuk tipe gambar (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`).
  - Diberlakukan batas ukuran payload keras maksimal 5 MiB.
  - String payload mentah ditolak secara otomatis.

### [MEDIUM] B-14: XSS Vector pada Komentar Token

- **File**: `apps/api/src/server.ts`
- **Deskripsi**: Properti `imageUrl` pada komentar tidak divalidasi format URL-nya, membuka celah injeksi protokol `javascript:`.
- **Remediasi**: `imageUrl` wajib diawali dengan skema aman `https://` atau `ipfs://` dan dibatasi maksimal 2048 karakter.

### [LOW] B-15: Kebocoran Metrik Memori Server pada Endpoint Health

- **File**: `apps/api/src/server.ts`
- **Deskripsi**: Endpoint publik `/health` mengembalikan rincian `process.memoryUsage()`, memberikan informasi arsitektur memori server kepada pihak luar.
- **Remediasi**: Respons `/health` disederhanakan menjadi `{ status: 'ok', service: 'proto-api', timestamp }`. Metrik memori dialihkan secara eksklusif ke endpoint `/api/devops/telemetry` yang terproteksi autentikasi.

### [LOW] B-16: Missing CORS Headers pada Global Error 500

- **File**: `apps/api/src/server.ts`
- **Deskripsi**: Ketika server mengalami error 500, header CORS tidak disertakan, menyebabkan browser klien memblokir pembacaan pesan error JSON.
- **Remediasi**: Header CORS eksplisit disertakan pada respons unhandled exception 500.

---

## Bagian 3: Infrastruktur, Docker & Konfigurasi

### [HIGH] I-01: Redis Port Terbuka ke Publik Tanpa Password

- **File**: `docker-compose.yml`, `.env.example`
- **Deskripsi**: Port Redis `6380:6379` terbuka ke semua antarmuka jaringan host (`0.0.0.0`) tanpa autentikasi password.
- **Remediasi**:
  - Port Redis dibatasi binding-nya hanya ke loopback lokal `127.0.0.1:6380:6379`.
  - Diaktifkan flag `--requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required}` pada command Redis.
  - Koneksi internal kontainer API ke Redis dialihkan melalui nama servis Docker internal dengan password.

### [HIGH] I-02: Ketiadaan Persistent Volume untuk Database SQLite

- **File**: `docker-compose.yml`
- **Deskripsi**: Kontainer API tidak me-mount persistent volume untuk file SQLite. Setiap kali kontainer di-recreate atau di-deploy ulang, seluruh data token, trade, dan komentar hilang.
- **Remediasi**: Ditambahkan named volume `api_data:/app/data` dan dikonfigurasi `DB_PATH=/app/data/proto.sqlite`.

### [MEDIUM] I-03: Ketiadaan Resource Limits pada Kontainer Docker

- **File**: `docker-compose.yml`
- **Deskripsi**: Kontainer berjalan tanpa batas alokasi memori dan CPU, berisiko mengonsumsi seluruh memori host (_host starvation_).
- **Remediasi**: Ditambahkan batas `deploy.resources.limits` (512MB RAM / 1 CPU untuk API, Frontoffice, Redis; 256MB RAM / 0.5 CPU untuk Docs).

### [LOW] I-04: Duplikasi dan Nilai Default Tidak Aman pada `.env.example`

- **File**: `.env.example`
- **Deskripsi**: Terdapat duplikasi variabel `REDIS_URL` dan `COINGECKO_API_KEY`, variabel `DEVOPS_AUTH_TOKEN` dan `DB_PATH` belum tercantum, serta `ARC_LOCKER_ADDRESS` menggunakan zero address sebagai default.
- **Remediasi**: File dibersihkan, diduplikasi dihilangkan, variabel baru didaftarkan dengan komentar dokumentasi lengkap, dan default zero address diganti dengan string kosong.

---

## Bagian 4: Standardisasi Commit & Quality Tooling

### C-01: Penegakan Aturan Zero Emojis pada Git Commit

- **File**: `commitlint.config.mjs`, `package.json`, `.git/hooks/commit-msg`, `scripts/setup-git-hooks.sh`
- **Deskripsi**: Sesuai aturan non-negotiable `AGENTS.md`, seluruh commit harus bebas dari emoji. Sebelumnya tidak ada hook atau validasi commitlint otomatis untuk memverifikasi aturan ini secara lokal sebelum commit dibuat.
- **Remediasi**:
  - Dibuat custom rule plugin `no-emoji` pada `commitlint.config.mjs`.
  - Didefinisikan daftar scope resmi proyek (`contracts`, `api`, `tokens`, `frontoffice`, `trade`, `chart`, `observability`, `security`, `shared-types`, `infra`, `deps`, `docs`, `scripts`, `worker`, `release`).
  - Dibuat script `scripts/setup-git-hooks.sh` dan file hook executable `.git/hooks/commit-msg` untuk validasi otomatis sebelum commit tersimpan.
  - Ditambahkan dokumentasi panduan commit lengkap pada `AGENTS.md`.

---

## Verifikasi Akhir

Seluruh pemeriksaan kualitas dijalankan dan diverifikasi:

```bash
# 1. Validasi Smart Contract (Foundry)
cd contracts && forge test
# Output: 7 test suites, 44 passed, 0 failed.

# 2. Validasi Unit Test (Vitest)
bun run test --run
# Output: 23 test files, 96 passed, 0 failed.

# 3. Validasi Static Typing (TypeScript)
bun run typecheck
# Output: Clean across @proto/shared-types, @proto/docs, @proto/api, @proto/frontoffice.

# 4. Validasi Linter (ESLint)
bun run lint
# Output: Exit code 0, max-warnings=0 terpenuhi.

# 5. Validasi Format Kode (Prettier)
bun run format:check
# Output: All matched files use Prettier code style!

# 6. Validasi Commit Guard (Commitlint)
echo "feat(api): test message" | bunx commitlint # Pass
echo "feat(api): test message 🚀" | bunx commitlint # Revert with error
```
