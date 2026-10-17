import type { PublicClient, WalletClient } from 'viem';
import {
  UNDEPLOYED,
  gotonLimitOrdersAbi,
  protoV4PoolKeyFor,
  type LimitOrderEntity,
  type NetworkConfig,
} from '@goton/shared-types';
import type { TokenRepositoryPort } from '../../domain/ports/token.repository.port';

const EXECUTOR_FEE_BPS = 10n;
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

  /** Lower bound of the executor fee, in native units. */
  private feeFloor(order: LimitOrderEntity, call: Call): bigint {
    if (order.isBuy) return (BigInt(order.amount) * EXECUTOR_FEE_BPS) / 10_000n;
    const leg = Number(call.args[2]);
    const floor = BigInt(leg === LEG_STOP_LOSS ? order.slMinOut : order.minOut);
    return ((floor * EXECUTOR_FEE_BPS) / 10_000n) * this.nativeScale;
  }

  private async tryFill(
    contract: `0x${string}`,
    account: `0x${string}`,
    order: LimitOrderEntity,
  ): Promise<LimitOrderFill | null> {
    const calls = await this.candidateCalls(order).catch(() => []);
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
        if (gas * gasPrice > this.feeFloor(order, call)) {
          return { key: order.key, executed: false, reason: 'Fee does not cover gas' };
        }
        const txHash = await this.walletClient!.writeContract(request);
        try {
          await this.publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
        } catch {
          return { key: order.key, executed: true, txHash, reason: 'Receipt pending' };
        }
        return { key: order.key, executed: true, txHash };
      } catch {
        // Not fillable on this leg yet (limit not reached, stop not triggered, oracle not ready).
      }
    }
    return null;
  }
}
