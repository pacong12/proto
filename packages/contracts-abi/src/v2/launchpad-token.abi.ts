/**
 * Canonical ABI for LaunchpadToken
 * Auto-generated from Foundry compilation output: contracts/out/LaunchpadToken.sol/LaunchpadToken.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const launchpadTokenAbi = [
  {
    type: 'function',
    name: 'MAX_BUY_AMOUNT',
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
    name: 'MAX_HOLD_AMOUNT',
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
    name: 'MAX_TAX_BPS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TAX_CHANGE_TIMELOCK',
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
    name: 'acceptTaxConfig',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
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
    name: 'approve',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
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
    name: 'cancelTaxConfig',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'decimals',
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
    name: 'description',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
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
    name: 'initialize',
    inputs: [
      {
        name: 'tokenName',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'tokenSymbol',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'tokenLogo',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'tokenDescription',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'tokenSocials',
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
        name: 'tokenDeployer',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tokenPairedToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'initialRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'launchBlock',
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
    name: 'liquidityPool',
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
    name: 'logo',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pairedToken',
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
    name: 'pendingTaxConfig',
    inputs: [],
    outputs: [
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
        name: 'taxRecipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'validAfter',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setInitialTaxConfig',
    inputs: [
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
        name: 'taxRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'proposeTaxConfig',
    inputs: [
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
        name: 'taxRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'restrictionsEndBlock',
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
    name: 'setLiquidityPool',
    inputs: [
      {
        name: 'pool',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'socials',
    inputs: [],
    outputs: [
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'taxConfig',
    inputs: [],
    outputs: [
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
        name: 'taxRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
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
    name: 'transfer',
    inputs: [
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      {
        name: 'from',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TaxCollected',
    inputs: [
      {
        name: 'from',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'taxAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'isBuy',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TaxConfigCancelled',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TaxConfigProposed',
    inputs: [
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
      {
        name: 'taxRecipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'validAfter',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TaxConfigUpdated',
    inputs: [
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
      {
        name: 'taxRecipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      {
        name: 'from',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ExcessiveTax',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientAllowance',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MaxBuyExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MaxWalletExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoPendingTaxConfig',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyDeployerCanBuyAtLaunchBlock',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PendingTaxExists',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolAlreadySet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TimelockNotExpired',
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
