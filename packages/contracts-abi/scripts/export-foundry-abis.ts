import fs from 'node:fs';
import path from 'node:path';

const CONTRACTS_OUT = path.resolve(__dirname, '../../../contracts/out');
const TARGET_DIR = path.resolve(__dirname, '../src/v2');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

interface ContractExportConfig {
  sourceFile: string;
  contractName: string;
  outputName: string;
  exportVarName: string;
}

const CONTRACTS_TO_EXPORT: ContractExportConfig[] = [
  {
    sourceFile: 'LaunchpadFactory.sol',
    contractName: 'LaunchpadFactory',
    outputName: 'launchpad-factory-v1.abi.ts',
    exportVarName: 'launchpadFactoryAbi',
  },
  {
    sourceFile: 'BondingCurve.sol',
    contractName: 'BondingCurve',
    outputName: 'bonding-curve.abi.ts',
    exportVarName: 'bondingCurveAbi',
  },
  {
    sourceFile: 'LaunchpadToken.sol',
    contractName: 'LaunchpadToken',
    outputName: 'launchpad-token.abi.ts',
    exportVarName: 'launchpadTokenAbi',
  },
  {
    sourceFile: 'LaunchpadV2Factory.sol',
    contractName: 'LaunchpadV2Factory',
    outputName: 'launchpad-v2-factory.abi.ts',
    exportVarName: 'launchpadV2FactoryAbi',
  },
  {
    sourceFile: 'LaunchpadV2FactoryArc.sol',
    contractName: 'LaunchpadV2FactoryArc',
    outputName: 'launchpad-v2-factory-arc.abi.ts',
    exportVarName: 'launchpadV2FactoryArcAbi',
  },
  {
    sourceFile: 'HolderFeeDistributor.sol',
    contractName: 'HolderFeeDistributor',
    outputName: 'holder-fee-distributor.abi.ts',
    exportVarName: 'holderFeeDistributorAbi',
  },
  {
    sourceFile: 'BuybackBurner.sol',
    contractName: 'BuybackBurner',
    outputName: 'buyback-burner.abi.ts',
    exportVarName: 'buybackBurnerAbi',
  },
  {
    sourceFile: 'LiquidityLocker.sol',
    contractName: 'LiquidityLocker',
    outputName: 'liquidity-locker.abi.ts',
    exportVarName: 'liquidityLockerAbi',
  },
  {
    sourceFile: 'VestingVault.sol',
    contractName: 'VestingVault',
    outputName: 'vesting-vault.abi.ts',
    exportVarName: 'vestingVaultAbi',
  },
  {
    sourceFile: 'ProtoLiquidityLockerV4.sol',
    contractName: 'ProtoLiquidityLockerV4',
    outputName: 'proto-liquidity-locker-v4.abi.ts',
    exportVarName: 'protoLiquidityLockerV4Abi',
  },
  {
    sourceFile: 'ProtoMemeHook.sol',
    contractName: 'ProtoMemeHook',
    outputName: 'proto-meme-hook.abi.ts',
    exportVarName: 'protoMemeHookAbi',
  },
  {
    sourceFile: 'ProtoV4Hook.sol',
    contractName: 'ProtoV4Hook',
    outputName: 'proto-v4-hook.abi.ts',
    exportVarName: 'protoV4HookAbi',
  },
  {
    sourceFile: 'ProtoFeeSplitter.sol',
    contractName: 'ProtoFeeSplitter',
    outputName: 'proto-fee-splitter.abi.ts',
    exportVarName: 'protoFeeSplitterAbi',
  },
  {
    sourceFile: 'ProtoV4Graduator.sol',
    contractName: 'ProtoV4Graduator',
    outputName: 'proto-v4-graduator.abi.ts',
    exportVarName: 'protoV4GraduatorAbi',
  },
  {
    sourceFile: 'ProtoV4Buyback.sol',
    contractName: 'ProtoV4Buyback',
    outputName: 'proto-v4-buyback.abi.ts',
    exportVarName: 'protoV4BuybackAbi',
  },
  {
    sourceFile: 'ProtoV4Router.sol',
    contractName: 'ProtoV4Router',
    outputName: 'proto-v4-router.abi.ts',
    exportVarName: 'protoV4RouterAbi',
  },
];

for (const item of CONTRACTS_TO_EXPORT) {
  const jsonPath = path.join(CONTRACTS_OUT, item.sourceFile, `${item.contractName}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.warn(`[export-foundry-abis] Skipped missing artifact: ${jsonPath}`);
    continue;
  }

  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(rawJson);
  let abi = parsed.abi;

  // Add legacy compatibility overloads for LaunchpadV2Factory
  if (item.contractName === 'LaunchpadV2Factory') {
    abi = [
      ...abi,
      {
        type: 'function',
        name: 'launchTokenV2',
        inputs: [
          { name: 'name', type: 'string', internalType: 'string' },
          { name: 'symbol', type: 'string', internalType: 'string' },
          { name: 'logo', type: 'string', internalType: 'string' },
          { name: 'description', type: 'string', internalType: 'string' },
          { name: 'twitter', type: 'string', internalType: 'string' },
          { name: 'telegram', type: 'string', internalType: 'string' },
          { name: 'website', type: 'string', internalType: 'string' },
        ],
        outputs: [
          { name: 'tokenAddress', type: 'address', internalType: 'address' },
          { name: 'curveAddress', type: 'address', internalType: 'address' },
        ],
        stateMutability: 'payable',
      },
      {
        type: 'event',
        name: 'TokenLaunched',
        inputs: [
          { name: 'token', type: 'address', indexed: true, internalType: 'address' },
          { name: 'curve', type: 'address', indexed: true, internalType: 'address' },
          { name: 'creator', type: 'address', indexed: true, internalType: 'address' },
          { name: 'pairedToken', type: 'address', indexed: false, internalType: 'address' },
          { name: 'positionId', type: 'uint256', indexed: false, internalType: 'uint256' },
          { name: 'initialBuyAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
        ],
        anonymous: false,
      },
    ];
  }

  const content = `/**
 * Canonical ABI for ${item.contractName}
 * Auto-generated from Foundry compilation output: contracts/out/${item.sourceFile}/${item.contractName}.json
 * Do not edit directly; run \`bun run export-abis\` in packages/contracts-abi.
 */

export const ${item.exportVarName} = ${JSON.stringify(abi, null, 2)} as const;
`;

  const outputPath = path.join(TARGET_DIR, item.outputName);
  fs.writeFileSync(outputPath, content, 'utf8');
  console.info(
    `[export-foundry-abis] Exported ${item.exportVarName} -> ${item.outputName} (${abi.length} items)`,
  );
}
