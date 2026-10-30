import type { ComputedRef, Ref } from 'vue';
import {
  type LaunchedTokenEntity,
  type NetworkConfig,
  type TokenMarketData,
} from '@goton/shared-types';

export interface LiveTrade {
  id: string;
  tokenAddress: string;
  poolAddress: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  wethAmount: string;
  priceUsd: number;
  blockNumber: string;
  transactionHash: string;
  timestamp: number;
}

export interface TokenHolder {
  address: string;
  balance: string;
  percent: number;
}

/** The token page's state the trade composables read: the token, its network and the page's tabs. */
export interface TradePage {
  currentToken: Ref<LaunchedTokenEntity>;
  currentMarketData: Ref<TokenMarketData>;
  tokenNetwork: ComputedRef<NetworkConfig>;
  currencySymbol: ComputedRef<string>;
  explorerUrl: ComputedRef<string>;
  /** Quick-buy amounts in the token's quote currency. */
  buyPresets: ComputedRef<string[]>;
  isCreator: ComputedRef<boolean>;
  tokenLoading: Ref<boolean>;
  activeBottomTab: Ref<'callouts' | 'trades' | 'top-traders' | 'holders' | 'about'>;
  /** Reloads the token after a swap changed its state. */
  loadTokenData: (address: `0x${string}`) => Promise<void>;
}
