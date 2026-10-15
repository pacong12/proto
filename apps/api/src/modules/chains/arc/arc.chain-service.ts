import { ARC_CHAIN } from '@proto/shared-types';
import type { PublicClient } from 'viem';
import { GenericChainService } from '../generic-chain.service';
import type { PriceFeedPort } from '../../tokens/domain/ports/price-feed.port';

/**
 * Arc Network Chain Service (Chain ID: 5042)
 * Circle USDC native gas asset with 18 decimals in msg.value.
 */
export class ArcChainService extends GenericChainService {
  constructor(client: PublicClient, priceFeed: PriceFeedPort) {
    super(client, ARC_CHAIN, priceFeed);
  }
}
