# Audit Integritas Internal SDKs, ABIs & Keselarasan Tipe (`packages/*`)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT SDK & KONSISTENSI MONOREPO  
**Ruang Lingkup Pemeriksaan**:

- **Paket ABI Smart Contract**: `packages/contracts-abi/` (`src/v2/`, `src/chains/`, `scripts/export-foundry-abis.ts`)
- **Paket Tipe Bersama**: `packages/shared-types/` (`src/domain/intents.ts`, `tokens.ts`, `constants/network.ts`, `abis/contracts.ts`)
- **Paket Matematika Protokol**: `packages/math-sdk/` (`src/bonding-curve.ts`, `revenue-split.ts`, `constants.ts`, `chains/`)
- **Kompilasi Bytecode Sumber**: `contracts/out/` vs TypeScript artifacts
- **Konsumen Antar-Paket**: `apps/api/`, `apps/frontoffice/`, `contracts/test/`

---

## 1. Ringkasan Eksekutif

Audit ini mengevaluasi konsistensi kontrak-ke-kode (_contract-to-code consistency_), integritas artefak ABI TypeScript terhadap kompilasi Foundry, keselarasan tipe data (_cross-boundary type-safety_), serta akurasi komputasi domain pada seluruh paket internal monorepo (`packages/*`).

Meskipun seluruh 48 unit test pada `packages/` berstatus lulus (_passing_), audit komparatif mendalam menemukan **5 ketidaksinkronan arsitektur dan cacat tipe data kritis**:

- **2 Tingkat Tinggi (High Severity)**: Desinkronisasi signature fungsi `launchTokenV2` antara kompilasi Foundry dengan ekspor TypeScript ABI, serta hardcode cadangan pool 200M usang di `@proto/math-sdk` yang bertentangan dengan kalibrasi on-chain Robinhood Chain (285.7M) dan Arc Network (261.4M).
- **2 Tingkat Sedang (Medium Severity)**: Kebijakan keamanan `TransactionIntent` yang tidak pernah dipanggil oleh frontend sebelum submit transaksi, dan simulasi alokasi pendapatan 4-arah di Math SDK yang tidak memiliki implementasi smart contract pengikat on-chain.
- **1 Tingkat Rendah (Low Severity)**: Duplikasi definisi ABI antara paket `@proto/shared-types` dan `@proto/contracts-abi`.

---

## 2. Matriks Temuan Audit Internal SDKs & ABIs

| ID            | Severity | Paket Terkait                                                       | Ringkasan Kerentanan                                                                                    |
| :------------ | :------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| **SDK-01**    | High     | `packages/contracts-abi/src/v2/launchpad-v2-factory.abi.ts`         | **Desinkronisasi Overload Signature `launchTokenV2` Memicu Ketidaksesuaian Selector Viem**              |
| **SDK-02** ✅ | High     | `packages/math-sdk/src/constants.ts` / `bonding-curve.ts`           | **Konstanta Cadangan Pool 200M Usang di Math SDK Menyimpang dari Kalibrasi On-Chain (285.7M / 261.4M)** |
| **SDK-03** ⚪ | Medium   | `packages/shared-types/src/domain/intents.ts` / `apps/frontoffice/` | **Arsitektur `TransactionIntent` & `SecurityPolicy` Tidak Pernah Ditegakkan pada Alur Klien Frontend**  |
| **SDK-04** ✅ | Medium   | `packages/math-sdk/src/revenue-split.ts`                            | **Formula Pembagian Pendapatan 4-Arah di Math SDK Hanya Fiktif Tanpa Penegakan Kontrak On-Chain**       |
| **SDK-05** ✅ | Low      | `packages/shared-types/src/abis/` & `packages/contracts-abi/`       | **Duplikasi Definisi ABI Ganda Membuka Resiko Inkonsistensi Pembaruan Monorepo**                        |

---

## 3. Detail Analisis Teknis & Rencana Remediasi

### SDK-01: Desinkronisasi Overload Signature `launchTokenV2` Memicu Ketidaksesuaian Selector Viem [High]

- **Lokasi Kode**:
  - `packages/contracts-abi/src/v2/launchpad-v2-factory.abi.ts:189-225, 594-620`
  - `packages/contracts-abi/scripts/export-foundry-abis.ts:92-128`
  - `contracts/src/LaunchpadV2Factory.sol:154-164`
- **Akar Masalah**:
  1. Kontrak kanonikal terkini `LaunchpadV2Factory.sol` memiliki fungsi `launchTokenV2` dengan **8 argumen**:
     ```solidity
     function launchTokenV2(
         string memory name, string memory symbol, string memory logo,
         string memory description, string memory twitter, string memory telegram,
         string memory website, uint256 minInitialTokensOut
     ) external payable returns (address, address);
     ```
     Selector fungsi ini adalah `0x0a16b906`.
  2. Namun, skrip ekspor ABI `export-foundry-abis.ts` secara manual menyuntikkan overload lama dengan **7 argumen** (tanpa `minInitialTokensOut`, selector `0x43a90f1e`) ke dalam array ABI TypeScript:
     ```typescript
     // export-foundry-abis.ts:92-128
     if (item.contractName === 'LaunchpadV2Factory') {
       abi = [ ...abi, { name: 'launchTokenV2', inputs: [ ... 7 items ... ] } ];
     }
     ```
- **Dampak**:
  - File `launchpad-v2-factory.abi.ts` memiliki 2 fungsi bernama `launchTokenV2`.
  - Pada Viem dan TypeScript, ketika komponen memanggil `writeContract({ functionName: 'launchTokenV2', args: [...] })`, sistem inferensi tipe Viem dapat memilih overload 7-argumen yang sudah tidak ada di bytecode Solidity terkini. Panggilan transaksi akan melempar error ketidaksesuaian tipe saat kompilasi atau mengirim calldata dengan 4-byte selector usang yang langsung revert dengan `execution reverted` on-chain.
- **Rekomendasi Remediasi**:
  Hapus injeksi manual overload 7-argumen pada `export-foundry-abis.ts`. Biarkan ABI mencerminkan 100% kompilasi murni dari `contracts/out/LaunchpadV2Factory.sol/LaunchpadV2Factory.json`.

---

### SDK-02: Konstanta Cadangan Pool 200M Usang di Math SDK Menyimpang dari Kalibrasi On-Chain [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Estimasi `TradeView` memakai `getChainMathConfig` dan invariant x·y=k (bukan 800M tetap). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `packages/math-sdk/src/constants.ts:10-16`
  - `packages/math-sdk/src/bonding-curve.ts:25, 78-83`
- **Akar Masalah**:
  1. Pada `packages/math-sdk/src/constants.ts`:
     ```typescript
     export const CURVE_TOKEN_SUPPLY_NUM = 800_000_000;
     export const POOL_RESERVE_SUPPLY_NUM = 200_000_000;
     export const CURVE_TOKEN_SUPPLY_WEI = 800_000_000n * 10n ** 18n;
     export const POOL_RESERVE_SUPPLY_WEI = 200_000_000n * 10n ** 18n;
     ```
  2. Pada `packages/math-sdk/src/bonding-curve.ts`:
     ```typescript
     export function calculateCurveBuyOutput(..., maxAvailableTokens = CURVE_TOKEN_SUPPLY_NUM) { ... }

     export function getAmountOutBuyWei(...) {
       // ...
       if (totalAvailableTokensWei !== undefined && totalAvailableTokensWei > POOL_RESERVE_SUPPLY_WEI) {
         const curveAvailable = totalAvailableTokensWei - POOL_RESERVE_SUPPLY_WEI;
         if (tokenOutWei > curveAvailable) tokenOutWei = curveAvailable;
       }
     }
     ```
  3. Namun, pada spesifikasi multi-chain resmi (`docs/CHAINS.md` dan smart contract):
     - **Robinhood Chain (4663)**: `poolReserveSupply` adalah **285,714,286 token (28.57%)**, alokasi kurva adalah **714,285,714 token**.
     - **Arc Network (5042)**: `poolReserveSupply` adalah **261,400,000 token (26.14%)**, alokasi kurva adalah **738,600,000 token**.
     - **Tidak ada rantai yang menggunakan cadangan 200,000,000 token**. Nilai 200M adalah artefak lama dari arsitektur V1.
- **Dampak**:
  Ketika fungsi Math SDK digunakan di antarmuka tanpa menyertakan konfigurasi rantai eksplisit:
  - Math SDK mengasumsikan kurva memiliki kuota penjualan hingga 800 juta token.
  - Saat pembeli membeli sisa token mendekati batas kurva, Math SDK menampilkan bahwa token masih dapat dibeli (misal hingga 790 juta token).
  - Namun transaksi on-chain akan langsung revert karena smart contract `BondingCurve.sol` menghentikan penjualan pada batas fisik cadangan pool (714.28M di Robinhood atau 738.60M di Arc). Hal ini memicu kegagalan transaksi tak terduga (_transaction revert_) bagi pengguna frontend.
- **Rekomendasi Remediasi**:
  Hapus nilai default global tunggal 200M/800M pada `constants.ts`. Wajibkan setiap kalkulasi kurva menerima `networkConfig` atau parameter alokasi rantai spesifik (`ROBINHOOD_POOL_RESERVE_SUPPLY_WEI` atau `ARC_POOL_RESERVE_SUPPLY_WEI`).

---

### SDK-03: Arsitektur `TransactionIntent` & `SecurityPolicy` Tidak Pernah Ditegakkan pada Alur Klien Frontend [Medium] — ⚪ DITERIMA (risk accepted)

> **Status: ⚪ DITERIMA (risk accepted) (2026-10-16)** — Diterima sebagai risiko: pemeriksaan intent di browser bisa dilewati siapa pun, jadi tidak menambah keamanan. Penegakan yang sesungguhnya ada on-chain (slippage router, batas pajak & split, aturan launch) dan di API (sesi wallet, data pajak dibaca dari chain). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `packages/shared-types/src/domain/intents.ts`
  - `apps/api/src/modules/security/domain/security-policy.ts`
  - `apps/frontoffice/src/composables/useLaunchpad.ts`, `useSwap.ts`
- **Akar Masalah**:
  1. Dokumen panduan utama `AGENTS.md` menyatakan:
     _"Fail-Closed Security: All transaction mutations must form a TransactionIntent and pass through SecurityPolicy.evaluate() before submission."_
  2. Paket `@proto/shared-types` mendefinisikan interface lengkap untuk `TransactionIntent`, `SecurityPolicyCheck`, dan `SecurityEvaluationResult`.
  3. Backend API mengimplementasikan controller `SecurityController` dan endpoint `POST /api/security/evaluate`.
  4. Namun di antarmuka web `apps/frontoffice/`:
     - Fungsi `launchToken` di `useLaunchpad.ts` langsung memanggil `walletClient.writeContract`.
     - Fungsi `executeSwap` di `useSwap.ts` langsung memanggil `chainAdapter.executeSwap`.
     - Fungsi `setFeeRedirect` langsung mengirim transaksi ke blockchain.
     - **Tidak ada satu pun alur frontend yang membentuk `TransactionIntent` atau memanggil `SecurityPolicy.evaluate()`**.
- **Dampak**:
  Pintu gerbang keamanan (_security gate_) yang telah dirancang di tingkat domain terabaikan sepenuhnya di lapisan presentasi. Transaksi yang melanggar batas (misalnya slippage berlebih atau nama token tidak valid) langsung diajukan ke dompet pengguna tanpa evaluasi kebijakan keamanan terlebih dahulu.
- **Rekomendasi Remediasi**:
  Bungkus setiap mutasi transaksi di `apps/frontoffice/` dengan pemanggilan lokal `SecurityPolicy.evaluate(intent)` sebelum memicu permintaan tanda tangan MetaMask/Rabby.

---

### SDK-04: Formula Pembagian Pendapatan 4-Arah di Math SDK Hanya Fiktif Tanpa Penegakan Kontrak On-Chain [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Split ditegakkan on-chain oleh `ProtoFeeSplitter`: Arc saat launch; Robinhood lewat `ProtoV4Graduator.setRevenueSplit` (sekali, oleh kreator, sebelum pembeli pihak ketiga) yang dipakai saat graduasi. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `packages/math-sdk/src/revenue-split.ts:1-139`
  - `contracts/src/LaunchpadToken.sol:39, 123-127, 360-384`
  - `contracts/src/LiquidityLocker.sol:196-248`
- **Akar Masalah**:
  1. `packages/math-sdk/src/revenue-split.ts` menyediakan algoritma matematika canggih untuk rebalancing alokasi pendapatan 4-arah (`creator`, `buyback`, `holders`, `growth`).
  2. Namun pada lapisan smart contract:
     - `LaunchpadToken.sol` hanya memiliki 1 variabel penerima pajak: `address taxRecipient`. Seluruh potongan pajak beli dan jual (100%) langsung ditransfer ke `taxRecipient` tunggal.
     - `LiquidityLocker.sol` hanya memiliki logika bagi hasil 2-arah (antara kreator dan perbendaharaan protokol via `FeeMath.calculateLockerSplit`).
  3. Tidak ada smart contract `FeeSplitter.sol` di on-chain yang mengeksekusi pembagian 4-arah secara otomatis.
- **Dampak**:
  Terdapat kesenjangan representasi (_representational gap_): fungsi Math SDK dan antarmuka slider formulir mengesankan kepada pengguna bahwa pendapatan pajak dibagi 4 secara desentralisasi, padahal di blockchain seluruh dana pajak masuk ke satu alamat EOA tanpa pembagian otomatis.
- **Rekomendasi Remediasi**:
  1. Kembangkan smart contract `RevenueSplitter.sol` di `contracts/src/` yang menerima aliran pajak dan membaginya on-chain ke 4 modul target.
  2. Atau sesuaikan Math SDK dan UI agar secara jujur menampilkan bahwa pajak saat ini mengalir ke 1 penerima pajak tunggal (`taxRecipient`).

---

### SDK-05: Duplikasi Definisi ABI Ganda Membuka Resiko Inkonsistensi Pembaruan Monorepo [Low] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — ABI V1 tulisan tangan dihapus; semua ABI (termasuk V1 legacy) di-generate dari artefak Foundry di `@proto/contracts-abi`, `shared-types` hanya re-export. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `packages/shared-types/src/abis/contracts.ts`
  - `packages/contracts-abi/src/v2/`
- **Akar Masalah**:
  Paket `@proto/shared-types` memiliki file `contracts.ts` yang mendefinisikan array ABI mandiri (seperti `bondingCurveAbi`, `launchpadTokenAbi`, `launchpadV2FactoryAbi`), sementara paket `@proto/contracts-abi` juga mendefinisikan dan mengekspor ABI dari kompilasi Foundry.
- **Dampak**:
  Keberadaan dua sumber kebenaran ABI yang terpisah di monorepo beresiko menimbulkan bug di mana pengembang memperbarui ABI di `packages/contracts-abi` setelah mengubah smart contract, tetapi lupa memperbarui salinan statis di `packages/shared-types`. Konsumen yang mengimpor dari shared-types akan beroperasi dengan ABI usang.
- **Rekomendasi Remediasi**:
  Hapus duplikasi ABI di `packages/shared-types/src/abis/contracts.ts`. Jadikan `packages/contracts-abi` sebagai satu-satunya penyedia ekspor ABI resmi di seluruh monorepo.
