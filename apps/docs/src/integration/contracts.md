# Verified Smart Contracts

For transparency and safety, all Goton launchpad contracts across supported networks are public, non-custodial, and verifiable on the official block explorers.

---

## 1. Robinhood Chain (Chain ID: 4663)

| Contract Name                         | Address                                      | Function                                                        |
| :------------------------------------ | :------------------------------------------- | :-------------------------------------------------------------- |
| **Launchpad Factory (Bonding Curve)** | `0x0b85876120e797Ca19655C0B81a0C25573f3Fc18` | Deploys tokens and active bonding curves                        |
| **Graduator (Uniswap V4)**            | `0xaEF6Fff944007b94a51F37e82cf5235fDBF9b771` | Moves a finished curve into its locked v4 pool; anyone can call |
| **Goton V4 Hook**                     | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` | Pool fees, anti-snipe and TWAP oracle                           |
| **Goton V4 Router**                   | `0x5F88CE2BeD0f2639133b5EeB8b8fFE1fD50BA2dc` | Swaps on graduated pools                                        |
| **Goton V4 Buyback**                  | `0x240547f435Fe98B8B3F14036936D3a3e0EE87213` | TWAP-guarded buyback and burn                                   |
| **Limit Orders**                      | `0x2f3212D06104eEbb5bA4FA934B9B55b906dC3F61` | Escrowed limit, take-profit and stop-loss orders                |
| **Team Splitter Factory**             | `0xF2187BdcDcdB0999Bf1143b18089dc37c09f7Ef4` | Creates fixed-share team splitters for creator fees             |
| **Liquidity Locker (Uniswap V4)**     | `0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E` | Holds and permanently locks LP position NFTs                    |
| **Uniswap V3 Factory**                | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | Canonical decentralized pool registry                           |
| **Position Manager**                  | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | Concentrated liquidity position NFT manager                     |
| **Swap Router**                       | `0xCaf681a66D020601342297493863E78C959E5cb2` | Direct trade and exact-input swap routing                       |
| **Wrapped Ether (WETH)**              | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Canonical wrapped native Ether token                            |

---

## 2. Arc Network (Mainnet, Chain ID: 5042)

| Contract Name                      | Address                                      | Function                                            |
| :--------------------------------- | :------------------------------------------- | :-------------------------------------------------- |
| **Launchpad Factory (Uniswap V4)** | `0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980` | Launches tokens straight into their locked v4 pool  |
| **Goton V4 Hook**                  | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` | Pool fees, anti-snipe and TWAP oracle               |
| **Goton V4 Router**                | `0xD8Ec94F07f590F8Ceb620A8D17Bb555fBde366f1` | Swaps paid in native USDC                           |
| **Goton V4 Buyback**               | `0xb0C5fCBf9D0326cA2Ed0b2C49c5E754f36c78AFd` | TWAP-guarded buyback and burn                       |
| **Limit Orders**                   | `0x3983F223E7Ef0B3c24b3a8F76Db96ed4Bf349Ee6` | Escrowed limit, take-profit and stop-loss orders    |
| **Team Splitter Factory**          | `0x1F64014D2fA9B8Dd277E2Fbd6581553916175C09` | Creates fixed-share team splitters for creator fees |
| **Uniswap V4 PoolManager**         | `0x8366a39CC670B4001A1121B8F6A443A643e40951` | Canonical v4 singleton                              |
| **Canonical Quote Token (USDC)**   | `0x3600000000000000000000000000000000000000` | Canonical ERC-20 USDC pair currency (6 dec)         |
| **Legacy Factory (pre-v4)**        | `0xf94d16c9E90fCd55b75D318d0104269146612abF` | Earlier launches; no new tokens                     |

## Security Audits

All smart contract logic has been rigorously tested through static analysis (Slither), formal lifecycle tests (Foundry), and monorepo regression suites. Liquidity positions are permanently locked without admin keys, mint backdoors, or withdrawal permissions.
