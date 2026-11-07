import { limitOrderContracts, limitOrderKey, originalLimitOrders } from '@goton/shared-types';
import { LIMIT_ORDER_EVENTS, FILL_LEGS } from './indexer-events';
import { ChainIndexerPart } from './indexer-context';

/** GotonLimitOrders: placed, filled and cancelled orders, in every deployment that holds some. */
export class LimitOrderIndexer extends ChainIndexerPart {
  private adopted = false;

  async pollLimitOrders(from: bigint, to: bigint): Promise<number> {
    const contracts = limitOrderContracts(this.network);
    if (contracts.length === 0) return 0;
    if (!this.tokenRepository.saveLimitOrder || !this.tokenRepository.updateLimitOrder) return 0;
    const chainId = this.network.chainId;
    try {
      if (!this.adopted) {
        const original = originalLimitOrders(this.network)!;
        await this.tokenRepository.adoptLimitOrders?.(chainId, original, (id) =>
          limitOrderKey(chainId, original, id),
        );
        this.adopted = true;
      }
      const logs = await this.client.getLogs({
        address: contracts,
        events: LIMIT_ORDER_EVENTS,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        const key = limitOrderKey(chainId, log.address, log.args.id!);
        if (log.eventName === 'OrderCreated') {
          const o = log.args.order!;
          const block = await this.client.getBlock({ blockNumber: log.blockNumber! });
          const at = Number(block.timestamp) * 1000;
          await this.tokenRepository.saveLimitOrder({
            key,
            chainId,
            contract: log.address,
            orderId: String(log.args.id),
            owner: o.owner,
            token: o.token,
            isBuy: o.isBuy,
            amount: o.amount.toString(),
            minOut: o.minOut.toString(),
            slPriceX36: o.slPriceX36.toString(),
            slMinOut: o.slMinOut.toString(),
            deadline: Number(o.deadline),
            status: 'open',
            createdTx: log.transactionHash!,
            createdAt: at,
            updatedAt: at,
          });
        } else if (log.eventName === 'OrderFilled') {
          await this.tokenRepository.updateLimitOrder(key, {
            status: 'filled',
            filledLeg: FILL_LEGS[Number(log.args.leg)] ?? 'buy',
            amountOut: String(log.args.amountOut),
            closedTx: log.transactionHash!,
          });
        } else {
          await this.tokenRepository.updateLimitOrder(key, {
            status: 'cancelled',
            closedTx: log.transactionHash!,
          });
        }
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] limit order poll error:`,
        (e as Error).message,
      );
      throw e;
    }
  }
}
