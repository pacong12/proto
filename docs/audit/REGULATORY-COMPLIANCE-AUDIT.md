# Audit Kepatuhan Regulasi, Hukum & GRC Proto (SEC, MiCA, Sanksi & GDPR)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima, ⏳ = terbuka (butuh keputusan legal/bisnis); verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / ADVISORY DECISION-SUPPORT  
**Ruang Lingkup**:

- Regulasi Pasar Modal AS: Securities Act of 1933, Securities Exchange Act of 1934, Uji Howey (_SEC v. W.J. Howey Co._)
- Regulasi Uni Eropa: Markets in Crypto-Assets Regulation (EU) 2023/1114 (MiCA), Market Abuse Regulation (MAR)
- Regulasi Anti-Pencucian Uang & Sanksi: US OFAC Sanctions, Circle USDC Native Freeze Architecture (Arc Network 5042)
- Regulasi Privasi Data: General Data Protection Regulation (EU) 2016/679 (GDPR), California Consumer Privacy Act (CCPA)
- Komponen Teruji: `HolderFeeDistributor.sol`, `BuybackBurner.sol`, `BondingCurve.sol`, `server.ts`, `docs/src/privacy-policy.md`, `terms-of-service.md`, `CookieConsentBanner.vue`

---

## 1. Ringkasan Eksekutif & Peta Resiko Kepatuhan

Audit tata kelola, resiko, dan kepatuhan (_Governance, Risk, and Compliance_) ini mengevaluasi eksposur hukum protokol Proto terhadap otoritas pengawas keuangan global (SEC di AS, ESMA/EBA di Uni Eropa, dan OFAC).

Meskipun Proto mengoperasikan smart contract non-kustodial di atas jaringan L2 (Robinhood Chain 4663) dan L1 (Arc Network 5042), arsitektur ekonomi protokol memperkenalkan fitur-fitur yang memiliki **resiko klasifikasi regulasi yang sangat tinggi**:

1. **Holder Fee Sharing & Buyback-and-Burn Sangat Kuat Memenuhi Kriteria Efek Tidak Terdaftar (_Unregistered Securities_)**:
   Pembagian dividen perdagangan tunai (ETH/USDC) secara pro-rata kepada pemegang token di `HolderFeeDistributor.sol` dan mekanisme pembelian kembali token secara otomatis di `BuybackBurner.sol` secara langsung memenuhi keempat elemen Uji Howey.
2. **Ketiadaan Whitepaper MiCA & Pengecualian Publik Uni Eropa**:
   Penerbitan token tanpa izin (_permissionless token issuance_) di kurva bonding tanpa badan hukum dan tanpa Whitepaper yang diberitahukan ke otoritas nasional melanggar Title II MiCA jika antarmuka web dapat diakses oleh penduduk Uni Eropa.
3. **Resiko Pembekuan Berantai (_Contagion Freeze Risk_) dari Native USDC Circle di Arc Network**:
   Smart contract Circle USDC memiliki fungsi `blacklist()` on-chain. Jika dompet yang terkena sanksi OFAC berinteraksi dengan kurva bonding atau locker likuiditas Proto, pembekuan oleh Circle terhadap alamat kontrak Proto dapat membekukan seluruh cadangan USDC ($69,000 \text{ USDC}$ per kurva) milik pengguna ritel yang sah.
4. **Celah Kepatuhan Privasi GDPR**:
   Pencatatan IP address mentah pada error log server Bun, ketiadaan mekanisme penghapusan data dompet (_Right to Erasure_), serta ketidaksinkronan dokumen hukum dengan fitur jaringan Arc.

---

## 2. Analisis Uji Howey (Klasifikasi Efek SEC Amerika Serikat)

Berdasarkan preseden Mahkamah Agung AS (_SEC v. W.J. Howey Co._, 328 U.S. 293 (1946)), suatu instrumen diklasifikasikan sebagai kontrak investasi (_investment contract / security_) apabila memenuhi 4 elemen kumulatif:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ELEMEN UJI HOWEY                               │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Investasi Uang (Investment of Money)                   ·  TERPENUHI  │
│ 2. Dalam Usaha Bersama (Common Enterprise)                 ·  TERPENUHI  │
│ 3. Ekspektasi Keuntungan yang Wajar (Expectation of Profit)·  TERPENUHI  │
│ 4. Berasal dari Usaha Pihak Lain (Efforts of Others)       ·  TERPENUHI  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Dekonstruksi Fitur Protokol Terhadap Uji Howey

#### A. Pembagian Dividen Pemegang Saham (`HolderFeeDistributor.sol`)

- **Mekanisme On-Chain**:
  Sebesar $70\%$ dari seluruh fee perdagangan yang dihasilkan pool likuiditas dapat dialihkan oleh deployer token ke `HolderFeeDistributor.sol`. Dana tersebut (dalam bentuk native ETH atau USDC) didistribusikan pro-rata kepada dompet yang memegang token melalui model akumulator dividen O(1).
- **Pemasaran & Antarmuka**:
  Antarmuka web di `SwapPanel.vue` dan `ProfileDividendsTab.vue` secara eksplisit mencantumkan label:
  _"Live Dividends — Pro-rata trading fee rewards accrued from tokens you hold that enabled Holder Fee Sharing. 100% on-chain and non-custodial."_
- **Evaluasi Hukum SEC**:
  Pemberian hak arus kas (_cash-flow rights_) atau dividen pasif kepada pemegang token atas dasar kepemilikan token merupakan karakteristik paling definitif dari saham ekuitas. Investor tidak perlu melakukan aktivitas apa pun selain menyimpan token untuk memperoleh bagi hasil dari volume perdagangan yang diciptakan oleh pihak lain. Berdasarkan _The DAO Report_ (2017) dan _SEC v. Ripple Labs_ (2023), pembagian dividen pasif hampir dipastikan memicu klasifikasi efek (_security_).

#### B. Pembelian Kembali dan Pembakaran Otomatis (`BuybackBurner.sol`)

- **Mekanisme On-Chain**:
  Kontrak `BuybackBurner.sol` mengumpulkan fee WETH protokol dan secara otomatis membeli token dari pasar sekunder Uniswap V3 lalu membakarnya ke `0x00...dEaD` via fungsi `executeBuyback`.
- **Evaluasi Hukum SEC**:
  Mekanisme ini secara langsung meniru skema _share repurchase_ pada perusahaan publik yang bertujuan mengurangi pasokan beredar demi mendorong kenaikan harga per lembar token. SEC dalam berbagai gugatan penegakan hukum (termasuk _SEC v. Bittrex_, _SEC v. Kraken_) secara konsisten menegaskan bahwa program buyback-and-burn yang dikelola protokol memicu ekspektasi keuntungan yang wajar bagi investor dari usaha tim pengelola.

#### C. Kontrol Pajak Kreator (`LaunchpadToken.setInitialTaxConfig` & `proposeTaxConfig`)

- **Mekanisme On-Chain**:
  Deployer token memegang hak istimewa sepihak untuk mengatur pajak beli/jual hingga 10% dan menentukan dompet penerima pajak (`taxRecipient`).
- **Evaluasi Hukum SEC**:
  Keberadaan satu entitas sentral (kreator/deployer) yang memiliki kendali administratif terhadap kebijakan moneter token membuktikan adanya "usaha manajerial pihak lain" (_managerial efforts of a promoter or third party_).

---

## 3. Kepatuhan MiCA (Uni Eropa - Markets in Crypto-Assets Regulation)

Regulasi Uni Eropa (EU) 2023/1114 (MiCA) mengatur penerbitan dan penyediaan layanan aset kripto di 27 negara anggota Uni Eropa.

### 3.1. Kewajiban Whitepaper Kripto (MiCA Title II, Pasal 4 – 9)

- **Ketentuan Regulasi**:
  Pasal 4 ayat (1) MiCA melarang penawaran aset kripto kepada publik di Uni Eropa kecuali penerbit:
  1. Merupakan badan hukum (_legal entity_).
  2. Telah menyusun Whitepaper aset kripto yang memenuhi Pasal 6.
  3. Telah memberitahukan (_notified_) Whitepaper kepada otoritas kompeten nasional (misal BaFin di Jerman, AMF di Prancis) minimal 20 hari sebelum publikasi.
  4. Bertanggung jawab atas kerugian materiil akibat informasi yang salah di Whitepaper (Pasal 15).
- **Kesenjangan di Proto**:
  Protokol Proto mengizinkan siapa saja membuat token secara _permissionless_ dalam satu transaksi tanpa badan hukum dan tanpa Whitepaper.
- **Pengecualian Skala Kecil (Pasal 4 ayat 2 huruf a)**:
  MiCA mengecualikan penawaran aset kripto jika total nilai penawaran di seluruh Uni Eropa tidak melebihi **EUR 1,000,000** selama periode 12 bulan.
  - Untuk token individual yang mencapai target graduasi ($4.20 \text{ ETH} \approx \$11,000$ atau $69,000 \text{ USDC} \approx \text{EUR } 63,000$), nilai emisi per token berada di bawah ambang batas EUR 1 juta.
  - **Namun**, entitas operator antarmuka web (Proto Labs) yang memfasilitasi penerbitan ratusan token beresiko diklasifikasikan sebagai penyedia layanan aset kripto (_Crypto-Asset Service Provider / CASP_) yang mengoperasikan platform perdagangan (_operating a trading platform_, Pasal 3 ayat 1 angka 16), yang mewajibkan izin usaha resmi di Uni Eropa.

### 3.2. Larangan Penyalahgunaan Pasar (MiCA Title VI, Pasal 87 – 92)

- **Pasal 88 (Insider Dealing) & Pasal 91 (Market Manipulation)**:
  - Fitur `setInitialTaxConfig` pada `LaunchpadToken.sol` mengizinkan kreator menaikkan pajak jual hingga 10% pada blok 1 dan 2 pasca-peluncuran saat perdagangan kurva sudah dibuka. Tindakan memasang pajak 0% saat peluncuran lalu menaikkannya secara mendadak saat pembeli awal masuk berpotensi dikategorikan sebagai manipulasi pasar atau praktik perdagangan yang menyesatkan (_deceptive trading practices_).
  - Pengecualian pajak anti-snipe khusus untuk kreator pada saat peluncuran (`isRestrictionExempt` atau bypass di `LaunchpadV2Factory.sol`) memberikan keuntungan asimetris yang bertentangan dengan prinsip kesetaraan akses pasar MiCA.

---

## 4. Analisis Sanksi & Resiko Pembekuan Circle USDC (Arc Network 5042)

### 4.1. Arsitektur Kontrak Blacklistable Circle USDC

Pada Arc Network (Chain ID: 5042), aset gas dan penyelesaian perdagangan adalah native USDC Circle. Smart contract resmi Circle USDC mengimplementasikan kontrol anti-kejahatan keuangan:

```solidity
interface Blacklistable {
    function isBlacklisted(address _account) external view returns (bool);
    function blacklist(address _account) external;
    function unBlacklist(address _account) external;
}
```

Ketika suatu alamat dimasukkan ke dalam daftar hitam oleh Circle (sebagai respons atas sanksi US OFAC, perintah pengadilan, atau investigasi penegakan hukum federal):

- Alamat tersebut tidak dapat mengirimkan USDC (`transfer` dan `transferFrom` selalu revert).
- Alamat tersebut tidak dapat menerima USDC.
- Seluruh saldo USDC pada alamat tersebut disita/dibekukan di tingkat blockchain.

### 4.2. Resiko Penularan Pembekuan (_Contagion Risk_) pada Kontrak Proto

```
[Dompet Penyerang / Terkena Sanksi OFAC]
                  │
                  ▼ Mentransfer USDC untuk membeli token
[BondingCurve.sol (Menyimpan hingga 69,000 USDC)]
                  │
                  ▼ Jika Circle mendeteksi pencucian uang dan mem-blacklist alamat BondingCurve
[Alamat Kontrak BondingCurve Ter-Blacklist On-Chain]
                  │
                  ├─► Panggilan curve.sell() gagal (revert)
                  ├─► Panggilan curve.migrateToV4() gagal (revert)
                  ├─► Panggilan curve.emergencyWithdraw() gagal (revert)
                  ▼
[100% Modal 69,000 USDC Milik Pembeli Ritel Sah Terkunci Permanen]
```

### 4.3. Ketiadaan Skrining Sanksi di Seluruh Lapisan Protokol

- Pemeriksaan pada `SecurityPolicy.evaluate` (`apps/api/src/modules/security/domain/security-policy.ts`) menunjukkan bahwa protokol hanya memvalidasi format regex alamat (`0x...` 42 karakter).
- Tidak ada integrasi dengan API intelijen sanksi (seperti Chainalysis oracle, TRM Labs, atau Elliptic).
- Tidak ada geoblocking IP untuk yurisdiksi sanksi komprehensif OFAC (Iran, Korea Utara, Suriah, Kuba, Krimea/Donetsk/Luhansk).

---

## 5. Audit Kepatuhan Privasi Data (GDPR & CCPA)

### 5.1. Klasifikasi PII: IP Address & Alamat Dompet Publik

Berdasarkan putusan Mahkamah Kehakiman Uni Eropa (_Court of Justice of the European Union_ / CJEU dalam perkara C-582/14 _Patrick Breyer v. Bundesrepublik Deutschland_):

- Alamat IP dinamis dan statis diklasifikasikan sebagai **Data Pribadi (Personal Data)** di bawah Pasal 4 angka 1 GDPR.
- Alamat dompet kripto publik (Ethereum address) yang diasosiasikan dengan riwayat komentar, like, atau aktivitas profil pengguna di platform off-chain berstatus data pribadi pseudonim (_pseudonymous personal data_).

### 5.2. Celah Kepatuhan GDPR & CCPA di Backend

1. **Kebocoran Pencatatan IP Mentah di Server Log**:
   Meskipun `http-request-tracker.ts` memotong hash SHA-256 IP untuk metrik analitik, pada `apps/api/src/server.ts` baris 2186:
   ```typescript
   logger.error(`Unhandled error on ${req.method} ${new URL(req.url).pathname}`, {
     requestId,
     ip: clientIp, // IP mentah klien ditulis ke stderr/stdout log
     error: { ... }
   });
   ```
   Pencatatan IP mentah ke file log tanpa kebijakan retensi atau dasar hukum pemrosesan (_Article 6 lawful basis_) melanggar prinsip minimalisasi data GDPR (_Article 5(1)(c)_).
2. **Ketiadaan Hak Penghapusan Data (_Right to Erasure / Article 17 GDPR_)**:
   Database SQLite menyimpan entitas komentar (`comments`), suka (`comment_likes`), dan suara sentimen (`sentiment_votes`) yang terikat dengan alamat dompet pengguna. Backend API tidak menyediakan endpoint atau mekanisme bagi pengguna untuk meminta penghapusan riwayat sosial mereka (_Right to be Forgotten_).
3. **Inkonsistensi Dokumen Kebijakan Privasi (`privacy-policy.md`)**:
   - Dokumen `privacy-policy.md` menyatakan hanya beroperasi di Robinhood Chain (Chain ID: 4663), sepenuhnya mengabaikan operasi Arc Network (Chain ID: 5042).
   - Dokumen tidak mencantumkan identitas Pengendali Data (_Data Controller_), kontak DPO, dasar hukum pemrosesan data, hak-hak subjek data GDPR (Pasal 15–22), maupun klausa CCPA _"Do Not Sell or Share My Personal Information"_.

---

## 6. Matriks Resiko GRC & Rencana Aksi Remediasi Kepatuhan

| ID Resiko     | Kategori                  | Tingkat Resiko (Inherent) | Tindakan Mitigasi yang Direkomendasikan                                                                                                                                                                                                                                                                                                                                               | Pemilik Tindakan     |
| :------------ | :------------------------ | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------- |
| **GRC-01** ⏳ | Regulasi Efek (SEC)       | **Kritis (Inherent 25)**  | 1. Terapkan geoblocking IP Amerika Serikat pada fitur Holder Fee Sharing dan Buyback Burner di frontend.<br>2. Hapus istilah "Dividends" di UI; ganti dengan istilah teknis non-promosional seperti "Protocol Fee Rebate".<br>3. Desentralisasikan kepemilikan kontrak locker ke DAO governance sejati tanpa hak istimewa admin perorangan.                                           | Legal / Core Dev     |
| **GRC-02** 🟡 | Regulasi MiCA (Uni Eropa) | **Tinggi (Inherent 20)**  | 1. Terapkan batasan emisi token di bawah ambang batas EUR 1,000,000 per token.<br>2. Cantumkan dokumen pengungkapan resiko standar (_standardized risk disclaimer_) pada setiap halaman pembuatan token.<br>3. Larang penyesuaian pajak mendadak pasca-peluncuran dengan mewajibkan konfigurasi pajak terkunci permanen sejak inisialisasi.                                           | Compliance / Product |
| **GRC-03** ⏳ | Sanksi OFAC / Circle USDC | **Tinggi (Inherent 20)**  | 1. Integrasikan API oracle skrining sanksi (Chainalysis / TRM Labs) pada backend `SecurityGateService`.<br>2. Terapkan geoblocking DNS/IP untuk negara-negara embargo OFAC (Iran, Korut, Suriah, Kuba, Krimea).<br>3. Tambahkan circuit breaker pemisah dana agar saldo USDC pengguna lain tidak terisolasi jika ada transfer yang terblokir.                                         | Security / DevOps    |
| **GRC-04** 🟡 | Privasi Data (GDPR)       | **Sedang (Inherent 12)**  | 1. Anonimkan IP address pada seluruh error log di `server.ts` menggunakan hashing atau masking subnet (`192.168.1.0/24`).<br>2. Sediakan endpoint API `DELETE /api/users/me/data` yang memungkinkan pengguna menghapus komentar dan preferensi lokal.<br>3. Perbarui `privacy-policy.md` dan `terms-of-service.md` untuk menyertakan klausul GDPR, CCPA, dan operasional Arc Network. | Backend / Legal      |

---

> [WARNING] Laporan kepatuhan ini bersifat analisis pendukung keputusan teknis dan operasional (decision-support advisory) dan tidak menggantikan nasihat hukum formal dari penasihat hukum berkualifikasi (licensed securities counsel). Validasi kepatuhan hukum resmi tetap disarankan sebelum peluncuran komersial skala penuh.

---

## Status Remediasi (2026-10-16)

- **GRC-01** ⏳ TERBUKA — Geoblocking AS, penggantian istilah "dividen", dan struktur governance adalah keputusan legal/bisnis; tidak diubah di kode.
- **GRC-02** 🟡 RESOLVED (sebagian) — Butir 3 sudah terpenuhi: pajak Arc tidak bisa diubah setelah launch (tidak ada setter) dan pajak awal Robinhood terkunci setelah buy publik pertama (S18). Butir 1–2 (batas emisi, disclaimer risiko standar) menunggu keputusan compliance/produk.
- **GRC-03** ⏳ TERBUKA — Skrining sanksi (Chainalysis/TRM) dan geoblocking OFAC butuh keputusan dan kontrak vendor. Catatan teknis: dana USDC tiap token Arc sudah terisolasi per splitter, sehingga satu transfer yang diblokir tidak membekukan saldo token lain.
- **GRC-04** 🟡 RESOLVED (sebagian) — IP di log kini di-hash (`anonymizeIp`); hak penghapusan via `DELETE /api/users/:address/data` (sesi wallet pemilik wajib, juga di test) beserta tombol di Edit Profile; kebijakan privasi (en/id/zh) mencantumkan Arc, data sosial, log, Google Analytics, dan cara penghapusan. Yang tersisa untuk legal: identitas pengendali data/DPO dan banner persetujuan cookie untuk Google Analytics (saat ini dimuat tanpa persetujuan).
