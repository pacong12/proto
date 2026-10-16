/**
 * Canonical ABI for GotonV4Hook
 * Auto-generated from Foundry compilation output: contracts/out/GotonV4Hook.sol/GotonV4Hook.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const gotonV4HookAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_poolManager',
        type: 'address',
        internalType: 'contract IPoolManagerV4',
      },
      {
        name: '_deployer',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'FLAGS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ORACLE_PERIOD',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'afterSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: 'hookDelta',
        type: 'int128',
        internalType: 'int128',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeInitialize',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
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
        name: '',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'beforeSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
      {
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: '',
        type: 'uint24',
        internalType: 'uint24',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'bonded',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'consultTick',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'twapTick',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'window',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentSnipeTaxBps',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
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
    name: 'currentTaxBps',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'isBuy',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deployer',
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
    name: 'factory',
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
    name: 'oracles',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'tickCumulative',
        type: 'int56',
        internalType: 'int56',
      },
      {
        name: 'lastTimestamp',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'olderCumulative',
        type: 'int56',
        internalType: 'int56',
      },
      {
        name: 'olderTimestamp',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'newerCumulative',
        type: 'int56',
        internalType: 'int56',
      },
      {
        name: 'newerTimestamp',
        type: 'uint32',
        internalType: 'uint32',
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
    name: 'pools',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'quote',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'splitter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'buyTaxBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'sellTaxBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'bondTick',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'quoteIsCurrency0',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'bonded',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'antiSnipe',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'launchTime',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerPool',
    inputs: [
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
        name: 'reg',
        type: 'tuple',
        internalType: 'struct GotonV4Hook.PoolRegistration',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'splitter',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'buyTaxBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'sellTaxBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'bondTick',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'bonded',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'antiSnipe',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFactory',
    inputs: [
      {
        name: '_factory',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'BondGraduated',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'tick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FactorySet',
    inputs: [
      {
        name: 'factory',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PoolRegistered',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'splitter',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'buyTaxBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'sellTaxBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TaxCollected',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'isBuy',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'FactoryAlreadySet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidHookAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OracleNotReady',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolAlreadyRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolNotRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const;
