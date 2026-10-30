import { erc20Abi, type Address } from 'viem';
import { resolveTokenNetwork, type LaunchedTokenEntity } from '@goton/shared-types';
import { findAllTokens } from '../../application/all-tokens';
import {
  TRANSFER_EVENT,
  ZERO_ADDRESS,
  LAUNCH_BLOCK_ABI,
  HOLDER_RETRY_MS,
  CONFIRMATIONS,
  LOG_ADDRESS_BATCH,
} from './indexer-events';
import { ChainIndexerPart } from './indexer-context';

/** Token balances: live transfers and each token's holder history. */
export class HolderIndexer extends ChainIndexerPart {
  /** When a token whose holder backfill failed may be tried again (ms). */
  private readonly holderRetryAt = new Map<string, number>();

  /** The holder history being read in the background, one token at a time. */
  private holderBackfill: Promise<void> | null = null;

  /** Resolves once the holder history being read in the background is done. */
  async holderBackfillSettled(): Promise<void> {
    await this.holderBackfill;
  }

  /**
   * Keeps token_balances current. Balances are read with balanceOf rather than summed from
   * Transfer values, so re-indexing a range (a retried cycle, a backfill) never double counts.
   * A token seen for the first time has its whole history read once, from its launch block.
   */
  async pollTransfers(from: bigint, to: bigint): Promise<number> {
    const repo = this.tokenRepository;
    if (!repo.saveBalances || !repo.markHoldersIndexed || !repo.getHolderIndexedTokens) return 0;
    const tokens = (await findAllTokens(repo)).filter(
      (t) => resolveTokenNetwork(t).chainId === this.network.chainId,
    );
    const indexed = await repo.getHolderIndexedTokens();
    // A history is read in the background, one token at a time: on a rate-limited RPC it takes
    // minutes, and a failure must never fail this cycle (a range that keeps failing is skipped,
    // trades included). A token whose backfill failed waits, so it cannot block the others.
    const now = Date.now();
    const pending = this.holderBackfill
      ? undefined
      : tokens.find(
          (t) =>
            !indexed.has(t.address.toLowerCase()) &&
            (this.holderRetryAt.get(t.address.toLowerCase()) ?? 0) <= now,
        );
    if (pending) {
      this.holderBackfill = this.backfillHolders(pending, to)
        .catch((e: unknown) => {
          this.holderRetryAt.set(pending.address.toLowerCase(), Date.now() + HOLDER_RETRY_MS);
          console.warn(
            `[EventPoller:${this.network.name}] holder history of ${pending.address} failed, retrying later:`,
            ((e as Error)?.message ?? String(e)).split('\n')[0],
          );
        })
        .finally(() => {
          this.holderBackfill = null;
        });
    }
    const live = tokens.filter((t) => indexed.has(t.address.toLowerCase())).map((t) => t.address);
    let count = 0;
    for (let i = 0; i < live.length; i += LOG_ADDRESS_BATCH) {
      const batch = live.slice(i, i + LOG_ADDRESS_BATCH);
      const logs = await this.client.getLogs({
        address: batch.length === 1 ? batch[0] : batch,
        event: TRANSFER_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      count += logs.length;
      await this.refreshBalances(this.holdersTouched(logs), to);
    }
    return count;
  }

  /** Reads a token's Transfer history from its launch block and records every holder's balance. */
  async backfillHolders(token: LaunchedTokenEntity, to: bigint): Promise<void> {
    let launchBlock: bigint;
    try {
      launchBlock = await this.client.readContract({
        address: token.address,
        abi: LAUNCH_BLOCK_ABI,
        functionName: 'launchBlock',
      });
    } catch {
      let code: `0x${string}` | undefined;
      try {
        code = await this.client.getCode({ address: token.address });
      } catch {
        code = '0x1'; // unknown: treat as a transient failure
      }
      if (!code || code === '0x') {
        // No contract at this address on this chain (e.g. a testnet leftover): it has no holders.
        await this.tokenRepository.markHoldersIndexed!(token.address);
      } else {
        this.holderRetryAt.set(token.address.toLowerCase(), Date.now() + HOLDER_RETRY_MS);
      }
      return;
    }
    const touched = new Map<string, Set<`0x${string}`>>();
    let from = await this.firstBlockOfParentBlock(launchBlock, to);
    let target = to;
    for (;;) {
      for (let start = from; start <= target; start += this.backfillChunk) {
        const end =
          start + this.backfillChunk - 1n > target ? target : start + this.backfillChunk - 1n;
        const logs = await this.withBackfillRetry(() =>
          this.client.getLogs({
            address: token.address,
            event: TRANSFER_EVENT,
            fromBlock: start,
            toBlock: end,
          }),
        );
        for (const [t, holders] of this.holdersTouched(logs)) {
          const set = touched.get(t) ?? new Set();
          holders.forEach((h) => set.add(h));
          touched.set(t, set);
        }
      }
      // The poller kept indexing other tokens meanwhile, without this one: read up to the head
      // before handing it over, so no transfer falls between the backfill and the live polls.
      const head = (await this.client.getBlockNumber()) - CONFIRMATIONS;
      if (head <= target) break;
      from = target + 1n;
      target = head;
    }
    await this.refreshBalances(touched, target);
    await this.tokenRepository.markHoldersIndexed!(token.address);
  }

  /**
   * The first block of this chain at or after parent-chain block `parentBlock`. On an
   * Arbitrum-style chain (Robinhood Chain) block.number inside contracts is Ethereum's block
   * number, so a token's launchBlock is not one of this chain's blocks; block headers carry
   * l1BlockNumber, which a binary search maps back. Chains without it get `parentBlock` as is.
   */
  private async firstBlockOfParentBlock(parentBlock: bigint, head: bigint): Promise<bigint> {
    const parentOf = async (n: bigint): Promise<bigint | null> => {
      const block = (await this.client.getBlock({ blockNumber: n })) as unknown as {
        l1BlockNumber?: string | bigint;
      };
      return block.l1BlockNumber === undefined ? null : BigInt(block.l1BlockNumber);
    };
    if ((await parentOf(head)) === null) return parentBlock;
    let lo = 0n;
    let hi = head;
    while (lo < hi) {
      const mid = (lo + hi) / 2n;
      const parent = await parentOf(mid);
      if (parent !== null && parent >= parentBlock) hi = mid;
      else lo = mid + 1n;
    }
    return lo;
  }

  private holdersTouched(
    logs: Array<{ address: Address; args: { from?: Address; to?: Address } }>,
  ): Map<string, Set<`0x${string}`>> {
    const touched = new Map<string, Set<`0x${string}`>>();
    for (const log of logs) {
      const set = touched.get(log.address.toLowerCase()) ?? new Set<`0x${string}`>();
      for (const holder of [log.args.from, log.args.to]) {
        if (holder && holder.toLowerCase() !== ZERO_ADDRESS)
          set.add(holder.toLowerCase() as Address);
      }
      touched.set(log.address.toLowerCase(), set);
    }
    return touched;
  }

  /** balanceOf at `blockNumber` (latest if the RPC no longer has that state) for each holder. */
  private async refreshBalances(
    touched: Map<string, Set<`0x${string}`>>,
    blockNumber: bigint,
  ): Promise<void> {
    for (const [tokenAddress, holders] of touched) {
      const list = [...holders];
      const balances: Array<{ holder: `0x${string}`; balance: bigint }> = [];
      for (let i = 0; i < list.length; i += 20) {
        const chunk = list.slice(i, i + 20);
        const read = async (holder: `0x${string}`, at?: bigint) =>
          this.client.readContract({
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [holder],
            ...(at === undefined ? {} : { blockNumber: at }),
          });
        const values = await Promise.all(
          chunk.map((h) => read(h, blockNumber).catch(() => read(h))),
        );
        chunk.forEach((holder, j) => balances.push({ holder, balance: values[j] }));
      }
      await this.tokenRepository.saveBalances!(tokenAddress as Address, balances);
    }
  }
}
