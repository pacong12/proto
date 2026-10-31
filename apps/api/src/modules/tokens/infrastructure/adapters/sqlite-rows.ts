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
