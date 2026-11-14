import type { SiteUrls } from '@goton/shared-types';
import type { IpfsService } from '../ipfs';
import { BRAND_LOGO, IpfsImageLoader, renderCardPng } from '../pnl';
import { InviteCardService, type InviteCardDeps } from './application/invite-card.service';
import { inviteCardSvg } from './infrastructure/invite-card.svg';

export * from './infrastructure/sqlite-referral.store';
export * from './presentation/referrals.routes';
export * from './application/invite-card.service';

/** The invite card service, rendered with resvg like the PnL card; photos read through ipfs. */
export function createInviteCardService(
  deps: Pick<InviteCardDeps, 'profiles' | 'referrals'>,
  ipfs: Pick<IpfsService, 'getFile'>,
  site: SiteUrls,
): InviteCardService {
  return new InviteCardService({
    ...deps,
    images: new IpfsImageLoader(ipfs),
    render: (card) => renderCardPng(inviteCardSvg(card, BRAND_LOGO, site.appHost)),
    site,
  });
}
