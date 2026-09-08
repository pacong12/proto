# Deployed Contract Registry

Official contract deployments on **Robinhood Chain (Chain ID: 4663)**.

---

## Core Protocol Contracts

| Contract              | Address                                      | Start Block |
| :-------------------- | :------------------------------------------- | :---------- |
| **Launchpad Factory** | `0x48844223aBDceeb1Ce502F54d559681358E68200` | `57851335`  |
| **Liquidity Locker**  | `0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4` | `57851335`  |
| **Buyback Burner**    | `0x000000000000000000000000000000000000dEaD` | —           |

---

## Canonical Uniswap V3 Infrastructure

| Contract                       | Address                                      |
| :----------------------------- | :------------------------------------------- |
| **Uniswap V3 Factory**         | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |
| **NonfungiblePositionManager** | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` |
| **SwapRouter**                 | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| **Quoter V2**                  | `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7` |
| **WETH Token**                 | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |

---

## Reading Factory State with Viem

```typescript
import { parseAbi } from 'viem';
import { robinhoodClient } from './network';

const factoryAbi = parseAbi([
  'function getLaunchedToken(address token) view returns ((address token, address deployer, address pairedToken, address positionManager, uint256 positionId, uint256 dexId, uint256 launchConfigId, uint256 restrictionsEndBlock, uint256 supply, bool isToken0, uint24 poolFee, bool exists, uint256 initialBuyAmount) launched)',
  'function graduationStatus(address token) view returns (uint256 pairedPrincipal, uint256 threshold, bool graduated)',
]);

const tokenData = await robinhoodClient.readContract({
  address: '0x48844223aBDceeb1Ce502F54d559681358E68200',
  abi: factoryAbi,
  functionName: 'getLaunchedToken',
  args: ['0x39dBED3a2bd333467115dE45665cC57F813C4571'],
});
```
