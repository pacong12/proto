import { BUYBACK_EXECUTED_EVENT, ZERO_ADDRESS } from './indexer-events';
import { ChainIndexerPart } from './indexer-context';

/**
 * GotonV4Buyback: every executed buyback-and-burn, stored per chain (`network` = chain ID) with
 * the quote spent (raw, quote-token decimals) and the tokens burned (raw, 18 decimals).
 */
export class BuybackIndexer extends ChainIndexerPart {
  async pollBuybacks(from: bigint, to: bigint): Promise<number> {
    const buyback = this.network.contracts.buyback;
    if (!buyback || buyback === ZERO_ADDRESS || !this.tokenRepository.recordBuybackBurn) return 0;
    const logs = await this.client.getLogs({
      address: buyback,
      event: BUYBACK_EXECUTED_EVENT,
      fromBlock: from,
      toBlock: to,
    });
    let count = 0;
    const blockTimes = new Map<bigint, number>();
    for (const log of logs) {
      const { token, quoteSpent, tokensBurned } = log.args ?? {};
      if (!token || quoteSpent === undefined || tokensBurned === undefined) continue;
      const blockNumber = log.blockNumber!;
      let at = blockTimes.get(blockNumber);
      if (at === undefined) {
        const block = await this.client.getBlock({ blockNumber });
        at = Number(block.timestamp) * 1000;
        blockTimes.set(blockNumber, at);
      }
      await this.tokenRepository.recordBuybackBurn({
        // Deterministic: re-indexing a range replaces the burn instead of counting it twice.
        id: `${this.network.chainId}:${log.transactionHash}:${log.logIndex}`,
        tokenAddress: token,
        network: String(this.network.chainId),
        wethSpent: quoteSpent.toString(),
        tokensBurned: tokensBurned.toString(),
        transactionHash: log.transactionHash!,
        timestamp: at,
      });
      count += 1;
    }
    return count;
  }
}
