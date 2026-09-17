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
Semua response di-cache via Redis.

### DEX Screener Partner API

Referensi: https://docs.dexscreener.com/api/partner

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/dex/latest-block` | Nomor blok terakhir yang diindex. Cache 5 detik. |
| GET | `/dex/asset?id=<addr>` | Metadata token: nama, simbol, decimals, logo, sosial. Cache 60 detik. |
| GET | `/dex/pair?id=<pool_addr>` | Metadata pool: base/quote token, fee, tick spacing. Cache 30 detik. |
| GET | `/dex/events?fromBlock=&toBlock=&id=<pool>` | Swap events untuk live price feed. Cache 5 detik. |

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

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/api/v1/networks/robinhood/pools/:pool` | Detail pool + volume 24h + tx count. Cache 15 detik. |
| GET | `/api/v1/networks/robinhood/tokens/:addr` | Detail token. Cache 30 detik. |
| GET | `/api/v1/networks/robinhood/pools/:pool/ohlcv/minute` | OHLCV candlestick resolusi 1 menit. |
| GET | `/api/v1/networks/robinhood/pools/:pool/ohlcv/hour` | OHLCV candlestick resolusi 1 jam. |
| GET | `/api/v1/networks/robinhood/pools/:pool/ohlcv/day` | OHLCV candlestick resolusi 1 hari. |
| GET | `/api/v1/networks/robinhood/pools/:pool/trades` | 100 trade terakhir di pool tersebut. |

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

- [ ] API harus bisa diakses dari internet (bukan localhost).
      Deploy ke VPS dengan domain `api.proto.fun` menggunakan workflow
      `.github/workflows/deploy-vps.yml`.
- [ ] CORS header `Access-Control-Allow-Origin: *` harus aktif pada endpoint
      `/dex/*` dan `/api/v1/*` agar crawler agregator bisa mengaksesnya.
      (Sudah diimplementasikan via variabel `CORS_ALLOWED_ORIGINS` — kosongkan
      untuk dev, isi domain spesifik untuk production.)
- [ ] Pastikan rate limit tidak memblokir crawler. IP agregator bisa mengirim
      puluhan request per menit. Naikkan limit di `checkRateLimit` dari 120
      menjadi 500 req/menit untuk path `/dex/*` jika diperlukan.
- [ ] `ROBINHOOD_CHAIN.contracts.weth` harus berisi alamat WETH yang benar
      di `packages/shared-types/src/constants/network.ts`.

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

| File | Keterangan |
|------|-----------|
| `apps/api/src/server.ts` | Semua endpoint DEX Screener + GeckoTerminal ada di sini |
| `apps/api/src/modules/tokens/infrastructure/indexer/event-poller.service.ts` | Event poller yang mengisi tabel trades |
| `packages/shared-types/src/constants/network.ts` | Alamat kontrak per chain |
| `.github/workflows/deploy-vps.yml` | Deploy API ke VPS publik |
