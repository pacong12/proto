/**
 * Canonical ABI for GotonLimitOrders
 * Auto-generated from Foundry compilation output: contracts/out/GotonLimitOrders.sol/GotonLimitOrders.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const gotonLimitOrdersAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_curveFactory',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_router',
        type: 'address',
        internalType: 'contract IGotonV4RouterLO',
      },
      {
        name: '_poolManager',
        type: 'address',
        internalType: 'contract IPoolManagerV4',
      },
      {
        name: '_hook',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_quoteAsset',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_nativeScale',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'BUY_FILL',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'EXECUTOR_FEE_BPS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createBuyOrder',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'minTokensOut',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'id',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'createSellOrder',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'tpMinOut',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'slPriceX36',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'slMinOut',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    outputs: [
      {
        name: 'id',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'curveFactory',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executeBuyOnCurve',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'curve',
        type: 'address',
        internalType: 'contract IBondingCurveLO',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeBuyOnPool',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'key',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          {
            name: 'currency0',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'currency1',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'fee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'tickSpacing',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'hooks',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeSellOnCurve',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'curve',
        type: 'address',
        internalType: 'contract IBondingCurveLO',
      },
      {
        name: 'leg',
        type: 'uint8',
        internalType: 'enum GotonLimitOrders.Leg',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeSellOnPool',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'key',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          {
            name: 'currency0',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'currency1',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'fee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'tickSpacing',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'hooks',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
      {
        name: 'leg',
        type: 'uint8',
        internalType: 'enum GotonLimitOrders.Leg',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hook',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nativeScale',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextOrderId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'orders',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'isBuy',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'deadline',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minOut',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'slPriceX36',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'slMinOut',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPoolManagerV4',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'priceX36AtTick',
    inputs: [
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'quoteIs0',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'quoteAsset',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'router',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGotonV4RouterLO',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'OrderCancelled',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderCreated',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'order',
        type: 'tuple',
        indexed: false,
        internalType: 'struct GotonLimitOrders.Order',
        components: [
          {
            name: 'owner',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'isBuy',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'deadline',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minOut',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'slPriceX36',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'slMinOut',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderFilled',
    inputs: [
      {
        name: 'id',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'executor',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'leg',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'amountIn',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'amountOut',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'fee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'Expired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientOutput',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOrder',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidRoute',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTick',
    inputs: [
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
      },
    ],
  },
  {
    type: 'error',
    name: 'NotOwner',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotTriggered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Reentrancy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TransferFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnknownOrder',
    inputs: [],
  },
] as const;
