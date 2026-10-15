/**
 * Canonical ABI for ProtoMemeHook
 * Auto-generated from Foundry compilation output: contracts/out/ProtoMemeHook.sol/ProtoMemeHook.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const protoMemeHookAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_poolManager',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_protocolFeeRecipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_buybackVault',
        type: 'address',
        internalType: 'address',
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
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterAddLiquidity',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: '',
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
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'afterInitialize',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
      {
        name: '',
        type: 'int24',
        internalType: 'int24',
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
    name: 'afterRemoveLiquidity',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
      {
        name: '',
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
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'afterSwap',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: '',
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
        name: '',
        type: 'int128',
        internalType: 'int128',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'beforeAddLiquidity',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
        type: 'bytes',
        internalType: 'bytes',
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
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'beforeInitialize',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'beforeRemoveLiquidity',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
        type: 'bytes',
        internalType: 'bytes',
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
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'beforeSwap',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
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
        type: 'bytes',
        internalType: 'bytes',
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'buybackVault',
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
    name: 'owner',
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
    name: 'pendingEthFees',
    inputs: [
      {
        name: '',
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
    name: 'pendingOwner',
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
    name: 'pendingTokenFees',
    inputs: [
      {
        name: '',
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
    name: 'poolConfigs',
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
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'locker',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'creatorFeeShareBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'buybackShareBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'initialized',
        type: 'bool',
        internalType: 'bool',
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
        internalType: 'contract IPoolManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolFeeRecipient',
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
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'locker',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'creatorFeeShareBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'buybackShareBps',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBuybackVault',
    inputs: [
      {
        name: 'newVault',
        type: 'address',
        internalType: 'address',
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
    type: 'function',
    name: 'setProtocolFeeRecipient',
    inputs: [
      {
        name: 'newRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sweepPoolFees',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'BuybackVaultUpdated',
    inputs: [
      {
        name: 'newVault',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeesSwept',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'creatorEth',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'protocolEth',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PendingOwnershipProposed',
    inputs: [
      {
        name: 'proposedOwner',
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
        name: 'creator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProtocolFeeRecipientUpdated',
    inputs: [
      {
        name: 'newRecipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
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
    name: 'TransferFailed',
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
