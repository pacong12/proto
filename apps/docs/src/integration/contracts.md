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
| **Liquidity Locker (Uniswap V4)**     | `0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E` | Holds and permanently locks LP position NFTs                    |
| **Uniswap V3 Factory**                | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | Canonical decentralized pool registry                           |
| **Position Manager**                  | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | Concentrated liquidity position NFT manager                     |
| **Swap Router**                       | `0xCaf681a66D020601342297493863E78C959E5cb2` | Direct trade and exact-input swap routing                       |
| **Wrapped Ether (WETH)**              | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Canonical wrapped native Ether token                            |

---

## 2. Arc Network (Mainnet, Chain ID: 5042)

| Contract Name                         | Address                                      | Function                                     |
| :------------------------------------ | :------------------------------------------- | :------------------------------------------- |
| **Launchpad Factory (Bonding Curve)** | `0xf94d16c9E90fCd55b75D318d0104269146612abF` | Deploys tokens and active bonding curves     |
| **Liquidity Locker**                  | `0x173FF5D4eF626869a5a35FF0EA0c56c0A7e4Cd8b` | Holds and permanently locks LP position NFTs |
| **Uniswap V3 Factory**                | `0xf0db7b58379503491d857dB50AC9ece64c653918` | Canonical decentralized pool registry        |
| **Position Manager**                  | `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377` | Concentrated liquidity position NFT manager  |
| **Swap Router**                       | `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77` | Direct trade and exact-input swap routing    |
| **Canonical Quote Token (USDC)**      | `0x3600000000000000000000000000000000000000` | Canonical ERC-20 USDC pair currency (6 dec)  |

## Security Audits

All smart contract logic has been rigorously tested through static analysis (Slither), formal lifecycle tests (Foundry), and monorepo regression suites. Liquidity positions are permanently locked without admin keys, mint backdoors, or withdrawal permissions.
