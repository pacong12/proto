# Network & RPC Configuration

Proto is deployed natively on **Robinhood Chain**.

---

## Mainnet Parameters

| Parameter          | Value                                                                          |
| :----------------- | :----------------------------------------------------------------------------- |
| **Network Name**   | Robinhood Chain                                                                |
| **Chain ID**       | `4663`                                                                         |
| **Native Asset**   | `ETH`                                                                          |
| **Public RPC URL** | `https://rpc.mainnet.chain.robinhood.com`                                      |
| **Block Explorer** | [https://robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com) |
| **WETH Address**   | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`                                   |

---

## Testnet Parameters

| Parameter          | Value                                                                                          |
| :----------------- | :--------------------------------------------------------------------------------------------- |
| **Network Name**   | Robinhood Chain Testnet                                                                        |
| **Chain ID**       | `46630`                                                                                        |
| **Native Asset**   | `ETH`                                                                                          |
| **Public RPC URL** | `https://rpc.testnet.chain.robinhood.com`                                                      |
| **Block Explorer** | [https://testnet.robinhoodchain.blockscout.com](https://testnet.robinhoodchain.blockscout.com) |

---

## Viem Client Setup

```typescript
import { createPublicClient, http } from 'viem';

export const robinhoodClient = createPublicClient({
  chain: {
    id: 4663,
    name: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
    },
    blockExplorers: {
      default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
    },
  },
  transport: http(),
});
```
