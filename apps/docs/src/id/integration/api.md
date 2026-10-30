# Public API

Aplikasi goton.fun membaca semua datanya dari API JSON publik yang hanya-baca di `https://goton.fun`. Integrator, bot dan dashboard dapat memakai endpoint yang sama. Respons dibungkus sebagai `{ "success": true, "data": …, "timestamp": … }`; jika gagal, respons berisi `success: false` dengan `error.code` dan `error.message`.

Semua alamat berformat hex (`0x…`, 40 karakter). `chainId` bernilai `4663` untuk Robinhood Chain dan `5042` untuk Arc Network. Endpoint dibatasi lajunya (rate limit), dan respons di-cache selama beberapa detik.

---

## Token

| Endpoint                                                    | Hasil                                                                                     |
| :---------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `GET /api/tokens?limit=&offset=&deployer=`                  | Token beserta data pasarnya (maksimal 100 per halaman)                                    |
| `GET /api/tokens/{address}`                                 | Satu token dan data pasarnya                                                              |
| `GET /api/tokens/{address}/ohlcv?resolution=&fillGaps=true` | Candle; `resolution` dalam detik: 1, 60, 300, 900, 3600, 14400, 86400                     |
| `GET /api/tokens/{address}/trades?limit=`                   | Transaksi terbaru, dari yang paling baru                                                  |
| `GET /api/tokens/{address}/holders`                         | Holder terbesar dengan saldo (unit mentah) dan porsi suplai                               |
| `GET /api/tokens/{address}/top-traders?limit=`              | Beli, jual, kepemilikan dan profit (USD) per dompet                                       |
| `GET /api/tokens/{address}/flow?window=5m\|1h\|6h\|24h`     | Volume beli vs jual dan jumlah trader                                                     |
| `GET /api/sparklines?chainId=`                              | Untuk tiap token, pergerakan harganya sejak peluncuran hingga sekarang (sekitar 40 titik) |
| `GET /api/memestock?chainId=`                               | Peluncuran terkurasi beserta sinyalnya (lihat [Memestock](/id/protocol/social#memestock)) |
| `GET /api/analytics?chainId=`                               | Total protokol untuk satu chain (kosongkan `chainId` untuk semua chain)                   |

## Order

| Endpoint                                                       | Hasil                                                                    |
| :------------------------------------------------------------- | :----------------------------------------------------------------------- |
| `GET /api/orders?owner=&token=&status=open\|filled\|cancelled` | Order limit, take-profit dan stop-loss; `owner` atau `token` wajib diisi |

Setiap order berisi `status`, `deadline`, `amount` deposit, batas minimum (`minOut`, `slMinOut`), pemicu stop `slPriceX36` dan, setelah ditutup, `filledLeg`, `amountOut` serta `closedTx`. Jumlah ditulis dalam unit mentah on-chain.

## Sosial

| Endpoint                                               | Hasil                                                             |
| :----------------------------------------------------- | :---------------------------------------------------------------- |
| `GET /api/feed`                                        | Call di semua token                                               |
| `GET /api/users/{address or username}/follows?viewer=` | Jumlah follower dan following, serta apakah `viewer` mengikutinya |
| `GET /api/users/{address or username}/followers`       | Akun yang mengikuti pengguna ini                                  |
| `GET /api/users/{address or username}/following`       | Akun yang diikuti pengguna ini                                    |

Memposting call, like dan follow membutuhkan sesi yang ditandatangani dompet dan ditujukan untuk aplikasi, bukan untuk integrator.

## Adapter DEX Screener

Goton mengimplementasikan [Adapter DEX Screener](https://dexscreener.notion.site/DEX-Screener-Adapter-Specs-cc1223cdf6e74a7799599106b65dcd0e) (v1.1, `dexKey: goton`), satu adapter per chain: `https://goton.fun/dex/robinhood` dan `https://goton.fun/dex/arc`.

| Endpoint                                      | Hasil                                                            |
| :-------------------------------------------- | :--------------------------------------------------------------- |
| `GET /dex/{chain}/latest-block`               | Blok terakhir yang sudah disimpan indexer, dengan timestamp UNIX |
| `GET /dex/{chain}/asset?id={address}`         | Token, atau aset quote (WETH di Robinhood Chain, USDC di Arc)    |
| `GET /dex/{chain}/pair?id={pairId}`           | Pair: token sebagai `asset0`, quote sebagai `asset1`             |
| `GET /dex/{chain}/events?fromBlock=&toBlock=` | Event swap dalam rentang blok (inklusif), dari yang paling lama  |

Sebuah token diperdagangkan di dua pair selama hidupnya. Sebelum graduate, id pair-nya adalah **alamat bonding curve** (`0x` + 40 hex); pool Uniswap v4-nya, setelah graduate di Robinhood Chain atau sejak peluncuran di Arc, dikenali dengan **poolId v4** (`0x` + 64 hex), karena pool v4 berada di dalam PoolManager. Jumlah sudah dalam satuan desimal, `priceNative` adalah harga token dalam aset quote, dan `blockTimestamp` dalam detik.

Lihat [Listing DEX & Agregator](/id/integration/listing-submission) untuk event on-chain di balik endpoint ini.
