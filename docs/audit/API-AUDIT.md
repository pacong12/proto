# Audit Keamanan & Arsitektur API Backend Proto (`apps/api/`)

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima; verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT TEKNIS BACKEND  
**Ruang Lingkup**:

- Server & HTTP Routing: `apps/api/src/server.ts`
- Middleware & Core HTTP: `apps/api/src/core/middleware/`, `apps/api/src/core/http/`
- Database & Adapters: `apps/api/src/modules/tokens/infrastructure/adapters/sqlite-token.repository.ts`, `viem-chain-indexer.adapter.ts`
- Event Poller & Indexer: `apps/api/src/modules/tokens/infrastructure/indexer/event-poller.service.ts`
- Autonomous Keeper: `apps/api/src/modules/tokens/infrastructure/keeper/buyback-keeper.service.ts`
- IPFS Storage Engine: `apps/api/src/modules/ipfs/ipfs.service.ts`, `ipfs.controller.ts`
- Domain Services & Aggregations: `apps/api/src/modules/tokens/domain/services/token-aggregation.service.ts`

---

## 1. Ringkasan Eksekutif

Audit komprehensif dilakukan terhadap seluruh lapisan backend API, event indexer, repository database, dan keeper otomatis pada `apps/api/`. Backend Proto bertanggung jawab menyajikan data analitik real-time, grafik candlestick OHLCV, distribusi pemegang saham (_holder distribution_), feed sosial, serta mengindeks peristiwa blockchain on-chain dari Robinhood Chain (4663) dan Arc Network (5042).

Meskipun seluruh 187 unit test API berstatus lulus (_passing_), audit mendalam menemukan **10 kerentanan keamanan dan cacat logika arsitektur**:

- **5 Tingkat Tinggi (High Severity)**: Cacat desimal yang merusak perhitungan pemegang saham, penimpaan konfigurasi pajak tanpa otentikasi, bypass rate limit via IP spoofing, resiko OOM DoS via chunked stream, dan potensi Stored XSS pada penyajian IPFS.
- **4 Tingkat Sedang (Medium Severity)**: Eksploitasi kapasitas disk via IPFS caching arbitrer, query $N+1$ sinkron pada endpoint DEX Screener, batasan array `eth_getLogs` yang mengancam kelangsungan indexer, dan manipulasi metrik sentimen/like tanpa verifikasi kriptografis.
- **1 Tingkat Rendah (Low Severity)**: Ketiadaan rollback buffer terhadap reorganisasi blok (_chain reorg_).

---

## 2. Matriks Temuan Audit API (`apps/api/`)

| ID            | Severity | Komponen Terkait                                              | Ringkasan Kerentanan                                                                                              |
| :------------ | :------- | :------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| **API-01** ✅ | High     | `token-aggregation.service.ts` / `sqlite-token.repository.ts` | **Ketidakcocokan Satuan Desimal Ekstrem (Wei vs Unit) Menghasilkan Persentase 0.00% untuk Semua Pemegang Retail** |
| **API-02** ✅ | High     | `apps/api/src/server.ts:684-772`                              | **Endpoint `POST /api/tokens/:address/sync` Tanpa Otentikasi Memungkinkan Manipulasi Database Konfigurasi Pajak** |
| **API-03** ✅ | High     | `apps/api/src/server.ts:2158-2173`                            | **Header Spoofing `cf-connecting-ip` Memungkinkan Bypass Rate Limiter Penuh di Lingkungan Produksi**              |
| **API-04** ✅ | High     | `apps/api/src/core/http/parse-body.ts`                        | **Streaming Transfer-Encoding Chunked Tanpa Content-Length Memicu Kerentanan Bounded OOM DoS**                    |
| **API-05** ✅ | High     | `apps/api/src/server.ts:1716-1735` / `ipfs.service.ts`        | **Pelayanan Konten IPFS Tanpa Sanitasi Content-Type dan Tanpa CSP Membuka Celah Stored XSS di Domain API**        |
| **API-06** ✅ | Medium   | `apps/api/src/modules/ipfs/ipfs.service.ts:161-190`           | **Pengunduhan CID IPFS Eksternal Tanpa Batas Kuota Folder Menyebabkan Kerentanan Disk Space Exhaustion**          |
| **API-07** ✅ | Medium   | `apps/api/src/server.ts:1881-1923`                            | **Query $N+1$ Serial Sinkron pada `GET /dex/events` Memblokir Event Loop Bun dan Menurunkan Kinerja Server**      |
| **API-08** ✅ | Medium   | `event-poller.service.ts:231-250`                             | **Ketiadaan Batching Array Alamat pada `eth_getLogs` Berisiko Menghentikan Indexing Trade Permanen (RPC 413)**    |
| **API-09** ✅ | Medium   | `apps/api/src/server.ts:1234-1277, 1323-1350`                 | **Ketiadaan Otentikasi Tanda Tangan pada Endpoint Interaksi Sosial (Likes, Reposts, Sentiment Votes)**            |
| **API-10** ✅ | Low      | `event-poller.service.ts:80-110`                              | **Ketiadaan Buffer Konfirmasi Blok Reorg Mengakibatkan Risiko Duplikasi atau Kehilangan Event Indexer**           |

---

## 3. Detail Analisis Teknis & Rencana Remediasi

### API-01: Ketidakcocokan Satuan Desimal Ekstrem (Wei vs Unit) Menghasilkan Persentase 0.00% untuk Semua Pemegang Retail [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Jumlah token dikonversi ke base unit; kreator dihitung dari trade-nya (test diperbarui ke format produksi). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/modules/tokens/domain/services/token-aggregation.service.ts:152-164, 202-230`
  - `apps/api/src/server.ts:338`
- **Akar Masalah**:
  1. Pada `server.ts:338`, saat transaksi perdagangan disimpan ke database, jumlah token diformat sebagai string desimal 4 angka:
     ```typescript
     tokenAmount: tokenAmountNum.toFixed(4); // Contoh: "12500.5000"
     ```
  2. Pada `token-aggregation.service.ts` fungsi `computeHoldersDistribution`:
     ```typescript
     let amount = 0n;
     try {
       amount = BigInt(trade.tokenAmount); // Melempar SyntaxError pada "12500.5000"
     } catch {
       amount = BigInt(Math.floor(Number(trade.tokenAmount) || 0)); // Menghasilkan 12500n (satuan utuh)
     }
     ```
     Saldo trader terakumulasi dalam satuan token utuh (misal $12,500$).
  3. Namun, total pasokan token didefinisikan dalam satuan **WEI** ($18 \text{ desimal}$):
     ```typescript
     let totalSupply = 1_000_000_000n * 10n ** 18n; // 1,000,000,000,000,000,000,000,000,000n
     ```
  4. Demikian pula `deployerInitial` dibaca dari `token.initialBuyAmount` yang bernilai dalam satuan **WEI** (misal $50,000,000 \times 10^{18}$).
  5. Saat menghitung persentase kepemilikan pemegang retail:
     ```typescript
     const pct = Number((bal * 10000n) / totalSupply) / 100;
     // bal = 12500n
     // (12500n * 10000n) / 10^27 = 0n
     ```
- **Dampak**:
  - Seluruh pemegang token retail dihitung memiliki saldo persentase `0.00%`.
  - Pada perhitungan `nonPoolTotal = totalDeployerBalance + totalTraderTokens`, angka berdimensi WEI ($10^{25}$) dijumlahkan dengan angka non-WEI ($10^4$).
  - `poolBalance` dihitung sebagai $\sim 95\%$ hingga $100\%$ dari suplai. Data endpoint `/api/tokens/:address/holders` rusak dan menampilkan informasi kepemilikan yang sepenuhnya salah kepada pengguna dan investor.
- **Rekomendasi Remediasi**:
  Standarisasi representasi saldo token di seluruh alur agregasi. Simpan dan proses saldo dalam bentuk BigInt wei (18 desimal), atau lakukan konversi desimal yang konsisten sebelum komputasi persentase:
  ```typescript
  // Konversi tokenAmount dari string desimal ke satuan wei (18 desimal)
  import { parseUnits } from 'viem';
  const amountWei = parseUnits(trade.tokenAmount, 18);
  ```

---

### API-02: Endpoint `POST /api/tokens/:address/sync` Tanpa Otentikasi Memungkinkan Manipulasi Database Konfigurasi Pajak [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Body `sync` tidak dipercaya; pajak dan split dibaca dari token / hook / splitter. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/server.ts:684-772`
- **Akar Masalah**:
  Endpoint `POST /api/tokens/:address/sync` terbuka untuk publik dan menerima payload:
  ```typescript
  if (body.taxConfig) {
    if (typeof body.taxConfig.buyTaxBps === 'number') buyTaxBps = body.taxConfig.buyTaxBps;
    if (typeof body.taxConfig.sellTaxBps === 'number') sellTaxBps = body.taxConfig.sellTaxBps;
    if (body.taxConfig.taxRecipient) taxRecipient = body.taxConfig.taxRecipient;
    if (body.taxConfig.revenueSplit) revenueSplit = body.taxConfig.revenueSplit;
  }
  ```
  Jika token di blockchain belum memanggil `setInitialTaxConfig` (sehingga pembacaan on-chain `taxConfig()` mengembalikan `[0, 0, address(0)]`), server akan menerima dan menyimpan konfigurasi pajak yang dikirimkan penyerang ke database SQLite, lalu menghapus cache detail token.
- **Dampak**:
  Penyerang dapat menimpa parameter pajak token apa pun di database lokal (misalnya mengubah pajak menjadi 0% atau merekayasa alokasi revenue split) untuk mengelabui pengguna yang melihat antarmuka web, sebelum mengeksploitasi mereka secara on-chain.
- **Rekomendasi Remediasi**:
  1. Hapus penerimaan mutasi `taxConfig` dan `revenueSplit` dari body request sembarang.
  2. Sinkronisasi hanya boleh membaca state resmi secara langsung dari blockchain (`client.readContract`).
  3. Jika mutasi off-chain diizinkan, wajibkan verifikasi tanda tangan kriptografis EIP-712 / personal sign dari alamat `deployer` token resmi.

---

### API-03: Header Spoofing `cf-connecting-ip` Memungkinkan Bypass Rate Limiter Penuh di Lingkungan Produksi [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — IP socket peer secara default; header proxy hanya dengan `TRUST_PROXY=true`. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/server.ts:2158-2173` (`extractClientIp`)
- **Akar Masalah**:
  Implementasi penentuan IP klien:
  ```typescript
  function extractClientIp(req: Request): string {
    const trustProxy = process.env.TRUST_PROXY === 'true';
    const cfConnectingIp = req.headers.get('cf-connecting-ip')?.trim();
    if (cfConnectingIp && (trustProxy || process.env.NODE_ENV === 'production')) {
      return cfConnectingIp;
    }
    if (trustProxy) { ... }
    return '127.0.0.1';
  }
  ```
  Kondisi `process.env.NODE_ENV === 'production'` menyebabkan server mempercayai header `CF-Connecting-IP` secara mutlak tanpa memvalidasi apakah request benar-benar berasal dari IP range resmi Cloudflare.
- **Dampak**:
  1. Klien penyerang dapat mengirimkan header HTTP buatan: `CF-Connecting-IP: 185.220.101.X` yang dirotasi pada setiap request, sehingga rate limiting berbasis IP (`ratelimit:api:<ip>`) menjadi tidak berguna (_100% bypass_).
  2. Di lingkungan selain production (jika `TRUST_PROXY` tidak diaktifkan), fungsi selalu mengembalikan `'127.0.0.1'`. Akibatnya, seluruh pengguna berbagi kuota rate limit yang sama (`ratelimit:api:127.0.0.1`), sehingga 1 pengguna agresif dapat membuat seluruh pengguna lain terkena HTTP 429 _Too Many Requests_.
- **Rekomendasi Remediasi**:
  Periksa IP socket koneksi TCP asli (`req.socket.remoteAddress` atau Bun server client IP) dan hanya percaya header proxy jika IP remote tersebut cocok dengan CIDR proxy terpercaya yang dikonfigurasi.

---

### API-04: Streaming Transfer-Encoding Chunked Tanpa Content-Length Memicu Kerentanan Bounded OOM DoS [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Body dibaca sebagai stream berbatas (test chunked tanpa Content-Length). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/core/http/parse-body.ts:7-16` (`parseJsonBody`)
  - `apps/api/src/modules/ipfs/ipfs.controller.ts:95-175`
- **Akar Masalah**:
  ```typescript
  export async function parseJsonBody<T>(req: Request, maxBytes = 65_536): Promise<T> {
    const cl = req.headers.get('content-length');
    if (cl && parseInt(cl, 10) > maxBytes) {
      throw new PayloadTooLargeError('Payload exceeds maximum allowed size');
    }
    const text = await req.text(); // Membaca SELURUH body ke memori
    if (text.length > maxBytes) {
      throw new PayloadTooLargeError('Payload exceeds maximum allowed size');
    }
    return JSON.parse(text) as T;
  }
  ```
  Pengecekan awal hanya berjalan jika header `content-length` dikirimkan oleh klien. Jika penyerang mengirimkan data menggunakan `Transfer-Encoding: chunked`, `content-length` bernilai null. Panggilan `await req.text()` akan menyerap data streaming tanpa batas ke memori RAM hingga proses selesai sebelum panjang string diperiksa di baris 13.
- **Dampak**:
  Penyerang dapat mengirimkan request streaming berukuran ratusan megabyte atau gigabyte ke endpoint POST mana pun, memicu lonjakan konsumsi memori heap Bun dan menyebabkan crash _Out Of Memory_ (OOM).
- **Rekomendasi Remediasi**:
  Gunakan stream reader dengan pemutus aliran (_circuit breaker_) saat mengakumulasi byte:
  ```typescript
  const reader = req.body?.getReader();
  let receivedBytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.length;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError('Payload exceeds maximum allowed size');
    }
    chunks.push(value);
  }
  ```

---

### API-05: Pelayanan Konten IPFS Tanpa Sanitasi Content-Type dan Tanpa CSP Membuka Celah Stored XSS di Domain API [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Sudah dimitigasi (CSP sandbox + nosniff); kini hanya gambar yang disajikan inline. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/server.ts:1716-1735`
  - `apps/api/src/modules/ipfs/ipfs.service.ts:161-190`
- **Akar Masalah**:
  Saat pengguna mengakses `GET /api/ipfs/:cid`, server mengambil file dari gateway IPFS publik jika belum ada di lokal:
  ```typescript
  const mime = res.headers.get('content-type') || 'image/webp';
  saveLocalFile(cleanCid, buf, mime, `${cleanCid}.bin`);
  ```
  Kemudian di `server.ts`:
  ```typescript
  return new Response(req.method === 'HEAD' ? null : new Uint8Array(file.data), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
  ```
  Respons ini menimpa header keamanan global (`buildSecurityHeaders`) dan tidak menyertakan `Content-Security-Policy` atau `X-Content-Type-Options: nosniff`.
- **Dampak**:
  Jika ada pengguna yang mengunggah file HTML atau SVG yang memuat skrip berbahaya (`<script>alert(document.cookie)</script>`) ke jaringan IPFS publik dan membuka tautannya di `https://api.proto.fun/api/ipfs/<cid>`, browser akan merender file tersebut sebagai dokumen HTML/SVG aktif dalam origin domain API. Hal ini merupakan celah **Stored Cross-Site Scripting (XSS)** langsung.
- **Rekomendasi Remediasi**:
  1. Batasi `Content-Type` yang dilayani hanya pada gambar aman (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).
  2. Untuk SVG atau tipe biner lain, tambahkan header:
     ```typescript
     'Content-Disposition': 'inline; filename="preview"',
     'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
     'X-Content-Type-Options': 'nosniff'
     ```

---

### API-06: Pengunduhan CID IPFS Eksternal Tanpa Batas Kuota Folder Menyebabkan Kerentanan Disk Space Exhaustion [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Konten gateway tidak lagi ditulis ke disk; unduhan berbatas stream. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/modules/ipfs/ipfs.service.ts:17-27, 161-190`
- **Akar Masalah**:
  Setiap pemanggilan `GET /api/ipfs/:cid` yang belum ada di cache lokal akan memicu pengunduhan dari gateway eksternal (hingga 5 MiB per file) dan disimpan secara permanen di filesystem lokal:
  ```typescript
  const filePath = path.join(dir, cleanCid);
  fs.writeFileSync(filePath, buf);
  ```
  Tidak ada batasan ukuran total folder `uploads/`, tidak ada masa kedaluwarsa file (_TTL eviction_), dan tidak ada verifikasi apakah CID tersebut terkait dengan token di database Proto.
- **Dampak**:
  Penyerang dapat menjalankan skrip otomatis yang memanggil ribuan CID acak di IPFS. Server akan terus mengunduh dan menyimpan file hingga kapasitas hard disk VPS habis (`ENOSPC`), menyebabkan crash pada SQLite, kegagalan penulisan log, dan penghentian layanan.
- **Rekomendasi Remediasi**:
  Terapkan kuota penyimpanan maksimum (misal 5 GB) dengan algoritma penggusuran Least-Recently-Used (LRU cache eviction), atau hanya izinkan caching untuk CID yang tercatat di database token Proto.

---

### API-07: Query $N+1$ Serial Sinkron pada `GET /dex/events` Memblokir Event Loop Bun [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Satu query `getTradesInBlockRange` (indeks blok) menggantikan loop per token; jumlah quote tidak lagi dibagi harga USD. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/server.ts:1881-1923`
- **Akar Masalah**:
  Pada endpoint DEX Screener `GET /dex/events` (saat parameter `id` tidak diberikan):
  ```typescript
  const allTokens = await repository.findAll();
  for (const token of allTokens) {
    const quotePriceUsd = await chain.getQuotePriceUsd();
    const trades = await repository.getTrades(token.address, 100, 0);
    // ...
  }
  ```
  Jika database memiliki 200 token, setiap pemanggilan endpoint ini akan menjalankan 200 query `getTrades` dan 200 panggilan kalkulasi harga secara berurutan (_serial $N+1$ query_).
- **Dampak**:
  Waktu respon endpoint membengkak menjadi puluhan detik, memblokir thread event loop Bun, dan menghabiskan sumber daya CPU server saat crawler DEX Screener melakukan polling berkala.
- **Rekomendasi Remediasi**:
  Gunakan 1 query SQL agregat tunggal untuk mengambil transaksi terbaru lintas token:
  ```sql
  SELECT * FROM trades WHERE blockNumber >= ? AND blockNumber <= ? ORDER BY blockNumber DESC LIMIT 500;
  ```

---

### API-08: Ketiadaan Batching Array Alamat pada `eth_getLogs` Berisiko Menghentikan Indexing Trade Permanen (RPC 413) [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `eth_getLogs` dipecah per 50 alamat. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `event-poller.service.ts:231-250`
- **Akar Masalah**:
  ```typescript
  const curveAddresses = v2Tokens.map((t) => t.poolAddress as Address);
  const logs = await this.client.getLogs({
    address: curveAddresses.length === 1 ? curveAddresses[0] : curveAddresses,
    event: TRADE_EVENT,
    fromBlock: from,
    toBlock: to,
  });
  ```
  Ketika jumlah token V2 di sistem bertambah (misalnya mencapai 200-500 token), array `curveAddresses` akan berisi ratusan alamat kontrak. Sebagian besar node RPC EVM publik dan privat memiliki batasan ketat terhadap jumlah alamat dalam array filter `eth_getLogs` (maksimum 100 alamat), dan akan melempar error `413 Request Entity Too Large` atau timeout.
- **Dampak**:
  Panggilan `pollV2Trades` akan selalu gagal di blok `catch`, dan server berhenti mengindeks seluruh transaksi perdagangan V2 baru di blockchain.
- **Rekomendasi Remediasi**:
  Bagi array `curveAddresses` menjadi chunk kecil (maksimal 50 alamat per batch), atau lakukan polling event `TRADE_EVENT` tanpa membatasi alamat (`address: undefined`) lalu filter berdasarkan kurva yang terdaftar di memori.

---

### API-09: Ketiadaan Otentikasi Tanda Tangan pada Endpoint Interaksi Sosial [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Like, repost dan vote sentimen mewajibkan token sesi HMAC 24 jam dari satu tanda tangan wallet; vote anonim dihapus (test `session-auth.spec.ts`). Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `apps/api/src/server.ts:1234-1277` (Like/Repost)
  - `apps/api/src/server.ts:1323-1350` (Sentiment)
- **Akar Masalah**:
  Endpoint `POST /api/comments/:commentId/like`, `POST /api/comments/:commentId/repost`, dan `POST /api/tokens/:address/sentiment` hanya menerima string `userAddress` di body JSON tanpa memverifikasi tanda tangan kriptografis dari dompet tersebut:
  ```typescript
  const body = await parseJsonBody<{ userAddress?: string; sentiment?: string }>(req);
  await repository.voteTokenSentiment?.(address, userAddress, sentiment);
  ```
- **Dampak**:
  Penyerang dapat mengirimkan ribuan request otomatis untuk memalsukan suara sentimen (bullish/bearish) atau jumlah like/repost atas nama alamat dompet mana pun (termasuk alamat whale/influencer), memanipulasi algoritma _trending_ dan _sentiment gauge_.
- **Rekomendasi Remediasi**:
  Terapkan skema verifikasi tanda tangan dompet yang konsisten dengan posting komentar (`buildCommentSignMessage` / `verifyMessage`).

---

### API-10: Ketiadaan Buffer Konfirmasi Blok Reorg Mengakibatkan Risiko Duplikasi atau Kehilangan Event Indexer [Low] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Indexer tertinggal `INDEXER_CONFIRMATIONS` blok (default 2) dari head. Lihat [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

- **Lokasi Kode**:
  - `event-poller.service.ts:80-110`
- **Akar Masalah**:
  Poller memajukan `lastPolledBlock` ke `batchEnd` segera setelah sukses:
  ```typescript
  const startBlock = this.lastPolledBlock > 0n ? this.lastPolledBlock + 1n : ...;
  ```
  Poller tidak memiliki _confirmation depth_ (misalnya membaca mundur 2-3 blok dari head terkini). Jika jaringan Arbitrum Nitro atau Arc mengalami reorg minor 1 blok, event yang dibatalkan oleh jaringan akan tetap tersimpan di database lokal tanpa rekonsiliasi.
- **Dampak**:
  Inkonsistensi data transaksi historis antara database lokal dan ledger blockchain final.
- **Rekomendasi Remediasi**:
  Terapkan kedalaman konfirmasi minimal 2-3 blok, atau simpan block hash untuk mendeteksi reorg dan memicu re-index pada blok yang berubah.
