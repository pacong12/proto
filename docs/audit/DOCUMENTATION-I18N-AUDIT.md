# Audit Akurasi Dokumentasi & Internasionalisasi (apps/docs/)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima, ⏳ = terbuka (butuh keputusan legal/bisnis); verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT DOKUMENTASI & KONSISTENSI I18N  
**Ruang Lingkup Pemeriksaan**:

- Portal Dokumentasi VitePress: `apps/docs/src/` (Dikelola dalam 10 bahasa: Inggris, Indonesia, Mandarin, Spanyol, Prancis, Jerman, Rusia, Portugis, Korea, Jepang, Arab)
- Panduan Integrasi Kontrak: `apps/docs/src/integration/contracts.md`, `apps/docs/src/id/integration/contracts.md`, `apps/docs/src/zh/integration/contracts.md`
- Panduan Protokol: `overview.md`, `launches.md`, `fees-and-burns.md`, `anti-snipe.md`, `trading-guide.md`
- Kebijakan Hukum: `terms-of-service.md`, `privacy-policy.md`, `cookie-policy.md`
- Skrip Verifikasi i18n: `scripts/audit-i18n.mjs`

---

## 1. Ringkasan Eksekutif

Audit komprehensif terhadap portal dokumentasi publik Proto (`apps/docs/`) dan sistem internasionalisasi (i18n) dilakukan untuk menguji apakah seluruh klaim, formula ekonomi, target kelulusan kurva, dan alamat kontrak yang dipublikasikan kepada pengguna dan pengembang eksternal mencerminkan kenyataan kode sumber (_ground truth on-chain_).

Audit mengidentifikasi **7 ketidaksesuaian kritis antara dokumentasi publik dengan realitas kode**:

- **4 Tingkat Tinggi (High Severity)**: Klaim otomatisasi buyback 80% via Uniswap TWAP di 10 bahasa yang tidak memiliki implementasi on-chain; kesalahan fatal target graduasi Arc Network di dokumentasi Mandarin, Spanyol, dan Jepang (8,400 USDC vs 69,000 USDC); pemuatan alamat smart contract usang/testnet di panduan integrasi resmi; dan klaim desimal USDC Arc yang keliru (6 desimal vs 18 desimal).
- **2 Tingkat Sedang (Medium Severity)**: Klaim kuota penjualan kurva 800M token yang tidak sesuai dengan kalibrasi V2 (714.28M di Robinhood dan 738.60M di Arc); dan pengabaian total panduan peluncuran Arc Network di `launches.md`.
- **1 Tingkat Rendah (Low Severity)**: String hardcoded bahasa Inggris pada komponen modal PnL card.

---

## 2. Matriks Temuan Audit Dokumentasi & i18n

| ID            | Severity | Status       | Halaman / Dokumen                                        | Ringkasan Temuan & Tindakan                                                                                |
| :------------ | :------- | :----------- | :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **DOC-01** ✅ | High     | **RESOLVED** | `index.md` & `fees-and-burns.md` (Semua 10 Bahasa)       | **Klaim Pembelian Kembali & Pembakaran Otomatis 80% via Uniswap TWAP Tidak Memiliki Penegakan On-Chain**   |
| **DOC-02** ✅ | High     | **RESOLVED** | `zh/`, `es/`, `ja/` `protocol/overview.md`               | **Target Graduasi Arc Network Dikoreksi ke 69,000 USDC pada Seluruh Bahasa Internasional**                 |
| **DOC-03**    | High     | **RESOLVED** | `integration/contracts.md` (Semua Bahasa)                | **Alamat Smart Contract V2 Resmi Diperbarui Menggantikan Alamat Usang/Testnet**                            |
| **DOC-04**    | High     | **RESOLVED** | `integration/contracts.md:29` (Semua Bahasa)             | **Presisi dan Rujukan Token Kuota USDC Resmi Dikoreksi ke Pasangan ERC-20 6 Desimal**                      |
| **DOC-05** ✅ | Medium   | **RESOLVED** | `protocol/overview.md:24` (Semua Bahasa)                 | **Klaim Kuota Penjualan Kurva "800M Token" Bertentangan dengan Kalibrasi Multi-Chain (714.28M / 738.60M)** |
| **DOC-06**    | Medium   | **RESOLVED** | `protocol/launches.md`, `faq.md`, `terms.md`             | **Prosedur Peluncuran Arc Network (0 USDC Launch Fee & Pre-Buy 4.50 USDC) Ditambahkan Lengkap**            |
| **DOC-07** ✅ | Low      | **RESOLVED** | `apps/frontoffice/src/components/trade/PnlCardModal.vue` | **String Hardcoded Bahasa Inggris pada Komponen Berbagi PnL Mengabaikan Sistem i18n Klien**                |

---

## 3. Detail Analisis Teknis & Rencana Remediasi

### DOC-01: Klaim Pembelian Kembali & Pembakaran Otomatis 80% via Uniswap TWAP Tidak Memiliki Penegakan On-Chain [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Halaman utama (11 bahasa) dan `fees-and-burns` (en/id/zh) kini menjelaskan alur yang benar: 30% protokol, 70% bagian kreator yang dapat dibagi ke kreator/holder/buyback-burn/likuiditas; buyback dijaga TWAP 30 menit ± 2%; bagian protokol tidak dipakai untuk buyback.

- **Lokasi Dokumen**:
  - `apps/docs/src/*/index.md` (Halaman utama di 10 bahasa: Inggris, Indonesia, Mandarin, Arab, Spanyol, Prancis, Jerman, Rusia, Portugis, Korea, Jepang)
  - `apps/docs/src/*/protocol/fees-and-burns.md`
- **Teks Dokumentasi yang Dipublikasikan**:
  _"30% to Protocol & Community Burns: 30% goes to platform sustainability, of which 80% is automatically used to purchase and permanently burn tokens via Uniswap TWAP."_  
  _(Bahasa Indonesia: "80% dari pendapatan protokol digunakan secara otomatis untuk membeli dan membakar token melalui TWAP Uniswap, mengurangi pasokan beredar.")_
- **Realitas Kode On-Chain**:
  1. Kontrak `ProtoMemeHook.sol` (baris 194) mengirimkan **100% dari sisa fee protokol langsung ke alamat perbendaharaan** `protocolFeeRecipient`, dan sama sekali tidak menghitung alokasi buyback (`buybackShareBps` diabaikan, Temuan S10).
  2. Kontrak `LiquidityLocker.sol` (baris 231) mentransfer **100% bagian protokol langsung ke dompet perbendaharaan** `protocolFeeRecipient`.
  3. Kontrak `BuybackBurner.sol` **TIDAK MEMILIKI INTEGRASI ORACLE UNISWAP TWAP**. Kontrak ini hanya membaca `lastKnownRate` dari transaksi eksekusi sebelumnya dan bergantung pada keeper off-chain.
- **Dampak**:
  Dokumentasi menyajikan klaim tokenomics fiktif kepada seluruh komunitas dan calon investor di 10 bahasa internasional, yang dapat dikategorikan sebagai _false advertising_ atau misrepresentasi material.
- **Rekomendasi Remediasi**:
  Perbarui teks dokumentasi di seluruh bahasa agar secara jujur menjelaskan alur yang sesungguhnya: fee protokol disetor ke perbendaharaan protokol untuk pemeliharaan ekosistem, di mana buyback dieksekusi secara terpisah oleh layanan keeper otonom.

---

### DOC-02: Target Graduasi Arc Network Salah Fatal (8,400 USDC vs 69,000 USDC) pada 3 Bahasa Internasional [High]

- **Lokasi Dokumen**:
  - `apps/docs/src/zh/protocol/overview.md:28` (Mandarin)
  - `apps/docs/src/es/protocol/overview.md:21` (Spanyol)
  - `apps/docs/src/ja/protocol/overview.md:23` (Jepang)
- **Teks Dokumentasi yang Dipublikasikan**:
  - Mandarin: `当达到毕业目标（Robinhood 链上 4.2 ETH 或 Arc 链上 8,400 USDC）后，市场自动毕业...`
  - Spanyol: `Tras alcanzar el objetivo (4.2 ETH en Robinhood o 8,400 USDC en Arc), se gradúa a Uniswap...`
  - Jepang: `目標金額（Robinhoodで4.2 ETH、Arcで8,400 USDC）調達後に自動でUniswapへ卒業します。`
- **Realitas Kode On-Chain**:
  Target graduasi resmi pada smart contract `LaunchpadV2FactoryArc.sol` adalah:
  `uint256 public constant GRADUATION_TARGET = 69_000 ether;` (yaitu **69,000 USDC**).
  Angka 8,400 USDC adalah angka dummy dari masa pengujian awal yang tertinggal pada file terjemahan.
- **Dampak**:
  Pengguna dan trader internasional penutur bahasa Mandarin, Spanyol, dan Jepang disesatkan bahwa token di Arc Network akan lulus graduasi saat mencapai 8,400 USDC, padahal kenyataan on-chain membutuhkan 69,000 USDC (selisih lebih dari 8.2x lipat).
- **Rekomendasi Remediasi**:
  Perbaiki teks pada ketiga file dokumentasi tersebut dari `8,400 USDC` menjadi `69,000 USDC`.

---

### DOC-03: Alamat Smart Contract Usang / Testnet Dipublikasikan pada Panduan Integrasi Resmi Pengembang [High]

- **Lokasi Dokumen**:
  - `apps/docs/src/integration/contracts.md:11-12, 25`
  - `apps/docs/src/id/integration/contracts.md:11-12, 25`
  - `apps/docs/src/zh/integration/contracts.md:11-12, 25`
- **Data Alamat di Dokumentasi vs Kode On-Chain**:
  1. **Robinhood Launchpad Factory**:
     - Tercantum di Dokumen: `0xbA42499Cfe59abc05120A100EEc4f859F476034F`
     - Alamat V2 Resmi Aktif: `0x9f1fAf78adE92C994AB188452338b45c52800748`
  2. **Robinhood Liquidity Locker**:
     - Tercantum di Dokumen: `0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4`
     - Alamat V4 Resmi Aktif: `0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E`
  3. **Arc Network Liquidity Locker**:
     - Tercantum di Dokumen: `0x9909ac8759dB233f546b644EF2CBDE1b3Af1dCE0`
     - Alamat Resmi Aktif: `0x173FF5D4eF626869a5a35FF0EA0c56c0A7e4Cd8b`
- **Dampak**:
  Pengembang pihak ketiga, aggregator DEX (seperti DEX Screener, GeckoTerminal), atau analis on-chain yang mengambil alamat dari dokumentasi resmi akan mengintegrasikan kontrak lama yang tidak terhubung dengan transaksi protokol saat ini.
- **Rekomendasi Remediasi**:
  Perbarui tabel alamat kontrak pada `contracts.md` di seluruh bahasa agar sesuai dengan `packages/shared-types/src/constants/network.ts` dan `.env.example`.

---

### DOC-04: Pernyataan Presisi Desimal Native USDC Arc Keliru (Tercatat 6 Desimal, Aktual 18 Desimal) [High]

- **Lokasi Dokumen**:
  - `apps/docs/src/integration/contracts.md:29`
  - `apps/docs/src/id/integration/contracts.md:29`
  - `apps/docs/src/zh/integration/contracts.md:29`
- **Teks Dokumentasi yang Dipublikasikan**:
  `Native Payment Token (USDC) | 0x3600...0000 | Native gas and base pair currency (6 dec)`
- **Realitas Kode On-Chain**:
  Sesuai spesifikasi resmi Circle Arc EVM differences yang ditegakkan di `docs/CHAINS.md`, `contracts/src/LaunchpadV2FactoryArc.sol`, dan `packages/shared-types/src/chains/arc.ts`:
  **Native USDC pada Arc Network menggunakan 18 desimal pada `msg.value` (di mana 1 ether = 1.00 USDC)**.
- **Dampak**:
  Jika pengembang mengintegrasikan interaksi smart contract menggunakan asumsi 6 desimal yang tertera pada dokumentasi, mereka akan mengirimkan nilai transaksi sebesar $10^{-12}$ dari nilai yang diharapkan, menyebabkan transaksi gagal atau underfunded.
- **Rekomendasi Remediasi**:
  Perbaiki teks pada tabel menjadi: `Native gas and base pair currency (18 decimals in msg.value per Arc EVM Standard)`.

---

### DOC-05: Klaim Kuota Penjualan Kurva "800M Token" Bertentangan dengan Kalibrasi Multi-Chain [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Robinhood: ~714,3 juta (71,43%) dijual di kurva, ~285,7 juta ke pool v4. Arc tidak lagi memakai kurva (Uniswap v4 sejak launch, graduasi di dalam pool sekitar $45.000); angka Arc yang usang (69.000 / 8.400 USDC) di overview (11 bahasa) dan FAQ (en/id/zh) ikut diperbaiki.

- **Lokasi Dokumen**:
  - `apps/docs/src/protocol/overview.md:24`
  - `apps/docs/src/id/protocol/overview.md:24`
  - `apps/docs/src/zh/protocol/overview.md:28`
- **Teks Dokumentasi yang Dipublikasikan**:
  _"800M tokens are sold gradually as buyers enter."_ _(Bahasa Indonesia: "Sebanyak 800 juta token diperdagangkan secara bertahap saat pembeli masuk.")_
- **Realitas Kode On-Chain**:
  Berdasarkan invarian matematika kurva V2 di `BondingCurve.sol`:
  - **Robinhood Chain (4663)**: Menjual **714,285,714 token (71.43%)** dan mencadangkan $285.7\text{M}$ token (28.57%) untuk pool Uniswap.
  - **Arc Network (5042)**: Menjual **738,600,000 token (73.86%)** dan mencadangkan $261.4\text{M}$ token (26.14%) untuk pool DEX.
  - Tidak ada jaringan yang menjual 800 juta token.
- **Dampak**:
  Ketidaksesuaian ekspektasi pengguna terhadap suplai token yang beredar sebelum dan sesudah kelulusan kurva.
- **Rekomendasi Remediasi**:
  Ganti pernyataan statis 800M dengan rincian akurat: $71.43\%$ di Robinhood Chain dan $73.86\%$ di Arc Network.

---

### DOC-06: Pengabaian Total Prosedur Peluncuran Token di Jaringan Arc Network pada Panduan Langkah-demi-Langkah [Medium]

- **Lokasi Dokumen**:
  - `apps/docs/src/protocol/launches.md:11, 42`
- **Akar Masalah**:
  Panduan pembuatan token (`launches.md`) hanya menuliskan:
  - _"Make sure your wallet is connected to Robinhood Chain (Chain ID: 4663)."_
  - _"Launch Fee: Fixed at 0.0005 ETH."_
    Sama sekali tidak ada panduan cara meluncurkan token di Arc Network, biaya peluncuran $1.00 \text{ USDC}$, atau kebutuhan aset gas native USDC.
- **Dampak**:
  Pengguna Arc Network tidak memiliki referensi dokumentasi resmi untuk meluncurkan token di jaringan Arc.
- **Rekomendasi Remediasi**:
  Tambahkan instruksi pemilihan jaringan (Robinhood Chain vs Arc Network) dan tabel komparasi biaya peluncuran ($0.0005 \text{ ETH}$ vs $1.00 \text{ USDC}$).

---

### DOC-07: String Hardcoded Bahasa Inggris pada Komponen Berbagi PnL Mengabaikan Sistem i18n Klien [Low] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Semua teks `PnlCardModal.vue`, termasuk yang digambar di canvas, memakai `t(...)` dengan 14 kunci baru di 11 bahasa; `scripts/audit-i18n.mjs` → `I18N INTEGRATED`.

- **Lokasi Komponen**:
  - `apps/frontoffice/src/components/trade/PnlCardModal.vue:14, 28, 43, 84, 101, 107, 113`
- **Akar Masalah**:
  Skrip audit `scripts/audit-i18n.mjs` menandai komponen modal berbagi PnL (`PnlCardModal.vue`) karena menggunakan string teks bahasa Inggris statis (_hardcoded strings_):
  `Share Trading PnL Card`, `Holding Value`, `Market Cap`, `Token Price`, `Trader:`.
  String ini tidak menggunakan fungsi pembungkus lokalisasi `t(...)`.
- **Dampak**:
  Saat pengguna mengganti bahasa antarmuka ke Bahasa Indonesia, Mandarin, Spanyol, dll., kartu modal PnL tetap muncul dalam bahasa Inggris, merusak konsistensi internasionalisasi antarmuka.
- **Rekomendasi Remediasi**:
  Bungkus seluruh teks statis di `PnlCardModal.vue` dengan helper `t(...)` dan tambahkan kunci terjemahan terkait pada `apps/frontoffice/src/lib/i18n.ts`.

---

## Status Remediasi (2026-10-16)

- **DOC-01** ✅ RESOLVED — Halaman utama (11 bahasa) dan `fees-and-burns` (en/id/zh) kini menjelaskan alur yang benar: 30% protokol, 70% bagian kreator yang dapat dibagi ke kreator/holder/buyback-burn/likuiditas; buyback dijaga TWAP 30 menit ± 2%; bagian protokol tidak dipakai untuk buyback.
- **DOC-05** ✅ RESOLVED — Robinhood: ~714,3 juta (71,43%) dijual di kurva, ~285,7 juta ke pool v4. Arc tidak lagi memakai kurva (Uniswap v4 sejak launch, graduasi di dalam pool sekitar $45.000); angka Arc yang usang (69.000 / 8.400 USDC) di overview (11 bahasa) dan FAQ (en/id/zh) ikut diperbaiki.
- **DOC-07** ✅ RESOLVED — Semua teks `PnlCardModal.vue`, termasuk yang digambar di canvas, memakai `t(...)` dengan 14 kunci baru di 11 bahasa; `scripts/audit-i18n.mjs` → `I18N INTEGRATED`.
- **DOC-02** ✅ RESOLVED — Koreksi sebelumnya ke 69.000 USDC sudah usang: Arc kini diluncurkan langsung ke Uniswap v4 tanpa kurva. Teks diganti di semua bahasa (lihat DOC-05).
- **DOC-03** — Alamat di `integration/contracts.md` masih alamat deployment lama dan harus diganti setelah stack v4 di-deploy.
