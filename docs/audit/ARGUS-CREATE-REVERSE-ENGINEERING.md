# Analisis Rekayasa Balik Form Pembuatan Token Argus (argus.world/create)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / ANALISIS ARSITEKTUR KLIEN & KONTRAK  
**Status**: DIKONFIRMASI LINTAS VERSI (Evolusi Argus V1 -> Argus Portal V2 Terkini)

**Sumber Referensi On-Chain**:

- Halaman Frontend Target: `https://argus.world/create`
- Argus Portal V2 Terkini: `0xeed7559B8A6ABf64427dc41Cb5cc6400109C5D93` (Total Launches: **7,989+**)
- Argus Factory V1 (Legacy): `0xb021be536808f551b31789422fd28a6c9c6e97da`
- Relayer Gasless Argus: `0x0052A87145f687b8F3AB2b3B63965f0abc6A58Ee` (Nonce: **2,513+**)
- Bukti Dekode Calldata On-Chain:
  - Token V1 $YouTube (`0xffFe...`, blok `21151141`, tx: `0x90fb...`): `initialBuy = 0 USDC` (Pola lama sebelum pembaruan).
  - Token V2 $GOLDETTF (`0xfe88...`, blok `26169748`, tx: `0x1a1b...`): **`prebuy = 4.50 USDC` (Pola wajib terkini)**.
  - Token V1 $IDEA (`0xd84e...`, blok `25977118`, tx: `0x472c...`): `initialBuy = 1,300 USDC`.

---

## 1. Evolusi Sistem Pembuatan Token Argus: Dari 0 USDC Menjadi Wajib Prebuy 4.50 USDC

Sebelum pembaruan terkini, Argus (seperti pada token $YouTube `0xffFe...`) mengizinkan pembuatan token dengan modal **0 USDC** (`initialBuy = 0`). Namun, model 0 USDC memicu berbagai permasalahan:

- Tingginya volume spam token dari bot otomatis.
- Kolam likuiditas awal kosong tanpa aktivitas volume perdagangan nyata.

### Pembaruan Terkini Argus (Portal V2 `0xeed7...`)

Pada sistem `argus.world/create` versi terbaru, Argus **MEWAJIBKAN PRE-BUY MINIMAL 4.50 USDC** bagi setiap peluncuran token:

- Nilai kuota USDC: **`4,500,000`** (dalam format **6 desimal**).
- Struktur parameter: Dikirimkan melalui array bundle `(address recipient, uint128 quoteAmount)[]`:
  ```json
  [["0x4465D72b96E94169733269499d5ec5A1bFCfa9d8", 4500000]]
  ```
- **Eksekusi Atomik On-Chain**:
  Dana 4.50 USDC milik kreator ditarik melalui **Permit2** (`0x0022...`) dan langsung dieksekusi sebagai swap beli pertama di Uniswap V4 PoolManager (`0x8366...`).
  Kreator secara instan menerima alokasi token awal (**~1,810,687 token** pada $GOLDETTF), dan tick pool bergeser dari tick inisialisasi `405400` ke `405363`, memberikan jangkar harga awal (_initial price anchor_) bagi pasar sekunder.

---

## 2. Dekonstruksi Skema Form `argus.world/create` Terkini

Melalui dekode ABI calldata pada fungsi `launch(...)` Portal V2 (selector `0x206641c0`), terurai struktur lengkap data yang dikirimkan oleh form `argus.world/create`:

### Signature Fungsi Portal V2

```solidity
function launch(
    LaunchParams p,
    bytes32 salt
) external returns (address token, address pool);
```

### Rincian Struktur `LaunchParams p`

| Field                                                   | Tipe Data             | Nilai ($GOLDETTF)                             | Penjelasan Teknis & Desimal                                  |
| :------------------------------------------------------ | :-------------------- | :-------------------------------------------- | :----------------------------------------------------------- |
| `name`                                                  | `string`              | `"GoldEttf"`                                  | Nama token.                                                  |
| `symbol`                                                | `string`              | `"GOLDETTF"`                                  | Simbol ticker (3–10 karakter).                               |
| `totalSupply`                                           | `uint256`             | $1,000,000,000 \times 10^{18}$                | Pasokan tetap 1 Miliar token (18 desimal).                   |
| `feeTier` ❌ INVALID (on-chain: dynamic fee `0x800000`) | `uint16`              | `500` (0.05%)                                 | Konfigurasi fee tier dasar.                                  |
| `tickSpacing`                                           | `uint16`              | `500` / `200`                                 | Jarak tick Uniswap V4.                                       |
| `splits`                                                | `uint16[5]`           | `[10000, 0, 0, 0, 0]`                         | Pembagian fee terkelola.                                     |
| `quoteAsset`                                            | `address`             | `0x3600...0000`                               | Canonical ERC-20 USDC Arc (**6 desimal**).                   |
| `creator`                                               | `address`             | `0x4465D...`                                  | Alamat dompet kreator token.                                 |
| `maxHoldBps`                                            | `uint16`              | `0`                                           | Batas kepemilikan dompet awal.                               |
| `treasury`                                              | `address`             | `0x341BB...`                                  | Alamat perbendaharaan protokol pengumpul fee.                |
| `hookSalt`                                              | `bytes32`             | `0x00...00`                                   | Salt penambangan alamat Hook Uniswap V4.                     |
| `initialBuy`                                            | `uint256`             | `0`                                           | Legacy field.                                                |
| **`bundles`**                                           | `(address,uint128)[]` | **`[["0x4465...", 4500000]]`**                | **Array Pembelian Awal Wajib (4.50 USDC = 4,500,000 unit)**. |
| `exempts`                                               | `address[]`           | `[]`                                          | Daftar dompet yang dikecualikan dari batasan.                |
| `meta`                                                  | `tuple`               | `(logo, website, twitter, telegram, discord)` | Metadata profil sosial dan tautan media token.               |

---

## 3. Perbandingan Model Peluncuran: Argus Terkini vs Proto Saat Ini

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 PERBANDINGAN PEMBUATAN TOKEN: ARGUS vs PROTO                │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Fitur & Mekanisme             │ Argus Terkini (Portal V2)                   │ Proto (CreateTokenView.vue) │
├───────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ 1. Syarat Pembelian Awal      │ Wajib Pre-Buy Minimal 4.50 USDC             │ Opsional murni (bisa 0)     │
│ 2. Biaya Peluncuran Platform  │ Ditanggung dari fee transaksi pre-buy       │ Biaya kaku 1.00 USDC        │
│ 3. Aset Pembayaran            │ ERC-20 USDC (6 desimal) via Permit2         │ Native gas msg.value 18 dec │
│ 4. Penyediaan Gas             │ Bersubsidi melalui Relayer 0x0052A...       │ Pengguna wajib bayar gas L1 │
│ 5. Dampak pada Pool Awal      │ Langsung ada likuiditas USDC & volume awal  │ Pool V4 kosong / tidak ada  │
│ 6. Kepemilikan Token Kreator  │ Kreator langsung memegang ~1.81M token      │ Kreator bisa memegang 0     │
└───────────────────────────────┴─────────────────────────────────────────────┴─────────────────────────────┘
```

---

## 4. Keuntungan Mekanisme Wajib Prebuy 4.50 USDC

Mengadopsi aturan wajib pre-buy 4.50 USDC memberikan keunggulan kompetitif dan keamanan yang signifikan:

1. **Pencegahan Spam Token & Bot Sybil**:
   Dengan mensyaratkan 4.50 USDC nyata pada setiap peluncuran, penyerang tidak dapat lagi membanjiri antarmuka dengan ribuan token kosong bernilai nol.
2. **Kreator Memiliki Kepentingan Finansial (_Skin in the Game_)**:
   Kreator langsung memegang token nyata hasil pembelian pertama (~1.81M token), memberikan motivasi untuk membangun komunitas dibanding meluncurkan token lalu meninggalkannya.
3. **Likuiditas Awal di Uniswap V4 PoolManager**:
   4.50 USDC langsung tersimpan di pool Uniswap V4 sejak detik pertama, mengaktifkan grafik harga awal dan memberikan titik acuan (_initial price point_) yang stabil bagi pembeli berikutnya.

---

## 5. Rencana Penerapan pada Halaman `CreateTokenView.vue` Proto di Arc Network

Untuk menyelaraskan sistem Proto dengan standar terbaru Argus di Arc Network:

1. **Wajibkan Input Pembelian Awal Minimal 4.50 USDC** ✅ RESOLVED:
   > Ditegakkan di kontrak (`minPrebuyUsdc6`) dan divalidasi di form.
   > Pada `apps/frontoffice/src/components/CreateTokenView.vue` saat jaringan aktif adalah **Arc Network (Chain ID: 5042)**:
   - Pasang batas minimal input: `initialBuyAmount >= 4.50`.
   - Berikan teks penjelas di bawah input:
     _"Arc Network standard requires a minimum initial pre-buy of 4.50 USDC to seed the initial trading pool and reward you with opening token supply."_
2. **Konversi Presisi ke Satuan 6 Desimal** ✅ RESOLVED:
   > Factory mengonversi `msg.value` ke 6 desimal dan menolak sisa pecahan.
   > Gunakan fungsi:
   ```typescript
   const prebuyUsdc6 = parseUnits(form.value.initialBuy || '4.5', 6); // 4500000n
   ```
3. **Integrasikan Alur Tanda Tangan Permit2**:
   Kreator menandatangani pesan Permit2 untuk 4.50 USDC tanpa perlu membayar transaksi approve terpisah.
4. **Teruskan ke Kontrak Factory V4**:
   Kirimkan parameter `bundles: [[creatorAddress, prebuyUsdc6]]` agar kontrak langsung mengeksekusi pembelian awal sebesar 4.50 USDC di Uniswap V4 PoolManager.
