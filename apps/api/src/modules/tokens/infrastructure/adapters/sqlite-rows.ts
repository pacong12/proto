import type { LaunchedTokenEntity, TradeEventEntity } from '@goton/shared-types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAINS } from '@goton/shared-types';

/** Contracts that hold v4 pool liquidity for every pool on their chain. */
export const POOL_HOLDERS = CHAINS.map((net) => net.contracts.poolManagerV4).filter(
  (a): a is `0x${string}` => Boolean(a),
);

export interface TokenRow {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logo: string | null;
  description: string | null;
  socials_json: string | null;
  deployer: string;
  pairedToken: string;
  poolAddress: string;
  isToken0: number;
  poolFee: number;
  positionId: string;
  restrictionsEndBlock: string;
  launchBlock: string;
  createdAt: number;
  initialBuyAmount: string | null;
  tax_config_json: string | null;
  version: string | null;
  curve_address: string | null;
}

export interface TradeRow {
  id: string;
  tokenAddress: string;
  poolAddress: string;
  trader: string;
  isBuy: number;
  tokenAmount: string;
  wethAmount: string;
  priceUsd: number;
  blockNumber: string;
  transactionHash: string;
  timestamp: number;
  priceQuote: number | null;
}

export interface MarketDataRow {
  address: string;
  priceInWeth: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  pairedPrincipalWeth: string;
  graduationThresholdWeth: string;
  graduationProgress: number;
  isGraduated: number;
  volume24hUsd: number;
}

export const currentDir =
  typeof import.meta.dir === 'string'
    ? import.meta.dir
    : path.dirname(fileURLToPath(import.meta.url));

export const defaultDbPath =
  process.env.DB_PATH || path.resolve(currentDir, '../../../../../proto.sqlite');

export function mapRowToToken(row: TokenRow): LaunchedTokenEntity {
  return {
    address: row.address as `0x${string}`,
    name: row.name,
    symbol: row.symbol,
    decimals: Number(row.decimals),
    totalSupply: row.totalSupply,
    logo: row.logo ?? '',
    description: row.description ?? '',
    socials: row.socials_json ? (JSON.parse(row.socials_json) as Record<string, string>) : {},
    taxConfig: row.tax_config_json
      ? (JSON.parse(row.tax_config_json) as LaunchedTokenEntity['taxConfig'])
      : undefined,
    deployer: row.deployer as `0x${string}`,
    pairedToken: row.pairedToken as `0x${string}`,
    poolAddress: row.poolAddress as `0x${string}`,
    isToken0: Boolean(row.isToken0),
    poolFee: Number(row.poolFee),
    positionId: BigInt(row.positionId),
    restrictionsEndBlock: BigInt(row.restrictionsEndBlock),
    launchBlock: BigInt(row.launchBlock),
    createdAt: Number(row.createdAt),
    initialBuyAmount: row.initialBuyAmount ?? undefined,
    version: (row.version as 'v1' | 'v2' | null) ?? undefined,
    curveAddress: (row.curve_address as `0x${string}` | null) ?? undefined,
    isGraduated: Boolean((row as TokenRow & { is_graduated?: number }).is_graduated),
    virtualEthReserve:
      (row as TokenRow & { virtual_eth_reserve?: string | null }).virtual_eth_reserve ?? undefined,
    virtualTokenReserve:
      (row as TokenRow & { virtual_token_reserve?: string | null }).virtual_token_reserve ??
      undefined,
    graduationTarget:
      (row as TokenRow & { graduation_target?: string | null }).graduation_target ?? undefined,
  };
}

export function mapRowToTrade(row: TradeRow): TradeEventEntity {
  return {
    id: row.id,
    tokenAddress: row.tokenAddress as `0x${string}`,
    poolAddress: row.poolAddress as `0x${string}`,
    trader: row.trader as `0x${string}`,
    isBuy: Boolean(row.isBuy),
    tokenAmount: row.tokenAmount,
    wethAmount: row.wethAmount,
    priceUsd: Number(row.priceUsd),
    ...(row.priceQuote ? { priceQuote: Number(row.priceQuote) } : {}),
    blockNumber: BigInt(row.blockNumber),
    transactionHash: row.transactionHash as `0x${string}`,
    timestamp: Number(row.timestamp),
  };
}
