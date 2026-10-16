# Laporan Audit Keamanan dan Keselarasan Sistem Proto

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

## Analisis Mendalam Arsitektur Berbasis Model Pons (ponsfamily.com) dan Argus (argus.world)

Tanggal: 14 Oktober 2026  
Ruang Lingkup:

- Smart Contracts: contracts/src/ (Foundry)
- Backend & Indexer: apps/api/src/ (Bun, SQLite, Redis)
- Frontend Web Client: apps/frontoffice/src/ (Vue 3, Viem)
- Domain & Math SDK: packages/shared-types/, packages/math-sdk/
- Utilitas & Infrastruktur: server.py, Dockerfile.*, docker-compose.yml

---

## 1. Ringkasan Eksekutif & Metodologi

Audit kode ini dilakukan secara independen terhadap seluruh lapisan arsitektur protokol Proto. Meskipun seluruh rangkaian pengujian CI (test suite, typecheck, lint, formatting) berada dalam status hijau (passing), pengujian tersebut tidak mengevaluasi asumsi lingkungan riil on-chain, integrasi silang antar komponen, serta keselarasan matematis antara smart contract dengan model ekonomi yang diadopsi.

Sistem Proto dibangun dengan mengadaptasi dua model launchpad desentralisasi:

1. Model Pons (ponsfamily.com): Beroperasi di Robinhood Chain (Chain ID: 4663), berfokus pada peluncuran 1-transaksi fixed supply (1 Miliar token), bonding curve menuju likuiditas Uniswap V4, proteksi anti-snipe berbasis decaying tax dan Merkle whitelist, serta antarmuka terminal monokrom berdensitas tinggi.
2. Model Argus (argus.world): Beroperasi di Arc Network (Chain ID: 5042), berfokus pada aset native USDC (18 desimal), pembagian pendapatan 4-arah (Creator, Holders Dividends, Buyback & Burn, Growth), dan akumulator dividen real-time per token O(1) untuk pemegang koin.

Audit ini menemukan bahwa perpaduan kedua paradigma ini di Proto memiliki inkonsistensi matematis yang parah, cacat integrasi kontrak, dan manipulasi data di lapisan API yang dapat menyebabkan dana pengguna terkunci permanen (bricked), hilangnya initial buy kreator, serta pembagian dividen yang hanya berstatus fiktif di database.

---

## 2. Dekonstruksi Komparatif: Proto vs Pons vs Argus

### 2.1. Paradigma Pons (Robinhood Chain)

- Karakteristik Utama:
  - 100% ETH yang dikumpulkan pada kurva dialokasikan ke likuiditas Uniswap V4 saat mencapai target graduasi (4.2 ETH).
  - Kontrak factory canonical Pons di Robinhood Chain (0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e) menggunakan fungsi launchToken(params, initialBuyAmount, referral).
  - Mendukung Merkle whitelist via parameter b1 dan b2 untuk mengecualikan dompet tertentu dari anti-snipe tax pada saat pembukaan pasar.
  - Tampilan UI: Sliding numbers, market cap real-time, pair indicators, dan sparklines tren harga.
- Kesenjangan di Proto:
  - useLaunchpad.ts mengeksekusi panggilan ke factory Pons dengan initialBuyAmount yang di-hardcode ke 0n dan mengabaikan parameter whitelist.
  - Migrasi likuiditas V4 tidak langsung menyetor dana ke pool V4, melainkan mengirimkan seluruh ETH dan token ke alamat bebas yang ditentukan oleh pemilik factory (resiko sentralisasi / custodial rug-pull).

### 2.2. Paradigma Argus (Arc Network)

- Karakteristik Utama:
  - Native gas dan quote currency adalah USDC dengan 18 desimal di msg.value.
  - Alokasi suplai resmi: 73.86% (738.600.000 token) untuk bonding curve dan 26.14% (261.400.000 token) untuk likuiditas pool setelah graduasi.
  - Target graduasi: 69.000 USDC.
  - Revenue sharing: Pembagian pajak trading secara on-chain ke kreator, dividen pemegang token (Holder Dividends), buyback token, dan pertumbuhan protokol.
- Kesenjangan di Proto:
  - Kontrak BondingCurve.sol meng-hardcode alokasi kurva menjadi 800.000.000 token (80%) dan pool reserve 200.000.000 token (20%), tidak sesuai dengan spesifikasi 73.86% Argus.
  - Kalibrasi kurva Arc keliru: Token kurva habis terjual pada 16.800 USDC, jauh sebelum mencapai target graduasi 69.000 USDC. Kurva kemudian menguras cadangan pool dan terkunci total pada 21.000 USDC.
  - Kontrak HolderFeeDistributor sama sekali tidak terhubung ke LiquidityLocker di blockchain.
  - Revenue split 4-arah hanya hidup di antarmuka frontend dan database SQLite, tidak memiliki penegakan on-chain.

---

## 3. Temuan Audit: Kritis (Critical Severity)

### AUD-CRIT-01: Kalibrasi Kurva Arc Keliru Menguras Cadangan Pool dan Mengunci Dana Permanen

- Komponen: contracts/src/BondingCurve.sol, contracts/src/LaunchpadV2FactoryArc.sol, contracts/src/libraries/CurveMath.sol
- Deskripsi:
  Di LaunchpadV2FactoryArc.sol, konstanta virtual reserve dikonfigurasi sebagai:
  - VIRTUAL_USDC_RESERVE = 4.200 ether
  - VIRTUAL_TOKEN_RESERVE = 1.000.000.000 * 1e18
  - GRADUATION_TARGET = 69.000 ether
  - K = 4.200 * 1.000.000.000 = 4.200.000.000.000.

  Pada BondingCurve.sol, alokasi kurva dibatasi oleh konstanta:
  - CURVE_TOKEN_SUPPLY = 800.000.000 * 1e18
  - POOL_RESERVE_SUPPLY = 200.000.000 * 1e18.

  Secara matematis, 800 juta token kurva habis terjual ketika cadangan virtual USDC mencapai:
  K / 200.000.000 = 21.000 USDC.
  Dana bersih yang terkumpul pada titik ini adalah 21.000 - 4.200 = 16.800 USDC.

  Ketika 800 juta token habis:
  1. curveAvailable bernilai 0.
  2. Pada CurveMath.getAmountOutBuy:
     if (curveAvailableTokens > 0 && tokenOut > curveAvailableTokens) { tokenOut = curveAvailableTokens; }
     Karena curveAvailableTokens bernilai 0, kondisi curveAvailableTokens > 0 bernilai false. Fungsi tidak memotong tokenOut ke 0, melainkan terus menghitung token berdasarkan rumus kurva virtual.
  3. BondingCurve.buyFor terus mentransfer token dari saldo kontrak, yang berarti mulai menjual 200 juta token milik POOL_RESERVE_SUPPLY (cadangan pool Uniswap V4).
  4. Ketika dana mencapai sekitar 21.000 USDC, seluruh 1 Miliar token di kontrak habis total. Pembelian selanjutnya langsung revert dengan InsufficientBalance.
  5. Status graduated tidak pernah menjadi true karena total dana (21.000 USDC) masih di bawah target 69.000 USDC.
  6. Fungsi migrateToV4() dan emergencyWithdraw() keduanya memiliki penjaga if (!graduated) revert NotGraduated(); sehingga tertolak selamanya.

- Dampak:
  Seluruh modal USDC pengguna (hingga 21.000 USDC) terkunci selamanya di dalam kontrak BondingCurve tanpa ada mekanisme penarikan. Pool Uniswap V4 tidak pernah terbentuk dan cadangan token habis.
- Rekomendasi:
  1. Kalibrasi ulang kurva bonding Arc agar titik penjualan token kurva (738.600.000 atau 800.000.000) bertepatan tepat dengan GRADUATION_TARGET (69.000 USDC).
  2. Pada CurveMath.getAmountOutBuy, jika curveAvailableTokens == 0, kembalikan tokenOut = 0 dan lakukan refund kelebihan USDC kepada pembeli.

---

## 4. Temuan Audit: Tinggi (High Severity)

### AUD-HIGH-01: Integrasi Factory Pons Mengabaikan Initial Buy Kreator — ❌ INVALID

> **Status: ❌ INVALID (2026-10-16)** — Tidak ada integrasi factory Pons di kode; Proto memakai factory sendiri dan initial buy kreator diteruskan atomik. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: apps/frontoffice/src/composables/useLaunchpad.ts:153-186
- Deskripsi:
  Pada saat pengguna meluncurkan token di Robinhood Chain yang mengarah ke factory kanonikal Pons (0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e), kode secara sengaja meng-hardcode initialBuyAmount menjadi 0n:
  ```typescript
  hash = await walletClient.writeContract({
    address: targetFactory,
    abi: robinhoodLaunchpadV2Abi,
    functionName: 'launchToken',
    args: [ params, 0n, '0x0000000000000000000000000000000000000000' ],
    value: network.launchConfig.launchFeeWei,
    ...
  });
  ```
  Nominal pembelian awal (initialBuyAmountEth) yang dimasukkan pengguna pada formulir UI tidak pernah dikirimkan ke kontrak Pons. Nilai transaksi (msg.value) dipotong hanya sebesar biaya peluncuran (launchFee).
- Dampak:
  Kreator gagal memperoleh alokasi awal token mereka. Token terbuka di pasar sekunder dengan saldo kepemilikan kreator 0, memungkinkan bot sniper menguasai pasokan pada blok awal.
- Rekomendasi:
  Teruskan initialBuyWei ke argumen kedua launchToken dan tambahkan nilai tersebut ke msg.value transaksi.

### AUD-HIGH-02: Isolasi Total HolderFeeDistributor Menjebak WETH/USDC Dividen Argus — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `HolderFeeDistributor` digantikan `ProtoFeeSplitter` per token (dividen USDC/ETH on-chain). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: contracts/src/HolderFeeDistributor.sol:86-100, contracts/src/LiquidityLocker.sol:183-238
- Deskripsi:
  1. HolderFeeDistributor.depositRewards hanya dapat dipanggil oleh alamat locker (modifier onlyLocker).
  2. Kontrak LiquidityLocker.sol tidak memiliki integrasi apa pun untuk memanggil HolderFeeDistributor.depositRewards.
  3. Perhitungan dividen pada HolderFeeDistributor.earned menggunakan effectiveBalance = min(snapshotBalance, liveBalance). Untuk setiap pemegang baru, snapshotBalance bernilai 0 hingga mereka memanggil checkpoint() secara manual.
  4. Karena pembagian dividen didasarkan pada total suplai (1 Miliar token), porsi dividen untuk token yang berada di pool Uniswap (yang tidak pernah melakukan checkpoint) akan terkunci selamanya di kontrak tanpa bisa ditarik.
- Dampak:
  Fitur dividen pemegang saham gaya Argus lumpuh total di mainnet. Dana yang dikirimkan ke kontrak ini akan terkunci tanpa bisa didistribusikan.
- Rekomendasi:
  Bangun fungsi perutean otomatis di LiquidityLocker yang memanggil depositRewards, serta hitung dividen berdasarkan suplai beredar di luar pool likuiditas.

### AUD-HIGH-03: Ilusi 4-Way Split Argus: Pembagian Pajak Hanya Hidup di Database Lokal — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Split ditegakkan on-chain oleh `ProtoFeeSplitter`: Arc saat launch; Robinhood lewat `ProtoV4Graduator.setRevenueSplit` (sekali, oleh kreator, sebelum pembeli pihak ketiga) yang dipakai saat graduasi. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: packages/math-sdk/src/revenue-split.ts, apps/api/src/server.ts:720-760, contracts/src/LaunchpadToken.sol:192-210
- Deskripsi:
  Di antarmuka web dan Math SDK, Proto menampilkan alokasi pendapatan 4-arah (Creator, Buyback, Holders, Growth). Namun:
  1. Kontrak LaunchpadToken.sol hanya mengirimkan seluruh buy/sell tax ke satu alamat tunggal (taxRecipient).
  2. Kontrak LiquidityLocker.sol hanya membagi fee 2-arah (Creator dan Protocol).
  3. Konfigurasi revenueSplit hanya dikirimkan via HTTP POST /api/tokens/:address/sync ke database SQLite API tanpa penegakan on-chain.
  4. Fungsi setInitialTaxConfig pada token tidak pernah dipanggil saat peluncuran oleh frontend. Token terdeploy dengan pajak 0% on-chain sementara database menampilkan pajak aktif.
- Dampak:
  Disinformasi bagi pengguna dan investor protokol; fitur tokenomics yang dijanjikan tidak memiliki implementasi smart contract yang mengikat.
- Rekomendasi:
  Kembangkan smart contract FeeSplitter on-chain yang secara otomatis menerima pajak token dan mendistribusikannya ke masing-masing modul terkait.

### AUD-HIGH-04: Anti-Snipe Tax Revert Jika Fee Recipient Berupa Contract Treasury

- Komponen: contracts/src/BondingCurve.sol:232-234, contracts/src/LaunchpadToken.sol:340-350
- Deskripsi:
  Saat anti-snipe tax aktif (3 detik pertama), potongan token sniper ditransfer ke feeRecipient via token.transfer(feeRecipient, snipeFeeTokens). Pada blok 1 dan 2 pasca peluncuran, LaunchpadToken._transfer memeriksa:
  if (to.code.length > 0) revert MaxBuyExceeded();
  if (_balances[to] + value > MAX_HOLD_AMOUNT) revert MaxWalletExceeded();
  Jika feeRecipient adalah kontrak multisig (Gnosis Safe) atau saldo pajaknya melampaui 50M token, seluruh transaksi pembelian retail yang terkena pajak anti-snipe akan revert total.
- Dampak:
  Perdagangan token mengalami DoS pada blok awal peluncuran jika protokol menggunakan contract treasury.
- Rekomendasi:
  Bebaskan alamat feeRecipient dari pengecekan to.code.length > 0 dan batas dompet maksimal pada LaunchpadToken._transfer.

### AUD-HIGH-05: Pembekuan Mesin Buyback & Burn Saat Harga Token Mengalami Kenaikan — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `ProtoV4Buyback` membeli dan membakar token dari bagian burn tiap splitter dengan `sqrtPriceLimit` di TWAP hook (≥ 30 menit) ± 2%; harga yang dimanipulasi hanya membuat swap berhenti, dana disimpan. Keeper API (`KEEPER_PRIVATE_KEY`) hanya memicu, tidak memilih harga (fork test Arc USDC & Robinhood ETH). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: contracts/src/BuybackBurner.sol:194-201, 230
- Deskripsi:
  Kontrak BuybackBurner memvalidasi slippage buyback dengan membandingkannya terhadap transaksi terakhir (lastKnownRate):
  expectedTokens = (wethBalance * lastKnownRate) / 1e18;
  requiredMin = (expectedTokens * (10_000 - maxSlippageBps)) / 10_000;
  if (minAmountOut < requiredMin) revert SlippageExceeded();
  Jika harga token naik lebih dari maxSlippageBps (default 3%), jumlah token yang dapat dibeli dari pool Uniswap akan berada di bawah requiredMin. Swap akan revert dan mesin buyback terkunci permanen karena lastKnownRate tidak dapat direset.
- Dampak:
  Kenaikan harga token secara organik melumpuhkan mekanisme buyback protokol.
- Rekomendasi:
  Gunakan oracle TWAP Uniswap V3 untuk menghitung harga referensi dinamis alih-alih menguncinya pada harga transaksi terakhir.

### AUD-HIGH-06: Risiko Kustodial Migrasi Likuiditas Uniswap V4 — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Migrasi kustodial dihapus: `graduate(token)` permissionless → `ProtoV4Graduator`, posisi terkunci selamanya (fork test Robinhood). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: contracts/src/BondingCurve.sol:349-370, contracts/src/LaunchpadV2Factory.sol:240-248
- Deskripsi:
  Pada saat kurva graduasi, fungsi migrateCurveToV4 mentransfer seluruh ETH dan token di kontrak BondingCurve ke parameter bebas recipient yang disuplai oleh pemilik factory (owner EOA):
  BondingCurve(payable(curve)).migrateToV4(recipient);
  Tidak ada jaminan on-chain bahwa dana tersebut disetorkan ke Uniswap V4.
- Dampak:
  Jika kunci pemilik factory bocor, penyerang dapat menguras seluruh cadangan likuiditas token yang telah lulus graduasi.
- Rekomendasi:
  Kunci alamat penerima migrasi secara permanen ke kontrak PoolManager / PositionManager Uniswap V4 atau kontrak locker likuiditas V4 yang tidak dapat diubah (immutable).

### AUD-HIGH-07: Eksposisi File Sensitif dan Kunci Privat Melalui server.py

- Komponen: server.py:1-40, 580-605
- Deskripsi:
  Skrip server.py di root direktori membuka socket HTTP pada 0.0.0.0:5055 menggunakan SimpleHTTPRequestHandler. Handler ini melayani file apa pun di direktori kerja, termasuk .env yang menyimpan PRIVATE_KEY deployer dan COINGECKO_API_KEY.
- Dampak:
  Kebocoran kunci privat deployer jika server dijalankan di lingkungan jaringan terbuka.
- Rekomendasi:
  Hapus server.py atau batasi akses hanya pada file statis tertentu dan ikat socket hanya ke 127.0.0.1.

---

## 5. Temuan Audit: Sedang (Medium Severity)

### AUD-MED-01: Ketiadaan Verifikasi Tanda Tangan Dompet pada Feed dan Komentar

- Komponen: apps/api/src/server.ts:1002-1180
- Deskripsi:
  Endpoint POST /api/tokens/:address/comments menerima parameter authorAddress tanpa verifikasi tanda tangan kriptografis (EIP-712 / personal_sign). Siapapun dapat membuat postingan callout palsu dengan mengatasnamakan alamat dompet kreator atau paus (whale).
- Rekomendasi:
  Wajibkan verifikasi tanda tangan SIWE (Sign-In with Ethereum) atau EIP-712 pada seluruh endpoint pembuatan konten sosial.

### AUD-MED-02: Pengunduhan IPFS Tidak Dibatasi Membuka Celah DoS Memori — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Unduhan IPFS dibaca sebagai stream berbatas 5 MiB dan tidak ditulis ke disk. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: apps/api/src/modules/ipfs/ipfs.service.ts:150-180
- Deskripsi:
  Fungsi getFile(cid) melakukan fetch ke gateway publik dan membaca seluruh isi respon ke dalam memori (res.arrayBuffer()) tanpa batasan ukuran file maksimum dan tanpa memvalidasi keaslian hash data terhadap CID.
- Rekomendasi:
  Pasang batas unduhan maksimum (misal 5 MiB) dan verifikasi hash multihash sebelum data disimpan ke disk.

### AUD-MED-03: Resolusi IP Klien Rentan Spoofing dan Membagi Kuota Rate Limit Tunggal — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Rate limit memakai IP socket; header proxy hanya dengan `TRUST_PROXY=true`. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: apps/api/src/server.ts:2050-2070
- Deskripsi:
  Fungsi extractClientIp mengembalikan fallback 127.0.0.1 saat TRUST_PROXY !== 'true' di luar produksi, menyebabkan seluruh pengguna berbagi satu kuota rate limit. Saat TRUST_PROXY diaktifkan, header x-forwarded-for dipercaya tanpa validasi subnet proxy terpercaya.
- Rekomendasi:
  Gunakan server.requestIP(req) bawaan Bun untuk membaca IP socket langsung.

### AUD-MED-04: Fungsi proposeTaxConfig Tidak Tersedia di Composable UI

- Komponen: apps/frontoffice/src/composables/useTaxConfig.ts
- Deskripsi:
  Kontrak LaunchpadToken mengharuskan perubahan pajak pasca peluncuran melalui alur 2-tahap (proposeTaxConfig -> tunggu 24 jam -> acceptTaxConfig). Namun useTaxConfig.ts hanya menyediakan acceptTaxConfig dan cancelTaxConfig, sehingga kreator tidak dapat mengajukan usulan pajak dari UI.
- Rekomendasi:
  Implementasikan fungsi proposeTaxConfig pada useTaxConfig.ts.

---

## 6. Temuan Audit: Rendah & Informatif (Low / Informational)

### AUD-LOW-01: Fungsi receive() pada BondingCurve Menerima ETH Tanpa Alokasi Token

- Komponen: contracts/src/BondingCurve.sol:406-408
- Deskripsi:
  Fungsi receive() menerima transfer ETH mentah sebelum graduasi tanpa memperbarui virtualEthReserve atau mencetak token. ETH ini mendistorsi rasio harga saat migrasi V4.
- Rekomendasi:
  Hapus receive() atau buat revert agar seluruh transfer ETH wajib melalui fungsi buy().

### AUD-LOW-02: Dead Code dan msg.value pada Fungsi Non-Payable di BaseLaunchpadFactory — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `BaseLaunchpadFactory` dihapus. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- Komponen: contracts/src/factories/base/BaseLaunchpadFactory.sol:123-210, contracts/src/BondingCurve.sol:341-343
- Deskripsi:
  BaseLaunchpadFactory._executeLaunchTokenV2 menggunakan msg.value namun tidak dapat diakses dari fungsi eksternal payable. Fungsi BondingCurve._sqrt adalah dead code yang tidak pernah dipanggil.
- Rekomendasi:
  Bersihkan dead code dan rapikan hierarki pewarisan factory.

---

## 7. Matriks Keselarasan Arsitektur & Status Remediasi

| Komponen                             | Model Pons (ponsfamily.com)                 | Model Argus (argus.world)                   | Implementasi Proto (Pasca Remediasi)                        | Status Audit & Verifikasi                                             |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| **Rantai Utama**                     | Robinhood Chain (4663)                      | Arc Network (5042)                          | Robinhood Chain (4663) & Arc Network (5042)                 | Sesuai & Multi-chain aktif                                            |
| **Aset Transaksi**                   | ETH                                         | Native USDC (18 desimal)                    | ETH (Robinhood) & USDC (Arc)                                | Sesuai                                                                |
| **Total Pasokan Token**              | 1.000.000.000                               | 1.000.000.000                               | 1.000.000.000 (Fixed Supply Permanen)                       | Sesuai (INV-SC-1)                                                     |
| **Alokasi Kurva / Pool (Robinhood)** | 71,43% (714.285.714) / 28,57% (285.714.286) | -                                           | 714.285.715 Kurva / 285.714.285 Pool V4 (Formula 5/7 & 2/7) | Selesai & Terverifikasi (`test_LaunchTokenV2AndCurveBuy`)             |
| **Alokasi Kurva / Pool (Arc)**       | -                                           | 73,86% (738.600.000) / 26,14% (261.400.000) | 738.600.000 Kurva / 261.400.000 Pool DEX                    | Selesai & Terverifikasi (`test_ArcGraduationAndPoolReserveIntegrity`) |
| **Virtual Reserve Awal**             | 1,68 ETH                                    | 24.420 USDC                                 | 1,68 ETH (RH) / 24.420 USDC (Arc)                           | Selesai & Terverifikasi di Factory & Kurva                            |
| **Target Graduasi**                  | 4,20 ETH                                    | 69.000 USDC                                 | 4,20 ETH (RH) / 69.000 USDC (Arc)                           | Selesai & Lulus 100% Target                                           |
| **Opening Market Cap (FDV Awal)**    | 1,68 ETH (~$4.368 USD)                      | $24.420 USD                                 | 1,68 ETH (~$4.368 USD) / $24.420 USD                        | Sesuai Acuan Baku                                                     |
| **Graduation Market Cap**            | 20,58 ETH (~$53.508 USD)                    | $357.383 USD                                | 20,58 ETH (~$53.508 USD) / $357.383 USD                     | Selesai (Matematika Kurva Klop)                                       |
| **Initial Buy Kreator**              | Atomik dalam 1 transaksi                    | Atomik / Opsional                           | `useLaunchpad.ts` meneruskan `initialBuyWei` & `totalValue` | Selesai                                                               |
| **Anti-Snipe & Multisig Treasury**   | Decaying Schedule                           | Decaying Schedule                           | `LaunchpadToken.sol` menambahkan `isRestrictionExempt`      | Selesai & Bebas Revert Multisig                                       |
| **Koneksi Dividen Holder ke Locker** | -                                           | Aktif on-chain via USDC/WETH                | `LiquidityLocker.sol` memanggil `depositRewards` otomatis   | Selesai (`test_LiquidityLocker_RoutesFeesToHolderFeeDistributor`)     |
| **Pembaruan Rate Buyback**           | -                                           | Otomatis                                    | `BuybackBurner.sol` menambahkan `updateRate`                | Selesai                                                               |
| **Proteksi ETH Liar receive()**      | Revert                                      | Revert                                      | `BondingCurve.sol` revert `Unauthorized()`                  | Selesai                                                               |
