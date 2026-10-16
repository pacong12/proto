import { encodeAbiParameters, encodePacked, parseAbi, type Address, type Hex } from 'viem';

/** Pool parameters every Goton launch on Arc uses (LaunchpadV2FactoryArc constants). */
export const ARC_V4_POOL_FEE = 10_000;
export const ARC_V4_TICK_SPACING = 200;

export interface V4PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

/**
 * Builds the PoolKey of a Goton token's v4 pool on any chain (currencies sorted by address;
 * native ETH is `address(0)` and therefore always currency0). Fee 1%, tick spacing 200.
 */
export function protoV4PoolKey(token: Address, quote: Address, hook: Address): V4PoolKey {
  const tokenFirst = BigInt(token) < BigInt(quote);
  return {
    currency0: tokenFirst ? token : quote,
    currency1: tokenFirst ? quote : token,
    fee: ARC_V4_POOL_FEE,
    tickSpacing: ARC_V4_TICK_SPACING,
    hooks: hook,
  };
}

/** Arc alias of {@link protoV4PoolKey}. */
export const arcPoolKey = protoV4PoolKey;

/** Universal Router command / v4-periphery action codes. */
const V4_SWAP = 0x10;
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;

const POOL_KEY_COMPONENTS = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const;

/**
 * ExactInputSingleParams as deployed on Arc's Universal Router (decoded from live swaps):
 * an extra uint256 price-limit word precedes hookData (0 = no limit).
 */
const EXACT_INPUT_SINGLE_PARAMS = [
  {
    type: 'tuple',
    components: [
      { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
      { name: 'zeroForOne', type: 'bool' },
      { name: 'amountIn', type: 'uint128' },
      { name: 'amountOutMinimum', type: 'uint128' },
      { name: 'priceLimit', type: 'uint256' },
      { name: 'hookData', type: 'bytes' },
    ],
  },
] as const;

export interface ArcV4ExactInSwap {
  poolKey: V4PoolKey;
  /** Input currency (USDC to buy, the token to sell). */
  tokenIn: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
}

/**
 * Encodes a single-pool exact-input swap for `UniversalRouter.execute(commands, inputs, deadline)`.
 * The swapper must have approved `tokenIn` to Permit2 and granted the router a Permit2 allowance.
 */
export function encodeArcV4ExactInSwap(swap: ArcV4ExactInSwap): { commands: Hex; inputs: Hex[] } {
  const { poolKey, tokenIn, amountIn, amountOutMinimum } = swap;
  const zeroForOne = tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();
  const tokenOut = zeroForOne ? poolKey.currency1 : poolKey.currency0;

  const actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL],
  );
  const params: Hex[] = [
    encodeAbiParameters(EXACT_INPUT_SINGLE_PARAMS, [
      { poolKey, zeroForOne, amountIn, amountOutMinimum, priceLimit: 0n, hookData: '0x' },
    ]),
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [tokenIn, amountIn]),
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [tokenOut, amountOutMinimum]),
  ];

  return {
    commands: encodePacked(['uint8'], [V4_SWAP]),
    inputs: [encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], [actions, params])],
  };
}

export const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
]);

export const permit2Abi = parseAbi([
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
]);
