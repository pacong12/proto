# Daftar Tiket Remediasi Audit Keamanan Proto

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

Dokumen ini merangkum seluruh tiket perbaikan teknis yang dihasilkan dari audit mendalam terhadap sistem Proto berdasarkan analisis komparatif model Pons (ponsfamily.com) dan Argus (argus.world).

Sumber Audit: `docs/audit/AUDIT-REPORT.md`  
Konvensi Prioritas:

- P0 (Bloker / Segera): Cacat kritis atau celah keamanan tinggi yang memicu penguncian dana, eksploitasi finansial, atau kebocoran kredensial.
- P1 (Tinggi): Masalah integritas sistem, manipulasi data on-chain/off-chain, atau kerusakan fungsional fitur utama.
- P2 (Sedang): Cacat logika sekunder, validasi input, resiko DoS memori, atau inkonsistensi antarmuka.
- P3 (Rendah): Pembersihan dead code, optimasi gas, dan perapian struktur arsitektur.

---

## Ringkasan Tiket

| ID Tiket          | Prioritas | Severity | Judul Tiket                                                         | Komponen                         |
| ----------------- | --------- | -------- | ------------------------------------------------------------------- | -------------------------------- |
| TKT-01            | P0        | Kritis   | Rekalibrasi Formula Kurva Arc & Proteksi Over-Sell Suplai Pool      | Contracts (Arc / Curve)          |
| TKT-02 ❌ INVALID | P0        | Tinggi   | Perbaikan Initial Buy Kreator & Integrasi Whitelist Pons Robinhood  | Frontend (useLaunchpad)          |
| TKT-03 ✅         | P0        | Tinggi   | Integrasi Aliran Dana LiquidityLocker ke HolderFeeDistributor       | Contracts (Locker / Dividends)   |
| TKT-04 ✅         | P0        | Tinggi   | Penegakan On-Chain Revenue Split & Pemanggilan setInitialTaxConfig  | Fullstack (Contracts / API / UI) |
| TKT-05            | P0        | Tinggi   | Pengecualian Fee Recipient dari Aturan Anti-Snipe LaunchpadToken    | Contracts (Token / Curve)        |
| TKT-06 ✅         | P0        | Tinggi   | Refaktor Mekanisme Slippage Buyback Menggunakan Oracle TWAP Uniswap | Contracts (BuybackBurner)        |
| TKT-07 ✅         | P0        | Tinggi   | Eliminasi Resiko Kustodial pada Migrasi Likuiditas Uniswap V4       | Contracts (Factory / Curve)      |
| TKT-08            | P0        | Tinggi   | Penghapusan / Pengamanan Utilitas server.py & Rotasi Kredensial     | Infra / Scripts                  |
| TKT-09 ✅         | P1        | Sedang   | Penerapan Otentikasi Tanda Tangan Kriptografis pada Komentar & Sync | Backend API (server.ts)          |
| TKT-10 ✅         | P1        | Sedang   | Pembatasan Ukuran & Validasi Integritas Hash pada Unduhan IPFS      | Backend API (ipfs.service)       |
| TKT-11 ✅         | P2        | Sedang   | Resolusi Socket IP Asli Bun untuk Rate Limiting Akurat              | Backend API (server.ts)          |
| TKT-12            | P2        | Sedang   | Implementasi proposeTaxConfig pada useTaxConfig Composable          | Frontend (Tax Config)            |
| TKT-13            | P3        | Rendah   | Penutupan Jalur ETH Mentah pada receive() BondingCurve              | Contracts (BondingCurve)         |
| TKT-14 ✅         | P3        | Rendah   | Pembersihan Dead Code pada BaseLaunchpadFactory dan BondingCurve    | Contracts (Factory / Math)       |

---

## Detail Spesifikasi Tiket

### TKT-01: Rekalibrasi Formula Kurva Arc & Proteksi Over-Sell Suplai Pool [P0]

- Severity: Kritis
- Komponen: `contracts/src/BondingCurve.sol`, `contracts/src/LaunchpadV2FactoryArc.sol`, `contracts/src/libraries/CurveMath.sol`
- Masalah:
  Pada Arc Network, konstanta kurva virtual reserve menyebabkan seluruh 800 juta token kurva habis pada 16.800 USDC (jauh di bawah target 69.000 USDC). Pengecekan `curveAvailableTokens > 0` di CurveMath menyebabkan kurva terus menjual cadangan pool Uniswap V4 hingga seluruh saldo token habis, menyebabkan kurva terkunci permanen pada ~21.000 USDC dan dana tidak bisa dicairkan.
- Rencana Aksi:
  1. Kalibrasi ulang cadangan virtual USDC dan token pada `LaunchpadV2FactoryArc.sol` agar saat `totalEthRaised == 69.000 ether`, jumlah token yang terjual tepat sama dengan alokasi kurva Arc (738.600.000 token atau 800.000.000 token).
  2. Perbaiki fungsi `CurveMath.getAmountOutBuy`: jika `curveAvailableTokens == 0`, kembalikan `tokenOut = 0`.
  3. Pada `BondingCurve.buyFor`, hitung sisa USDC yang benar-benar digunakan untuk membeli sisa token kurva, dan kembalikan (refund) kelebihan USDC ke pembeli.
  4. Tambahkan pengujian integrasi Foundry di `test/LaunchpadV2Arc.t.sol` yang mensimulasikan pembelian dari 0 hingga 69.000 USDC sampai lulus graduasi tanpa revert saldo kurang.
- Kriteria Keberterimaan (Acceptance Criteria):
  - Pembelian hingga target 69.000 USDC berhasil memicu status `graduated = true`.
  - Cadangan token pool (`POOL_RESERVE_SUPPLY`) tetap utuh minimal 200 juta token saat graduasi tercapai.
  - Tidak ada dana USDC pengguna yang terkunci tanpa opsi migrasi atau refund.

---

### TKT-02: Perbaikan Initial Buy Kreator & Integrasi Whitelist Pons Robinhood [P0] — ❌ INVALID

> **Status: ❌ INVALID (2026-10-16)** — Sama dengan AUD-HIGH-01: tidak ada integrasi factory/whitelist Pons di kode. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Tinggi
- Komponen: `apps/frontoffice/src/composables/useLaunchpad.ts:153-186`, `packages/contracts-abi/src/v2/robinhood-launchpad-v2.abi.ts`
- Masalah:
  Cabang peluncuran Robinhood Pons factory (`0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`) meng-hardcode `initialBuyAmount` menjadi `0n` dan memotong `msg.value` menjadi hanya sebatas `launchFeeWei`, mengabaikan nominal pembelian awal yang dimasukkan kreator. Parameter Merkle whitelist (`b1`, `b2`) juga di-hardcode nol.
- Rencana Aksi:
  1. Perbarui pemanggilan fungsi `launchToken` di `useLaunchpad.ts`: teruskan `initialBuyWei` ke argumen kedua `initialBuyAmount`.
  2. Tambahkan `initialBuyWei` ke `value` transaksi sehingga total ETH mencakup biaya peluncuran dan pembelian perdana.
  3. Sediakan input opsional di formulir pembuatan token (`CreateTokenView.vue`) untuk memuat root hash whitelist anti-snipe ala Pons (`b1` dan `b2`).
- Kriteria Keberterimaan:
  - Kreator yang menentukan initial buy menerima token secara atomik dalam transaksi peluncuran di Robinhood Chain.
  - Saldo kreator tidak lagi bernilai 0 pasca deployment.

---

### TKT-03: Integrasi Aliran Dana LiquidityLocker ke HolderFeeDistributor [P0] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Distributor digantikan `ProtoFeeSplitter`; fee LP mengalir ke splitter per token. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Tinggi
- Komponen: `contracts/src/LiquidityLocker.sol`, `contracts/src/HolderFeeDistributor.sol`
- Masalah:
  `HolderFeeDistributor.depositRewards` hanya mengizinkan pemanggilan dari `locker`, namun `LiquidityLocker.sol` tidak memiliki kode untuk memanggil fungsi tersebut. Akibatnya fitur dividen Argus tidak dapat menerima aliran dana di mainnet dan sisa dividen terkunci permanen.
- Rencana Aksi:
  1. Tambahkan variabel immutable atau setter `holderFeeDistributor` di `LiquidityLocker.sol`.
  2. Saat fungsi `claimFees` dieksekusi, jika token memiliki konfigurasi bagi hasil pemegang koin, alirkan porsi WETH/USDC terkait langsung ke `IHolderFeeDistributor(distributor).depositRewards(token, holderShare)`.
  3. Modifikasi pembagian dividen pada `HolderFeeDistributor` agar akumulator dividen dihitung berdasarkan total pasokan yang beredar di luar pool likuiditas Uniswap.
  4. Tambahkan fungsi darurat penarikan sisa debu (_dust sweeper_) dengan timelock pada `HolderFeeDistributor`.
- Kriteria Keberterimaan:
  - Klaim biaya dari locker secara otomatis meningkatkan `rewardPerTokenCumulative` di `HolderFeeDistributor`.
  - Pemegang token dapat melakukan klaim dividen WETH/USDC tanpa revert.

---

### TKT-04: Penegakan On-Chain Revenue Split & Pemanggilan setInitialTaxConfig [P0] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Split ditegakkan on-chain oleh `ProtoFeeSplitter`: Arc saat launch; Robinhood lewat `ProtoV4Graduator.setRevenueSplit` (sekali, oleh kreator, sebelum pembeli pihak ketiga) yang dipakai saat graduasi. `setInitialTaxConfig` hanya disinkronkan bila sukses on-chain. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Tinggi
- Komponen: `contracts/src/LaunchpadToken.sol`, `apps/frontoffice/src/composables/useLaunchpad.ts`, `apps/api/src/server.ts`
- Masalah:
  Diagram revenue split 4-arah (Creator, Buyback, Holders, Growth) hanya disimpan di database SQLite API dan tidak ditegakkan di blockchain. Fungsi `setInitialTaxConfig` tidak pernah dipanggil saat peluncuran, sehingga token beroperasi dengan pajak 0% on-chain meskipun UI menampilkan pajak aktif.
- Rencana Aksi:
  1. Tambahkan pemanggilan `token.setInitialTaxConfig(buyTaxBps, sellTaxBps, taxRecipient)` langsung pada blok peluncuran di `useLaunchpad.ts`, atau integrasikan langsung ke dalam fungsi `launchTokenV2` di factory kontrak.
  2. Kembangkan smart contract `RevenueSplitter.sol` on-chain yang menerima pajak token dan membaginya sesuai persentase yang ditentukan kreator.
  3. Hapus ketergantungan API pada data mentah `body.taxConfig` di endpoint `sync` tanpa bukti verifikasi on-chain.
- Kriteria Keberterimaan:
  - Transaksi swap token memotong pajak secara nyata di blockchain sesuai konfigurasi kreator.
  - Data analitik pendapatan di frontoffice mencerminkan aliran transaksi on-chain yang dapat diverifikasi pada block explorer.

---

### TKT-05: Pengecualian Fee Recipient dari Aturan Anti-Snipe LaunchpadToken [P0]

- Severity: Tinggi
- Komponen: `contracts/src/LaunchpadToken.sol:340-350`, `contracts/src/BondingCurve.sol:232-234`
- Masalah:
  Transfer potongan anti-snipe tax dari kurva ke `feeRecipient` akan revert jika `feeRecipient` adalah contract treasury/multisig (`to.code.length > 0`) atau saldo pajaknya melampaui `MAX_HOLD_AMOUNT` (50M token) pada blok 1 dan 2.
- Rencana Aksi:
  1. Tambahkan pengecualian di `LaunchpadToken._transfer`:
     `if (to != deployer && to != factory && to != taxRecipient) { ... validasi caps ... }`
  2. Pastikan alamat penerima fee protokol dibebaskan dari pembatasan ukuran dompet dan status smart contract.
- Kriteria Keberterimaan:
  - Pembelian yang terkena anti-snipe tax berhasil dieksekusi meskipun `feeRecipient` adalah Gnosis Safe multisig.

---

### TKT-06: Refaktor Mekanisme Slippage Buyback Menggunakan Oracle TWAP Uniswap [P1] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `ProtoV4Buyback` membeli dan membakar token dari bagian burn tiap splitter dengan `sqrtPriceLimit` di TWAP hook (≥ 30 menit) ± 2%; harga yang dimanipulasi hanya membuat swap berhenti, dana disimpan. Keeper API (`KEEPER_PRIVATE_KEY`) hanya memicu, tidak memilih harga (fork test Arc USDC & Robinhood ETH). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Tinggi
- Komponen: `contracts/src/BuybackBurner.sol:194-201, 230`
- Masalah:
  `BuybackBurner` membandingkan minimum output terhadap transaksi sebelumnya (`lastKnownRate`). Apabila harga token naik lebih dari 3% di pasar, transaksi buyback revert selamanya karena pool tidak mampu memenuhi `requiredMin`.
- Rencana Aksi:
  1. Gantikan variabel `lastKnownRate` dengan pembacaan observasi harga TWAP dari Uniswap V3 Pool (`IUniswapV3Pool(pool).observe(...)`).
  2. Hitung harga batas minimum slippage berdasarkan rata-rata pergerakan harga 30 menit terakhir.
  3. Izinkan pemilik factory dengan timelock mengatur ulang tingkat referensi darurat jika pool mengalami volatilitas ekstrim.
- Kriteria Keberterimaan:
  - Mesin buyback tetap dapat mengeksekusi pembelian dan pembakaran token saat harga token mengalami kenaikan organik di pasar.

---

### TKT-07: Eliminasi Resiko Kustodial pada Migrasi Likuiditas Uniswap V4 [P1] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Graduasi trustless via `ProtoV4Graduator`. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Tinggi
- Komponen: `contracts/src/BondingCurve.sol:349-370`, `contracts/src/LaunchpadV2Factory.sol:240-248`
- Masalah:
  Fungsi `migrateCurveToV4` mentransfer seluruh ETH dan token ke parameter bebas `recipient` yang ditentukan sepihak oleh pemilik factory, menciptakan celah rug pull kustodial.
- Rencana Aksi:
  1. Hapus parameter `recipient` bebas pada fungsi migrasi.
  2. Kunci rute transfer dana langsung ke kontrak `PoolManager` Uniswap V4 atau kontrak `LiquidityLocker` V4 kanonikal.
  3. Terapkan timelock 48 jam dan pengumuman on-chain jika penarikan darurat (`emergencyWithdraw`) terpaksa dipanggil.
- Kriteria Keberterimaan:
  - Dana kurva yang lulus graduasi dijamin secara kriptografis 100% masuk ke pool likuiditas DEX tanpa intervensi perantara dompet pribadi.

---

### TKT-08: Penghapusan / Pengamanan Utilitas server.py & Rotasi Kredensial [P0]

- Severity: Tinggi
- Komponen: Root direktori `server.py`, `.env`
- Masalah:
  `server.py` menggunakan `SimpleHTTPRequestHandler` yang mengekspos seluruh isi direktori kerja (termasuk file rahasia `.env`) pada host publik `0.0.0.0:5055`.
- Rencana Aksi:
  1. Hapus file `server.py` dari repository atau batasi hanya berjalan pada `127.0.0.1` dengan pembatasan direktori ketat.
  2. Rotasi segera kunci privat deployer yang tersimpan pada `.env` (`0x2e28...`), kunci API CoinGecko, dan JWT Pinata.
  3. Pastikan gitignore mencakup `.env*` dan tambahkan aturan pre-commit gitleaks.
- Kriteria Keberterimaan:
  - Tidak ada proses server lokal yang melayani file sensitif ke jaringan eksternal.
  - Kunci privat baru diisolasi dalam secret manager.

---

### TKT-09: Penerapan Otentikasi Tanda Tangan Kriptografis pada Komentar & Sync [P1] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Endpoint `sync` membaca pajak/split dari chain; like, repost dan vote sentimen mewajibkan sesi wallet bertanda tangan (`POST /api/auth/session`). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Sedang
- Komponen: `apps/api/src/server.ts:702-770, 1002-1180`
- Masalah:
  Endpoint komentar dan manipulasi metadata token menerima `authorAddress` tanpa verifikasi tanda tangan kriptografis, memungkinkan impersonasi identitas kreator/paus.
- Rencana Aksi:
  1. Terapkan verifikasi tanda tangan EIP-712 atau `personal_sign` (Sign-In with Ethereum) pada payload POST komentar, like, dan repost.
  2. Batasi endpoint `POST /api/tokens/:address/sync` hanya untuk memverifikasi event yang tercatat pada blockchain via receipt hash, tanpa menerima penimpaan metadata arbitrary.
- Kriteria Keberterimaan:
  - Request komentar dengan alamat dompet palsu ditolak dengan HTTP 401 Unauthorized.

---

### TKT-10: Pembatasan Ukuran & Validasi Integritas Hash pada Unduhan IPFS [P1] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Unduhan gateway dibatasi stream 5 MiB dan diverifikasi terhadap CID (raw leaf & UnixFS satu blok ≤ 256 KiB; isi yang tidak cocok ditolak). File berblok banyak hanya dibatasi ukurannya. CID fallback API kini memakai codec raw yang benar. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Sedang
- Komponen: `apps/api/src/modules/ipfs/ipfs.service.ts:150-180`
- Masalah:
  `getFile(cid)` membaca seluruh muatan dari gateway luar ke dalam memori tanpa batas ukuran, membuka celah heap memory exhaustion (OOM crash), serta menyajikan file tanpa validasi hash CID.
- Rencana Aksi:
  1. Terapkan batas ukuran unduhan stream maksimal 5 MiB via AbortController atau Content-Length guard.
  2. Hitung hash multihash (SHA-256 DAG-PB) dari buffer yang diunduh dan pastikan cocok dengan CID sebelum menyimpannya ke disk lokal.
  3. Setel header `Content-Security-Policy: sandbox` dan `X-Content-Type-Options: nosniff` saat menyajikan file.
- Kriteria Keberterimaan:
  - Unduhan file di atas 5 MiB dibatalkan secara otomatis sebelum memenuhi memori server.

---

### TKT-11: Resolusi Socket IP Asli Bun untuk Rate Limiting Akurat [P2] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — IP socket Bun (`server.requestIP`) dipakai secara default. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Sedang
- Komponen: `apps/api/src/server.ts:2050-2070`
- Masalah:
  Fungsi `extractClientIp` mengembalikan `127.0.0.1` saat `TRUST_PROXY` false, menyebabkan seluruh pengguna berbagi satu kuota rate limit. Saat aktif, header proxy dapat di-spoof penyerang.
- Rencana Aksi:
  1. Manfaatkan method `server.requestIP(req)` bawaan runtime Bun untuk memperoleh alamat IP socket TCP asli.
  2. Hanya percayai header `cf-connecting-ip` apabila koneksi terverifikasi berasal dari blok IP resmi Cloudflare.
- Kriteria Keberterimaan:
  - Rate limiting dihitung secara independen per alamat IP asli klien.

---

### TKT-12: Implementasi proposeTaxConfig pada useTaxConfig Composable [P2]

- Severity: Sedang
- Komponen: `apps/frontoffice/src/composables/useTaxConfig.ts`
- Masalah:
  Fungsi `proposeTaxConfig` pada kontrak `LaunchpadToken` tidak memiliki binding composable di frontend, sehingga kreator tidak dapat mengusulkan pembaruan pajak pasca peluncuran.
- Rencana Aksi:
  1. Tambahkan method `proposeTaxConfig(tokenAddress, buyTaxBps, sellTaxBps, recipient)` ke `useTaxConfig.ts`.
  2. Hubungkan fungsi tersebut ke modal pengaturan pajak kreator di antarmuka perdagangan.
- Kriteria Keberterimaan:
  - Kreator dapat mengirimkan usulan perubahan pajak on-chain dan memicu masa timelock 24 jam langsung dari UI.

---

### TKT-13: Penutupan Jalur ETH Mentah pada receive() BondingCurve [P3]

- Severity: Rendah
- Komponen: `contracts/src/BondingCurve.sol:406-408`
- Masalah:
  Fungsi `receive() external payable` menerima ETH mentah tanpa mencatat pembelian token dan mendistorsi rasio harga saat likuiditas bermigrasi ke Uniswap V4.
- Rencana Aksi:
  1. Hapus fungsi `receive()` atau ganti dengan logika yang merevert seluruh kiriman ETH mentah tanpa pemanggilan fungsi `buy()`.
- Kriteria Keberterimaan:
  - Transfer ETH mentah ke kontrak BondingCurve ditolak.

---

### TKT-14: Pembersihan Dead Code pada BaseLaunchpadFactory dan BondingCurve [P3] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `BaseLaunchpadFactory` dihapus; inisialisasi pool di `BondingCurve` dihapus (dilakukan graduator). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Severity: Rendah
- Komponen: `contracts/src/factories/base/BaseLaunchpadFactory.sol`, `contracts/src/BondingCurve.sol:341-343`
- Masalah:
  Fungsi internal `_sqrt` pada BondingCurve dan `_executeLaunchTokenV2` pada BaseLaunchpadFactory adalah dead code yang memicu peringatan kompiler Slither.
- Rencana Aksi:
  1. Hapus fungsi `BondingCurve._sqrt`.
  2. Rapikan arsitektur warisan factory agar `LaunchpadV2Factory` dan `LaunchpadV2FactoryArc` mewarisi antarmuka `ILaunchpadV2Factory` secara konsisten.
- Kriteria Keberterimaan:
  - Peringatan dead code Slither bersih.
