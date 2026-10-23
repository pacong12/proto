# Public API

The goton.fun app reads everything from a public, read-only JSON API at `https://goton.fun`. Integrators, bots and dashboards can use the same endpoints. Responses are wrapped as `{ "success": true, "data": …, "timestamp": … }`; errors return `success: false` with an `error.code` and `error.message`.

All addresses are hex (`0x…`, 40 characters). `chainId` is `4663` for Robinhood Chain and `5042` for Arc Network. Endpoints are rate limited; responses are cached for a few seconds.

---

## Tokens

| Endpoint                                                    | Returns                                                                           |
| :---------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `GET /api/tokens?limit=&offset=&deployer=`                  | Tokens with market data (max 100 per page)                                        |
| `GET /api/tokens/{address}`                                 | One token and its market data                                                     |
| `GET /api/tokens/{address}/ohlcv?resolution=&fillGaps=true` | Candles; `resolution` in seconds: 1, 60, 300, 900, 3600, 14400, 86400             |
| `GET /api/tokens/{address}/trades?limit=`                   | Recent trades, newest first                                                       |
| `GET /api/tokens/{address}/holders`                         | Largest holders with balance (raw units) and share of supply                      |
| `GET /api/tokens/{address}/top-traders?limit=`              | Per-wallet buys, sells, holding and profit (USD)                                  |
| `GET /api/tokens/{address}/flow?window=5m\|1h\|6h\|24h`     | Buy vs sell volume and trader counts                                              |
| `GET /api/sparklines?chainId=`                              | Per token, its price path from launch to now (about 40 points)                    |
| `GET /api/memestock?chainId=`                               | Curated launches with their signals (see [Memestock](/protocol/social#memestock)) |
| `GET /api/analytics?chainId=`                               | Protocol totals for one chain (omit `chainId` for all chains)                     |

## Orders

| Endpoint                                                       | Returns                                                                 |
| :------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `GET /api/orders?owner=&token=&status=open\|filled\|cancelled` | Limit, take-profit and stop-loss orders; `owner` or `token` is required |

Each order includes its `status`, `deadline`, deposit `amount`, floors (`minOut`, `slMinOut`), the stop trigger `slPriceX36` and, once closed, `filledLeg`, `amountOut` and `closedTx`. Amounts are raw on-chain units.

## Social

| Endpoint                                               | Returns                                                     |
| :----------------------------------------------------- | :---------------------------------------------------------- |
| `GET /api/feed`                                        | Calls across all tokens                                     |
| `GET /api/users/{address or username}/follows?viewer=` | Follower and following counts, and whether `viewer` follows |
| `GET /api/users/{address or username}/followers`       | Accounts following this user                                |
| `GET /api/users/{address or username}/following`       | Accounts this user follows                                  |

Posting calls, likes and follows needs a wallet-signed session and is meant for the app, not for integrators.

## DEX Screener Adapter

Goton implements the DEX Screener adapter (`dexId: goton`):

| Endpoint                                     | Returns                                |
| :------------------------------------------- | :------------------------------------- |
| `GET /dex/latest-block?chain=robinhood\|arc` | Latest block the indexer has processed |
| `GET /dex/asset?id={address}`                | Token metadata and supply              |
| `GET /dex/pair?id={pair}`                    | Pair metadata                          |
| `GET /dex/events?fromBlock=&toBlock=`        | Swap events in a block range           |

See [DEX & Aggregator Listing](/integration/listing-submission) for the on-chain events behind these endpoints.
