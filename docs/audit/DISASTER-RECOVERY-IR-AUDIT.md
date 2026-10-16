# Audit Disaster Recovery, Incident Response & Circuit Breakers (CSOC Operations)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima, ⏳ = terbuka (butuh keputusan legal/bisnis); verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT OPERASIONAL & KESIAPSIAGAAN INSIDEN  
**Ruang Lingkup Pemeriksaan**:

- Smart Contract Circuit Breakers: `BondingCurve.sol`, `LaunchpadV2Factory.sol`, `LaunchpadV2FactoryArc.sol`, `ProtoLiquidityLockerV4.sol`, `HolderFeeDistributor.sol`
- RPC Resiliency & Failover: `apps/api/src/server.ts`, `apps/frontoffice/src/lib/viem-client.ts`, `buyback-keeper.service.ts`
- Database Disaster Recovery: `apps/api/src/modules/tokens/infrastructure/adapters/sqlite-token.repository.ts`, `apps/api/entrypoint.sh`, `scripts/backfill-tokens.ts`
- CSOC Incident Response & Alert Triage: Prosedur penanganan eksploitasi aktif, matriks eskalasi P1–P4, dan SLA penanggulangan insiden on-chain.

---

## 1. Ringkasan Eksekutif

Audit kesiapsiagaan insiden (_Cyber Security Operations Center / CSOC_) ini mengevaluasi kemampuan protokol Proto untuk mendeteksi, menghentikan (_contain_), dan memulihkan diri (_recover_) dari kegagalan operasional parah, eksploitasi smart contract on-chain, pemadaman node RPC, serta korupsi database SQLite lokal.

Audit mengidentifikasi **6 kerentanan operasional dan celah kesiapsiagaan kritis**:

1. **Ketiadaan Total Mekanisme Emergency Pause On-Chain (_The Zero-Pause Vulnerability_)**:
   Tidak ada satu pun smart contract di `contracts/src/` yang memiliki fungsi `pause()` atau modifier `whenNotPaused`. Jika eksploitasi aktif terdeteksi di mainnet (seperti pengurasan likuiditas S1 atau pencurian fee S2), tim CSOC **tidak memiliki instrumen teknis on-chain untuk menghentikan pengurasan dana secara instan**.
2. **Ketergantungan Titik Tunggal RPC (_Single RPC Point of Failure_) pada Backend API**:
   Meskipun konfigurasi jaringan memiliki daftar multi-RPC, `server.ts` hanya meneruskan 1 URL RPC tunggal dengan `retryCount: 0`. Pemadaman sementara pada RPC publik Robinhood atau Arc langsung melumpuhkan seluruh event poller dan keeper.
3. **Resiko Kebuntuan Transaksi (_Nonce Deadlock_) pada Autonomous Keeper**:
   `BuybackKeeperService` tidak memiliki logika penggantian gas (_speed-up / replacement transaction_) atau pelacakan nonce persisten, berisiko mengalami kebuntuan antrian transaksi jika RPC melambat.
4. **Ketiadaan Prosedur Pencadangan & Pemulihan Database SQLite (_Disaster Recovery Absence_)**:
   Database `proto.sqlite` berjalan dalam mode WAL tanpa pencadangan otomatis (_hot backup_), tanpa replikasi off-site, dan tanpa pemeriksaan integritas saat booting kontainer.
5. **Ketiadaan Runbook Penanganan Insiden On-Chain Terstruktur**:
   Protokol tidak memiliki ambang batas peringatan (_alert thresholds_) untuk mendeteksi penurunan likuiditas ekstrem atau anomali penarikan dana.
6. **Ketiadaan Skrip Rollback Reorganisasi Blok (Reorg Remediation)**.

---

## 2. Matriks Temuan Audit CSOC & Disaster Recovery

| ID           | Severity        | Komponen Terkait                                                             | Ringkasan Kerentanan                                                                                   |
| :----------- | :-------------- | :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **DR-01** ✅ | High (Critical) | `BondingCurve.sol` / `LaunchpadV2Factory.sol` / `ProtoLiquidityLockerV4.sol` | **Ketiadaan Emergency Circuit Breaker (Pausable) Membiarkan Eksploitasi Menguras Dana Tanpa Halangan** |
| **DR-02** ✅ | High            | `apps/api/src/server.ts:80`                                                  | **Backend API Hanya Menggunakan 1 URL RPC Tanpa Fallback Transport (`retryCount: 0`)**                 |
| **DR-03** ✅ | High            | `buyback-keeper.service.ts:104-136`                                          | **Ketiadaan Manajemen Nonce & Escalation Gas Membuka Resiko Stuck Transaction Deadlock pada Keeper**   |
| **DR-04** 🟡 | Medium          | `sqlite-token.repository.ts` / `entrypoint.sh`                               | **Ketiadaan Snapshot Otomatis & Pemulihan Integritas Membuka Resiko Malformed Database Pasca-Crash**   |
| **DR-05** ❌ | Medium          | `apps/frontoffice/src/lib/viem-client.ts:59-82`                              | **Frontend Menggunakan Klien Publik Statis Tanpa Pemantauan Kesehatan RPC Real-Time**                  |
| **DR-06** ✅ | Low             | `scripts/backfill-tokens.ts`                                                 | **Skrip Backfill Bencana Mengabaikan Penyelarasan State Pasar (Market Data & Candlestick)**            |

---

## 3. Analisis Mendalam Temuan

### DR-01: Ketiadaan Emergency Circuit Breaker (Pausable) Membiarkan Eksploitasi Menguras Dana Tanpa Halangan [Critical] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `EmergencyPause` di kedua factory: owner atau `guardian` (env `EMERGENCY_GUARDIAN` saat deploy) dapat menjeda; hanya owner yang dapat melanjutkan. Saat dijeda, launch, buy di kurva, dan graduasi ditolak. Sell di kurva, swap di pool, dan klaim fee sengaja tidak pernah bisa dijeda agar admin tidak bisa mengunci dana pengguna. Test: `test_EmergencyPause_*`.

- **Komponen**: `BondingCurve.sol`, `LaunchpadV2Factory.sol`, `LaunchpadV2FactoryArc.sol`, `ProtoLiquidityLockerV4.sol`, `HolderFeeDistributor.sol`
- **Akar Masalah**:
  Seluruh smart contract protokol tidak mengimplementasikan kontrak OpenZeppelin `Pausable` atau modifier penjaga darurat `whenNotPaused`.
  Satu-satunya fungsi penarikan darurat yang tersedia adalah:
  - `BondingCurve.emergencyWithdraw()`: Hanya dapat dipanggil setelah $180 \text{ hari}$ (`MIGRATION_DEADLINE`) dan mewajibkan `graduated == true`.
  - `BuybackBurner.emergencyWithdrawWeth()`: Terbatas hanya pada saldo WETH modul buyback.
- **Skenario Bencana Operasional**:
  1. Penyerang mendeteksi harga terbalik pada graduasi kurva (Temuan S1 / Rantai Alpha) atau menemukan celah pengurasan saldo global di `ProtoLiquidityLockerV4.claimFees` (Temuan S2 / Rantai Bravo).
  2. Bot penyerang mulai mengirimkan transaksi pengurasan blok demi blok.
  3. Tim pemantau CSOC mendeteksi anomali dalam 5 menit pertama.
  4. **Respons Terhambat**: Tim CSOC tidak memiliki fungsi administratif apa pun untuk menjeda kurva (`pauseCurve()`), menghentikan trading (`pauseTrading()`), atau memblokir penarikan fee (`pauseClaim()`).
  5. Penyerang memiliki waktu berjam-jam untuk menyedot 100% dana dari seluruh pool yang aktif sebelum tim pengembang dapat merancang dan men-deploy kontrak baru.
- **Dampak**:
  Kerugian modal total (_total liquidity drain_) tanpa ada mekanisme mitigasi teknis untuk membendung eksploitasi yang sedang berlangsung.
- **Rekomendasi Remediasi**:
  Implementasikan modul `EmergencyPausable` dengan otorisasi multi-sig darurat (_Emergency Guardian Role_):
  ```solidity
  import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

  contract BondingCurve is Pausable {
      function buyFor(...) external payable nonReentrant whenNotPaused returns (...) { ... }
      function sell(...) external nonReentrant whenNotPaused returns (...) { ... }
      function pause() external onlyFactory { _pause(); }
      function unpause() external onlyFactory { _unpause(); }
  }
  ```

---

### DR-02: Backend API Hanya Menggunakan 1 URL RPC Tanpa Fallback Transport (`retryCount: 0`) [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `apps/api/src/core/rpc.ts`: transport `fallback` viem melintasi semua `rpcUrls` (retry 1x per endpoint) untuk server, keeper, dan skrip backfill.

- **Komponen**: `apps/api/src/server.ts:80`
- **Akar Masalah**:
  Pada `server.ts`:
  ```typescript
  function createClientForNetwork(cfg: NetworkConfig) {
    const c = defineChain({
      id: cfg.chainId,
      name: cfg.name,
      nativeCurrency: cfg.nativeCurrency,
      rpcUrls: {
        default: { http: [cfg.rpcUrl] },
      },
    });
    return createPublicClient({
      chain: c,
      transport: http(cfg.rpcUrl, { retryCount: 0, timeout: 10_000 }),
    });
  }
  ```
  Meskipun `NetworkConfig.rpcUrls` mendefinisikan hingga 4 endpoint RPC alternatif (misalnya untuk Arc Network: `rpc.mainnet.arc.io`, `rpc.blockdaemon.mainnet.arc.io`, `rpc.drpc.mainnet.arc.io`, `arc.drpc.org`), backend API **hanya mengikat pada 1 URL tunggal** `cfg.rpcUrl` dan menonaktifkan percobaan ulang (`retryCount: 0`).
- **Dampak**:
  Jika endpoint RPC publik mengalami gangguan jaringan selama 30 detik (seperti pemeliharaan node, lonjakan trafik L2, atau rate limit HTTP 429):
  - `event-poller.service.ts` langsung gagal di setiap siklus polling.
  - Pengindeksan transaksi perdagangan baru terhenti total.
  - Server mengembalikan data kadaluarsa (_stale market data_) kepada ribuan pengguna aktif.
- **Rekomendasi Remediasi**:
  Gunakan `fallback()` transport bawaan Viem dengan failover otomatis ke daftar `cfg.rpcUrls`:
  ```typescript
  import { fallback, http } from 'viem';

  function createClientForNetwork(cfg: NetworkConfig) {
    const urls = cfg.rpcUrls && cfg.rpcUrls.length > 0 ? cfg.rpcUrls : [cfg.rpcUrl];
    const transport = fallback(
      urls.map((u) => http(u, { timeout: 8000, retryCount: 2, retryDelay: 500 })),
      { rank: true },
    );
    return createPublicClient({ chain: c, transport });
  }
  ```

---

### DR-03: Ketiadaan Manajemen Nonce & Escalation Gas Membuka Resiko Stuck Transaction Deadlock pada Keeper [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Keeper v4 tidak mengirim transaksi baru selama nonce `pending > latest`, menunggu receipt per transaksi, dan setelah 5 menit mengganti transaksi macet dengan self-transfer 0 berbiaya +50% pada nonce yang sama (test). `BuybackKeeperService` V3 yang dirujuk audit tidak pernah dipasang di server (kode mati).

- **Komponen**: `apps/api/src/modules/tokens/infrastructure/keeper/buyback-keeper.service.ts:104-136`
- **Akar Masalah**:
  Keeper mengirim transaksi buyback ke blockchain menggunakan:
  ```typescript
  const hash = await this.walletClient.writeContract({
    address: burnerAddress,
    abi: buybackBurnerAbi,
    functionName: 'executeBuyback',
    args: [minAmountOut],
    account,
    chain: this.walletClient.chain,
  });
  const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
  ```
  Jika node RPC mengalami timeout saat menunggu tanda terima blok (`waitForTransactionReceipt`), blok `catch` menangkap error dan mengembalikan `{ executed: false }`.
  Pada siklus berikutnya, karena transaksi sebelumnya masih menggantung di mempool (_pending_), panggilan baru ke `writeContract` akan:
  1. Gagal dengan pesan error `Replacement transaction underpriced` jika mencoba menggunakan nonce yang sama tanpa kenaikan gas minimal 10%.
  2. Atau, jika wallet client mengambil nonce berikutnya, seluruh transaksi berikutnya akan tertahan di mempool (_stuck queue_) hingga transaksi pertama berhasil di-mine atau dibatalkan.
- **Dampak**:
  Layanan keeper otomatis mengalami kebuntuan (_deadlock_) dan berhenti menjalankan program buyback-and-burn untuk seluruh token protokol.
- **Rekomendasi Remediasi**:
  Terapkan pelacakan status transaksi aktif dan mekanisme pembatalan/akselerasi gas:
  ```typescript
  // Jika transaksi pending melewati batas waktu 60s, kirim transaksi pengganti dengan gas 1.2x
  if (pendingTxAge > 60_000) {
    await speedUpTransaction(walletClient, account, pendingNonce, lastGasPrice * 1.2n);
  }
  ```

---

### DR-04: Ketiadaan Snapshot Otomatis & Pemulihan Integritas Membuka Resiko Malformed Database Pasca-Crash [Medium] — 🟡 RESOLVED (sebagian)

> **Status: 🟡 RESOLVED (sebagian) (2026-10-16)** — Saat start, `PRAGMA quick_check`; file rusak (beserta WAL/SHM) dipindahkan ke `*.corrupt-<waktu>` lalu backup sehat terbaru dipulihkan (atau mulai kosong dan re-index dari chain). Backup panas harian `VACUUM INTO` di `data/backups` (simpan 7, `DB_BACKUP_INTERVAL_MS`/`DB_BACKUP_KEEP`). Diuji di vitest dan Bun. Salinan off-site (S3 dsb.) masih tugas operasional.

- **Komponen**: `apps/api/src/modules/tokens/infrastructure/adapters/sqlite-token.repository.ts`, `apps/api/entrypoint.sh`
- **Akar Masalah**:
  1. Database SQLite berjalan dalam mode WAL (`PRAGMA journal_mode = WAL`). Dalam mode ini, penulisan transaksi dilakukan ke file pendamping `.sqlite-wal` sebelum di-checkpoint ke file utama `.sqlite`.
  2. Jika proses kontainer Bun di-restart paksa (`kill -9`, kehabisan memori OOM, atau server VPS reboot mendadak), file WAL dapat mengalami _torn write_.
  3. Pada saat server booting kembali, tidak ada instruksi `PRAGMA integrity_check;` yang dijalankan di `entrypoint.sh` atau konstruktor repository. Server akan langsung beroperasi di atas database yang berpotensi rusak (_malformed_), yang dapat memicu crash acak di tengah jam kerja.
  4. Tidak ada penjadwalan pencadangan otomatis (_automated backup_) ke direktori penyimpanan terisolasi atau bucket S3.
- **Dampak**:
  Kehilangan data riwayat perdagangan, lilin candlestick, komentar sosial, dan metrik sentimen jika terjadi kerusakan fisik pada file database.
- **Rekomendasi Remediasi**:
  1. Tambahkan pemeriksaan integritas otomatis pada saat start server di `entrypoint.sh`:
     ```sh
     sqlite3 /app/data/proto.sqlite "PRAGMA quick_check;" || {
       echo "Database corrupted! Attempting recovery..."
       sqlite3 /app/data/proto.sqlite ".recover" | sqlite3 /app/data/proto_recovered.sqlite
       mv /app/data/proto_recovered.sqlite /app/data/proto.sqlite
     }
     ```
  2. Jadwalkan cron job pencadangan panas harian menggunakan `sqlite3 /app/data/proto.sqlite ".backup '/backup/proto-$(date +%Y%m%d).sqlite'"`.

---

## 4. Runbook Pemulihan Bencana Database (Disaster Recovery Runbook)

Jika database lokal `proto.sqlite` hilang, terhapus, atau mengalami korupsi data total, tim operasional CSOC harus mengikuti langkah pemulihan deterministik berikut:

```
[Insiden: proto.sqlite Rusak / Malformed]
                     │
                     ▼
[Langkah 1: Hentikan Kontainer API untuk Mencegah Penulisan Tambahan]
   docker compose stop api
                     │
                     ▼
[Langkah 2: Coba Pemulihan Lokal via Perintah .recover]
   sqlite3 data/proto.sqlite ".recover" | sqlite3 data/proto_fixed.sqlite
   mv data/proto_fixed.sqlite data/proto.sqlite
                     │
                     ├─► Berhasil? ──► [Langkah 4: Jalankan Ulang Layanan API]
                     │
                     ▼ Gagal / File Hilang
[Langkah 3: Pemulihan Penuh dari Blockchain (Full Ledger Re-indexing)]
   rm -f data/proto.sqlite data/proto.sqlite-*
   docker compose up -d api
   # Jalankan skrip backfill bersejarah dari Genesis Factory:
   bun run scripts/backfill-tokens.ts --chain robinhood --from 0 --to latest
   bun run scripts/backfill-tokens.ts --chain arc --from 0 --to latest
                     │
                     ▼
[Langkah 4: Jalankan Ulang Layanan API & Verifikasi Endpoint]
   curl -sf http://127.0.0.1:3011/health
   curl -sf http://127.0.0.1:3011/api/tokens | jq '.data | length'
```

---

## 5. Playbook Respons Insiden On-Chain CSOC (Smart Contract Security Breach)

Playbook ini dirancang untuk analis CSOC saat terjadi anomali keuangan on-chain pada kurva bonding atau liquidity locker Proto:

### Fase 1: Deteksi & Triase Cepat (SLA: < 15 Menit)

- **Kondisi Pemicu Alarm P1 (Kritis)**:
  1. Penurunan saldo ETH/USDC pada kontrak `ProtoLiquidityLockerV4` atau `BondingCurve` $> 20\%$ dalam 1 blok.
  2. Panggilan berulang ke fungsi `claimFees` dari deployer yang sama dalam rentang $< 60 \text{ detik}$.
  3. Pemanggilan `_prepareGraduationV4` dengan harga spot yang menyimpang $> 500\%$ dari kurva trading.
- **Aksi Analis**:
  - Konfirmasi kebenaran transaksi di block explorer (RobinScan / Arc Explorer).
  - Tentukan apakah transaksi adalah perdagangan paus normal atau eksploitasi smart contract.

### Fase 2: Penahanan Darurat / Containment (SLA: < 30 Menit)

1. **Frontend Disabling**:
   Jika kontrak belum memiliki fungsi pause, segera alihkan antarmuka frontend ke mode pemeliharaan (_maintenance mode_) melalui Cloudflare Worker proxy untuk mencegah pengguna awam berinteraksi dengan pool yang bermasalah.
2. **Keeper Shutdown**:
   Hentikan proses keeper otomatis untuk mencegah kerugian dana buyback:
   `docker compose stop api` atau matikan worker service keeper.
3. **Pemberitahuan Tim Inti**:
   Buka ruang koordinasi darurat (_war room_) dan libatkan lead smart contract developer serta penasihat keamanan.

### Fase 3: Eradikasi & Remediasi (Eradication)

1. Analisis bytecode dan calldata penyerang untuk mereproduksi celah eksploitasi secara lokal di Foundry.
2. Siapkan kontrak penambal (_patched contract_) dengan migrasi saldo yang tersisa.
3. Jika kurva terdampak telah lulus graduasi, koordinasikan dengan tim operator validator jaringan atau DEX Uniswap jika pembekuan likuiditas memungkinkan.

### Fase 4: Pemulihan & Analisis Pasca-Insiden (Post-Mortem)

1. Publikasikan laporan keterbukaan insiden (_Post-Mortem Incident Report_) transparan kepada komunitas.
2. Perbarui aturan deteksi Slither dan integrasikan circuit breaker on-chain permanen.

---

## 6. Matriks Eskalasi & Tingkat Keparahan CSOC

| Tingkat         | Kriteria Insiden                                                                                | Waktu Respons (SLA) | Tim yang Dilibatkan          | Tindakan Utama                                                                     |
| :-------------- | :---------------------------------------------------------------------------------------------- | :------------------ | :--------------------------- | :--------------------------------------------------------------------------------- |
| **P1 — Kritis** | Eksploitasi aktif on-chain, pengurasan likuiditas pool, kebocoran private key deployer.         | **15 Menit**        | CSOC Lead + Core Dev + Legal | Buka War Room, aktifkan pause on-chain / Cloudflare maintenance, hentikan keeper.  |
| **P2 — Tinggi** | Pemadaman node RPC utama, kegagalan event poller $> 30 \text{ menit}$, error rate API $> 10\%$. | **30 Menit**        | Backend On-Call + DevOps     | Alihkan ke RPC cadangan, verifikasi reorg blockchain, reboot container bermasalah. |
| **P3 — Sedang** | Korupsi data lokal pada 1 token, kegagalan refresh dividen, anomali vote sentimen.              | **2 Jam**           | Backend Dev                  | Jalankan sinkronisasi ulang token spesifik via endpoint backfill manual.           |
| **P4 — Rendah** | Kesalahan visual grafis, typo dokumen, peringatan log non-fatal.                                | **12 Jam**          | Tim Dokumentasi / UI         | Perbaiki di siklus rilis sprint berikutnya.                                        |

---

## Status Remediasi (2026-10-16)

- **DR-01** ✅ RESOLVED — `EmergencyPause` di kedua factory: owner atau `guardian` (env `EMERGENCY_GUARDIAN` saat deploy) dapat menjeda; hanya owner yang dapat melanjutkan. Saat dijeda, launch, buy di kurva, dan graduasi ditolak. Sell di kurva, swap di pool, dan klaim fee sengaja tidak pernah bisa dijeda agar admin tidak bisa mengunci dana pengguna. Test: `test_EmergencyPause_*`.
- **DR-02** ✅ RESOLVED — `apps/api/src/core/rpc.ts`: transport `fallback` viem melintasi semua `rpcUrls` (retry 1x per endpoint) untuk server, keeper, dan skrip backfill.
- **DR-03** ✅ RESOLVED — Keeper v4 tidak mengirim transaksi baru selama nonce `pending > latest`, menunggu receipt per transaksi, dan setelah 5 menit mengganti transaksi macet dengan self-transfer 0 berbiaya +50% pada nonce yang sama (test). `BuybackKeeperService` V3 yang dirujuk audit tidak pernah dipasang di server (kode mati).
- **DR-04** 🟡 RESOLVED (sebagian) — Saat start, `PRAGMA quick_check`; file rusak (beserta WAL/SHM) dipindahkan ke `*.corrupt-<waktu>` lalu backup sehat terbaru dipulihkan (atau mulai kosong dan re-index dari chain). Backup panas harian `VACUUM INTO` di `data/backups` (simpan 7, `DB_BACKUP_INTERVAL_MS`/`DB_BACKUP_KEEP`). Diuji di vitest dan Bun. Salinan off-site (S3 dsb.) masih tugas operasional.
- **DR-05** ❌ TIDAK VALID — Frontend sudah memakai transport `fallback` viem ke semua RPC yang dikonfigurasi (4 endpoint Arc) sejak sebelum audit ini; failover terjadi otomatis.
- **DR-06** ✅ RESOLVED — `scripts/backfill-tokens.ts` ditulis ulang: menjalankan indexer API sendiri (`EventPollerService.indexRange`) sehingga launch, graduasi, trade, dan market data/candle dibangun ulang persis seperti poller; kursor poller live tidak digeser. Skrip lama juga rusak (ABI event dan konstruktor repository usang). Diuji terhadap RPC Arc asli.
