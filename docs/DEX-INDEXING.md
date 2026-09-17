# DEX Indexing — Internal Reference

Status: implemented, awaiting public API deployment + manual submissions.

---

## Problem

Token yang diluncurkan via Proto tidak otomatis muncul di agregator seperti
DEX Screener, GMGN, GeckoTerminal, Birdeye, dll. Agregator tersebut hanya
meng-index chain dan DEX yang sudah mereka kenal. Untuk chain baru (Robinhood
Chain ID 4663 dan Arc Network ID 5042), diperlukan:

1. Implementasi endpoint API sesuai spesifikasi partner masing-masing agregator.
2. Pendaftaran manual (submit form / email) ke masing-masing platform.

---

## Apa yang Sudah Diimplementasikan

Semua endpoint berada di `apps/api/src/server.ts` dan aktif di port 3001.
Semua response di-cache via Redis. Telah mendukung multi-chain penuh untuk
**Robinhood Chain (4663)** dan **Arc Network (5042)**.

### DEX Screener Partner API

Referensi: https://docs.dexscreener.com/api/partner

| Method | Path                                        | Fungsi                                                                |
| ------ | ------------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/dex/latest-block?chain=robinhood\|arc`    | Nomor blok terakhir yang diindex per chain. Cache 5 detik.            |
| GET    | `/dex/asset?id=<addr>`                      | Metadata token: nama, simbol, decimals, logo, sosial. Cache 60 detik. |
| GET    | `/dex/pair?id=<pool_addr>`                  | Metadata pool: base/quote token, fee, tick spacing. Cache 30 detik.   |
| GET    | `/dex/events?fromBlock=&toBlock=&id=<pool>` | Swap events untuk live price feed (ETH/USDC aware). Cache 5 detik.    |

Contoh response `/dex/asset?id=0xABC...`:

```json
{
  "id": "4663_0xABC...",
  "caip19": "eip155:4663/erc20:0xABC...",
  "name": "MyToken",
  "symbol": "MTK",
  "totalSupply": "1000000000000000000000000000",
  "circulatingSupply": "1000000000000000000000000000",
  "coinGeckoId": null,
  "coinMarketCapId": null,
  "decimals": 18,
  "metadata": {
    "description": "...",
    "image": "ipfs://...",
    "twitter": "https://x.com/...",
    "telegram": null,
    "discord": null,
    "website": null
  }
}
```

Contoh response `/dex/pair?id=0xPOOL...`:

```json
{
  "id": "4663_0xPOOL...",
  "dexId": "proto",
  "url": "https://proto.fun/trade/0xTOKEN...",
  "pairAddress": "0xPOOL...",
  "labels": ["proto-v2"],
  "baseToken": { "address": "0xTOKEN...", "name": "MyToken", "symbol": "MTK" },
  "quoteToken": { "address": "0xWETH...", "name": "Wrapped Ether", "symbol": "WETH" },
  "quoteTokenOrder": "token1",
  "fee": 0.01,
  "tickSpacing": 200,
  "hooks": "0x0000000000000000000000000000000000000000"
}
```

Contoh response `/dex/events`:

```json
{
  "events": [
    {
      "block": { "blockNumber": 123456, "blockTimestamp": 1700000000 },
      "eventType": "buy",
      "txnId": "0xTX...",
      "txnIndex": 0,
      "eventIndex": 0,
      "maker": "0xTRADER...",
      "pairId": "4663_0xPOOL...",
      "asset0In": "0.000420",
      "asset1In": "0",
      "asset0Out": "0",
      "asset1Out": "1000000.0000",
      "priceNative": "0.000000000420000000",
      "priceUsd": "0.00000100"
    }
  ]
}
```

### GeckoTerminal / GMGN API

Referensi: https://api.geckoterminal.com/docs
Dukungan dinamis untuk slug network `:network` (`robinhood`, `arc`, `4663`, `5042`).

| Method | Path                                                 | Fungsi                                               |
| ------ | ---------------------------------------------------- | ---------------------------------------------------- |
| GET    | `/api/v1/networks/:network/pools/:pool`              | Detail pool + volume 24h + tx count. Cache 15 detik. |
| GET    | `/api/v1/networks/:network/tokens/:addr`             | Detail token. Cache 30 detik.                        |
| GET    | `/api/v1/networks/:network/pools/:pool/ohlcv/minute` | OHLCV candlestick resolusi 1 menit.                  |
| GET    | `/api/v1/networks/:network/pools/:pool/ohlcv/hour`   | OHLCV candlestick resolusi 1 jam.                    |
| GET    | `/api/v1/networks/:network/pools/:pool/ohlcv/day`    | OHLCV candlestick resolusi 1 hari.                   |
| GET    | `/api/v1/networks/:network/pools/:pool/trades`       | 100 trade terakhir di pool tersebut.                 |

GMGN membaca data dari GeckoTerminal, jadi cukup daftar ke GeckoTerminal.

---

## Langkah Pendaftaran Manual

Semua langkah ini harus dikerjakan oleh owner setelah API di-deploy ke domain publik
(`https://api.proto.fun` atau sejenisnya).

### DEX Screener

1. Kirim email ke **partners@dexscreener.com** dengan subject:
   `Partner API Integration Request — Proto (Robinhood Chain)`

   Isi email:

   ```
   Chain Name       : Robinhood Chain
   Chain ID         : 4663
   RPC URL          : https://rpc.mainnet.chain.robinhood.com
   Block Explorer   : https://robinhoodchain.blockscout.com
   DEX Name         : Proto
   Partner API URL  : https://api.proto.fun
   Protocol Type    : Bonding Curve + Uniswap V3
   Contact          : [email owner]
   ```

2. Untuk Arc Network, kirim email terpisah:

   ```
   Chain Name       : Arc Network
   Chain ID         : 5042
   RPC URL          : https://rpc.mainnet.arc.io
   Block Explorer   : https://explorer.arc.io
   DEX Name         : Proto
   Partner API URL  : https://api.proto.fun
   ```

3. DEX Screener akan memverifikasi endpoint `/dex/latest-block`, `/dex/asset`,
   `/dex/pair`, `/dex/events` secara otomatis setelah review.

Estimasi waktu: 1-2 minggu setelah submission.

### GeckoTerminal

1. Buka: https://www.geckoterminal.com/new-network-requests
2. Isi form:
   - Network Name: `Robinhood Chain`
   - Chain ID: `4663`
   - API Base URL: `https://api.proto.fun/api/v1/networks/robinhood`
   - Explorer: `https://robinhoodchain.blockscout.com`
3. Ulangi untuk Arc Network (Chain ID 5042).

Estimasi waktu: 2-4 minggu.

### GMGN

GMGN (gmgn.ai) tidak memiliki form publik. Mereka menarik data dari GeckoTerminal
secara otomatis setelah chain terdaftar di sana. Tidak perlu submit terpisah.

### Birdeye

1. Buka: https://birdeye.so/developer
2. Klik "List Your DEX" atau hubungi via Telegram: @birdeye_support
3. Birdeye memerlukan WebSocket feed untuk real-time data.
   Pertimbangkan menambahkan SSE/WebSocket endpoint jika diminta.

### DexTools

1. Buka: https://www.dextools.io/app/en/defi-ecosystem
2. Submit via form "Add your DEX": https://dextools.io/partner

---

## Pra-syarat Teknis Sebelum Submit

- [ ] **Deploy API ke Publik**: API harus bisa diakses dari internet publik (bukan localhost).
      Deploy ke VPS dengan domain publik (contoh: `https://api.proto.fun`) menggunakan workflow
      `.github/workflows/deploy-vps.yml`.
- [x] **CORS Wildcard**: Header `Access-Control-Allow-Origin: *` aktif pada semua endpoint
      `/dex/*` dan `/api/v1/*` sehingga crawler agregator tidak terblokir. (SUDAH IMPLEMENTED)
- [x] **Rate Limiting Ramah Crawler**: Batas rate limit untuk rute crawler dinaikkan menjadi
      600 req/menit per IP. (SUDAH IMPLEMENTED)
- [x] **Multi-Chain Support**: Polling dan endpoint `/dex/*` serta `/api/v1/networks/*` mendukung
      kedua chain secara dinamis (Robinhood Chain 4663 & Arc Network 5042). (SUDAH IMPLEMENTED)
- [ ] **WETH & Native Gas Setup**: Pastikan `ROBINHOOD_CHAIN.contracts.weth` dan
      `ARC_CHAIN.contracts.weth` sudah terkonfigurasi dengan token quote resmi di chain masing-masing.

---

## Catatan Arsitektur

- Data yang dikembalikan endpoint `/dex/events` bersumber dari tabel `trades`
  di SQLite lokal, bukan query on-chain secara real-time. Ini berarti event
  baru hanya terindex setelah `EventPollerService` mendeteksinya (polling
  interval default: setiap blok baru, query window 50 blok per cycle).
- Jika volume tinggi, pertimbangkan menaikkan polling frequency atau beralih
  ke WebSocket subscription `eth_subscribe('logs')` untuk latensi rendah.
- Token di Arc Network (Chain ID 5042) belum memiliki endpoint `/api/v1/networks/arc`
  terpisah. Perlu ditambahkan jika Arc ingin didaftarkan ke GeckoTerminal secara
  independen dari Robinhood Chain.

---

## File Terkait

| File                                                                         | Keterangan                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/api/src/server.ts`                                                     | Semua endpoint DEX Screener + GeckoTerminal ada di sini |
| `apps/api/src/modules/tokens/infrastructure/indexer/event-poller.service.ts` | Event poller yang mengisi tabel trades                  |
| `packages/shared-types/src/constants/network.ts`                             | Alamat kontrak per chain                                |
| `.github/workflows/deploy-vps.yml`                                           | Deploy API ke VPS publik                                |
