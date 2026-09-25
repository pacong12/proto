# 网络配置与钱包连接

Proto 作为原生多链发射协议，同时支持 **Robinhood Chain Layer 2** 与 **Arc Network (Circle 稳定币底层 L1)**，具备极高的交易吞吐速度、极低延迟以及可预测的执行成本。

在参与交互前，请将目标网络添加至您的 Web3 钱包。

---

## 1. Robinhood Chain (主网)

| 参数项                      | 参数值                                    |
| :-------------------------- | :---------------------------------------- |
| **网络名称 (Network Name)** | Robinhood Chain                           |
| **RPC 节点地址**            | `https://rpc.mainnet.chain.robinhood.com` |
| **链 ID (Chain ID)**        | `4663`                                    |
| **原生货币符号**            | `ETH` (18 位精度)                         |
| **区块浏览器**              | `https://robinhoodchain.blockscout.com`   |

---

## 2. Arc Network (Circle 稳定币 L1)

| 参数项                      | 参数值                                                |
| :-------------------------- | :---------------------------------------------------- |
| **网络名称 (Network Name)** | Arc Network (Mainnet)                                 |
| **RPC 节点地址**            | `https://rpc.mainnet.arc.io`                          |
| **链 ID (Chain ID)**        | `5042` (`0x13b2`)                                     |
| **原生货币符号**            | `USDC` (原生 Gas: 18 位 msg.value / 6 位 ERC-20 视图) |
| **区块浏览器**              | `https://explorer.arc.io`                             |

---

## 一键切换与网络自适应

在访问 [proto.family](https://proto.family) 时，系统将自动识别您钱包当前所在网络。您可以通过顶部导航栏的网络切换器，一键在 **Robinhood Chain** 与 **Arc Network** 之间流畅切换。
