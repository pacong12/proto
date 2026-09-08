# Onchain Event Indexing

For trust-minimized integrations, index `TokenLaunched` from the factory and `Swap` events from Uniswap V3 pools.

---

## Event Topics

### TokenLaunched Topic0

```text
0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a
```

### Uniswap V3 Swap Topic0

```text
0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
```

---

## Indexing Launches with Viem

```typescript
import { parseAbiItem } from 'viem';
import { robinhoodClient } from './network';

const tokenLaunchedEvent = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairedToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)',
);

const logs = await robinhoodClient.getLogs({
  address: '0x48844223aBDceeb1Ce502F54d559681358E68200',
  event: tokenLaunchedEvent,
  fromBlock: 57851335n,
  toBlock: 'latest',
});
```

---

## Deriving Trade Direction (Buy vs Sell)

To determine whether a swap is a buy or a sell, compare the token address against the paired WETH address:

```typescript
const isToken0 = tokenAddress.toLowerCase() < pairedWethAddress.toLowerCase();
const pairSigned = isToken0 ? amount1 : amount0;
const tradeDirection = pairSigned > 0n ? 'BUY' : 'SELL';
```
