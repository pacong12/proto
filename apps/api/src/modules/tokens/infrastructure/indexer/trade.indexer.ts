import { replayCurveReserves, sqrtPriceX96ToQuotePrice } from '@goton/math-sdk';
import { erc20Abi, isAddress, type Address } from 'viem';
import {
  bondingCurveAbi,
  launchpadTokenAbi,
  type LaunchedTokenEntity,
  type TradeEventEntity,
} from '@goton/shared-types';
import { findAllTokens } from '../../application/all-tokens';
import {
  SWAP_EVENT,
  TRADE_EVENT,
  V4_SWAP_EVENT,
  CONFIRMATIONS,
  LOG_ADDRESS_BATCH,
} from './indexer-events';
import { ChainIndexerPart } from './indexer-context';

/** Curve trades, V1 and V4 pool swaps, and curve trade history backfills. */
export class TradeIndexer extends ChainIndexerPart {
  private quoteDecimals: number | null = null;

  async pollV2Trades(from: bigint, to: bigint): Promise<number> {
    // Every v2 token's curve, graduated ones included: graduation replaces poolAddress with the v4
    // pool id, and a range can hold the curve's last trades and the graduation together.
    const allTokens = await findAllTokens(this.tokenRepository);
    const curveOf = (t: LaunchedTokenEntity) => t.curveAddress ?? t.poolAddress;
    const v2Tokens = allTokens.filter((t) => t.version === 'v2' && isAddress(curveOf(t)));

    if (v2Tokens.length === 0) return 0;

    const curveAddresses = v2Tokens.map((t) => curveOf(t) as Address);
    const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);

    try {
      // API-08: query in address batches so a growing token list never exceeds RPC limits.
      const logs = [];
      for (let i = 0; i < curveAddresses.length; i += LOG_ADDRESS_BATCH) {
        const batch = curveAddresses.slice(i, i + LOG_ADDRESS_BATCH);
        logs.push(
          ...(await this.client.getLogs({
            address: batch.length === 1 ? batch[0] : batch,
            event: TRADE_EVENT,
            fromBlock: from,
            toBlock: to,
          })),
        );
      }

      if (logs.length === 0) return 0;

      const tokenByCurve = new Map(v2Tokens.map((t) => [curveOf(t).toLowerCase(), t]));
      return await this.saveTradeLogs(logs, tokenByCurve, quotePriceUsd);
    } catch (e) {
      console.warn(`[EventPoller:${this.network.name}] V2 trade poll error:`, (e as Error).message);
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  async pollV1Swaps(from: bigint, to: bigint): Promise<number> {
    const allTokens = await findAllTokens(this.tokenRepository);
    // Only poll V1 tokens (or graduated V2 which now have a Uniswap V3 pool)
    const v1Tokens = allTokens.filter(
      (t) =>
        (t.version === 'v1' || t.isGraduated) &&
        typeof t.poolAddress === 'string' &&
        t.poolAddress.length === 42 &&
        t.poolAddress.startsWith('0x'),
    );

    if (v1Tokens.length === 0) return 0;

    const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);

    try {
      const poolAddresses = v1Tokens.map((t) => t.poolAddress as Address);
      // API-08: same address batching as the V2 trade poll.
      const logs = [];
      for (let i = 0; i < poolAddresses.length; i += LOG_ADDRESS_BATCH) {
        const batch = poolAddresses.slice(i, i + LOG_ADDRESS_BATCH);
        logs.push(
          ...(await this.client.getLogs({
            address: batch.length === 1 ? batch[0] : batch,
            event: SWAP_EVENT,
            fromBlock: from,
            toBlock: to,
          })),
        );
      }

      if (logs.length === 0) return 0;

      const tokenByPool = new Map(v1Tokens.map((t) => [t.poolAddress.toLowerCase(), t]));
      const blockTimestamps = new Map<bigint, number>();

      let count = 0;
      for (const swap of logs) {
        const token = tokenByPool.get(swap.address.toLowerCase());
        if (!token) continue;

        const { sender, recipient, amount0, amount1, sqrtPriceX96 } = swap.args as {
          sender: Address;
          recipient: Address;
          amount0: bigint;
          amount1: bigint;
          sqrtPriceX96: bigint;
          liquidity: bigint;
          tick: number;
        };

        if (amount0 === undefined || amount1 === undefined) continue;

        const isToken0 = token.isToken0;
        // Uniswap V3 sign convention: negative amount = asset flows OUT of the pool (to user).
        // Buy token = token flows out of pool → tokenAmount < 0.
        // token is amount0 when isToken0, amount1 otherwise.
        const tokenAmountSigned = isToken0 ? amount0 : amount1;
        const isBuy = tokenAmountSigned < 0n;

        const tokenAmountRaw = Math.abs(Number(tokenAmountSigned)) / 1e18;
        const wethAmountSigned = isToken0 ? amount1 : amount0;
        const wethAmountRaw = Math.abs(Number(wethAmountSigned)) / 1e18;

        const marketData = this.calculatePricing.execute({
          address: token.address,
          sqrtPriceX96: sqrtPriceX96 ?? 2505414483750479299401734n,
          isToken0: token.isToken0,
          pairedPrincipalWei: 0n,
          ethPriceUsd: quotePriceUsd,
          totalSupply: BigInt(token.totalSupply || '1000000000000000000000000000'),
        });

        const blockNumber = swap.blockNumber ?? 0n;
        let timestamp = blockTimestamps.get(blockNumber);
        if (timestamp === undefined) {
          try {
            const block = await this.client.getBlock({ blockNumber });
            timestamp = Number(block.timestamp) * 1000;
          } catch {
            timestamp = Date.now();
          }
          blockTimestamps.set(blockNumber, timestamp);
        }

        const trade: TradeEventEntity = {
          id: `${swap.transactionHash}-${swap.logIndex}`,
          tokenAddress: token.address,
          poolAddress: token.poolAddress,
          trader: (recipient ?? sender ?? '0x0000000000000000000000000000000000000000') as Address,
          isBuy,
          tokenAmount: tokenAmountRaw.toFixed(4),
          wethAmount: wethAmountRaw.toFixed(6),
          priceUsd: marketData.priceUsd,
          priceQuote: marketData.priceInWeth,
          blockNumber,
          transactionHash: swap.transactionHash ?? '0x0',
          timestamp,
        };

        await this.tokenRepository.saveTrade(trade);
        count++;
      }
      return count;
    } catch (e) {
      console.warn(`[EventPoller:${this.network.name}] V1 swap poll error:`, (e as Error).message);
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  /** Decimals of the pool quote currency (18 for ETH / WETH, 6 for Arc USDC), read once. */
  private async getQuoteDecimals(): Promise<number> {
    if (this.quoteDecimals === null) {
      this.quoteDecimals = await this.client
        .readContract({
          address: this.network.contracts.weth,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        .catch(() => this.network.nativeCurrency.decimals);
    }
    return this.quoteDecimals;
  }

  async pollV4Swaps(from: bigint, to: bigint): Promise<number> {
    const poolManager = this.network.contracts.poolManagerV4;
    if (!poolManager || poolManager === '0x0000000000000000000000000000000000000000') return 0;

    try {
      const logs = await this.client.getLogs({
        address: poolManager as Address,
        event: V4_SWAP_EVENT,
        fromBlock: from,
        toBlock: to,
      });

      if (logs.length === 0) return 0;

      const allTokens = await findAllTokens(this.tokenRepository);
      const tokenByPoolId = new Map(allTokens.map((t) => [t.poolAddress.toLowerCase(), t]));
      const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);
      const blockTimestamps = new Map<bigint, number>();
      const txSenders = new Map<string, Address | null>();

      let count = 0;
      for (const log of logs) {
        const poolId = (log.args as { id?: string })?.id?.toLowerCase();
        if (!poolId) continue;
        const token = tokenByPoolId.get(poolId);
        if (!token) continue;

        const { sender, amount0, amount1, sqrtPriceX96 } = log.args as {
          sender?: Address;
          amount0?: bigint;
          amount1?: bigint;
          sqrtPriceX96?: bigint;
        };
        if (amount0 === undefined || amount1 === undefined) continue;

        // v4 Swap amounts are the swapper's deltas: negative = paid into the pool. The quote
        // side is whichever currency is not the token (token.isToken0 tells the order).
        const quoteDecimals = await this.getQuoteDecimals();
        const quoteDelta = token.isToken0 ? amount1 : amount0;
        const tokenDelta = token.isToken0 ? amount0 : amount1;
        const usdcAmountNum = Math.abs(Number(quoteDelta)) / 10 ** quoteDecimals;
        const tokenAmountNum = Math.abs(Number(tokenDelta)) / 1e18;
        const isBuy = quoteDelta < 0n;

        // The pool's price after the swap. The swap's own ratio is its average price, which
        // sits below the price a buy leaves (and above the one a sell leaves), so a buy after a
        // sell could chart lower than that sell.
        const spot = sqrtPriceX96
          ? sqrtPriceX96ToQuotePrice(sqrtPriceX96, token.isToken0, quoteDecimals)
          : 0;
        const priceQuote =
          spot > 0 ? spot : tokenAmountNum > 0 ? usdcAmountNum / tokenAmountNum : 0;
        const priceUsd = priceQuote * quotePriceUsd;

        const blockNumber = log.blockNumber ?? 0n;
        let timestamp = blockTimestamps.get(blockNumber);
        if (timestamp === undefined) {
          try {
            const block = await this.client.getBlock({ blockNumber });
            timestamp = Number(block.timestamp) * 1000;
          } catch {
            timestamp = Date.now();
          }
          blockTimestamps.set(blockNumber, timestamp);
        }

        // The Swap event's sender is whatever called PoolManager.swap: the router, the limit-order
        // contract or the buyback, never the trader. The transaction's signer is the trader.
        const signer = await this.txSender(log.transactionHash, txSenders);
        const trade: TradeEventEntity = {
          id: `${log.transactionHash}-${log.logIndex}`,
          tokenAddress: token.address,
          poolAddress: token.poolAddress,
          trader: (signer ?? sender ?? '0x0000000000000000000000000000000000000000') as Address,
          isBuy,
          tokenAmount: tokenAmountNum.toFixed(4),
          wethAmount: usdcAmountNum.toFixed(6),
          priceUsd,
          priceQuote,
          blockNumber,
          transactionHash: log.transactionHash ?? '0x0',
          timestamp,
        };

        await this.tokenRepository.saveTrade(trade);
        await this.refreshMarketAfterTrade(token, priceUsd, quotePriceUsd);
        count++;
      }
      return count;
    } catch (e) {
      console.warn(`[EventPoller:${this.network.name}] V4 swap poll error:`, (e as Error).message);
      throw e;
    }
  }

  /** Saves decoded curve Trade logs (idempotent: trade ids are txHash-logIndex). */
  private async saveTradeLogs(
    logs: Awaited<ReturnType<TradeIndexer['fetchTradeLogs']>>,
    tokenByCurve: Map<string, LaunchedTokenEntity>,
    quotePriceUsd: number,
  ): Promise<number> {
    const blockTimestamps = new Map<bigint, number>();
    const spots = await this.curveTradeSpots(logs, tokenByCurve);

    let count = 0;
    for (const log of logs) {
      const token = tokenByCurve.get(log.address.toLowerCase());
      if (!token) continue;

      const { trader, isBuy, ethAmount, tokenAmount } = log.args as {
        trader: Address;
        isBuy: boolean;
        ethAmount: bigint;
        tokenAmount: bigint;
        feeEth: bigint;
      };

      if (ethAmount === undefined || tokenAmount === undefined) continue;

      const ethAmountNum = Number(ethAmount) / 1e18;
      const tokenAmountNum = Number(tokenAmount) / 1e18;

      // The curve's spot price right after the trade. The trade's own ratio is not a price: in
      // the first seconds the anti-snipe tax (up to 99%) shrinks tokenAmount and made a buy look
      // up to 100x dearer, and the fee and price impact skew it too.
      const spotNative = spots.get(`${log.transactionHash}-${log.logIndex}`) ?? null;
      // Older than the RPC's state history (a deep backfill): the trade ratio is all there is.
      const priceQuote = spotNative ?? (tokenAmountNum > 0 ? ethAmountNum / tokenAmountNum : 0);
      const priceUsd = priceQuote * quotePriceUsd;

      const blockNumber = log.blockNumber ?? 0n;
      let timestamp = blockTimestamps.get(blockNumber);
      if (timestamp === undefined) {
        try {
          const block = await this.client.getBlock({ blockNumber });
          // Arc Network block.timestamp is in seconds (Unix standard)
          timestamp = Number(block.timestamp) * 1000;
        } catch {
          timestamp = Date.now();
        }
        blockTimestamps.set(blockNumber, timestamp);
      }

      const trade: TradeEventEntity = {
        id: `${log.transactionHash}-${log.logIndex}`,
        tokenAddress: token.address,
        poolAddress: token.poolAddress,
        trader,
        isBuy,
        tokenAmount: tokenAmountNum.toFixed(4),
        wethAmount: ethAmountNum.toFixed(6),
        priceUsd,
        priceQuote,
        blockNumber,
        transactionHash: log.transactionHash ?? '0x0',
        timestamp,
      };

      await this.tokenRepository.saveTrade(trade);
      await this.refreshMarketAfterTrade(token, priceUsd, quotePriceUsd);
      count++;
    }
    return count;
  }

  /** The address that signed `hash`, or null if the transaction cannot be read. */
  private async txSender(
    hash: `0x${string}` | null,
    cache: Map<string, Address | null>,
  ): Promise<Address | null> {
    if (!hash) return null;
    const cached = cache.get(hash);
    if (cached !== undefined) return cached;
    let from: Address | null = null;
    try {
      from = (await this.client.getTransaction({ hash })).from;
    } catch {
      // Unreadable transaction: the caller falls back to the Swap event's sender.
    }
    cache.set(hash, from);
    return from;
  }

  /** Curve spot price (quote per token) at the end of `blockNumber`, or null if unreadable. */
  /**
   * Moves the token's stored market data to a trade's price (and its 24h volume), so the token's
   * stream and lists follow trades as they are indexed, on the curve and in its pool.
   */
  private async refreshMarketAfterTrade(
    token: LaunchedTokenEntity,
    priceUsd: number,
    quotePriceUsd: number,
  ): Promise<void> {
    if (!(priceUsd > 0)) return;
    const mkt = await this.tokenRepository.getMarketData(token.address);
    if (mkt) {
      const supplyTokens = token.totalSupply
        ? Number(BigInt(token.totalSupply)) / 1e18
        : 1_000_000_000;
      // Recompute 24h volume from stored trades so the value is always accurate
      // and never lost when saveMarketData overwrites the DB row. Summed in SQL: the newest
      // 500 trades undercount any token that trades more often than that in a day.
      const cutoff24h = Date.now() - 86_400_000;
      let volume24hQuote: number;
      if (this.tokenRepository.getTradeFlow) {
        const flow = await this.tokenRepository.getTradeFlow(token.address, cutoff24h);
        volume24hQuote = flow.buyQuote + flow.sellQuote;
      } else {
        const recentTrades = await this.tokenRepository.getTrades(token.address, 500, 0);
        volume24hQuote = recentTrades
          .filter((t) => (t.timestamp ?? 0) >= cutoff24h)
          .reduce((sum, t) => sum + parseFloat(t.wethAmount || '0'), 0);
      }
      const volume24hUsd = volume24hQuote * quotePriceUsd;
      await this.tokenRepository.saveMarketData({
        ...mkt,
        priceUsd,
        priceInWeth: priceUsd / quotePriceUsd,
        marketCapUsd: priceUsd * supplyTokens,
        fdvUsd: priceUsd * supplyTokens,
        volume24hUsd,
      });
    }
  }

  /**
   * The curve's spot price right after each trade (by `txHash-logIndex`), null when its block is
   * older than the RPC's state history. One trade in a block gets the block's closing spot; several
   * get it walked back through their amounts (replayCurveReserves), so a buy followed by a sell in
   * the same block keeps its own, higher, price.
   */
  private async curveTradeSpots(
    logs: Awaited<ReturnType<TradeIndexer['fetchTradeLogs']>>,
    tokenByCurve: Map<string, LaunchedTokenEntity>,
  ): Promise<Map<string, number | null>> {
    const groups = new Map<string, typeof logs>();
    for (const log of logs) {
      if (log.blockNumber === null) continue;
      const key = `${log.address.toLowerCase()}-${log.blockNumber}`;
      groups.set(key, [...(groups.get(key) ?? []), log]);
    }
    const spots = new Map<string, number | null>();
    for (const group of groups.values()) {
      group.sort((a, b) => (a.logIndex ?? 0) - (b.logIndex ?? 0));
      const { address, blockNumber } = group[0]!;
      const closing = await this.curveReservesAtBlock(address, blockNumber!);
      const token = tokenByCurve.get(address.toLowerCase());
      const sellTaxBps =
        closing && group.length > 1 && token ? await this.sellTaxBps(token.address) : 0n;
      const after = closing
        ? replayCurveReserves(
            closing,
            group.map((log) => {
              const a = log.args as {
                isBuy: boolean;
                ethAmount: bigint;
                tokenAmount: bigint;
                feeEth: bigint;
              };
              return {
                isBuy: a.isBuy,
                ethAmount: a.ethAmount,
                tokenAmount: a.tokenAmount,
                feeEth: a.feeEth ?? 0n,
              };
            }),
            sellTaxBps,
          ).after
        : [];
      group.forEach((log, i) => {
        const r = after[i];
        spots.set(
          `${log.transactionHash}-${log.logIndex}`,
          r && r.virtualTokenWei > 0n ? Number(r.virtualEthWei) / Number(r.virtualTokenWei) : null,
        );
      });
    }
    return spots;
  }

  /** The curve's virtual reserves at the end of a block, or null past the RPC's state history. */
  private async curveReservesAtBlock(curve: Address, blockNumber: bigint) {
    try {
      const [virtualEthWei, virtualTokenWei] = await Promise.all([
        this.client.readContract({
          address: curve,
          abi: bondingCurveAbi,
          functionName: 'virtualEthReserve',
          blockNumber,
        }) as Promise<bigint>,
        this.client.readContract({
          address: curve,
          abi: bondingCurveAbi,
          functionName: 'virtualTokenReserve',
          blockNumber,
        }) as Promise<bigint>,
      ]);
      return { virtualEthWei, virtualTokenWei };
    } catch {
      // The RPC keeps a limited state history (about 2,000 blocks on Robinhood Chain).
      return null;
    }
  }

  /** The token's sell tax: a taxed sell leaves the curve fewer tokens than it sold. */
  private async sellTaxBps(token: Address): Promise<bigint> {
    try {
      const [, sellTaxBps] = (await this.client.readContract({
        address: token,
        abi: launchpadTokenAbi,
        functionName: 'taxConfig',
      })) as readonly [number, number, Address];
      return BigInt(sellTaxBps);
    } catch {
      return 0n;
    }
  }

  private fetchTradeLogs(address: Address | Address[], fromBlock: bigint, toBlock: bigint) {
    return this.client.getLogs({ address, event: TRADE_EVENT, fromBlock, toBlock });
  }

  /**
   * Indexes a v2 curve's trades in [from, to] in large chunks. For tokens that entered the database
   * after the live cursor passed their first trades (discovered on a page visit or a late sync),
   * whose earlier trades the poller would otherwise never see. Idempotent.
   */
  async backfillCurveTrades(
    token: LaunchedTokenEntity,
    from: bigint,
    to?: bigint,
  ): Promise<number> {
    const curve = (token.curveAddress || token.poolAddress) as Address;
    if (token.version !== 'v2' || !curve || curve.length !== 42) return 0;
    const end =
      to ??
      (this.lastPolledBlock > 0n
        ? this.lastPolledBlock
        : (await this.client.getBlockNumber()) - CONFIRMATIONS);
    const quotePriceUsd = await this.priceFeed.getQuoteAssetPriceUsd(this.network.chainId);
    const tokenByCurve = new Map([[curve.toLowerCase(), token]]);
    let count = 0;
    for (let start = from < 0n ? 0n : from; start <= end; start += this.backfillChunk) {
      const chunkEnd =
        start + this.backfillChunk - 1n > end ? end : start + this.backfillChunk - 1n;
      const logs = await this.withBackfillRetry(() => this.fetchTradeLogs(curve, start, chunkEnd));
      if (logs.length) count += await this.saveTradeLogs(logs, tokenByCurve, quotePriceUsd);
    }
    return count;
  }
}
