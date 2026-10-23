# Stress-Testing Tokenomics & Simulasi MEV On-Chain Proto

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / ANALISIS KUANTITATIF & TOKENOMICS  
**Ruang Lingkup**:

- Smart Contracts: `contracts/src/BondingCurve.sol`, `contracts/src/libraries/CurveMath.sol`, `contracts/src/libraries/AntiSnipeLogic.sol`
- Parameter Jaringan: Robinhood Chain (Chain ID: 4663) & Arc Network (Chain ID: 5042)
- Metodologi Pengujian:
  1. **Simulasi Monte Carlo 10,000 Transaksi**: Analisis pergeseran invarian $K$, presisi aritmatika integer, dan akumulasi selisih saldo.
  2. **Pemodelan Matematis Batas Serangan Sandwich MEV**: Penentuan frontrun optimal, ekstraksi keuntungan bot, dan rasio ROI pada rentang slippage 0.5%, 1.0%, 3.0%, dan 5.0%.
  3. **Vektor Kelelahan Paus (_Whale Exhaustion Vector_)**: Simulasi pembelian agresif 50% kuota kurva dalam satu blok awal dan dump instan lintas jadwal pajak anti-snipe ($t=0\text{s}$, $t=1\text{s}$, $t=2\text{s}$, $t \ge 3\text{s}$).

---

## 1. Ringkasan Eksekutif Hasil Stress-Testing

Simulasi kuantitatif berbasis kode integer Solidity menghasilkan kesimpulan utama:

1. **Integritas Aritmatika Kurva Murni (Tanpa Pajak Kreator)**:
   Pada 10,000 transaksi acak berturut-turut, algoritma pembagian integer dan akar kuadrat Babilonia di `CurveMath.sol` terbukti sangat kokoh. Pergeseran invarian $K$ hanya sebesar $-1.13 \times 10^{-13}\%$ pada Robinhood Chain dan $-7.92 \times 10^{-18}\%$ pada Arc Network. Tidak ditemukan satupun transaksi penjualan yang revert akibat selisih saldo rounding (> 100 wei).
2. **Deadlock Depleksi Cadangan Akibat Pajak Jual Kreator (_Sell Tax Token Leakage_)**:
   Ketika token mengaktifkan pajak penjualan (misal 5% atau 10% sell tax), token fisik bocor keluar ke `taxRecipient` pada setiap order jual. Pada pajak 10%, setelah $\sim 3,295$ transaksi acak, saldo fisik token kurva menyentuh batas `poolReserveSupply` ($285.7\text{M}$ token). Seluruh token kurva habis terjual sebelum dana mencapai target graduasi, menyebabkan kurva membeku (_deadlock_) secara permanen.
3. **Kerentanan Ekstraksi MEV yang Sangat Tinggi Akibat Cadangan Awal Rendah**:
   Karena kurva Robinhood Chain dimulai dengan cadangan virtual hanya $1.68 \text{ ETH}$, transaksi pembelian $\ge 0.20 \text{ ETH}$ memicu dampak harga (_price impact_) yang curam ($> 10\%$). Bahkan pada toleransi slippage yang wajar ($1.0\%$), bot MEV dapat mengeksekusi sandwich attack dengan ROI $> 140\%$ terhadap modal frontrun mereka.
4. **Anomali Anti-Snipe Tax pada Order Paus Awal**:
   Jika seorang paus membeli 50% suplai kurva pada blok 0 ($t=0\text{s}$, 99% anti-snipe tax), pembeli kehilangan 98.48% modalnya. Namun, 353.5 juta token (35.3% suplai total) teralihkan secara permanen ke dompet perbendaharaan protokol (`feeRecipient`), mendistorsi harga kurva secara permanen dan menempatkan risiko pasokan terkonsentrasi di dompet protokol.

---

## 2. Simulasi Monte Carlo 10,000 Transaksi Perdagangan

Pengujian Monte Carlo mensimulasikan 10,000 transaksi acak (55% order beli acak $0.001 - 0.20 \text{ ETH}$ dan 45% order jual $1\% - 25\%$ dari saldo token pengguna) dengan penegakan integer floor/ceiling division persis seperti EVM Solidity.

### Matriks Hasil Simulasi

| Parameter Metrik                         | Robinhood Chain (4663)              | Arc Network (5042)                  | Evaluasi Keamanan    |
| :--------------------------------------- | :---------------------------------- | :---------------------------------- | :------------------- |
| **Jumlah Transaksi Dieksekusi**          | 10,000                              | 10,000                              | 100% Selesai         |
| **Invarian Awal ($K\_{\text{init}}$)**   | $1.68 \times 10^{45}$               | $2.442 \times 10^{49}$              | Baseline             |
| **Invarian Akhir ($K\_{\text{final}}$)** | $1.6799999999999981 \times 10^{45}$ | $2.4419999999999999 \times 10^{49}$ | Presisi Tinggi       |
| **Persentase Drift Invarian ($K$)**      | $-1.128 \times 10^{-13}\%$          | $-7.915 \times 10^{-18}\%$          | Bounded / Negligible |
| **Transaksi Jual Revert (> 100 wei)**    | 0                                   | 0                                   | Bersih               |
| **Discrepancy Saldo Maksimal**           | 0 wei                               | 0 wei                               | Sempurna             |
| **Saldo Fisik Kontrak Akhir**            | 3.0275 ETH                          | 44,005.08 USDC                      | Solven               |

### Temuan Simulasi Monte Carlo dengan Pajak Jual (Sell Tax Token Leakage) — ❌ INVALID

> **Status: ❌ INVALID (2026-10-16)** — Asumsi kebocoran cadangan tidak berlaku pada kode saat ini (sama dengan S5). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

Pengujian dilanjutkan dengan mengaktifkan pajak penjualan token kreator:

```
[Simulasi 5,000 Transaksi dengan Pajak Jual 10%]
- Transaksi Berjalan : 3,295 trades
- Status Kurva       : DEADLOCK (curveAvailable = 0)
- Saldo Token Kurva  : 285,714,285 tokens (Menyentuh poolReserveSupply)
- Token Bocor ke Pajak: 700,480,801 tokens (70.0% dari total suplai)
- Dana Terkumpul     : 4.204 ETH
- Dana Terjebak      : 4.593 ETH
```

**Analisis**:
Pajak penjualan token menyebabkan token fisik mengalir keluar dari kurva ke `taxRecipient` pada setiap order sell. Akibatnya, kurva kehabisan token sebelum target graduasi tercapai secara mulus. Begitu `curveAvailable` mencapai 0, seluruh pembelian baru ditolak dengan `InvalidAmount()`. Kurva membeku dan dana terkunci selamanya jika `emergencyWithdraw` mensyaratkan graduasi telah selesai.

---

## 3. Analisis Batas Serangan Sandwich MEV (MEV Sandwich Bound Analysis)

Karena kurva bonding Robinhood Chain menggunakan cadangan virtual quote sebesar $E = 1.68 \text{ ETH}$ dan cadangan token $T = 1,000,000,000 \text{ token}$, dampak harga per unit ETH sangat tinggi.

Misalkan korban mengajukan order beli sebesar $V \text{ ETH}$ dengan toleransi slippage $\delta$.
Searcher MEV menjalankan bundel tiga langkah:

1. **Frontrun ($x \text{ ETH}$)**: Searcher membeli token sebelum transaksi korban, menaikkan harga hingga batas slippage korban.
2. **Victim Buy ($V \text{ ETH}$)**: Transaksi korban dieksekusi pada harga puncak, menerima jumlah token minimum $T_{\text{min}} = T_{\text{expected}} \cdot (1 - \delta)$.
3. **Backrun**: Searcher menjual kembali token yang dibeli, merealisasikan keuntungan bersih setelah dipotong fee 1% kurva pada kedua sisi.

### Tabel Matriks Ekstraksi MEV

| Ukuran Order Korban ($V$) | Toleransi Slippage ($\delta$) | Modal Frontrun Optimal ($x$) | Token Diterima Korban | Kerugian Token Korban | Keuntungan Bersih Bot MEV | ROI Bot per Transaksi |
| :------------------------ | :---------------------------- | :--------------------------- | :-------------------- | :-------------------- | :------------------------ | :-------------------- |
| **0.05 ETH**              | 0.5%                          | 0.004 ETH                    | 28,495,200            | -0.50%                | +0.00017 ETH              | 3.85%                 |
| **0.05 ETH**              | 1.0%                          | 0.009 ETH                    | 28,351,800            | -1.00%                | +0.00033 ETH              | 3.82%                 |
| **0.05 ETH**              | 3.0%                          | 0.026 ETH                    | 27,778,400            | -3.00%                | +0.00099 ETH              | 3.73%                 |
| **0.05 ETH**              | 5.0%                          | 0.045 ETH                    | 27,205,000            | -5.00%                | +0.00163 ETH              | 3.64%                 |
| **0.20 ETH**              | 0.5%                          | 0.004 ETH                    | 104,784,000           | -0.50%                | +0.00101 ETH              | 22.37%                |
| **0.20 ETH**              | 1.0%                          | 0.009 ETH                    | 104,257,000           | -1.00%                | +0.00201 ETH              | 22.26%                |
| **0.20 ETH**              | 3.0%                          | 0.027 ETH                    | 102,152,000           | -3.00%                | +0.00600 ETH              | 21.84%                |
| **0.20 ETH**              | 5.0%                          | 0.047 ETH                    | 100,047,000           | -5.00%                | +0.00997 ETH              | 21.41%                |
| **0.50 ETH**              | 0.5%                          | 0.005 ETH                    | 226,711,000           | -0.50%                | +0.00307 ETH              | 63.93%                |
| **0.50 ETH**              | 1.0%                          | 0.010 ETH                    | 225,571,000           | -1.00%                | +0.00613 ETH              | 63.58%                |
| **0.50 ETH**              | 3.0%                          | 0.029 ETH                    | 221,012,000           | -3.00%                | +0.01828 ETH              | 62.20%                |
| **0.50 ETH**              | 5.0%                          | 0.050 ETH                    | 216,453,000           | -5.00%                | +0.03027 ETH              | 60.84%                |
| **1.00 ETH**              | 0.5%                          | 0.005 ETH                    | 369,678,000           | -0.50%                | +0.00766 ETH              | 146.55%               |
| **1.00 ETH**              | 1.0%                          | 0.010 ETH                    | 367,820,000           | -1.00%                | +0.01528 ETH              | 145.55%               |
| **1.00 ETH**              | 3.0%                          | 0.032 ETH                    | 360,388,000           | -3.00%                | +0.04528 ETH              | 141.59%               |
| **1.00 ETH**              | 5.0%                          | 0.054 ETH                    | 352,956,000           | -5.00%                | +0.07458 ETH              | 137.71%               |

### Kesimpulan Analisis MEV

1. **Rasio Keuntungan Terhadap Modal Frontrun Sangat Asimetris**: Untuk order korban sebesar $1.00 \text{ ETH}$, bot MEV hanya perlu mempertaruhkan modal frontrun sebesar $0.010 \text{ ETH}$ (sekitar $25) untuk mengantongi keuntungan bersih $0.01528 \text{ ETH}$ ($145.55\%$ ROI) dalam waktu 1 blok.
2. **Rekomendasi Proteksi Frontend**: Toleransi slippage default di antarmuka web tidak boleh melebihi **0.5% – 1.0%** untuk order bernilai $\ge 0.1 \text{ ETH}$. Nilai default `minInitialTokensOut = 0n` pada saat peluncuran token (Temuan FO-02) terbukti sangat berbahaya karena memberikan 100% margin keuntungan bagi pencari MEV.

---

## 4. Vektor Kelelahan Paus (Whale Exhaustion Vector)

Skenario ini menguji dampak matematis ketika satu akun paus membeli 50% kuota kurva bonding ($357,142,857 \text{ token}$) dalam satu transaksi awal dan langsung melakukan penjualan (_dump_) instan.

### Parameter Pengujian

- Modal Pembelian Diperlukan: **0.9428 ETH**
- Pasokan Token Dibeli: **357,142,857 token** (50% dari alokasi kurva $714.28\text{M}$)
- Harga Spot Awal: $1.68 \times 10^{-9} \text{ ETH/token}$
- Harga Spot Puncak: $4.07 \times 10^{-9} \text{ ETH/token}$ ($+142.26\%$ kenaikan harga)

### Matriks Respon Lintas Blok Anti-Snipe

| Skenario Blok                  | Tarif Pajak Anti-Snipe | Token Diterima Paus | Token Dialihkan ke Treasury | ETH Dipulihkan Saat Dump | Kerugian Bersih Paus  | Fee Protokol Terkumpul | Sisa Token Kurva Hilang Permanen |
| :----------------------------- | :--------------------- | :------------------ | :-------------------------- | :----------------------- | :-------------------- | :--------------------- | :------------------------------- |
| **Blok 0 ($t=0\text{s}$)**     | 99% (9900 bps)         | 3,571,429           | 353,571,429 (35.3%)         | 0.0143 ETH               | -0.9285 ETH (-98.48%) | 0.0096 ETH             | **353,571,429 token**            |
| **Blok 1 ($t=1\text{s}$)**     | 25% (2500 bps)         | 267,857,143         | 89,285,714 (8.9%)           | 0.7609 ETH               | -0.1818 ETH (-19.29%) | 0.0171 ETH             | **89,285,714 token**             |
| **Blok 2 ($t=2\text{s}$)**     | 3% (300 bps)           | 346,428,571         | 10,714,286 (1.1%)           | 0.9060 ETH               | -0.0368 ETH (-3.90%)  | 0.0186 ETH             | **10,714,286 token**             |
| **Normal ($t \ge 3\text{s}$)** | 0% (0 bps)             | 357,142,857         | 0 (0.0%)                    | 0.9240 ETH               | -0.0188 ETH (-1.99%)  | 0.0188 ETH             | **0 token**                      |

### Analisis Kritis Efek Samping Anti-Snipe Tax pada Integritas Kurva

1. **Efektivitas Hukuman Sniper**:
   Jadwal pajak anti-snipe terbukti memberikan hukuman finansial yang sangat berat pada bot sniper di blok 0: sniper kehilangan 98.48% dari modal ETH mereka ($0.9285 \text{ ETH}$ hangus).
2. **Kerusakan Permanen Struktur Pasokan Kurva (_Collateral Damage_)**:
   Ketika 99% token sniper dialihkan ke perbendaharaan protokol (`feeRecipient`), token tersebut **TIDAK PERNAH DIKEMBALIKAN KE CADANGAN KURVA BONDING**:
   - Pasokan fisik kurva berkurang secara permanen sebesar $353,571,429 \text{ token}$ (35.3% dari suplai total 1 Miliar token).
   - Setelah paus melakukan dump, harga spot tidak kembali ke $1.68 \times 10^{-9}$, melainkan tertahan tinggi di $4.02 \times 10^{-9} \text{ ETH/token}$ karena pasokan token kurva telah berkurang separuh.
   - Perbendaharaan protokol (`feeRecipient`) kini memegang 35.3% suplai token. Jika alamat perbendaharaan menjual token tersebut di pasar sekunder DEX pasca-graduasi, likuiditas pasar ritel akan tertekan hebat (_dump risk_).
3. **Penyempurnaan Rekomendasi**:
   Alih-alih mengirimkan token hasil pajak anti-snipe ke alamat perbendaharaan, smart contract `BondingCurve.sol` sebaiknya **membakar (_burn_)** token tersebut ke alamat `0x00...dEaD` atau mengembalikannya ke cadangan virtual token kurva (`virtualTokenReserve`) agar harga tidak terdistorsi permanen.

---

## 5. Ringkasan Rekomendasi Mitigasi Kuantitatif

1. **Eliminasi Kebocoran Pajak Penjualan pada Kurva Bonding**:
   Jangan kenakan pajak kreator (`sellTaxBps`) pada transaksi penjualan di fase kurva bonding. Pajak kreator hanya boleh aktif setelah token lulus graduasi ke DEX, atau token yang dipotong harus tetap dihitung sebagai bagian dari cadangan likuiditas graduasi.
2. **Penegakan Slippage Dinamis di Frontend**:
   Terapkan batasan slippage dinamis yang berbanding terbalik dengan ukuran order:
   - Order $< 0.05 \text{ ETH}$: slippage maksimal 2.0%
   - Order $0.05 – 0.50 \text{ ETH}$: slippage maksimal 1.0%
   - Order $> 0.50 \text{ ETH}$: slippage maksimal 0.5%
3. **Pencegahan Akumulasi Suplai Liar di Dompet Treasury**:
   Modifikasi logika anti-snipe di `BondingCurve.sol` agar token denda anti-snipe langsung dibakar atau dialokasikan sebagai tambahan cadangan pool graduasi V4/V3, bukan ditumpuk di dompet EOA/multisig treasury.
