import type { PublicClient } from 'viem';
import type { NetworkConfig, TokenAddressPair } from '@goton/shared-types';

/** One supported network: its config, its RPC client and its quote-asset price. */
export interface IChainService {
  readonly chainId: number;
  readonly name: string;
  readonly client: PublicClient;
  readonly network: NetworkConfig;
  readonly quoteSymbol: string;
  readonly quoteDecimals: number;

  getQuotePriceUsd(): Promise<number>;
}

/** Every supported network, looked up by chain ID, URL parameter or token. */
export interface ChainRegistryPort {
  getAllChains(): IChainService[];
  /** The chain with this ID, or the default network's chain. */
  getChainById(chainId?: number): IChainService;
  getChainByParam(param?: string | null): IChainService;
  resolveForToken(token?: TokenAddressPair | null, activeChainId?: number): IChainService;
}
