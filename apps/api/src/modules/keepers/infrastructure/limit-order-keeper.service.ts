import type { PublicClient, WalletClient } from 'viem';
import { constantProductSellAt, sqrtPriceX96ToQuotePrice } from '@goton/math-sdk';
import {
  bondingCurveAbi,
  gotonLimitOrdersAbi,
  launchpadTokenAbi,
  limitOrderContractOf,
  limitOrderContracts,
  protoV4PoolKeyFor,
  readV4PoolState,
  v4PoolId,
  type LimitOrderEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../../core/ports/token.repository.port';
import { isRateLimited } from '../../../core/rpc';
import { sendAndWait, sentResult } from './keeper-tx';

export { isRateLimited };

const EXECUTOR_FEE_BPS = 10n;
/** v4 pool LP fee. */
const POOL_FEE_BPS = 100;
/**
 * Share of a pool sell's estimated proceeds the fee check counts on: the estimate takes only the
 * in-range liquidity's price impact, so keep a margin for the rest.
 */
const POOL_ESTIMATE_MARGIN = 0.9;
const LEG_TAKE_PROFIT = 0;
export const RATE_LIMITED = 'Rate limited';

const LEG_STOP_LOSS = 1;

export interface LimitOrderFill {
  key: string;
  executed: boolean;
  reason?: string;
  txHash?: `0x${string}`;
}

type Call = { functionName: string; args: readonly unknown[] };

/** Live open orders read per cycle. */
export const KEEPER_PAGE = 500;

/**
 * Fills open GotonLimitOrders orders. The keeper never computes prices: it simulates each order's
 * fill and sends it only when the simulation passes, so the contract (limit, floors, TWAP stop
 * trigger, route checks) is the only judge. A fill is sent only when its executor fee covers the
 * gas, so the keeper does not pay to fill orders too small to sustain it.
 */
export class LimitOrderKeeperService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly repository: TokenRepositoryPort,
    private readonly network: NetworkConfig,
    /** Native units per quote raw unit (1, or 1e12 for Arc USDC). */
    private readonly nativeScale: bigint = 1n,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Where the next cycle's page of live orders starts. Each cycle reads KEEPER_PAGE of them, the
   * next page each time and back to the start after the last: reading only the newest 500 meant
   * that once more were open (expired ones counted too, as they stay open until cancelled), older
   * stop-losses were never looked at again, and anyone could push them out with small orders.
   */
  private pageStart = 0;

  async runOnce(maxFills = 20): Promise<LimitOrderFill[]> {
    // The current deployment and earlier ones that may still hold orders.
    const contracts = new Set(limitOrderContracts(this.network).map((a) => a.toLowerCase()));
    if (contracts.size === 0 || !this.walletClient || !this.repository.listLimitOrders) return [];
    const [account] = await this.walletClient.getAddresses();
    if (!account) return [];

    const nowSec = Math.floor(this.now() / 1000);
    const page = (offset: number) =>
      this.repository.listLimitOrders!({
        status: 'open',
        chainId: this.network.chainId,
        liveAt: nowSec,
        oldestFirst: true,
        limit: KEEPER_PAGE,
        offset,
      });
    let open = await page(this.pageStart);
    if (open.length === 0 && this.pageStart > 0) {
      this.pageStart = 0;
      open = await page(0);
    }
    this.pageStart = open.length < KEEPER_PAGE ? 0 : this.pageStart + KEEPER_PAGE;
    const results: LimitOrderFill[] = [];
    let fills = 0;
    for (const order of open) {
      if (order.deadline < nowSec) continue;
      if (fills >= maxFills) break;
      const contract = limitOrderContractOf(this.network, order);
      if (!contract || !contracts.has(contract.toLowerCase())) continue;
      const result = await this.tryFill(contract, account, order);
      if (!result) continue;
      results.push(result);
      if (result.executed) fills++;
      // A pending receipt or a rate-limited RPC: stop this cycle, the next one picks up.
      if (result.reason === 'Receipt pending' || result.reason === RATE_LIMITED) break;
    }
    return results;
  }

  /** The calls that could fill this order, most protective first (stop-loss before take-profit). */
  private async candidateCalls(order: LimitOrderEntity): Promise<Call[]> {
    const id = BigInt(order.orderId);
    const token = await this.repository.findByAddress(order.token);
    const onCurve =
      token?.version === 'v2' && !token.isGraduated && token.curveAddress
        ? token.curveAddress
        : null;
    const key = onCurve ? null : protoV4PoolKeyFor(this.network, order.token);
    if (!onCurve && !key) return [];

    if (order.isBuy) {
      return [
        onCurve
          ? { functionName: 'executeBuyOnCurve', args: [id, onCurve] }
          : { functionName: 'executeBuyOnPool', args: [id, key] },
      ];
    }
    const legs = [
      ...(order.slPriceX36 !== '0' ? [LEG_STOP_LOSS] : []),
      ...(order.minOut !== '0' ? [LEG_TAKE_PROFIT] : []),
    ];
    return legs.map((leg) =>
      onCurve
        ? { functionName: 'executeSellOnCurve', args: [id, onCurve, leg] }
        : { functionName: 'executeSellOnPool', args: [id, key, leg] },
    );
  }

  /**
   * The executor fee a fill pays, in native units. A buy pays a share of its deposit. A sell pays a
   * share of what it sells for, which is estimated (on the curve exactly) because the order's floor
   * can sit far below it: a stop-loss with a loose floor was skipped as not covering gas. The floor
   * still bounds the estimate from below.
   */
  private async expectedFee(order: LimitOrderEntity, call: Call): Promise<bigint> {
    if (order.isBuy) return (BigInt(order.amount) * EXECUTOR_FEE_BPS) / 10_000n;
    const leg = Number(call.args[2]);
    const floor = BigInt(leg === LEG_STOP_LOSS ? order.slMinOut : order.minOut);
    const proceeds = await this.sellProceeds(order, call).catch(() => 0n);
    const quoteOut = proceeds > floor ? proceeds : floor;
    return ((quoteOut * EXECUTOR_FEE_BPS) / 10_000n) * this.nativeScale;
  }

  /** What selling the order's tokens would pay now, in quote raw units (0 when unknown). */
  private async sellProceeds(order: LimitOrderEntity, call: Call): Promise<bigint> {
    const amount = BigInt(order.amount);
    if (call.functionName === 'executeSellOnCurve') {
      const [ethOut] = (await this.publicClient.readContract({
        address: call.args[1] as `0x${string}`,
        abi: bondingCurveAbi,
        functionName: 'getAmountOutSell',
        args: [amount],
      })) as readonly [bigint, bigint];
      return ethOut;
    }
    const key = call.args[1] as Parameters<typeof v4PoolId>[0];
    const [{ sqrtPriceX96, liquidity }, tax] = await Promise.all([
      readV4PoolState(this.publicClient, this.network.contracts.poolManagerV4!, v4PoolId(key)),
      this.publicClient.readContract({
        address: order.token,
        abi: launchpadTokenAbi,
        functionName: 'taxConfig',
      }) as Promise<readonly [number, number, `0x${string}`]>,
    ]);
    // Raw quote per raw token (both sides' decimals cancel out when both are passed as equal).
    const tokenIs0 = key.currency0.toLowerCase() === order.token.toLowerCase();
    const price = sqrtPriceX96ToQuotePrice(sqrtPriceX96, tokenIs0, 0, 0);
    const k = Number(liquidity) ** 2;
    const out =
      constantProductSellAt(k, price, Number(amount), POOL_FEE_BPS) * (1 - tax[1] / 10_000);
    return BigInt(Math.floor(out * POOL_ESTIMATE_MARGIN));
  }

  private async tryFill(
    contract: `0x${string}`,
    account: `0x${string}`,
    order: LimitOrderEntity,
  ): Promise<LimitOrderFill | null> {
    const calls = await this.candidateCalls(order).catch(() => []);
    // A leg whose fee does not cover gas must not hide the order's other leg.
    let unprofitable: LimitOrderFill | null = null;
    for (const call of calls) {
      try {
        const { request } = await this.publicClient.simulateContract({
          address: contract,
          abi: gotonLimitOrdersAbi,
          functionName: call.functionName as never,
          args: call.args as never,
          account,
        });
        const [gas, gasPrice] = await Promise.all([
          this.publicClient.estimateContractGas({
            address: contract,
            abi: gotonLimitOrdersAbi,
            functionName: call.functionName as never,
            args: call.args as never,
            account,
          }),
          this.publicClient.getGasPrice(),
        ]);
        if (gas * gasPrice > (await this.expectedFee(order, call))) {
          unprofitable = { key: order.key, executed: false, reason: 'Fee does not cover gas' };
          continue;
        }
        const sent = await sendAndWait(this.publicClient, this.walletClient!, request);
        return { key: order.key, ...sentResult(sent) };
      } catch (e) {
        // A rate-limited RPC says nothing about the order: report it instead of moving on as if
        // the order were not fillable, which hid fillable stops behind a busy public RPC.
        if (isRateLimited(e)) return { key: order.key, executed: false, reason: RATE_LIMITED };
        // Otherwise not fillable on this leg yet (limit not reached, stop not triggered, oracle not ready).
      }
    }
    return unprofitable;
  }
}
