import { ApiEnvelope, TransactionIntent, SecurityEvaluationResult, ok, err } from '@proto/shared-types';
import { SecurityGateService } from '../application/security-gate.service';

export class SecurityController {
  constructor(private readonly securityGateService: SecurityGateService) {}

  evaluateIntent(intent: TransactionIntent): ApiEnvelope<SecurityEvaluationResult> {
    if (!intent || !intent.id || !intent.action) {
      return err('INVALID_INTENT', 'Transaction intent payload is malformed');
    }

    try {
      const evaluation = this.securityGateService.evaluate(intent);
      return ok(evaluation);
    } catch (error) {
      return err('SECURITY_EVALUATION_FAILED', (error as Error).message);
    }
  }
}
