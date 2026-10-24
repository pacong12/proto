# DEX 与聚合器上架

供希望收录 Goton 代币的索引器和聚合器（DEX Screener、GeckoTerminal、GMGN 等）参考的数据。Goton 本身也提供 DEX Screener 适配器接口；见 [公开 API](/zh/integration/api#dex-screener-适配器)。

---

## 交易方式

- **Robinhood Chain (4663)**：代币先在其专属联合曲线上交易，直到曲线募集到 **4.2 ETH**。随后代币毕业进入与**原生 ETH** 配对的 **Uniswap v4** 池，流动性永久锁定。
- **Arc Network (5042)**：没有联合曲线。代币从第一个区块起就在与 **USDC** 配对的 **Uniswap v4** 池中交易，流动性永久锁定。

每个 Goton v4 池都使用 Goton hook、**1% LP 费率**（`fee = 10000`）和 `tickSpacing = 200`。

---

## Robinhood Chain (4663)

| 合约                   | 地址                                         |
| :--------------------- | :------------------------------------------- |
| Launchpad Factory      | `0x0b85876120e797Ca19655C0B81a0C25573f3Fc18` |
| Graduator              | `0xaEF6Fff944007b94a51F37e82cf5235fDBF9b771` |
| Goton V4 Hook          | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` |
| Uniswap V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| 池中的报价资产         | 原生 ETH（`address(0)`）                     |

**事件**

```solidity
// Factory: a token and its bonding curve are created.
event TokenLaunchedV2(
    address indexed token,
    address indexed curve,
    address indexed creator,
    string name,
    string symbol,
    uint256 initialBuy
);

// Bonding curve: every buy and sell before graduation.
event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth);

// Factory: the curve's liquidity moved into its locked v4 pool.
event TokenGraduated(address indexed token, bytes32 indexed poolId, address splitter);
```

毕业后，成交即为该 `poolId` 在 PoolManager 上的标准 Uniswap v4 `Swap` 事件。

---

## Arc Network (5042)

| 合约                   | 地址                                                          |
| :--------------------- | :------------------------------------------------------------ |
| Launchpad Factory (v4) | `0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980`                  |
| Goton V4 Hook          | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc`                  |
| Uniswap V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951`                  |
| 池中的报价资产         | USDC `0x3600000000000000000000000000000000000000`（6 位小数） |

**事件**

```solidity
// Factory: a token is created directly in its locked v4 pool.
event TokenLaunchedV4(
    address indexed token,
    bytes32 indexed poolId,
    address indexed creator,
    address splitter,
    string name,
    string symbol,
    uint256 prebuyUsdc6,
    uint256 creatorTokens
);
```

成交即为该 `poolId` 在 PoolManager 上的 Uniswap v4 `Swap` 事件。

---

## 代币信息

- 固定供应量 **1,000,000,000** 枚，18 位小数，没有铸造函数。
- 创作者可在发行时设置 0–10% 的买入和卖出税，在链上按创作者份额与协议份额分配。见 [创作者费用与奖励](/zh/protocol/fees-and-burns)。
- 早期 factory 的代币仍会被索引，但不再接受新的发行。所有当前地址见 [已验证智能合约](/zh/integration/contracts)。

---

## 申请模板

请用英文发送，因为大多数聚合器团队使用英文沟通：

```text
Subject: Goton launchpad listing - Robinhood Chain (4663) and Arc (5042)

Hi team,

Goton (https://goton.fun) is a fixed-supply token launchpad.

- Robinhood Chain (4663): tokens trade on a bonding curve until 4.2 ETH, then graduate
  into a Uniswap v4 pool against native ETH with liquidity locked for good.
  Factory 0x0b85876120e797Ca19655C0B81a0C25573f3Fc18 (TokenLaunchedV2, TokenGraduated),
  curve Trade events before graduation.
- Arc (5042): tokens launch straight into a Uniswap v4 pool against USDC
  (0x3600000000000000000000000000000000000000), liquidity locked.
  Factory 0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980 (TokenLaunchedV4).
- Uniswap v4 PoolManager on both chains: 0x8366a39CC670B4001A1121B8F6A443A643e40951,
  Goton hook 0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc, fee 10000, tickSpacing 200.
- DEX Screener adapter: https://goton.fun/dex/{latest-block,asset,pair,events}, dexId "goton".
- Docs: https://docs.goton.fun

Thank you!
```
