/**
 * Canonical ABI for ProtoV4Graduator
 * Auto-generated from Foundry compilation output: contracts/out/ProtoV4Graduator.sol/ProtoV4Graduator.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const protoV4GraduatorAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_poolManager',
        type: 'address',
        internalType: 'contract IPoolManagerV4',
      },
      {
        name: '_hook',
        type: 'address',
        internalType: 'contract ProtoV4Hook',
      },
      {
        name: '_splitterDeployer',
        type: 'address',
        internalType: 'contract ProtoFeeSplitterDeployer',
      },
      {
        name: '_feeRecipient',
        type: 'address',
        internalType: 'address payable',
      },
      {
        name: '_defaultSplit',
        type: 'tuple',
        internalType: 'struct ProtoFeeSplitter.Split',
        components: [
          {
            name: 'protocolBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'holdersBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'burnBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'creatorBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'liquidityBps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
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
    name: 'MAX_USABLE_TICK',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'POOL_FEE',
    inputs: [],
    outputs: [
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
    name: 'TICK_SPACING',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    stateMutability: 'view',
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
    name: 'collectFees',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'ethFees',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'tokenFees',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'defaultSplit',
    inputs: [],
    outputs: [
      {
        name: 'protocolBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'holdersBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'burnBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'creatorBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'liquidityBps',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'graduate',
    inputs: [
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
        name: 'curve',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    outputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'splitter',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'graduations',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'splitter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tokenReserveTickUpper',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'ethReserveTickLower',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasTokenSplit',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
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
    name: 'hook',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ProtoV4Hook',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'launcher',
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
    name: 'liquidityVault',
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
    name: 'poolKeyOf',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
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
    name: 'protocolFeeRecipient',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address payable',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setDefaultSplit',
    inputs: [
      {
        name: 'split',
        type: 'tuple',
        internalType: 'struct ProtoFeeSplitter.Split',
        components: [
          {
            name: 'protocolBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'holdersBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'burnBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'creatorBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'liquidityBps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setLauncher',
    inputs: [
      {
        name: '_launcher',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRecipients',
    inputs: [
      {
        name: '_protocolFeeRecipient',
        type: 'address',
        internalType: 'address payable',
      },
      {
        name: '_buybackVault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_liquidityVault',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRevenueSplit',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'holdersBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'burnBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'creatorBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'liquidityBps',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'splitterDeployer',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ProtoFeeSplitterDeployer',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenSplits',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'protocolBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'holdersBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'burnBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'creatorBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'liquidityBps',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
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
    type: 'function',
    name: 'unlockCallback',
    inputs: [
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'DefaultSplitUpdated',
    inputs: [
      {
        name: 'protocolBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'holdersBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'burnBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'creatorBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'liquidityBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeesCollected',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'ethFees',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'tokenFeesBurned',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Graduated',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'splitter',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'ethLiquidity',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'tokenLiquidity',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'tokenReserve',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LauncherSet',
    inputs: [
      {
        name: 'launcher',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferProposed',
    inputs: [
      {
        name: 'proposed',
        type: 'address',
        indexed: true,
        internalType: 'address',
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
    name: 'RecipientsUpdated',
    inputs: [
      {
        name: 'protocolFeeRecipient',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'buybackVault',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'liquidityVault',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenSplitSet',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'holdersBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'burnBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'creatorBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'liquidityBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadyGraduated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSplit',
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
    name: 'LauncherAlreadySet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Reentrancy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SplitLocked',
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
    name: 'UnknownToken',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const;
