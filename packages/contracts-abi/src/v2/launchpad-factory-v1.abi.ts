/**
 * Canonical ABI for LaunchpadFactory
 * Auto-generated from Foundry compilation output: contracts/out/LaunchpadFactory.sol/LaunchpadFactory.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const launchpadFactoryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_v3Factory',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_positionManager',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_swapRouter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_weth',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_protocolFeeRecipient',
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
    name: 'TICK_LOWER',
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
    name: 'TICK_UPPER',
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
    name: 'allTokens',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
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
    name: 'defaultProtocolFeeShare',
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
    name: 'getLaunchedToken',
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
        internalType: 'struct ILaunchpadFactory.LaunchedToken',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'deployer',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'pairedToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'positionManager',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'positionId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'dexId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'launchConfigId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'restrictionsEndBlock',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'supply',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'isToken0',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'poolFee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'exists',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'initialBuyAmount',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'graduationStatus',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'pairedPrincipal',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'threshold',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'graduated',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'graduationThreshold',
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
    name: 'launchFee',
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
    name: 'launchToken',
    inputs: [
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'symbol',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'logo',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'description',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'socials',
        type: 'tuple',
        internalType: 'struct ILaunchpadToken.Socials',
        components: [
          {
            name: 'twitter',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'telegram',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'discord',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'website',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'farcaster',
            type: 'string',
            internalType: 'string',
          },
        ],
      },
      {
        name: 'initialBuyAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minTokensOut',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tokenAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'poolAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'launchToken',
    inputs: [
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'symbol',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'logo',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'description',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'socials',
        type: 'tuple',
        internalType: 'struct ILaunchpadToken.Socials',
        components: [
          {
            name: 'twitter',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'telegram',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'discord',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'website',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'farcaster',
            type: 'string',
            internalType: 'string',
          },
        ],
      },
      {
        name: 'initialBuyAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'tokenAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'poolAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'launchedTokens',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'deployer',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'pairedToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'positionManager',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'dexId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'launchConfigId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'restrictionsEndBlock',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'supply',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'isToken0',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'poolFee',
        type: 'uint24',
        internalType: 'uint24',
      },
      {
        name: 'exists',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'initialBuyAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'locker',
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
    name: 'positionManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract INonfungiblePositionManager',
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
    name: 'setDefaultProtocolFeeShare',
    inputs: [
      {
        name: 'newShare',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setGraduationThreshold',
    inputs: [
      {
        name: '_threshold',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setLaunchFee',
    inputs: [
      {
        name: '_fee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setLocker',
    inputs: [
      {
        name: '_locker',
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
        name: '_recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'swapRouter',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ISwapRouter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalTokensCount',
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
    name: 'uniswapV3Factory',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapV3Factory',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'weth',
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
    name: 'TokenLaunched',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'deployer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'dexFactory',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'pairedToken',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'pool',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'dexId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'launchConfigId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'positionId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'restrictionsEndBlock',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'initialBuyAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'InsufficientLaunchFee',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidFee',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoPendingOwner',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolCreationFailed',
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
