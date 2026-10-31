import type { PublicClient, WalletClient } from 'viem';
import { constantProductSellAt, sqrtPriceX96ToQuotePrice } from '@goton/math-sdk';
import {
  UNDEPLOYED,
  bondingCurveAbi,
  gotonLimitOrdersAbi,
  launchpadTokenAbi,
  protoV4PoolKeyFor,
  readV4PoolState,
  v4PoolId,
  type LimitOrderEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';
import { sendAndWait, sentResult } from './keeper-tx';

const EXECUTOR_FEE_BPS = 10n;
/** v4 pool LP fee. */
const POOL_FEE_BPS = 100;
/**
 * Share of a pool sell's estimated proceeds the fee check counts on: the estimate takes only the
 * in-range liquidity's price impact, so keep a margin for the rest.
 */
const POOL_ESTIMATE_MARGIN = 0.9;
const LEG_TAKE_PROFIT = 0;
const LEG_STOP_LOSS = 1;

export interface LimitOrderFill {
  key: string;
  executed: boolean;
  reason?: string;
  txHash?: `0x${string}`;
}

type Call = { functionName: string; args: readonly unknown[] };

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

  private get contract(): `0x${string}` | null {
    const a = this.network.contracts.limitOrders;
    return a && a !== UNDEPLOYED ? a : null;
  }

  async runOnce(maxFills = 20): Promise<LimitOrderFill[]> {
    const contract = this.contract;
    if (!contract || !this.walletClient || !this.repository.listLimitOrders) return [];
    const [account] = await this.walletClient.getAddresses();
    if (!account) return [];

    const open = await this.repository.listLimitOrders({
      status: 'open',
      chainId: this.network.chainId,
      limit: 500,
    });
    const nowSec = Math.floor(this.now() / 1000);
    const results: LimitOrderFill[] = [];
    let fills = 0;
    for (const order of open) {
      if (order.deadline < nowSec) continue;
      if (fills >= maxFills) break;
      const result = await this.tryFill(contract, account, order);
      if (!result) continue;
      results.push(result);
      if (result.executed) fills++;
      if (result.reason === 'Receipt pending') break;
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
      } catch {
        // Not fillable on this leg yet (limit not reached, stop not triggered, oracle not ready).
      }
    }
    return unprofitable;
  }
}
