export type IntentActionType = 'LAUNCH_TOKEN' | 'SWAP_BUY' | 'SWAP_SELL' | 'CLAIM_FEES';

export interface LaunchTokenIntentPayload {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  website?: string;
  farcaster?: string;
  initialBuyAmountWei?: string;
}

export interface SwapIntentPayload {
  tokenAddress: `0x${string}`;
  isBuy: boolean;
  amountInWei: string;
  minAmountOutWei: string;
  slippageTolerancePercent: number;
}

export interface ClaimFeesIntentPayload {
  tokenAddress: `0x${string}`;
}

export interface TransactionIntent<T = unknown> {
  id: string;
  sender: `0x${string}`;
  action: IntentActionType;
  chainId: number;
  payload: T;
  timestamp: number;
  estimatedGas?: bigint;
}

export interface SecurityPolicyCheck {
  code: string;
  description: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  message?: string;
}

export interface SecurityEvaluationResult {
  intentId: string;
  allowed: boolean;
  reason?: string;
  checks: SecurityPolicyCheck[];
  evaluatedAt: number;
  suggestedAction?: 'APPROVE' | 'REJECT' | 'WARN';
}
