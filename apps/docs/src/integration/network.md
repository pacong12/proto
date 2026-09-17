# Supported Networks & Wallet Setup

Proto operates as a multi-chain launchpad supporting both **Robinhood Chain Layer 2** and **Arc Network (Circle Stablecoin L1)**, providing fast transaction speeds, deterministic finality, and predictable execution costs.

To interact with Proto, add either network to your Web3 wallet.

---

## 1. Robinhood Chain (Mainnet)

| Parameter              | Value                                     |
| :--------------------- | :---------------------------------------- |
| **Network Name**       | Robinhood Chain                           |
| **RPC URL**            | `https://rpc.mainnet.chain.robinhood.com` |
| **Chain ID**           | `4663`                                    |
| **Currency Symbol**    | `ETH` (18 decimals)                       |
| **Block Explorer URL** | `https://robinhoodchain.blockscout.com`   |

---

## 2. Arc Network (Mainnet)

| Parameter              | Value                                                |
| :--------------------- | :--------------------------------------------------- |
| **Network Name**       | Arc Network                                          |
| **RPC URL**            | `https://rpc.mainnet.arc.io`                         |
| **Chain ID**           | `5042` (`0x13b2`)                                    |
| **Currency Symbol**    | `USDC` (Native Gas: 18 dec msg.value / 6 dec ERC-20) |
| **Block Explorer URL** | `https://explorer.arc.io`                            |

---

## 3. Testnet Networks

For developers and test simulations:

- **Robinhood Chain Testnet**: Chain ID `46630`, RPC `https://rpc.testnet.chain.robinhood.com`
- **Arc Testnet**: Chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, Explorer `https://explorer.testnet.arc.io`

---

## One-Click Connection & Network Switching

When visiting [proto.family](https://proto.family), the platform will automatically detect your wallet's active chain and allow you to switch seamlessly between **Robinhood Chain** and **Arc Network** with a single click from the network selector in the top navigation bar.
