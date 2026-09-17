# 已验证官方智能合约

为了保证透明性与资产安全，Proto Launchpad 在各网络上部署的核心合约均完全开源、非托管，并已在官方区块浏览器上完成代码验证。

---

## 1. Robinhood Chain (Chain ID: 4663)

| 合约名称                            | 合约地址                                     | 核心功能                         |
| :---------------------------------- | :------------------------------------------- | :------------------------------- |
| **Launchpad Factory (v1 直接池)**   | `0x48844223aBDceeb1Ce502F54d559681358E68200` | 部署代币并注入 Uniswap V3 流动性 |
| **Launchpad Factory (v2 联合曲线)** | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` | 部署代币并开启链上联合曲线       |
| **Liquidity Locker**                | `0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4` | 永久锁定 Uniswap V3 LP NFT 仓位  |
| **Uniswap V3 Factory**              | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | 官方去中心化交易池注册表         |
| **Position Manager**                | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | 集中流动性头寸管理合约           |
| **Swap Router**                     | `0xCaf681a66D020601342297493863E78C959E5cb2` | 去中心化交易精确输入路由合约     |
| **Wrapped Ether (WETH)**            | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | 官方原生封装 Ether 代币          |

---

## 2. Arc Testnet (Chain ID: 5042002)

| 合约名称                            | 合约地址                                     | 核心功能                             |
| :---------------------------------- | :------------------------------------------- | :----------------------------------- |
| **Launchpad Factory (v1 直接池)**   | `0x92cB206557907e4955faEeBd387D9602872d52cA` | 部署代币并注入 Uniswap V3 流动性     |
| **Launchpad Factory (v2 联合曲线)** | `0x9C7Ff544aAc9f4A4ECAE3ca8c110740888fF70E3` | 部署代币并开启链上联合曲线           |
| **Liquidity Locker**                | `0x561723e55C27929f8C5317532c331c2a26060782` | 永久锁定 Uniswap V3 LP NFT 仓位      |
| **Uniswap V3 Factory**              | `0x867E249D61cb0951433FAfd72b15Acc63646D266` | 官方去中心化交易池注册表             |
| **Position Manager**                | `0x7bD82CA0E7fd5F4EfFFd69cb413CBf8E954c3660` | 集中流动性头寸管理合约               |
| **Swap Router**                     | `0x5b8953eFc63F70377fa8C23FBEE0EAD632B277Cd` | 去中心化交易精确输入路由合约         |
| **Native Payment Token (USDC)**     | `0x3600000000000000000000000000000000000000` | 原生 Gas 与基准交易对货币 (6 位精度) |

---

## 安全审计概述

全部智能合约逻辑均已通过严苛的静态代码扫描 (Slither)、形式化测试 (Foundry) 以及跨模块回归测试。流动性池仓位不存在任何特权提取后门。
