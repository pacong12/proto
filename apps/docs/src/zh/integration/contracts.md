# 已验证官方智能合约

为了保证透明性与资产安全，Goton Launchpad 在各网络上部署的核心合约均完全开源、非托管，并已在官方区块浏览器上完成代码验证。

---

## 1. Robinhood Chain (Chain ID: 4663)

| 合约名称                          | 合约地址                                     | 核心功能                                     |
| :-------------------------------- | :------------------------------------------- | :------------------------------------------- |
| **Launchpad Factory (联合曲线)**  | `0x0b85876120e797Ca19655C0B81a0C25573f3Fc18` | 部署代币并开启链上联合曲线                   |
| **Graduator (Uniswap V4)**        | `0xaEF6Fff944007b94a51F37e82cf5235fDBF9b771` | 将完成的曲线迁移到锁定的 v4 池，任何人可调用 |
| **Goton V4 Hook**                 | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` | 池手续费、防狙击与 TWAP 预言机               |
| **Goton V4 Router**               | `0x5F88CE2BeD0f2639133b5EeB8b8fFE1fD50BA2dc` | 毕业后池的兑换                               |
| **Goton V4 Buyback**              | `0x240547f435Fe98B8B3F14036936D3a3e0EE87213` | 受 TWAP 保护的回购销毁                       |
| **Limit Orders**                  | `0x2f3212D06104eEbb5bA4FA934B9B55b906dC3F61` | 托管的限价、止盈与止损订单                   |
| **Liquidity Locker (Uniswap V4)** | `0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E` | 永久锁定 Uniswap LP NFT 仓位                 |
| **Uniswap V3 Factory**            | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | 官方去中心化交易池注册表                     |
| **Position Manager**              | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | 集中流动性头寸管理合约                       |
| **Swap Router**                   | `0xCaf681a66D020601342297493863E78C959E5cb2` | 去中心化交易精确输入路由合约                 |
| **Wrapped Ether (WETH)**          | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | 官方原生封装 Ether 代币                      |

---

## 2. Arc Network (主网, Chain ID: 5042)

| 合约名称                           | 合约地址                                     | 核心功能                           |
| :--------------------------------- | :------------------------------------------- | :--------------------------------- |
| **Launchpad Factory (Uniswap V4)** | `0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980` | 直接在锁定的 v4 池中发行代币       |
| **Goton V4 Hook**                  | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` | 池手续费、防狙击与 TWAP 预言机     |
| **Goton V4 Router**                | `0xD8Ec94F07f590F8Ceb620A8D17Bb555fBde366f1` | 使用原生 USDC 支付的兑换           |
| **Goton V4 Buyback**               | `0xb0C5fCBf9D0326cA2Ed0b2C49c5E754f36c78AFd` | 受 TWAP 保护的回购销毁             |
| **Limit Orders**                   | `0x3983F223E7Ef0B3c24b3a8F76Db96ed4Bf349Ee6` | 托管的限价、止盈与止损订单         |
| **Uniswap V4 PoolManager**         | `0x8366a39CC670B4001A1121B8F6A443A643e40951` | 官方 v4 单例合约                   |
| **报价代币 (USDC)**                | `0x3600000000000000000000000000000000000000` | 官方 ERC-20 USDC 交易对 (6 位小数) |
| **旧版 Factory (v4 之前)**         | `0xf94d16c9E90fCd55b75D318d0104269146612abF` | 早期发行；不再创建新代币           |

---

## 安全审计概述

全部智能合约逻辑均已通过严苛的静态代码扫描 (Slither)、形式化测试 (Foundry) 以及跨模块回归测试。流动性池仓位不存在任何特权提取后门。
