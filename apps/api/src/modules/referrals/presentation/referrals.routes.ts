import { isAddress, ok } from '@goton/shared-types';
import { parseJsonBody, PayloadTooLargeError } from '../../../core';
import type { Router } from '../../../core/http/router';
import type { AppContainer } from '../../../app/container';

/** HTTP routes of the referrals module: off-chain, first-touch referral attribution. */
export function registerReferralsRoutes(router: Router, deps: AppContainer): void {
  const { repository } = deps;

  // GET /api/referrals?referrer=0x.. — how many wallets this referrer has referred.
  router.on('GET', '/api/referrals', async ({ url, replyError, replyEnvelope }) => {
    const referrer = url.searchParams.get('referrer') ?? '';
    if (!isAddress(referrer)) {
      return replyError('INVALID_ADDRESS', 'A valid referrer is required', 400);
    }
    const stats = (await repository.getReferralStats?.(referrer)) ?? { count: 0, referees: [] };
    return replyEnvelope(ok(stats));
  });

  // POST /api/referrals — attribute the connected wallet (referee) to a referrer, first-touch.
  router.on('POST', '/api/referrals', async ({ req, replyError, replyJson }) => {
    try {
      const body = await parseJsonBody<{ referee?: string; referrer?: string }>(req, 1024);
      const referee = String(body.referee ?? '').trim();
      const referrer = String(body.referrer ?? '').trim();
      if (!isAddress(referee) || !isAddress(referrer)) {
        return replyError('INVALID_ADDRESS', 'Valid referee and referrer are required', 400);
      }
      if (referee.toLowerCase() === referrer.toLowerCase()) {
        return replyError('INVALID_REFERRAL', 'You cannot refer yourself', 400);
      }
      // No session gate: attribution is off-chain and first-touch (each referee counts once), so
      // the worst a spoofer can do is inflate a cosmetic count. When rewards are added, move
      // attribution to a signed trigger (the referee's first on-chain launch or trade).
      const recorded = (await repository.recordReferral?.(referee, referrer, Date.now())) ?? false;
      return replyJson(ok({ recorded }), recorded ? 201 : 200);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        return replyError('PAYLOAD_TOO_LARGE', 'Payload exceeds maximum allowed size', 413);
      }
      return replyError('REFERRAL_ERROR', 'Failed to record referral', 400);
    }
  });
}
