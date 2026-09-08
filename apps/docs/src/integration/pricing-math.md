# Pricing & Graduation Math

Proto derives real-time token pricing directly from Uniswap V3 `slot0.sqrtPriceX96`.

---

## Deriving Spot Price from `slot0`

Uniswap V3 encodes relative price as a Q64.96 fixed-point number:

$$\text{Ratio} = \frac{\text{sqrtPriceX96}}{2^{96}}$$

$$\text{Token1PerToken0} = \text{Ratio}^2$$

$$\text{PriceInWeth} = \begin{cases} \text{Token1PerToken0} & \text{if } \text{token} < \text{WETH (Token0)} \\ \frac{1}{\text{Token1PerToken0}} & \text{if } \text{token} > \text{WETH (Token1)} \end{cases}$$

### TypeScript Implementation

```typescript
import { parseAbiItem } from 'viem';
import { robinhoodClient } from './network';

const [sqrtPriceX96] = await robinhoodClient.readContract({
  address: poolAddress,
  abi: [
    parseAbiItem(
      'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    ),
  ],
  functionName: 'slot0',
});

const ratio = Number(sqrtPriceX96) / 2 ** 96;
const token1PerToken0 = ratio * ratio;
const priceInWeth = isToken0 ? token1PerToken0 : 1 / token1PerToken0;

const ethPriceUsd = 3000; // From DefiLlama / Pyth oracle
const priceUsd = priceInWeth * ethPriceUsd;
```

---

## Market Cap & FDV

Since every token has a fixed supply of 1 Billion ($10^9$) tokens:

$$\text{MarketCapUsd} = \text{PriceUsd} \times 1,000,000,000$$

$$\text{BurnAdjustedMarketCap} = \text{PriceUsd} \times (1,000,000,000 - \text{BurnedTokens})$$

---

## Graduation Progress

Graduation tracks the WETH paired in the liquidity pool toward the **4.2 ETH** threshold:

$$\text{GraduationProgress} = \min\left(1.0, \frac{\text{PairedPrincipalWei}}{4.2 \times 10^{18}}\right)$$
