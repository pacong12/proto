# Deployed Contract Registry

Official contract deployments on **Robinhood Chain (Chain ID: 4663)**.

---

## Core Protocol Contracts

| Contract | Address | Start Block | Description |
| **Launchpad Factory (v1)** | `0x48844223aBDceeb1Ce502F54d559681358E68200` | `57851335` | Direct Uniswap V3 Pool Deployer |
| **Launchpad Factory (v2)** | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` | `57851335` | Bonding Curve & Uniswap v4 Deployer |
| **Liquidity Locker (v1)** | `0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4` | `57851335` | Permanently locks Uniswap V3 LP NFTs |
| **Launch Locker (v2)** | `0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952` | `58991118` | Uniswap v4 Liquidity Locker |
| **Meme Hook (v2)** | `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044` | `58991118` | Uniswap v4 Fee Split & Tax Hook |
| **Buyback Burner** | `0x42df2a798f82289E177311362e8f5ccC45c1219c` | `58991118` | Protocol Fee Buyback Vault & Burn |

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

## Uniswap v4 Pool Construction (v2)

A graduated v2 launch trades as a canonical Uniswap v4 singleton pool. The `PoolKey` is derived deterministically:

```typescript
import { encodeAbiParameters, keccak256 } from 'viem';

// Uniswap v4 sorts currencies by address. Address(0) is native ETH.
const poolKey = {
  currency0: '0x0000000000000000000000000000000000000000',
  currency1: tokenAddress,
  fee: 0, // Hook collects trading fees
  tickSpacing: 200,
  hooks: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044', // Meme Hook
};

const poolId = keccak256(
  encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
  ),
);
```

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
