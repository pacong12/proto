import type { PublicClient } from 'viem';
import type { NetworkConfig } from '@proto/shared-types';

export interface IChainService {
  readonly chainId: number;
  readonly name: string;
  readonly client: PublicClient;
  readonly network: NetworkConfig;
  readonly isArc: boolean;

  getQuotePriceUsd(): Promise<number>;
}
