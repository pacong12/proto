# Verified Smart Contracts

For transparency and safety, all Proto launchpad contracts on **Robinhood Chain (Chain ID: 4663)** are public, non-custodial, and verifiable on the official block explorer.

---

## Contract Addresses

| Contract Name                            | Address                                      | Function                                     |
| :--------------------------------------- | :------------------------------------------- | :------------------------------------------- |
| **Launchpad Factory (v1 Direct Pool)**   | `0x48844223aBDceeb1Ce502F54d559681358E68200` | Deploys tokens and seeds Uniswap V3 pools    |
| **Launchpad Factory (v2 Bonding Curve)** | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` | Deploys tokens and active bonding curves     |
| **Liquidity Locker**                     | `0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4` | Holds and permanently locks LP position NFTs |
| **Uniswap V3 Factory**                   | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | Canonical decentralized pool registry        |
| **Position Manager**                     | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | Concentrated liquidity position NFT manager  |
| **Swap Router**                          | `0xCaf681a66D020601342297493863E78C959E5cb2` | Direct trade and exact-input swap routing    |
| **Wrapped Ether (WETH)**                 | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Canonical wrapped native Ether token         |

---

## Security Audits

All smart contract logic has been rigorously tested through static analysis (Slither), formal lifecycle tests (Foundry), and monorepo regression suites. Liquidity positions are permanently locked without admin keys, mint backdoors, or withdrawal permissions.
