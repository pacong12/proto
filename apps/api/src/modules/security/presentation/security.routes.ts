import { TransactionIntent } from '@goton/shared-types';
import { parseJsonBody, PayloadTooLargeError } from '../../../core';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

/** HTTP routes of the security module, registered in the order they are matched. */
export function registerSecurityRoutes(router: Router, deps: AppContainer): void {
  const { securityController } = deps;
  router.on('POST', '/api/security/evaluate', async ({ req, replyError, replyEnvelope }) => {
    try {
      const body = await parseJsonBody<TransactionIntent>(req, 65_536);
      const res = securityController.evaluateIntent(body);
      return replyEnvelope(res);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('BAD_REQUEST', 'Malformed JSON payload', 400);
    }
  });
}
