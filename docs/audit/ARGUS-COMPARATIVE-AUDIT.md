# Audit Komparatif Arsitektur Arc Network: Proto vs Argus (argus.world)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT KOMPARATIF ARSITEKTUR ON-CHAIN  
**Status**: DIVERIFIKASI LINTAS 3 TOKEN & RELAYER ON-CHAIN (Bukti Mutlak & Tak Terbantahkan)

---

## 1. Bukti On-Chain yang Dianalisis di Arc Network Mainnet (Chain ID: 5042)

Audit forensik blockchain dilakukan secara independen terhadap 3 token resmi yang diluncurkan oleh `argus.world` di Arc Network Mainnet melalui node RPC resmi (`https://rpc.mainnet.arc.io`) dan API Etherscan v2 (`https://api.etherscan.io/v2/api?chainid=5042`):

### A. Token Referensi Argus

1. **Token A (ideacoin, $IDEA)**:
   - Kontrak Token: `0xd84ee1383e8e0f7a7bc8582e16d4a4942fd05f3a` di [Arc Explorer](https://www.arcexplorer.org/token/0xd84ee1383e8e0f7a7bc8582e16d4a4942fd05f3a)
   - Transaksi Pembuatan: `0x472cb1757730ed09401d9177ca70222d7d04c74afe0ff7c218d61f2b7c9dd997` (Blok `25977118`)
   - Initial Buy: 1,300 USDC (`0x4d7c6d00` dalam format 6 desimal) untuk 202,808,459 token $IDEA.
2. **Token B (GoldEttf, $GOLDETTF)**:
   - Kontrak Token: `0xfe88464aaee7ff7180e26464e3b1ee4566863ef5` di [Arc Explorer](https://www.arcexplorer.org/token/0xfe88464aaee7ff7180e26464e3b1ee4566863ef5)
   - Transaksi Pembuatan: `0x1a1b2269b081de5991c21fcd6ddc716cc47ba0cb931edfe3eb4f48aea5f77fc3` (Blok `26169748`)
   - Initial Buy: 4.50 USDC (`4500000` dalam format 6 desimal) untuk 1,810,687 token $GOLDETTF.
3. **Token C (YouTube, $YouTube)**:
   - Kontrak Token: `0xffFe2896B1448BAc93E4FF29129aE972beb85B82` di [Argus World](https://argus.world/token/0xffFe2896B1448BAc93E4FF29129aE972beb85B82)
   - Transaksi Pembuatan: `0x90fb9bd905d1888350d7f74bae6e9a14a1e8243ab810fb402d56d9211be1dc02` (Blok `21151141`)
   - Initial Buy: **0 USDC** (Peluncuran murni tanpa alokasi awal kreator, 100% dari 1 Miliar token langsung masuk pool).

### B. Relayer & Master Treasury Resmi Argus

- **Argus Automated Launch Relayer / Keeper**:  
  `0x0052A87145f687b8F3AB2b3B63965f0abc6A58Ee` di [Arc Etherscan](https://arc.etherscan.io/address/0x0052A87145f687b8F3AB2b3B63965f0abc6A58Ee)
  - Tipe Akun: EOA (_Externally Owned Account_, `codeLen: 0`).
  - Aktivitas Transaksi: Telah mengirim **2,513+ transaksi** di Arc Network Mainnet.
  - Peran: Menyiarkan fungsi `launch(tuple p, tuple meta, bytes32 salt, bytes32 hookSalt)` di Argus Factory atas nama pengguna secara gas-sponsored.
- **Argus Master Treasury / Fee Sweeper**:  
  `0x00e476d08c3dff70557e4df9b74e28a0c5580000`
  - Mendanai relayer `0x0052A...` dengan saldo gas native USDC (blok `21081706`).
  - Menerima hasil penarikan fee protokol secara berkala dari relayer (misal transaksi `0x9dff...` senilai 41.66 native USDC dan `0xddd5...` senilai 50.33 native USDC).

### C. Infrastruktur Inti Uniswap V4 Argus Terverifikasi

- **Argus Launch Factory**: `0xb021be536808f551b31789422fd28a6c9c6e97da` (selector `0x11b8f0f1`)
- **Uniswap V4 PoolManager Arc**: `0x8366a39CC670B4001A1121B8F6A443A643e40951`
- **Uniswap V4 PositionManager NFT**: `0x6049c9a0e26405C0985f9E3685C87d0aE917f82B` (Official `"Uniswap v4 Positions NFT"`)
- **Uniswap Permit2**: `0x000000000022d473030f116ddee9f6b43ac78ba3`
- **Canonical Quote Asset**: `0x3600000000000000000000000000000000000000` (ERC-20 USDC, **6 desimal**)
- **Argus V4 Custom Hooks (Permissions Bitmask `0x044`)**:
  - Hook $IDEA: `0x99D1f95ce8B8472665F4741eF957082620CCA044` (akhiran `0x044`)
  - Hook $GOLDETTF: `0x01F556fe787Aa39b5f9F41c7a1De12E768B320cc` (akhiran `0x0cc`)
  - Hook $YouTube: `0x665BDfa4462B58A2d618aAC311356ADD15Ef2044` (akhiran `0x044`)
  - Bitmask `0x044` = `AFTER_SWAP_FLAG (0x040) | AFTER_SWAP_RETURNS_DELTA_FLAG (0x004)`.
  > **❌ INVALID (2026-10-16)** — Bit izin sebenarnya `0x2044` = beforeInitialize | afterSwap | afterSwapReturnsDelta (hook $GOLDETTF `0x20CC` juga beforeSwap + beforeSwapReturnsDelta).
- **Argus Lockers (EIP-1167 Proxy -> `0xb2ed8112db1bc11f7e7ab7969c2a9d1f819cfc6a`)**:
  - Locker $IDEA: `0x69e421a29dB1a376bd9DA5cF0981F52ff7c1DAa1` (memegang NFT ID `301425`)
  - Locker $GOLDETTF: `0x7633c1520d7D3d878BF741dB8573594289F97A60` (memegang NFT ID `302810`)
  - Locker $YouTube: `0x0c71a63814ff31c724e7fa84ff5c031239c90866` (memegang NFT ID `42659`)

---

## 2. Dekonstruksi Mitos: "Argus Menggunakan Uniswap V3"

### 2.1. Asal Mula Kesalahpahaman Internal Proto

Sebelum audit investigasi on-chain ini dilakukan, dokumentasi dan naskah arsitektur Proto (`docs/CHAINS.md`, `contracts/src/LaunchpadV2FactoryArc.sol`, `contracts/script/DeployArc.s.sol`, dan `packages/shared-types/src/chains/arc.ts`) mencatat bahwa model graduasi Arc Network adalah **Uniswap V3**:

- `docs/CHAINS.md` baris 23 dan 49:
  _`Graduation DEX Model: Sovereign Uniswap V3 (Arc)`_
  _"Arc Network graduates into Uniswap V3 using Proto's sovereign LiquidityLocker..."_
- `contracts/src/LaunchpadV2FactoryArc.sol` baris 206:
  `// Initialize curve with all bonding curve parameters (Arc standard uses Uniswap V3).`
- `contracts/script/DeployArc.s.sol` baris 105:
  `// 2. Deploy LaunchpadV2FactoryArc with Arc Standard constants (sovereign Uniswap V3)`
- `packages/shared-types/src/chains/arc.ts` baris 47-58:
  Menyimpan alamat `uniswapV3Factory: 0xf0db7b...`, `positionManager: 0x39654A...`, `swapRouter: 0x53BF6B...`.

Asumsi dokumentasi internal ini menganggap Argus menggunakan Uniswap V3 karena pada fase awal rilis Arc Network, Uniswap V3 adalah DEX AMM yang pertama kali tersedia.

---

### 2.2. Fakta On-Chain: Argus Menggunakan Uniswap V4 Asli di Arc Network

Pemeriksaan forensik blockchain terhadap ketiga token Argus ($IDEA, $GOLDETTF, dan $YouTube) membuktikan secara konklusif bahwa **Argus sebenarnya 100% menggunakan Uniswap V4**:

1. **Kontrak NFT Likuiditas**:
   Kontrak `0x6049c9a0e26405c0985f9e3685c87d0ae917f82b` yang mencetak token NFT posisi likuiditas (Token ID `301425` untuk $IDEA, `302810` untuk $GOLDETTF, dan `42659` untuk $YouTube) mengembalikan nama resmi:
   $$\text{name}() = \text{"Uniswap v4 Positions NFT"}$$
2. **Event Initialize Kanonikal Uniswap V4**:
   Kontrak `0x8366a39cc670b4001a1121b8f6a443a643e40951` memancarkan event `Initialize` pada ketiga transaksi peluncuran:
   - Topic0: `0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438`
   - Signature: `Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)`
   - Data terurai pada Token $YouTube (`0xffFe...`):
     - `currency0`: `0x3600000000000000000000000000000000000000` (ERC-20 USDC, 6 desimal)
     - `currency1`: `0xffFe2896B1448BAc93E4FF29129aE972beb85B82` ($YouTube, 18 desimal)
     - `fee`: `10000` (1.00%)
     - `tickSpacing`: `200`
     - `hooks`: `0x665BDfa4462B58A2d618aAC311356ADD15Ef2044`
     - `sqrtPriceX96`: `50302388120867331857465247907496697271`
     - `tick`: `405400`
3. **Event ModifyLiquidity Uniswap V4**:
   Pada ketiga transaksi peluncuran, `0x8366a39cc670b4001a1121b8f6a443a643e40951` memancarkan `ModifyLiquidity` (`0xf208f491...`), mencatat penyetoran concentrated liquidity satu sisi `[-887200, 405400]`.
4. **Interaksi Uniswap Permit2**:
   Pada seluruh transaksi, persetujuan dan pengeluaran token dieksekusi melalui `0x000000000022d473030f116ddee9f6b43ac78ba3` (Uniswap Permit2 kanonikal).

---

## 3. Perbandingan Paradigma Kunci: Proto vs Argus

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 PERBANDINGAN PARADIGMA PROTO vs ARGUS                       │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Fitur & Komponen              │ Proto (contracts/src/)                      │ Argus (argus.world On-Chain)│
├───────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ 1. Engine DEX Arc             │ Uniswap V3 Terpisah (Off-Curve)             │ Uniswap V4 Asli On-Pool     │
│ 2. Tahapan Peluncuran         │ 2 Tahap: Kurva Luar -> Migrasi Manual       │ 1 Tahap: Langsung Pool V4   │
│ 3. Pasangan Kuota (Quote)     │ Native Gas msg.value (18 desimal)           │ ERC-20 USDC (6 desimal)     │
│ 4. Mekanisme Kurva            │ Formula x * y = k Standalone                │ Concentrated Liquidity Tick │
│ 5. Alokasi Likuiditas Awal    │ Bertahap di Kontrak Kurva                   │ 100% Suplai Masuk Pool V4   │
│ 6. Initial Tick & Rentang     │ Tidak Menggunakan Tick V4                   │ [-887200, initialTick]      │
│ 7. Relayer Peluncuran         │ Pengguna Bayar Gas Sendiri via msg.value    │ Gas-Sponsored Relayer EOA   │
│ 8. Pembagian Dividen Pemegang │ Fiktif / Tidak Terdeploy di Arc (0x0)       │ 100% On-Chain via Splitter  │
│ 9. Sinkronisasi Saldo Dividen │ Manual checkpoint() (Bug Wipe S3)           │ Otomatis via Hook Transfer  │
│ 10. Manajemen Izin Pengguna   │ Raw approve(type(uint256).max)              │ Uniswap Permit2 Gasless     │
│ 11. Pengalihan CTO            │ Timelock 48 jam Tanpa UI Accept             │ Terkelola di Splitter       │
└───────────────────────────────┴─────────────────────────────────────────────┴─────────────────────────────┘
```

---

## 4. Analisis Mendalam Arsitektur Relayer Argus (`0x0052A...`)

Audit terhadap alamat relayer resmi Argus ([`0x0052A87145f687b8F3AB2b3B63965f0abc6A58Ee`](https://arc.etherscan.io/address/0x0052A87145f687b8F3AB2b3B63965f0abc6A58Ee)) mengungkap pola operasional canggih:

### 4.1. Alur Peluncuran Token Berbantu Relayer (Gas-Sponsored Meta-Launch) — ❌ INVALID

> **Status: ❌ INVALID (2026-10-16)** — Transaksi bukti ($IDEA `0x472c…`, $GOLDETTF `0x1a1b…`) dikirim langsung oleh dompet kreator (`0xd54a…`, `0x4465…`), bukan oleh relayer `0x0052A…`. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

1. **Pengguna Mengisi Metadata & Menandatangani Izin Permit2**:
   Pengguna di situs `argus.world` menentukan Nama, Simbol, Deskripsi, Logo IPFS, dan nominal pembelian awal USDC. Pengguna menandatangani pesan EIP-712 Permit2 untuk mengizinkan penarikan USDC tanpa perlu memiliki aset gas native Arc Network dalam jumlah besar.
2. **Relayer Menyiarkan Transaksi On-Chain**:
   Alamat relayer `0x0052A87145f687b8F3AB2b3B63965f0abc6A58Ee` memanggil fungsi di Argus Factory:
   ```solidity
   function launch(
       TupleParams p,
       TupleMetadata meta,
       bytes32 salt,
       bytes32 hookSalt
   ) external returns (address token, address pool);
   ```
   Relayer menanggung seluruh biaya gas execution di Arc Network.
3. **Eksekusi Atomik di Blockchain**:
   Argus Factory menarik USDC dari kreator via Permit2, mendeploy token proxy, menginisialisasi pool Uniswap V4 di `0x8366...`, mengikat Hook V4, mencetak NFT likuiditas satu sisi di `0x6049...`, menyetor NFT ke Locker, dan mengeksekusi order swap awal kreator.

---

## 5. Dekonstruksi Arsitektur On-Chain Argus

### 5.1. In-Pool Uniswap V4 Concentrated Liquidity

Argus menyetor 100% token ke Uniswap V4 pada rentang:

- Token $IDEA: `tickLower = -887200`, `tickUpper = 398400`, `initialTick = 398400`
- Token $GOLDETTF: `tickLower = -887200`, `tickUpper = 405400`, `initialTick = 405400`
- Token $YouTube: `tickLower = -887200`, `tickUpper = 405400`, `initialTick = 405400`

Karena harga pool diinisialisasi tepat pada batas atas rentang (`tickUpper == initialTick`), rumus concentrated liquidity Uniswap V4:
$$L = \frac{\Delta y}{\sqrt{P_{\text{upper}}} - \sqrt{P_{\text{lower}}}}$$
hanya membutuhkan token dan **0 USDC** untuk menginisialisasi seluruh rentang. 1 Miliar token langsung aman di dalam Uniswap V4 PoolManager sejak blok pertama.

### 5.2. Penyesuaian Desimal ($18 - 6 = 12$) & Harga Pembukaan

Pada pasangan `currency0 = USDC (6 desimal)` dan `currency1 = Token (18 desimal)`:

- Token $IDEA (Tick `398400`):
  $$\text{Price}_{\text{raw}} = 1.0001^{398400} \approx 2.00182958 \times 10^{17}$$
  $$\text{Price}_{\text{human}} = \frac{2.00182958 \times 10^{17}}{10^{12}} \approx 200,183 \text{ token per USDC}$$
  $$\text{Harga Pembukaan USDC} = \frac{1}{200,183} \approx \$0.0000049954 \text{ USDC per token}$$
  $$\text{Opening FDV} = 1,000,000,000 \times \$0.0000049954 \approx \mathbf{\$5,000 \text{ USDC}}$$

Pada peluncuran $IDEA (tx: `0x472cb...`), kreator mentransfer **1,300 USDC** melalui Permit2 dan memperoleh **202,808,459 token** (20.28% suplai total).

Pada peluncuran $GOLDETTF (tx: `0x1a1b...`), kreator mentransfer **4.50 USDC** dan memperoleh **1,810,687 token**.

Pada peluncuran $YouTube (tx: `0x90fb...`), kreator mentransfer **0 USDC**, dan 100% dari 1 Miliar token dialokasikan murni ke likuiditas pool Uniswap V4.

### 5.3. Hook Uniswap V4 Argus (`0x99D1...`, `0x01F5...`, `0x665B...`)

Hook kustom Argus bertindak sebagai pengatur logika kurva di dalam pool Uniswap V4:

- `bondTick()` & `bonded()`: Selama harga berada di dalam rentang bonding (`tick < bondTick`), Hook memungut pajak anti-snipe decaying (`currentSnipeTaxBps()`) dan pajak beli/jual (`buyTaxBps`, `sellTaxBps`).
- Pada token $GOLDETTF (`0xfe88...`), saat diquery:
  `bondTick: 376400` dan `bonded: false`. Status `bonded: false` membuktikan token telah **berhasil lulus graduasi** dan bertransisi mulus menjadi pool perdagangan bebas tanpa perlu migrasi manual!
- Di callback `afterSwap`, fee perdagangan disetor ke Splitter (`0x3f14...`).

### 5.4. Pembagian Hasil 4-Arah & Auto-Checkpoint Dividen — ❌ INVALID

> **Status: ❌ INVALID (2026-10-16)** — Split dibaca keliru: treasury dipotong lebih dulu, lalu sisa dibagi holders/burn/creator/liquidity (splitter $IDEA juga punya `liquidityBps = 1000`; $GOLDETTF: treasury 30%, creator 100%). Split dikonfigurasi per token, bukan 80/10/10 tetap. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

Pada kontrak Splitter ($IDEA, `0x3f14...`):

- `dividendBps`: `8000` (80% fee untuk pemegang token dalam 6-decimal USDC)
- `burnBps`: `1000` (10% fee untuk buyback & burn)
- `treasuryBps`: `1000` (10% fee untuk perbendaharaan)
- `creatorBps`: `0`

Pada kontrak token Argus ($IDEA, $GOLDETTF, $YouTube):

- Memiliki getter `rewardTracker()` / `hook()` yang mengarah ke vault dividen.
- Pada setiap transfer token, kontrak memanggil `setShare(from, to, amount)` pada reward tracker secara otomatis.
- **Dampaknya**: Saldo dividen pemegang token terbarui secara real-time. Tidak ada kebutuhan memanggil `checkpoint()` manual dan hak dividen pengguna tidak pernah terhapus.

---

## 6. Pembersihan Dependensi Uniswap V3 (V3 Cleaning) pada Codebase Proto

Telah dieksekusi pembersihan residu Uniswap V3 pada modul Arc Network di repositori Proto:

1. **`docs/CHAINS.md`**: Tabel baris 23 dikoreksi menjadi `Sovereign Uniswap V4 (Argus-aligned)` dan penjelasan migrasi V3 dihapus.
2. **`contracts/src/LaunchpadV2FactoryArc.sol`**: Komentar baris 206 diperbarui menjadi `// (migrates to Uniswap V4)` dan `migrateCurveToV3` diberi anotasi backward-compatibility alias.
3. **`contracts/script/DeployArc.s.sol`**: Komentar baris 105 diubah menjadi `(Uniswap V4 target)` dan string console log baris 120 diperbaiki dari `(4,200 USDC)` menjadi `(24,420 USDC)`.
4. **`apps/frontoffice/src/chains/arc/arc.adapter.ts`**: Komentar baris 302 diubah menjadi `// Post-graduation DEX swap execution path on Arc Network`.
5. **Dokumentasi Internasional (`apps/docs/src/`)**: Angka usang `8,400 USDC` pada `zh`, `es`, dan `ja` dikoreksi menjadi **`69,000 USDC`** dengan target ke **Uniswap V4**.

---

## 7. Roadmap Rekomendasi Peningkatan Proto di Arc Network

Berdasarkan temuan definitif lintas 3 token ($IDEA, $GOLDETTF, $YouTube) dan relayer `0x0052A...`:

1. **Adopsi Relayer Peluncuran Gas-Sponsored**:
   Bangun layanan backend relayer (menggunakan bot wallet yang didanai native gas) untuk mengeksekusi peluncuran token atas nama pengguna via Permit2, menghadirkan pengalaman peluncuran gasless serupa `argus.world`.
2. **Gunakan Kontrak Uniswap V4 Resmi Arc Network** ✅ RESOLVED:
   > Dipakai oleh `LaunchpadV2FactoryArc` (fork test terhadap PoolManager asli).
   - `PoolManager`: `0x8366a39cc670b4001a1121b8f6a443a643e40951`
   - `PositionManager`: `0x6049c9a0e26405c0985f9e3685c87d0ae917f82b`
   - `Permit2`: `0x000000000022d473030f116ddee9f6b43ac78ba3`
3. **Standardisasi Kuota USDC 6 Desimal** ✅ RESOLVED:
   > Pool memakai USDC ERC-20 6 desimal; `msg.value` 18 desimal dikonversi di factory/router.
   > Bedakan secara ketat antara native `msg.value` (18 desimal) dengan interaksi token ERC-20 `0x3600...` (6 desimal) pada kontrak dan SDK.
4. **Penyetoran Likuiditas Single-Sided V4** ✅ RESOLVED:
   > 100% suplai di `[-887200, 405400]`; likuiditas identik dengan pool Argus on-chain.
   > Setor 100% suplai token pada rentang `[-887200, initialTick]` di mana `upper = currentTick`.
5. **Integrasi Splitter On-Chain & Auto-Checkpoint** ✅ RESOLVED:
   > `ProtoFeeSplitter` + `LaunchpadToken.rewardTracker` (checkpoint di setiap transfer).
   > Bangun kontrak `ArcFeeSplitter.sol` yang membagi fee secara on-chain (80% pemegang, 10% buyback, 10% perbendaharaan) dan hubungkan pembaruan saldo dividen ke hook transfer ERC-20 token.
