# Multi-Chain Architectural Specification

## Overview

The Proto protocol is designed from the ground up for multi-chain scalability.
Rather than hardcoding conditional branches (`if (chainId === 5042)`), the codebase uses dedicated chain modules across all architectural layers.

---

## 1. Comparative Matrix

| Feature                     | Robinhood Chain                              | Arc Network                                  |
| :-------------------------- | :------------------------------------------- | :------------------------------------------- |
| **Chain ID**                | `4663`                                       | `5042`                                       |
| **Network Type**            | Arbitrum Nitro L2                            | Circle Stablecoin L1                         |
| **Native Gas Currency**     | ETH (18 decimals)                            | USDC (18 decimals in `msg.value`)            |
| **Token Total Supply**      | 1,000,000,000                                | 1,000,000,000                                |
| **Curve Token Allocation**  | 714,285,714 (71.43%)                         | 738,600,000 (73.86%)                         |
| **DEX Pool Allocation**     | 285,714,286 (28.57%)                         | 261,400,000 (26.14%)                         |
| **Initial Virtual Reserve** | 1.68 ETH                                     | 24,420 USDC                                  |
| **Graduation Target**       | 4.20 ETH                                     | 69,000 USDC                                  |
| **Launch Fee**              | 0.0005 ETH                                   | 1.00 USDC                                    |
| **Graduation DEX Model**    | Sovereign Uniswap V3                         | Sovereign Uniswap V3                         |
| **Fee Recipient / Owner**   | `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2` | `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2` |

---

## 2. Cross-Package File Organization

| Architectural Layer        | Robinhood Chain Module                           | Arc Network Module                         |
| :------------------------- | :----------------------------------------------- | :----------------------------------------- |
| **Smart Contracts**        | `contracts/src/LaunchpadV2Factory.sol`           | `contracts/src/LaunchpadV2FactoryArc.sol`  |
| **Contract Documentation** | `contracts/src/chains/robinhood/README.md`       | `contracts/src/chains/arc/README.md`       |
| **Deployment Scripts**     | `contracts/script/DeployRobinhoodV2.s.sol`       | `contracts/script/DeployArc.s.sol`         |
| **Test Suites**            | `contracts/test/LaunchpadV2.t.sol`               | `contracts/test/LaunchpadV2Arc.t.sol`      |
| **Domain Definitions**     | `packages/shared-types/src/chains/robinhood.ts`  | `packages/shared-types/src/chains/arc.ts`  |
| **Math SDK**               | `packages/math-sdk/src/chains/robinhood.ts`      | `packages/math-sdk/src/chains/arc.ts`      |
| **Contract ABIs**          | `packages/contracts-abi/src/chains/robinhood.ts` | `packages/contracts-abi/src/chains/arc.ts` |
| **Backend API**            | `apps/api/src/modules/chains/robinhood/`         | `apps/api/src/modules/chains/arc/`         |
| **Frontend Adapters**      | `apps/frontoffice/src/chains/robinhood/`         | `apps/frontoffice/src/chains/arc/`         |

---

## 3. Sovereign Protocol vs Third-Party Infrastructure

Proto adopts **Sovereign Infrastructure (Opsi 2)**:

- Robinhood Chain graduates into Uniswap V4 using Proto's sovereign `ProtoLiquidityLockerV4` (`0x7A1A...`) and `ProtoMemeHook` (`0x6347...`) with `LaunchpadV2Factory` (`0x9f1f...`).
- Arc Network graduates into Uniswap V3 using Proto's sovereign `LiquidityLocker` (`0x173F...`) with `LaunchpadV2FactoryArc` (`0xf94d...`).
- Protocol fees, locker fees, and trading incentives flow directly to Proto (`0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2`) and token creators without dependency on third-party multisigs (e.g. Pons Multisig `0x263ed...`).
