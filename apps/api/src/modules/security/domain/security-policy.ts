import {
  TransactionIntent,
  SecurityEvaluationResult,
  SecurityPolicyCheck,
  ROBINHOOD_CHAIN,
  LaunchTokenIntentPayload,
  SwapIntentPayload,
} from '@proto/shared-types';

export class SecurityPolicy {
  static evaluate(intent: TransactionIntent): SecurityEvaluationResult {
    const checks: SecurityPolicyCheck[] = [];

    // 1. Chain ID Verification
    if (intent.chainId !== ROBINHOOD_CHAIN.chainId) {
      checks.push({
        code: 'INVALID_CHAIN_ID',
        description: `Chain ID ${intent.chainId} does not match Robinhood Chain (${ROBINHOOD_CHAIN.chainId})`,
        passed: false,
        severity: 'CRITICAL',
      });
    } else {
      checks.push({
        code: 'VALID_CHAIN_ID',
        description: 'Chain ID verified for Robinhood Chain',
        passed: true,
        severity: 'INFO',
      });
    }

    // 2. Sender Address Format
    if (!intent.sender || !intent.sender.startsWith('0x') || intent.sender.length !== 42) {
      checks.push({
        code: 'INVALID_SENDER',
        description: 'Sender address must be a valid 42-character hex string',
        passed: false,
        severity: 'CRITICAL',
      });
    } else {
      checks.push({
        code: 'VALID_SENDER',
        description: 'Sender address format is valid',
        passed: true,
        severity: 'INFO',
      });
    }

    // 3. Action-Specific Policies
    if (intent.payload && typeof intent.payload === 'object') {
      if (intent.action === 'LAUNCH_TOKEN') {
        const payload = intent.payload as LaunchTokenIntentPayload;
        if (!payload.name || payload.name.trim().length === 0 || payload.name.length > 60) {
          checks.push({
            code: 'INVALID_TOKEN_NAME',
            description: 'Token name must be between 1 and 60 characters',
            passed: false,
            severity: 'HIGH',
          });
        }
        if (!payload.symbol || payload.symbol.trim().length === 0 || payload.symbol.length > 20) {
          checks.push({
            code: 'INVALID_TOKEN_SYMBOL',
            description: 'Token symbol must be between 1 and 20 characters',
            passed: false,
            severity: 'HIGH',
          });
        }
        if (!payload.logo || payload.logo.trim().length === 0) {
          checks.push({
            code: 'MISSING_TOKEN_IMAGE',
            description: 'Token logo image URI or data encoding is required',
            passed: false,
            severity: 'HIGH',
          });
        }
        // Validate custom tax constraints (max 10% each)
        if (
          payload.buyTaxPercent !== undefined &&
          (payload.buyTaxPercent < 0 || payload.buyTaxPercent > 10)
        ) {
          checks.push({
            code: 'EXCESSIVE_BUY_TAX',
            description: `Buy tax ${payload.buyTaxPercent}% exceeds maximum allowable threshold of 10%`,
            passed: false,
            severity: 'CRITICAL',
          });
        }
        if (
          payload.sellTaxPercent !== undefined &&
          (payload.sellTaxPercent < 0 || payload.sellTaxPercent > 10)
        ) {
          checks.push({
            code: 'EXCESSIVE_SELL_TAX',
            description: `Sell tax ${payload.sellTaxPercent}% exceeds maximum allowable threshold of 10%`,
            passed: false,
            severity: 'CRITICAL',
          });
        }
        if (
          payload.creatorTaxWallet &&
          (!payload.creatorTaxWallet.startsWith('0x') || payload.creatorTaxWallet.length !== 42)
        ) {
          checks.push({
            code: 'INVALID_TAX_WALLET',
            description: 'Creator tax recipient wallet must be a valid 42-character hex address',
            passed: false,
            severity: 'HIGH',
          });
        }
      } else if (intent.action === 'SWAP_BUY' || intent.action === 'SWAP_SELL') {
        const payload = intent.payload as SwapIntentPayload;
        if (payload.slippageTolerancePercent < 0 || payload.slippageTolerancePercent > 50) {
          checks.push({
            code: 'EXCESSIVE_SLIPPAGE',
            description: `Slippage tolerance ${payload.slippageTolerancePercent}% is outside safe bounds (0 - 50%)`,
            passed: false,
            severity: 'HIGH',
          });
        }
        if (
          !payload.tokenAddress ||
          !payload.tokenAddress.startsWith('0x') ||
          payload.tokenAddress.length !== 42
        ) {
          checks.push({
            code: 'INVALID_TARGET_TOKEN',
            description: 'Swap target token address is invalid',
            passed: false,
            severity: 'CRITICAL',
          });
        }
      } else {
        checks.push({
          code: 'UNKNOWN_ACTION',
          description: `Unrecognized transaction action: ${intent.action}`,
          passed: false,
          severity: 'CRITICAL',
        });
      }
    } else {
      checks.push({
        code: 'INVALID_PAYLOAD',
        description: 'Transaction payload must be a non-null object',
        passed: false,
        severity: 'CRITICAL',
      });
    }

    const hasCriticalFailure = checks.some((c) => !c.passed && c.severity === 'CRITICAL');
    const hasHighFailure = checks.some((c) => !c.passed && c.severity === 'HIGH');
    const allowed = !hasCriticalFailure && !hasHighFailure;

    return {
      intentId: intent.id,
      allowed,
      reason: allowed
        ? undefined
        : checks
            .filter((c) => !c.passed)
            .map((c) => c.description)
            .join('; '),
      checks,
      evaluatedAt: Date.now(),
      suggestedAction: allowed ? 'APPROVE' : 'REJECT',
    };
  }
}
