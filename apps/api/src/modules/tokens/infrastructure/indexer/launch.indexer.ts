import { type Address } from 'viem';
import {
  TOKEN_LAUNCHED_V2_EVENT,
  TOKEN_LAUNCHED_V2_STANDARD_EVENT,
  TOKEN_LAUNCHED_V4_EVENT,
  TOKEN_GRADUATED_EVENT,
  TOKEN_LAUNCHED_V1_EVENT,
} from './indexer-events';
import { ChainIndexerPart } from './indexer-context';

/** Token launches (V1, V2 curves, V4 pools) and curve graduations. */
export class LaunchIndexer extends ChainIndexerPart {
  async pollV1Launches(from: bigint, to: bigint): Promise<number> {
    const factory = this.network.contracts.factory;
    const factoryV2 = this.network.contracts.factoryV2;

    // Skip V1 poll if factory === factoryV2 (Arc uses V2-only)
    if (!factory || factory === '0x0000000000000000000000000000000000000000') return 0;
    if (factory === factoryV2) return 0;

    try {
      const logs = await this.client.getLogs({
        address: factory as Address,
        event: TOKEN_LAUNCHED_V1_EVENT,
        fromBlock: from,
        toBlock: to,
      });

      for (const log of logs) {
        const tokenAddress = log.args.token as Address;
        if (!tokenAddress) continue;
        const entity = await this.chainIndexer.fetchLaunchedTokenFromChain(
          tokenAddress,
          this.network,
        );
        if (entity) await this.tokenRepository.save(entity);
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] V1 launch poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  async pollV2Launches(from: bigint, to: bigint): Promise<number> {
    const factoryV2 = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!factoryV2 || factoryV2 === '0x0000000000000000000000000000000000000000') return 0;

    try {
      const [logs1, logs2] = await Promise.all([
        this.client
          .getLogs({
            address: factoryV2 as Address,
            event: TOKEN_LAUNCHED_V2_EVENT,
            fromBlock: from,
            toBlock: to,
          })
          .catch(() => []),
        this.client
          .getLogs({
            address: factoryV2 as Address,
            event: TOKEN_LAUNCHED_V2_STANDARD_EVENT,
            fromBlock: from,
            toBlock: to,
          })
          .catch(() => []),
      ]);
      const logs = [...logs1, ...logs2];
      for (const log of logs) {
        const tokenAddress = log.args.token as Address;
        const curveAddress = log.args.curve as Address;
        if (!tokenAddress || !curveAddress) continue;

        // Skip RPC fetch if this token is already indexed
        const existing = await this.tokenRepository.findByAddress(tokenAddress);
        if (existing) continue;

        const entity = await this.chainIndexer.fetchV2LaunchedToken(
          tokenAddress,
          curveAddress,
          this.network,
        );
        if (entity) {
          // The launch block's time, not the time it was indexed: charts start at createdAt, and
          // the launch buy and the first trades after it would fall before a later one.
          const launchedAt = log.blockNumber
            ? await this.client
                .getBlock({ blockNumber: log.blockNumber })
                .then((b) => Number(b.timestamp) * 1000)
                .catch(() => entity.createdAt)
            : entity.createdAt;
          await this.tokenRepository.save({
            ...entity,
            version: 'v2',
            curveAddress,
            launchBlock: log.blockNumber ?? entity.launchBlock,
            createdAt: launchedAt,
          });
        }
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] V2 launch poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  async pollV4Launches(from: bigint, to: bigint): Promise<number> {
    const factory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!factory || factory === '0x0000000000000000000000000000000000000000') return 0;
    try {
      const logs = await this.client.getLogs({
        address: factory as Address,
        event: TOKEN_LAUNCHED_V4_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        const { token, poolId, creator, prebuyUsdc6 } = log.args;
        if (!token || !poolId || !creator) continue;
        if (await this.tokenRepository.findByAddress(token)) continue;
        const entity = await this.chainIndexer.fetchV4LaunchedToken(
          token,
          poolId,
          creator,
          prebuyUsdc6 ?? 0n,
          this.network,
        );
        if (entity) await this.tokenRepository.save(entity);
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] V4 launch poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }

  /** Points graduated tokens at their v4 pool id so pollV4Swaps picks up their trades. */
  async pollGraduations(from: bigint, to: bigint): Promise<number> {
    const factory = this.network.contracts.factoryV2 ?? this.network.contracts.factory;
    if (!factory || factory === '0x0000000000000000000000000000000000000000') return 0;
    try {
      const logs = await this.client.getLogs({
        address: factory as Address,
        event: TOKEN_GRADUATED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs) {
        const { token, poolId } = log.args;
        if (!token || !poolId) continue;
        const existing = await this.tokenRepository.findByAddress(token);
        if (!existing) continue;
        await this.tokenRepository.save({
          ...existing,
          poolAddress: poolId,
          // Native ETH is always currency0 in graduated pools.
          isToken0: false,
          isGraduated: true,
        });
      }
      return logs.length;
    } catch (e) {
      console.warn(
        `[EventPoller:${this.network.name}] Graduation poll error:`,
        (e as Error).message,
      );
      // Rethrow so pollEvents keeps the cursor and retries this range.
      throw e;
    }
  }
}
