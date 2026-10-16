# Audit Keamanan Seluruh Halaman & Komponen Frontend (`apps/frontoffice/`)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT TEKNIS FRONTOFFICE  
**Ruang Lingkup Pemeriksaan**:

- **Halaman (Pages)**:
  - `TradePage.vue`
  - `ProfilePage.vue`
  - `FeedPage.vue`
  - `CreatePage.vue`
  - `ExplorePage.vue`
  - `MemestockPage.vue`
  - `AnalyticsPage.vue`
  - `PostDetailPage.vue`
  - `TermsPage.vue`, `PrivacyPage.vue`, `CookiePolicyPage.vue`
- **Tampilan Utama (Main Views)**:
  - `TradeView.vue`
  - `ExploreView.vue`
  - `MemestockView.vue`
  - `CreateTokenView.vue`
  - `AnalyticsView.vue`
  - `ProfileView.vue`
  - `FeedView.vue`
  - `Navbar.vue`, `SearchDialog.vue`, `WalletModal.vue`, `LanguageSwitcher.vue`, `CookieConsentBanner.vue`
- **Komponen Fitur (Feature Components)**:
  - `components/trade/`: `SwapPanel.vue`, `TradeHeader.vue`, `HoldersTable.vue`, `TopTradersTable.vue`, `TradesTable.vue`, `BondingCurveStats.vue`, `SentimentGauge.vue`, `MobileTradeDock.vue`, `TradeAboutTab.vue`, `TradeCalloutsTab.vue`, `PnlCardModal.vue`, `CreatorTaxModal.vue`, `CalloutModal.vue`
  - `components/feed/`: `FeedCalloutCard.vue`, `FeedSidebar.vue`, `FeedAlphaTicker.vue`, `CashtagText.vue`, `ThreadModal.vue`, `QuoteModal.vue`, `ShareModal.vue`
  - `components/profile/`: `ProfileHero.vue`, `ProfileStats.vue`, `ProfilePortfolioTab.vue`, `ProfileDividendsTab.vue`, `ProfileCreatedTab.vue`, `ProfilePostsTab.vue`, `ProfileActivityTab.vue`, `EditProfileModal.vue`, `CtoRedirectModal.vue`
  - `components/explore/`: `ExploreGrid.vue`, `ExploreFeaturedMovers.vue`, `ExploreTable.vue`
  - `components/create/`: `CreateTokenAdvancedSection.vue`, `LaunchProgressModal.vue`
  - `components/tax/`: `TaxTimelockPanel.vue`, `PendingTaxBanner.vue`
  - `components/ui/chart/`: `TradingChart.vue`, `LightweightCandlestickChart.vue`, `LightweightHistogramChart.vue`, `LightweightAreaChart.vue`
- **Composables & State**:
  - `useLaunchpad.ts`, `useSwap.ts`, `useTaxConfig.ts`, `useHolderDividends.ts`, `useWallet.ts`, `useUserProfile.ts`, `useTokenStore.ts`, `useTokenStream.ts`
- **Multi-Chain Adapters**:
  - `apps/frontoffice/src/chains/robinhood/robinhood.adapter.ts`
  - `apps/frontoffice/src/chains/arc/arc.adapter.ts`

---

## 1. Ringkasan Eksekutif Audit Frontend

Audit menyeluruh ini menguji seluruh kode antarmuka klien Vue 3, composables, interaksi dompet Web3 (_wallet client_), penanganan transaksi on-chain, serta sanitasi data pada setiap halaman dan komponen frontoffice.

Ditemukan **11 kerentanan dan cacat arsitektur**:

- **5 Tingkat Tinggi (High Severity)**: Notifikasi konfirmasi swap palsu sebelum blok dikonfirmasi, default slippage 0% pada pembelian awal kreator, pemaksaan approval tak terbatas (_infinite allowance_), ketiadaan implementasi fungsi eksekusi CTO (`acceptFeeRedirect`), dan desinkronisasi pajak awal antara blockchain dengan database.
- **4 Tingkat Sedang (Medium Severity)**: Saldo dividen kreator fiktif (_phantom balance_), kegagalan cross-chain receipt polling pada `useTaxConfig`, pemalsuan status koneksi dompet via `localStorage`, dan sanitasi URL gambar lemah pada feed.
- **2 Tingkat Rendah (Low Severity)**: Penyimpanan profil yang hanya tersimpan di `localStorage` lokal, dan polling konfirmasi transaksi 2.5 detik yang terlalu prematur.

---

## 2. Matriks Temuan Audit Seluruh Halaman & Komponen

| ID                   | Severity | Halaman / Komponen                                             | Ringkasan Temuan                                                                                     |
| :------------------- | :------- | :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **FO-01** ✅         | High     | `TradeView.vue:2002-2021`                                      | **Notifikasi "Swap Confirmed" Muncul Sebelum Transaksi Di-Mine (False Confirmation Revert)**         |
| **FO-02** ❌ INVALID | High     | `CreateTokenView.vue` / `useLaunchpad.ts:187`                  | **Default `minInitialTokensOut = 0n` Membuka Celah 100% Slippage MEV Sandwich pada Initial Buy**     |
| **FO-03** ✅         | High     | `robinhood.adapter.ts:231, 295` / `arc.adapter.ts:256, 320`    | **Persetujuan Token Tak Terbatas (`maxUint256`) Secara Paksa Mengekspos Seluruh Saldo Dompet**       |
| **FO-04** ✅         | High     | `ProfileView.vue` / `CtoRedirectModal.vue` / `useLaunchpad.ts` | **Ketiadaan Implementasi `acceptFeeRedirect` Menyebabkan Pengalihan CTO Tidak Pernah Aktif**         |
| **FO-05** ✅         | High     | `useLaunchpad.ts:244-282` / `CreateTokenAdvancedSection.vue`   | **Kegagalan Transaksi Pajak Awal Diabaikan Tetapi Database Disinkronkan dengan Data Palsu**          |
| **FO-06** ✅         | Medium   | `useUserProfile.ts:85-94` / `ProfileCreatedTab.vue`            | **Simulasi Payout Multi-Tenant Menampilkan Saldo Dividen Kreator Fiktif (_Phantom Balance_)**        |
| **FO-07** ✅         | Medium   | `useTaxConfig.ts:103, 131, 160` / `CreatorTaxModal.vue`        | **Ketiadaan Parameter `chainId` Menyebabkan Transaksi Arc Network Menunggu di Chain Robinhood**      |
| **FO-08** ✅         | Medium   | `useWallet.ts:62-67` / `Navbar.vue` / `WalletModal.vue`        | **Fallback `localStorage` Menampilkan Status Dompet "Connected" Palsu Saat Provider Terputus**       |
| **FO-09** ✅         | Medium   | `FeedCalloutCard.vue:357-364` / `ThreadModal.vue`              | **Fungsi `resolveSafeUrl` Mengembalikan URL Mentah Tanpa Sanitasi Skema Eksternal**                  |
| **FO-10** ✅         | Low      | `ProfileView.vue:470-478` / `EditProfileModal.vue`             | **Penyimpanan Profil Kreator Hanya Lokal di Browser (`localStorage`), Tidak Terlihat Pengguna Lain** |
| **FO-11** ✅         | Low      | `viem-client.ts:193-204`                                       | **Polling Receipt 2.5 Detik Terlalu Cepat Menyerah pada Kondisi Jaringan Lambat**                    |

---

## 3. Analisis Mendalam per Halaman & Komponen

### FO-01: Notifikasi "Swap Confirmed" Muncul Sebelum Transaksi Di-Mine (False Confirmation Revert) [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Toast sukses hanya setelah receipt `success`; revert/pending ditampilkan. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `TradePage.vue`, `TradeView.vue`
- **Komponen Terkait**: `SwapPanel.vue`, `robinhood.adapter.ts`, `arc.adapter.ts`
- **Akar Masalah**:
  Pada `TradeView.vue` (baris 2002–2021), setelah fungsi `executeSwap` mengembalikan `hash`, kode langsung mengeksekusi:
  ```typescript
  if (hash) {
    swapSuccessTx.value = hash;
    isMaxSell.value = false;
    toast.success('Swap Confirmed', {
      id: loadingToastId,
      description: isBuy.value ? 'Successfully bought tokens!' : 'Successfully sold tokens!',
      duration: 8000,
    });
  }
  ```
  Di dalam adaptor rantai (`robinhood.adapter.ts` dan `arc.adapter.ts`), `waitForReceiptWithFallback` dipanggil dengan `.catch(() => {})` di latar belakang dan tidak di-`await`. Fungsi `executeSwap` langsung mengembalikan `hash` segera setelah wallet menandatangani dan menyiarkan transaksi.
- **Dampak**:
  Pengguna melihat banner hijau bertuliskan **"Swap Confirmed — Successfully bought tokens!"** saat transaksi baru saja masuk ke mempool atau bahkan **gagal/revert on-chain** (misalnya karena slippage terlampaui atau target graduasi kurva tercapai). Pengguna berasumsi telah memiliki token, padahal transaksi mereka dibatalkan di blockchain.
- **Rekomendasi Remediasi**:
  Wajibkan penantian tanda terima blok (_transaction receipt_) secara asinkron sebelum memicu toast sukses. Jika `receipt.status === 'reverted'`, tampilkan `toast.error('Swap Reverted')`.

---

### FO-02: Default `minInitialTokensOut = 0n` Membuka Celah 100% Slippage MEV Sandwich pada Initial Buy [High] — ❌ INVALID

> **Status: ❌ INVALID (2026-10-16)** — Token dan bonding curve / pool v4 dibuat di dalam transaksi launch itu sendiri, jadi tidak ada transaksi lain yang bisa trading lebih dulu untuk men-sandwich initial buy. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `CreatePage.vue`, `CreateTokenView.vue`
- **Komponen Terkait**: `CreateTokenAdvancedSection.vue`, `LaunchProgressModal.vue`, `useLaunchpad.ts`
- **Akar Masalah**:
  Pada `CreateTokenView.vue` (baris 729–744), parameter `minInitialTokensOut` sama sekali tidak pernah dihitung atau diteruskan ke fungsi `launchToken`. Pada composable `useLaunchpad.ts` baris 187, kode menetapkan:
  ```typescript
  params.minInitialTokensOut ?? 0n,
  ```
- **Dampak**:
  Ketika kreator menyertakan pembelian awal bernilai besar (misalnya $5.0 \text{ ETH}$ atau $50,000 \text{ USDC}$), transaksi dikirimkan dengan jaminan token minimum = 0 ($100\%$ toleransi slippage). Pada rantai dengan mempool publik, bot MEV dapat melakukan front-running / sandwich attack terhadap alokasi awal kreator.
- **Rekomendasi Remediasi**:
  Hitung estimasi token minimum berdasarkan formula konstan produk kurva di frontend sebelum transaksi dikirimkan, dan terapkan toleransi slippage maksimum $1\% - 3\%$.

---

### FO-03: Persetujuan Token Tak Terbatas (`maxUint256`) Secara Paksa Mengekspos Seluruh Saldo Dompet [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Tidak ada lagi approve tak terbatas: beli dibayar dengan native value, jual meng-approve jumlah yang dijual. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `TradePage.vue`, `TradeView.vue`
- **Komponen Terkait**: `SwapPanel.vue`, `robinhood.adapter.ts`, `arc.adapter.ts`
- **Akar Masalah**:
  Setiap kali pengguna menjual token di kurva bonding atau di SwapRouter Uniswap V3, adaptor secara otomatis meminta persetujuan tak terbatas:
  ```typescript
  const maxUint256 = 2n ** 256n - 1n;
  const approveHash = await walletClient.writeContract({
    address: params.tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [params.curveAddress!, maxUint256],
    account,
    chain: walletClient.chain,
  });
  ```
- **Dampak**:
  Pengguna dipaksa memberikan izin debet tanpa batas (`type(uint256).max`) kepada setiap alamat kontrak kurva token meme yang diperdagangkan. Jika kontrak kurva tersebut memiliki celah keamanan atau dibuat berbahaya, penyerang dapat menyedot seluruh saldo token yang tersisa di dompet korban di masa mendatang tanpa perlu konfirmasi tambahan.
- **Rekomendasi Remediasi**:
  Minta persetujuan nominal pasti (_exact approval_) sesuai jumlah token yang hendak dijual (`sellTokenAmount`), atau sediakan tombol toggle preferensi persetujuan bagi pengguna.

---

### FO-04: Ketiadaan Implementasi `acceptFeeRedirect` Menyebabkan Pengalihan CTO Tidak Pernah Aktif [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Redirect CTO lewat `ProtoFeeSplitter`: kirim pertama = propose, kirim ulang setelah 48 jam = accept. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `ProfilePage.vue`, `ProfileView.vue`
- **Komponen Terkait**: `CtoRedirectModal.vue`, `ProfileCreatedTab.vue`, `useLaunchpad.ts`
- **Akar Masalah**:
  Pada `CtoRedirectModal.vue`, modal menginformasikan:
  _"Permanently transfer all trading tax and launchpad fee accruals for this token to a new community multisig or developer wallet."_
  Saat dikonfirmasi, kode hanya memanggil `setFeeRedirect`:
  ```typescript
  await walletClient.writeContract({
    address: network.contracts.locker,
    abi: liquidityLockerAbi,
    functionName: 'setFeeRedirect',
    args: [tokenAddress, redirectAddress],
  });
  ```
  Pada smart contract `LiquidityLocker.sol` dan `ProtoLiquidityLockerV4.sol`, fungsi `setFeeRedirect` hanya membuat proposal pending yang terkunci selama 48 jam (`REDIRECT_TIMELOCK`). Pengalihan fee **TIDAK PERNAH AKTIF** sebelum fungsi `acceptFeeRedirect(token)` dipanggil setelah 48 jam berlalu.
  Di seluruh repositori frontoffice, fungsi `acceptFeeRedirect` **sama sekali tidak diimplementasikan**.
- **Dampak**:
  Kreator yang melakukan Community Takeover (CTO) mengira pengalihan fee ke perwakilan komunitas telah berhasil, padahal fee tetap mengalir ke kreator lama selamanya karena tidak ada tombol atau alur di UI untuk menyelesaikan proses accept.
- **Rekomendasi Remediasi**:
  Implementasikan composable dan antarmuka untuk menampilkan status pending timelock CTO dan tombol `acceptFeeRedirect` setelah 48 jam terlewati.

---

### FO-05: Kegagalan Transaksi Pajak Awal Diabaikan Tetapi Database Disinkronkan dengan Data Palsu [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Pajak hanya disinkronkan bila diterapkan on-chain (`taxApplied`); API membaca pajak dari chain. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `CreatePage.vue`, `CreateTokenView.vue`
- **Komponen Terkait**: `CreateTokenAdvancedSection.vue`, `useLaunchpad.ts`
- **Akar Masalah**:
  Peluncuran token dengan pajak kreator dipecah menjadi dua transaksi terpisah:
  1. Transaksi 1: `launchTokenV2` (token terdeploy di blockchain dengan pajak 0%).
  2. Transaksi 2: `setInitialTaxConfig` (mengatur pajak on-chain).
     Pada `useLaunchpad.ts` baris 246–261:
  ```typescript
  if (buyBps > 0 || sellBps > 0) {
    try {
      const taxHash = await walletClient.writeContract({ ... functionName: 'setInitialTaxConfig' ... });
      await publicClient.waitForTransactionReceipt({ hash: taxHash });
    } catch (taxErr) {
      console.warn('[useLaunchpad] Failed to configure onchain initial tax:', taxErr);
    }
  }
  // Tetap mengirimkan sync payload ke backend API
  await apiFetch(`/api/tokens/${tokenAddr}/sync`, { body: JSON.stringify(syncPayload) });
  ```
  Jika pengguna menolak transaksi kedua di dompet, atau jika gas habis: error ditelan secara diam-diam oleh `catch`. Namun kode tetap melanjutkan pengiriman data pajak ke backend API.
- **Dampak**:
  Token di blockchain memiliki pajak 0%, namun database API dan antarmuka web menampilkan token memiliki pajak 5% atau 10%. Pengguna melihat data tokenomics yang tidak sesuai dengan kenyataan on-chain.
- **Rekomendasi Remediasi**:
  Jika transaksi kedua gagal, gagalkan status peluncuran di UI dan tampilkan tombol retry khusus untuk mengatur pajak awal sebelum perdagangan dimulai.

---

### FO-06: Simulasi Payout Multi-Tenant Menampilkan Saldo Dividen Kreator Fiktif (_Phantom Balance_) [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Saldo kreator dibaca dari `creatorAccrued` splitter, bukan simulasi locker. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `ProfilePage.vue`, `ProfileView.vue`
- **Komponen Terkait**: `ProfileCreatedTab.vue`, `ProfileStats.vue`, `useUserProfile.ts`
- **Akar Masalah**:
  Pada `useUserProfile.ts` baris 85–94:
  ```typescript
  const { result } = await tokenClient.simulateContract({
    address: lockerAddr,
    abi: liquidityLockerAbi,
    functionName: 'claimFees',
    args: [item.token.address as `0x${string}`],
    account: target as `0x${string}`,
  });
  const [, creatorWethFee] = result as [bigint, bigint];
  unclaimedWeth = (Number(creatorWethFee) / 1e18).toFixed(4);
  ```
  Karena kerentanan pada `ProtoLiquidityLockerV4.claimFees` (Temuan S2), panggilan simulasi menghitung 70% dari **seluruh saldo kontrak locker global**. Jika seorang kreator meluncurkan 5 token, UI akan menampilkan saldo klaim sebesar $5 \times 70\% = 350\%$ dari saldo total locker.
- **Dampak**:
  Kreator melihat angka klaim palsu bernilai sangat besar di halaman profil mereka. Saat mengklik "Claim Fees", klaim pada token pertama menyedot saldo, dan klaim pada token berikutnya menghasilkan angka yang jauh lebih kecil atau nol.
- **Rekomendasi Remediasi**:
  Perbaiki kontrak locker terlebih dahulu untuk memisahkan saldo per token, dan baca saldo terakumulasi spesifik token via getter mapping storage alih-alih simulasi fungsi state-mutating.

---

### FO-07: Ketiadaan Parameter `chainId` Menyebabkan Transaksi Arc Network Menunggu di Chain Robinhood [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Receipt ditunggu di chain token; transaksi ditolak bila wallet di chain lain. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `TradePage.vue`, `TradeView.vue`
- **Komponen Terkait**: `CreatorTaxModal.vue`, `TaxTimelockPanel.vue`, `useTaxConfig.ts`
- **Akar Masalah**:
  Pada composable `useTaxConfig.ts` (baris 103, 131, 160):
  ```typescript
  const client = getPublicClient(); // Tanpa parameter explicitChainId!
  await client.waitForTransactionReceipt({ hash });
  ```
  `getPublicClient()` mengembalikan fallback `publicClientMainnet` (Robinhood Chain ID 4663). Jika token berada pada Arc Network (Chain ID 5042), kode akan mencari hash transaksi Arc di node RPC Robinhood Chain.
- **Dampak**:
  Panggilan `waitForTransactionReceipt` melempar error `TransactionNotFoundError` atau timeout 60 detik. Antarmuka menganggap transaksi gagal, padahal transaksi telah sukses di Arc Network.
- **Rekomendasi Remediasi**:
  Teruskan parameter `chainId` token secara eksplisit: `getPublicClient(chainId)`.

---

### FO-08: Fallback `localStorage` Menampilkan Status Dompet "Connected" Palsu Saat Provider Terputus [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Alamat tersimpan tidak lagi dianggap terhubung setelah AppKit melaporkan `disconnected`. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: Seluruh Halaman (`Navbar.vue`, `WalletModal.vue`, `App.vue`)
- **Komponen Terkait**: `useWallet.ts:62-67`, `wallet-store.ts`
- **Akar Masalah**:
  Pada `useWallet.ts`:
  ```typescript
  if (isStoredConnectionActive() && typeof window !== 'undefined' && 'localStorage' in window) {
    const stored = localStorage.getItem(STORAGE_ADDRESS_KEY);
    if (stored && stored.startsWith('0x') && stored.length === 42) {
      return stored as `0x${string}`;
    }
  }
  ```
  Jika pengguna telah memutus koneksi (_disconnect_) di ekstensi browser MetaMask/Rabby atau berganti akun, status `resolvedAddress` tetap mengembalikan alamat lama dari cache `localStorage`.
- **Dampak**:
  UI menampilkan status dompet terhubung dengan alamat lama. Ketika pengguna menekan tombol transaksi, wallet client menolak karena akun aktif di ekstensi tidak cocok atau tidak terhubung.
- **Rekomendasi Remediasi**:
  Selalu verifikasi ketersediaan akun aktif melalui panggilan `eth_accounts` ke provider EIP-1193 sebelum menganggap dompet terhubung.

---

### FO-09: Fungsi `resolveSafeUrl` Mengembalikan URL Mentah Tanpa Sanitasi Skema Eksternal [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Satu helper `lib/safe-url.ts` (http(s), ipfs, gambar inline) menggantikan 4 duplikat. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `FeedPage.vue`, `PostDetailPage.vue`
- **Komponen Terkait**: `FeedCalloutCard.vue:357-364`, `ThreadModal.vue`
- **Akar Masalah**:
  ```typescript
  function resolveSafeUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('ipfs://')) {
      const cid = url.replace('ipfs://', '');
      return `https://gateway.pinata.cloud/ipfs/${cid}`;
    }
    return url; // Mengembalikan string URL apa adanya
  }
  ```
  Jika konten memuat data URL SVG aktif (`data:image/svg+xml;...`) atau URL skema berbahaya, fungsi meloloskannya tanpa validasi skema `https://`.
- **Dampak**:
  Membuka potensi pemuatan aset berbahaya atau pelacakan privasi IP pengguna secara tidak sah (_Tracking Pixel / Mixed Content_).
- **Rekomendasi Remediasi**:
  Validasi bahwa URL berawal dari `https://` atau CID IPFS yang terverifikasi sebelum dirender.

---

### FO-10: Penyimpanan Profil Kreator Hanya Lokal di Browser (`localStorage`), Tidak Terlihat Pengguna Lain [Low] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Profil disimpan API (`GET/PUT /api/profiles/:address`, tulis wajib sesi wallet pemilik, validasi bersama `sanitizeCreatorProfile`) sehingga terlihat semua pengunjung; profil lama di browser tetap tampil untuk pemiliknya sampai disimpan ulang. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Halaman Terkait**: `ProfilePage.vue`, `ProfileView.vue`
- **Komponen Terkait**: `EditProfileModal.vue`, `ProfileHero.vue`
- **Akar Masalah**:
  Pada `ProfileView.vue` baris 474:
  ```typescript
  localStorage.setItem(`proto_profile_${targetAccount.value}`, JSON.stringify(data));
  ```
  Perubahan data profil (nama tampilan, bio, foto banner, tautan sosial) disimpan secara eksklusif di `localStorage` peramban lokal komputer pengguna yang mengedit.
- **Dampak**:
  Kreator mengira profil mereka telah diperbarui secara publik. Namun saat pengguna lain membuka tautan profil tersebut dari komputer mereka, mereka hanya melihat profil anonim default karena data tidak pernah dikirim ke database backend.
- **Rekomendasi Remediasi**:
  Sinkronisasikan data profil ke endpoint backend API (`POST /api/users/:address/profile`) dengan otentikasi tanda tangan dompet.

---

### FO-11: Polling Receipt 2.5 Detik Terlalu Cepat Menyerah pada Kondisi Jaringan Lambat [Low] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Fallback `waitForTransactionReceipt` 2 menit setelah polling cepat. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Komponen Terkait**: `apps/frontoffice/src/lib/viem-client.ts:193-204`
- **Akar Masalah**:
  `waitForReceiptWithFallback` hanya melakukan polling selama 2.5 detik (5 kali per 500ms).
- **Dampak**:
  Pada kondisi kepadatan blok Arbitrum L2 atau Arc Network, konfirmasi receipt memakan waktu 3–6 detik. Fungsi mengembalikan `null` lebih awal, memicu error sementara pada antarmuka.
- **Rekomendasi Remediasi**:
  Tingkatkan durasi polling minimal menjadi 15–20 detik.
