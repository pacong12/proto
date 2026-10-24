# 公开 API

goton.fun 应用的所有数据都来自 `https://goton.fun` 上的公开只读 JSON API。集成方、机器人和仪表盘可以使用相同的接口。响应格式为 `{ "success": true, "data": …, "timestamp": … }`；出错时返回 `success: false`，并附带 `error.code` 和 `error.message`。

所有地址均为十六进制（`0x…`，40 个字符）。Robinhood Chain 的 `chainId` 为 `4663`，Arc Network 为 `5042`。接口有频率限制，响应会缓存几秒。

---

## 代币

| 接口                                                        | 返回内容                                                           |
| :---------------------------------------------------------- | :----------------------------------------------------------------- |
| `GET /api/tokens?limit=&offset=&deployer=`                  | 代币及其市场数据（每页最多 100 个）                                |
| `GET /api/tokens/{address}`                                 | 单个代币及其市场数据                                               |
| `GET /api/tokens/{address}/ohlcv?resolution=&fillGaps=true` | K 线；`resolution` 以秒为单位：1、60、300、900、3600、14400、86400 |
| `GET /api/tokens/{address}/trades?limit=`                   | 最近成交，最新的在前                                               |
| `GET /api/tokens/{address}/holders`                         | 最大持有者及其余额（原始单位）和供应占比                           |
| `GET /api/tokens/{address}/top-traders?limit=`              | 每个钱包的买入、卖出、持仓和收益（美元）                           |
| `GET /api/tokens/{address}/flow?window=5m\|1h\|6h\|24h`     | 买入与卖出成交量及交易者数量                                       |
| `GET /api/sparklines?chainId=`                              | 每个代币从发行至今的价格走势（约 40 个点）                         |
| `GET /api/memestock?chainId=`                               | 精选发行及其信号（见 [Memestock](/zh/protocol/social#memestock)）  |
| `GET /api/analytics?chainId=`                               | 单条链的协议汇总数据（省略 `chainId` 则为所有链）                  |

## 订单

| 接口                                                           | 返回内容                                              |
| :------------------------------------------------------------- | :---------------------------------------------------- |
| `GET /api/orders?owner=&token=&status=open\|filled\|cancelled` | 限价、止盈和止损订单；`owner` 或 `token` 至少填写一个 |

每个订单包含 `status`、`deadline`、存入的 `amount`、下限（`minOut`、`slMinOut`）、止损触发价 `slPriceX36`，以及关闭后的 `filledLeg`、`amountOut` 和 `closedTx`。数量均为链上原始单位。

## 社交

| 接口                                                   | 返回内容                                 |
| :----------------------------------------------------- | :--------------------------------------- |
| `GET /api/feed`                                        | 所有代币的喊单                           |
| `GET /api/users/{address or username}/follows?viewer=` | 粉丝数和关注数，以及 `viewer` 是否已关注 |
| `GET /api/users/{address or username}/followers`       | 关注该用户的账户                         |
| `GET /api/users/{address or username}/following`       | 该用户关注的账户                         |

发布喊单、点赞和关注需要钱包签名的会话，仅供应用使用，不面向集成方。

## DEX Screener 适配器

Goton 实现了 DEX Screener 适配器（`dexId: goton`）：

| 接口                                         | 返回内容               |
| :------------------------------------------- | :--------------------- |
| `GET /dex/latest-block?chain=robinhood\|arc` | 索引器已处理的最新区块 |
| `GET /dex/asset?id={address}`                | 代币元数据和供应量     |
| `GET /dex/pair?id={pair}`                    | 交易对元数据           |
| `GET /dex/events?fromBlock=&toBlock=`        | 区块范围内的兑换事件   |

这些接口背后的链上事件见 [DEX 与聚合器上架](/zh/integration/listing-submission)。
