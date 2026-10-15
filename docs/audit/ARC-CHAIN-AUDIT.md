# Audit Keamanan & Arsitektur Arc Network (Chain ID: 5042)

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT TEKNIS  
**Ruang Lingkup**:

- Smart Contracts: `contracts/src/LaunchpadV2FactoryArc.sol`, `contracts/src/BondingCurve.sol`, `contracts/src/LiquidityLocker.sol`
- Deployment & Scripting: `contracts/script/DeployArc.s.sol`, `docs/ARC_DEPLOY.md`
- Shared Types & Math SDK: `packages/shared-types/src/chains/arc.ts`, `packages/math-sdk/src/chains/arc.ts`
- Backend API & Indexer: `apps/api/src/modules/chains/arc/`, `apps/api/src/server.ts`
- Frontend Adapters: `apps/frontoffice/src/chains/arc/arc.adapter.ts`

---

## 1. Ringkasan Eksekutif

Audit mendalam terhadap implementasi **Arc Network (Chain ID: 5042)** dilakukan untuk memverifikasi keselarasan teknis dengan spesifikasi Circle USDC L1, integritas matematika kurva bonding (target $69,000 USDC), keamanan migrasi likuiditas, serta integrasi off-chain backend dan frontend.

Arc Network memiliki perbedaan fundamental dibanding Robinhood Chain:

- **Aset Gas Asli**: USDC (18 desimal pada `msg.value`, di mana `1 ether = 1.00 USDC`).
- **Alokasi Suplai**: 73.86% (738,600,000 token) untuk kurva bonding dan 26.14% (261,400,000 token) untuk cadangan likuiditas DEX.
- **Model Likuiditas**: Ditargetkan untuk bermigrasi ke Uniswap V3 berdaulat (_Sovereign Uniswap V3_).

Audit ini mengidentifikasi **7 temuan teknis** (3 Tingkat Tinggi / High, 2 Tingkat Sedang / Medium, dan 2 Tingkat Rendah / Low).

---

## 2. Matriks Temuan Audit Arc Chain

| ID         | Severity | Komponen                                         | Judul Temuan                                                                          |
| :--------- | :------- | :----------------------------------------------- | :------------------------------------------------------------------------------------ |
| **ARC-01** | High     | `LaunchpadV2FactoryArc.sol`                      | Ketiadaan `receive()` Menggagalkan Peluncuran Token dengan Initial Buyout Penuh       |
| **ARC-02** | High     | `LaunchpadV2FactoryArc.sol` / `BondingCurve.sol` | Resiko Sentralisasi & Kustodial Penuh pada Migrasi Likuiditas 69,000 USDC             |
| **ARC-03** | High     | `LiquidityLocker.sol` / `DeployArc.s.sol`        | `factory` Imutabel Mengunci Hak Panggilan `lockPosition` untuk Factory Arc            |
| **ARC-04** | High     | `arc.adapter.ts`                                 | Swap Beli Uniswap V3 Pasca-Graduasi Mengirim Native ETH Mentah ke Router Non-Payable  |
| **ARC-05** | Medium   | `LaunchpadV2FactoryArc.sol` / `ARC_DEPLOY.md`    | Inkonsistensi Nilai Cadangan Virtual USDC ($4,200 vs $24,420) pada Komentar & Panduan |
| **ARC-06** | Low      | `LaunchpadV2FactoryArc.sol`                      | Variabel `defaultLocker` Tersimpan sebagai Dead Storage Tanpa Penggunaan              |
| **ARC-07** | Low      | `docs/ARC_DEPLOY.md`                             | Signature Konstruktor Keliru pada Panduan Verifikasi Explorer `forge verify-contract` |

---

## 3. Analisis Mendalam Temuan

### ARC-01: Ketiadaan `receive()` Menggagalkan Peluncuran Token dengan Initial Buyout Penuh [High]

- **Lokasi Kode**:
  - `contracts/src/LaunchpadV2FactoryArc.sol:169-254` (`launchTokenV2`)
  - `contracts/src/BondingCurve.sol:278-281` (`buyFor`)
- **Akar Masalah**:
  Ketika kreator meluncurkan token di Arc Network dengan pembelian awal (`initialBuyUsdc`) yang cukup besar untuk membeli sisa suplai kurva (misalnya 70,000 USDC), `BondingCurve.buyFor` menghitung kelebihan dana refund:
  ```solidity
  if (refundEth > 0) {
      (bool refundOk, ) = payable(msg.sender).call{value: refundEth}("");
      if (!refundOk) revert TransferFailed();
  }
  ```
  Dalam alur peluncuran token, `msg.sender` yang memanggil `curve.buyFor` adalah kontrak `LaunchpadV2FactoryArc`. Karena kontrak factory ini tidak memiliki fungsi `receive()` atau `fallback()`, panggilan transfer native USDC tersebut gagal (`refundOk == false`), menyebabkan transaksi peluncuran token selalu revert dengan `TransferFailed()`.
- **Dampak**:
  Kreator yang berniat membeli seluruh alokasi kurva saat pembuatan token mengalami penolakan transaksi permanen (_Denial of Service_).
- **Rekomendasi Remediasi**:
  1. Tambahkan fungsi penerima dana pada `LaunchpadV2FactoryArc.sol`:
     ```solidity
     receive() external payable {}
     ```
  2. Teruskan dana refund kembali ke `msg.sender` awal (kreator).

---

### ARC-02: Resiko Sentralisasi & Kustodial Penuh pada Migrasi Likuiditas 69,000 USDC [High]

- **Lokasi Kode**:
  - `contracts/src/LaunchpadV2FactoryArc.sol:260-266` (`migrateCurve`)
  - `contracts/src/BondingCurve.sol:406-427` (`_executeMigration`)
- **Akar Masalah**:
  Pada dokumen arsitektur `docs/CHAINS.md` (baris 49), dinyatakan:
  _"Arc Network graduates into Uniswap V3 using Proto's sovereign LiquidityLocker with LaunchpadV2FactoryArc."_
  Namun, implementasi aktual pada smart contract tidak memiliki otomasi on-chain:
  ```solidity
  function migrateCurve(address curve, address payable recipient) public onlyOwner {
      BondingCurve(payable(curve)).migrateToV4(recipient);
      address token = curveToToken[curve];
      if (token != address(0)) {
          launches[token].graduated = true;
      }
  }
  ```
  Fungsi ini memanggil `curve.migrateToV4(recipient)` yang mentransfer 100% saldo USDC (69,000 USDC) dan seluruh sisa token pool (261,400,000 token) ke alamat arbitrer `recipient` yang ditentukan oleh `owner`.
- **Dampak**:
  - Likuiditas tidak terkunci secara otomatis atau trustless di Uniswap V3.
  - Terdapat resiko sentralisasi penuh (_single point of failure_ / custodial risk). Jika private key `owner` dikompromikan atau disalahgunakan, 69,000 USDC dan 26.14% suplai token dapat ditarik ke dompet pribadi tanpa pernah membentuk pool DEX terbuka bagi publik.
- **Rekomendasi Remediasi**:
  Kembangkan kontrak migrator otomatis atau integrasikan pemanggilan ke `NonfungiblePositionManager.mint` di Uniswap V3 dan setor NFT posisi likuiditas langsung ke `LiquidityLocker.sol`.

---

### ARC-03: `factory` Imutabel Mengunci Hak Panggilan `lockPosition` untuk Factory Arc [High]

- **Lokasi Kode**:
  - `contracts/src/LiquidityLocker.sol:34, 68, 90`
  - `contracts/script/DeployArc.s.sol:100-110`
- **Akar Masalah**:
  Pada `LiquidityLocker.sol`:
  ```solidity
  address public immutable factory;
  modifier onlyFactory() {
      if (msg.sender != factory) revert Unauthorized();
      _;
  }
  constructor(...) {
      factory = msg.sender;
      owner = msg.sender;
  }
  ```
  Pada naskah deployment `DeployArc.s.sol`:
  1. `LiquidityLocker` dideploy terlebih dahulu oleh EOA deployer (`msg.sender` = EOA deployer), sehingga `factory` terkunci permanen ke alamat EOA deployer.
  2. `LaunchpadV2FactoryArc` dideploy setelahnya.
  3. Ketika kontrak factory Arc hendak memanggil `locker.lockPosition(...)`, transaksi akan revert dengan `Unauthorized()` karena pemanggilnya adalah alamat `LaunchpadV2FactoryArc`, bukan EOA deployer.
  4. Variabel `factory` bersifat `immutable` dan tidak memiliki fungsi mutasi `setFactory`.
- **Dampak**:
  Penguncian posisi LP NFT di `LiquidityLocker` untuk Arc Network tidak dapat dieksekusi oleh factory yang baru dideploy.
- **Rekomendasi Remediasi**:
  1. Ubah variabel `factory` di `LiquidityLocker.sol` menjadi mutable dengan fungsi setter yang dilindungi `onlyOwner`:
     ```solidity
     function setFactory(address _factory) external onlyOwner {
         if (_factory == address(0)) revert ZeroAddress();
         factory = _factory;
     }
     ```
  2. Atau jadikan alamat factory sebagai parameter konstruktor `LiquidityLocker`.

---

### ARC-04: Swap Beli Uniswap V3 Pasca-Graduasi Mengirim Native ETH Mentah ke Router Non-Payable [High]

- **Lokasi Kode**:
  - `apps/frontoffice/src/chains/arc/arc.adapter.ts:302-358` (`executeSwap`)
- **Akar Masalah**:
  Saat token di Arc Network telah lulus graduasi dan diperdagangkan di Uniswap V3, adaptor frontend mengeksekusi pembelian dengan mengirimkan nilai transaksi:
  ```typescript
  const swapHash = await walletClient.writeContract({
    address: this.network.contracts.swapRouter,
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: this.network.contracts.weth,
        tokenOut: params.tokenAddress,
        ...
        amountIn: params.amountInWei,
      },
    ],
    value: params.amountInWei, // Mengirim native USDC mentah
    ...
  });
  ```
  Pada Uniswap V3 `SwapRouter`, fungsi `exactInputSingle` standar tidak menerima native `msg.value` secara langsung untuk pembelian token ERC-20 kecuali melalui fungsi pembungkus multicall (`payments` / `unwrapWETH9`). Router akan memanggil `transferFrom(msg.sender, ...)` untuk menarik token ERC-20 `tokenIn` (`weth`).
- **Dampak**:
  Transaksi swap beli di Uniswap V3 pada Arc Network pasca-graduasi akan revert karena saldo ERC-20 tidak mencukupi atau approval tidak ada, sementara native USDC yang dikirim tertolak.
- **Rekomendasi Remediasi**:
  Gunakan antarmuka multicall Uniswap V3 standar dengan menyetor native USDC ke kontrak wrapped token sebelum swap, atau panggil fungsi deposit WETH sebelum `exactInputSingle`.

---

### ARC-05: Inkonsistensi Nilai Cadangan Virtual USDC ($4,200 vs $24,420) pada Komentar & Panduan [Medium]

- **Lokasi Kode**:
  - `contracts/src/LaunchpadV2FactoryArc.sol:42-46`
  - `docs/ARC_DEPLOY.md:10-13`
  - `contracts/script/DeployArc.s.sol:120`
- **Akar Masalah**:
  - Di `contracts/src/LaunchpadV2FactoryArc.sol`:
    Komentar NatSpec menyatakan:
    `// = 4_200e18 / (1_000_000_000e18) = 0.0000042 USDC per token`
    `// Opening FDV = 0.0000042 * 1,000,000,000 = $4,200`
    Namun konstanta sesungguhnya di baris berikutnya adalah:
    `uint256 public constant VIRTUAL_USDC_RESERVE = 24_420 ether;` (Opening FDV = $24,420 USDC).
  - Di `docs/ARC_DEPLOY.md` baris 10-13, dokumen panduan deployment masih mencatat angka lama $4,200 USDC dan harga buka $0.0000042.
  - Di `DeployArc.s.sol` baris 120, console log mencetak string `"wei (4,200 USDC)"` padahal nilai getter mengembalikan 24,420.
- **Dampak**:
  Ketidaksesuaian dokumentasi menciptakan kebingungan operasional bagi operator pasar dan bot penentu harga off-chain.
- **Rekomendasi Remediasi**:
  Perbarui komentar NatSpec di `LaunchpadV2FactoryArc.sol`, console log di `DeployArc.s.sol`, dan panduan `docs/ARC_DEPLOY.md` agar konsisten dengan nilai resmi: **24,420 USDC** (Opening Price $0.00002442, Opening FDV $24,420 USDC).

---

### ARC-06: Variabel `defaultLocker` Tersimpan sebagai Dead Storage Tanpa Penggunaan [Low]

- **Lokasi Kode**:
  - `contracts/src/LaunchpadV2FactoryArc.sol:52, 109`
- **Akar Masalah**:
  Kontrak `LaunchpadV2FactoryArc` menerima alamat `_locker` pada konstruktor dan menetapkannya ke variabel storage `public immutable defaultLocker`. Namun, variabel ini tidak pernah dipanggil, dirujuk, atau digunakan dalam logika apa pun di dalam kontrak.
- **Dampak**:
  Konsumsi gas tambahan pada saat deployment dan dead storage yang tidak berfungsi.
- **Rekomendasi Remediasi**:
  Manfaatkan `defaultLocker` dalam fungsi migrasi otomatis, atau hapus jika tidak diperlukan.

---

### ARC-07: Signature Konstruktor Keliru pada Panduan Verifikasi Explorer `ARC_DEPLOY.md` [Low]

- **Lokasi Kode**:
  - `docs/ARC_DEPLOY.md:113-118`
- **Akar Masalah**:
  Pada panduan verifikasi kontrak di Blockscout Explorer Arc, dokumen menuliskan:
  ```bash
  --constructor-args $(cast abi-encode \
    "constructor(address,address,address,address)" \
    "0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2" \
    "<LOCKER_ADDRESS>" \
    "0x0000000000000000000000000000000000000000" \
    "0x0000000000000000000000000000000000000000")
  ```
  Padahal konstruktor `LaunchpadV2FactoryArc` hanya menerima 2 argumen:
  `constructor(address payable _feeRecipient, address _locker)`.
- **Dampak**:
  Perintah verifikasi bytecode pada explorer Blockscout Arc Network akan gagal (_mismatched constructor arguments length_).
- **Rekomendasi Remediasi**:
  Ubah signature verifikasi menjadi `"constructor(address,address)"` dengan hanya meneruskan 2 parameter.

---

## 4. Verifikasi Matematika Kalibrasi Kurva Arc

Verifikasi persamaan bonding curve Arc Network:

- Suplai Total Token ($S$): $1,000,000,000 \times 10^{18}$
- Cadangan Virtual USDC ($V_{\text{USDC}}$): $24,420 \times 10^{18}$
- Target Graduasi Dana ($G$): $69,000 \times 10^{18}$
- Invarian AMM: $K = V_{\text{USDC}} \times S = 24,420 \times 10^{18} \times 1,000,000,000 \times 10^{18} = 2.442 \times 10^{40}$

Saat target graduasi $69,000 \text{ USDC}$ tercapai:

- Total Cadangan Quote: $V_{\text{USDC}} + G = 24,420 + 69,000 = 93,420 \times 10^{18}$
- Sisa Cadangan Token di Kurva:
  $$T_{\text{rem}} = \frac{K}{93,420 \times 10^{18}} = \frac{24,420 \times 1,000,000,000 \times 10^{18}}{93,420} \approx 261,399,593.2 \times 10^{18} \text{ token}$$
- Alokasi Token Terjual ke Pembeli Kurva:
  $$T_{\text{sold}} = 1,000,000,000 \times 10^{18} - 261,399,593.2 \times 10^{18} \approx 738,600,406.8 \times 10^{18} \text{ token}$$
- Persentase: **73.86% kurva** dan **26.14% cadangan pool likuiditas DEX**.

**Kesimpulan Kalibrasi**:
Secara matematis, formula invarian kurva Arc saat ini dengan $24,420 \text{ USDC}$ virtual reserve dan $69,000 \text{ USDC}$ target graduasi **sudah akurat dan presisi** mengalokasikan 73.86% token ke pembeli kurva dan menyisakan 26.14% untuk likuiditas pool, menyelesaikan anomali over-sell pada versi sebelumnya.
