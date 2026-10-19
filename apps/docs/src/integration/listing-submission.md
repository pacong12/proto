# DEX & Aggregator Listing

Reference data for indexers and aggregators (DEX Screener, GeckoTerminal, GMGN and similar) that want to list Goton tokens. Goton also serves the DEX Screener adapter endpoints itself; see [Public API](/integration/api#dex-screener-adapter).

---

## How Trading Works

- **Robinhood Chain (4663)**: a token trades on its own bonding curve until the curve raises **4.2 ETH**. It then graduates into a **Uniswap v4** pool against **native ETH**, with the liquidity locked for good.
- **Arc Network (5042)**: there is no curve. A token trades in a **Uniswap v4** pool against **USDC** from the first block, with the liquidity locked for good.

Every Goton v4 pool uses the Goton hook, a **1% LP fee** (`fee = 10000`) and `tickSpacing = 200`.

---

## Robinhood Chain (4663)

| Contract | Address |
| :--- | :--- |
| Launchpad Factory | `0x0b85876120e797Ca19655C0B81a0C25573f3Fc18` |
| Graduator | `0xaEF6Fff944007b94a51F37e82cf5235fDBF9b771` |
| Goton V4 Hook | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` |
| Uniswap V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| Quote asset in pools | Native ETH (`address(0)`) |

**Events**

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

After graduation, trades are standard Uniswap v4 `Swap` events on the PoolManager for that `poolId`.

---

## Arc Network (5042)

| Contract | Address |
| :--- | :--- |
| Launchpad Factory (v4) | `0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980` |
| Goton V4 Hook | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` |
| Uniswap V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| Quote asset in pools | USDC `0x3600000000000000000000000000000000000000` (6 decimals) |

**Events**

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

Trades are Uniswap v4 `Swap` events on the PoolManager for that `poolId`.

---

## Token Facts

- Fixed supply of **1,000,000,000** tokens, 18 decimals, no mint function.
- Creators can set a buy and sell tax of 0–10% at launch, split on-chain between the creator's share and the protocol. See [Creator Fees & Rewards](/protocol/fees-and-burns).
- Earlier factories have tokens that are still indexed but do not take new launches. All current addresses are on [Verified Smart Contracts](/integration/contracts).

---

## Submission Template

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
