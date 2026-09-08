import { TransactionIntent, SecurityEvaluationResult } from '@proto/shared-types';
import { SecurityPolicy } from '../domain/security-policy';

export class SecurityGateService {
  evaluate(intent: TransactionIntent): SecurityEvaluationResult {
    return SecurityPolicy.evaluate(intent);
  }
}
