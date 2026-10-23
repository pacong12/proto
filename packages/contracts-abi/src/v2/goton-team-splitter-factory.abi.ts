/**
 * Canonical ABI for GotonTeamSplitterFactory
 * Auto-generated from Foundry compilation output: contracts/out/GotonTeamSplitter.sol/GotonTeamSplitterFactory.json
 * Do not edit directly; run `bun run export-abis` in packages/contracts-abi.
 */

export const gotonTeamSplitterFactoryAbi = [
  {
    type: 'function',
    name: 'create',
    inputs: [
      {
        name: 'payees',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: 'sharesBps',
        type: 'uint16[]',
        internalType: 'uint16[]',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'splitter',
        type: 'address',
        internalType: 'contract GotonTeamSplitter',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'predict',
    inputs: [
      {
        name: 'payees',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: 'sharesBps',
        type: 'uint16[]',
        internalType: 'uint16[]',
      },
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
    type: 'event',
    name: 'TeamCreated',
    inputs: [
      {
        name: 'splitter',
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
        name: 'payees',
        type: 'address[]',
        indexed: false,
        internalType: 'address[]',
      },
      {
        name: 'sharesBps',
        type: 'uint16[]',
        indexed: false,
        internalType: 'uint16[]',
      },
    ],
    anonymous: false,
  },
] as const;
