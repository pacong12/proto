/**
 * Canonical ABI for LaunchpadV2Factory
 * Auto-generated from Foundry compilation output: contracts/out/LaunchpadV2Factory.sol/LaunchpadV2Factory.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const launchpadV2FactoryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_feeRecipient',
        type: 'address',
        internalType: 'address payable',
      },
      {
        name: '_graduator',
        type: 'address',
        internalType: 'contract GotonV4Graduator',
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
    name: 'GRADUATION_TARGET',
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
    name: 'MAX_LAUNCH_FEE',
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
    name: 'VIRTUAL_ETH_RESERVE',
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
    name: 'VIRTUAL_TOKEN_RESERVE',
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
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allLaunches',
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
    name: 'curveDeployer',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract BondingCurveDeployer',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'curveToToken',
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
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'emergencyWithdrawFromCurve',
    inputs: [
      {
        name: 'curve',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address payable',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLaunchCount',
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
    name: 'graduate',
    inputs: [
      {
        name: 'tokenAddress',
        type: 'address',
        internalType: 'address',
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
    name: 'graduator',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract GotonV4Graduator',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'guardian',
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
    name: 'launchTokenV2',
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
        name: 'website',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'minInitialTokensOut',
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
        name: 'curveAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'launches',
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
        name: 'curve',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'createdAt',
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
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
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
    name: 'predictCurveAddress',
    inputs: [
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'predictTokenAddress',
    inputs: [
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
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
    name: 'setGuardian',
    inputs: [
      {
        name: 'newGuardian',
        type: 'address',
        internalType: 'address',
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
        name: '_newFee',
        type: 'uint256',
        internalType: 'uint256',
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
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'GuardianUpdated',
    inputs: [
      {
        name: 'guardian',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LaunchFeeUpdated',
    inputs: [
      {
        name: 'oldFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
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
    name: 'PauseChanged',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'by',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenGraduated',
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
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenLaunchedV2',
    inputs: [
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'curve',
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
      {
        name: 'name',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
      {
        name: 'symbol',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
      {
        name: 'initialBuy',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'EmergencyPaused',
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
    name: 'NotFactory',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotGraduated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotGuardian',
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
  {
    type: 'function',
    name: 'launchTokenV2',
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
        name: 'website',
        type: 'string',
        internalType: 'string',
      },
    ],
    outputs: [
      {
        name: 'tokenAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'curveAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'payable',
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
        name: 'curve',
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
      {
        name: 'pairedToken',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'positionId',
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
] as const;
