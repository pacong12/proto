# Audit Spesifikasi Resmi Dokumentasi Argus (argus.world/docs)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT SPESIFIKASI DOKUMENTASI RESMI  
**Sumber Referensi**:

- Portal Dokumentasi: `https://argus.world/docs`
- Live Contract Terms & Metadata Endpoint: `https://claudearc.com/api/terms`
- Dokumentasi Integrasi MCP Argus: `https://claudearc.com/docs`
- Jaringan: Arc Network (Chain ID: 5042)

---

## 1. Ringkasan Eksekutif Dokumentasi Resmi Argus

Dokumentasi resmi Argus (`https://argus.world/docs`) mendefinisikan standar teknis, ekonomi, dan kontrak pintar protokol peluncuran token di Arc Network:

1. **Model Pasar**: **100% Uniswap V4 Pool**.
   Argus tidak menggunakan bonding curve terpisah di luar pool. Token langsung diluncurkan dan diperdagangkan di dalam Uniswap V4 PoolManager sejak blok pertama.
2. **Kelulusan Tanpa Migrasi (_In-Place Graduation_)**:
   Likuiditas terkunci permanen pada market cap **$45,000 USDC**. Setelah mencapai batas graduasi, perdagangan **tetap berlanjut di dalam pool Uniswap V4 yang sama** (_"trading continues in the same Uniswap v4 pool"_). Tidak ada perpindahan dana manual atau perpindahan pool.
3. **Biaya Peluncuran**: **0 USDC** (`launchFee: "0"`).
   Peluncuran token tidak memungut biaya pendaftaran protokol.
4. **Pembelian Awal Kreator (_Dev Buy_)**:
   Dibatasi maksimal **5% dari total pasokan** (50.000.000 token) dan dieksekusi dalam transaksi yang sama dengan peluncuran (_atomic launch-and-buy_).
5. **Pajak & Pembagian Hasil Tetap Permanen (_Fixed Forever_)**:
   Pajak beli dan jual dapat diatur terpisah (0% hingga 10% per leg, minimal salah satu di atas 0%). Pajak bersifat permanen dan tidak dapat diubah setelah peluncuran. Pajak dibagi antara kreator, buyback & burn, dividen pemegang token (dibayar dalam USDC), dan likuiditas pool, setelah dipotong biaya protokol.

---

## 2. Tabel Parameter Resmi Protokol Argus (`/api/terms`)

| Parameter                           | Nilai Resmi Dokumentasi                      | Keterangan & Aturan                                                                  |
| :---------------------------------- | :------------------------------------------- | :----------------------------------------------------------------------------------- |
| **Nama Venue**                      | `Argus` (ArgusPad)                           | Platform peluncuran token resmi di Arc Network.                                      |
| **Chain ID**                        | `5042`                                       | Arc Network (Circle Stablecoin L1).                                                  |
| **Satuan Kuota (Unit)**             | `USDC`                                       | ERC-20 USDC `0x3600...0000` (6 desimal).                                             |
| **Total Suplai Token**              | `1,000,000,000`                              | Tepat 1 Miliar token dengan 18 desimal.                                              |
| **Biaya Peluncuran (Launch Fee)**   | **`0 USDC`**                                 | Tidak ada biaya peluncuran platform.                                                 |
| **Harga Pembukaan (Opens At)**      | **`$2,500 Market Cap`**                      | Cadangan kuota virtual awal senilai $2,500 USDC.                                     |
| **Target Kelulusan (Graduates At)** | **`$45,000 Market Cap`**                     | Likuiditas terkunci permanen di Uniswap V4; perdagangan berlanjut di pool yang sama. |
| **Batas Maksimal Dev Buy**          | **`5% of supply`**                           | Maksimal 50 juta token untuk pembelian awal kreator.                                 |
| **Fee Trading Kurva**               | `1% pool fee`                                | Fee dasar Uniswap V4 pool (`fee: 10000`).                                            |
| **Pajak Beli / Jual Maksimal**      | `10%` (1000 bps)                             | Dapat diatur 0%–10% per leg; terkunci permanen (_fixed forever_).                    |
| **Porsi Biaya Protokol**            | `10%` (Portal lama) / `30%` (Portal 8)       | Dipotong pertama kali dari total fee pajak.                                          |
| **Pembagian Sisa Pajak**            | `Creator` + `Burn` + `Holders` + `Liquidity` | Total alokasi harus berjumlah 100%.                                                  |
| **Metode Pembayaran Dividen**       | **USDC Tunai**                               | Dibagikan pro-rata kepada pemegang token tanpa klaim berbelit.                       |
| **Slippage Floor Default**          | `3%`                                         | Toleransi slippage standar untuk order swap beli.                                    |

---

## 3. Alamat Kontrak Kanonikal Resmi Argus di Arc Network

Berikut adalah daftar alamat kontrak pintar kanonikal yang dipublikasikan secara resmi oleh dokumentasi Argus:

| Komponen Kontrak                                                          | Alamat Terverifikasi di Arc Network          | Fungsi & Peran                                                          |
| :------------------------------------------------------------------------ | :------------------------------------------- | :---------------------------------------------------------------------- |
| **Argus Portal (Factory)**                                                | `0xB021Be536808f551b31789422Fd28a6c9c6e97Da` | Pabrik penerbit token, inisialisasi pool, dan pengatur likuiditas awal. |
| **Argus Portal V2 (Portal 8)**                                            | `0xeed7559B8A6ABf64427dc41Cb5cc6400109C5D93` | Portal generasi terbaru dengan wajib prebuy dan fee split terkelola.    |
| **Uniswap V4 PoolManager**                                                | `0x8366a39CC670B4001A1121B8F6A443A643e40951` | Manajer pool kanonikal Uniswap V4 di Arc Network.                       |
| **Uniswap Universal Router**                                              | `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1` | Router agregasi perdagangan multi-call Uniswap V4.                      |
| **Uniswap Permit2**                                                       | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Protokol persetujuan penarikan token off-chain tanpa gas.               |
| **Canonical USDC**                                                        | `0x3600000000000000000000000000000000000000` | Token ERC-20 USDC resmi Arc Network (**6 desimal**).                    |
| **Token Implementation**                                                  | `0x1b74922c01ddfd9c77b37d02c0a236611e8fe500` | Bytecode implementasi standar ERC-20 untuk seluruh token proxy Argus.   |
| **State View Contract**                                                   | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` | Kontrak pembaca status pasar dan analitik on-chain.                     |
| **Canonical Hook Code Hash** ❌ INVALID (alamat kontrak 6 KB, bukan hash) | `0xe5815bd5584eb18e8b37157f26c732df1445a944` | Hash kode sumber Hook resmi untuk validasi pembuatan pool V4.           |

---

## 4. Analisis Perbedaan Kritis: Dokumentasi Argus vs Sistem Proto

| Aspek                  | Dokumentasi Resmi Argus                                            | Sistem Proto Saat Ini                                                       | Dampak bagi Pengguna                                                             |
| :--------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **Model Perdagangan**  | Uniswap V4 pool tunggal sejak peluncuran hingga graduasi.          | Memisahkan kurva di luar DEX, lalu mencoba migrasi ke Uniswap V3.           | Proto membebankan risiko migrasi manual; likuiditas Argus langsung aktif on-DEX. |
| **Biaya Peluncuran**   | **0 USDC** (gratis).                                               | **1.00 USDC** (diwajibkan via native `msg.value`).                          | Peluncuran di Proto lebih mahal dan menolak pengguna tanpa saldo gas native.     |
| **Target Graduasi**    | **$45,000 Market Cap** (terkunci permanen).                        | Hardcode **69,000 USDC** di `LaunchpadV2FactoryArc`.                        | Target graduasi Argus lebih cepat tercapai ($45k vs $69k).                       |
| **Mekanisme Graduasi** | _In-place graduation_: perdagangan berlanjut di pool V4 yang sama. | Menarik dana keluar kurva via `migrateCurve(recipient)` ke dompet bebas.    | Proto memiliki resiko sentralisasi kustodial penuh (ARC-02).                     |
| **Pajak & Timelock**   | Pajak dikunci permanen sejak peluncuran (_fixed forever_).         | Mengizinkan kenaikan pajak instan 10% di blok awal (`setInitialTaxConfig`). | Pengguna Proto rentan terhadap jebakan pajak (_tax bait-and-switch_).            |
| **Pembagian Dividen**  | Dibayarkan tunai dalam **USDC 6 desimal** secara instan.           | Menggunakan WETH dan memiliki bug wipe saldo snapshot nol (S3).             | Dividen pemegang koin di Proto tidak dapat diklaim di Arc Network.               |
| **Router Pembelian**   | Uniswap Universal Router (`0x4fcA...`) + Permit2.                  | Memanggil SwapRouter V3 usang dengan `msg.value` yang revert (ARC-04).      | Pembelian token di Proto di DEX pasca-graduasi gagal.                            |

---

## 5. Rekomendasi Sinkronisasi Spesifikasi untuk Proto

Berdasarkan spesifikasi resmi dokumentasi Argus:

1. **Gunakan Uniswap Universal Router Arc Network** 🟡 RESOLVED (sebagian):
   > Builder Universal Router tersedia dan teruji byte-exact; frontend memakai `ProtoV4Router` agar sama di semua chain.
   > Integrasikan router resmi `0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1` pada `apps/frontoffice/src/chains/arc/arc.adapter.ts`.
2. **Koreksi Parameter Target Pasar di `@proto/shared-types`** ✅ RESOLVED:
   > Arc memakai pembukaan ≈ $2.5k dan graduasi ≈ $45k (tick 405400 / 376400).
   > Tambahkan preset $45,000 graduation market cap dengan $2,500 opening market cap sesuai ketentuan resmi Argus.
3. **Koreksi Alur Dividen ke USDC 6 Desimal** ✅ RESOLVED:
   > Dividen Arc dibayar dalam USDC lewat `ProtoFeeSplitter`.
   > Seluruh modul pembayaran dividen pemegang saham di Arc Network wajib menggunakan token `0x3600000000000000000000000000000000000000` dengan pembagian 6 desimal.
4. **Hapus Biaya Peluncuran 1.00 USDC** ✅ RESOLVED:
   > Launch fee Arc = 0; prebuy 4.50 USDC wajib.
   > Untuk bersaing secara adil dengan Argus, Proto harus menyediakan opsi peluncuran bebas biaya (0 USDC) dengan mengalihkan pembiayaan ke pre-buy kreator atau subsidi relayer.
