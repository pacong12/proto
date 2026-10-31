import type { SiteUrls } from '@goton/shared-types';
import type { IpfsService } from '../ipfs';
import { PnlService, type PnlServiceDeps } from './application/pnl.service';
import { IpfsImageLoader } from './infrastructure/ipfs-image.loader';
import { ResvgPnlCardRenderer } from './infrastructure/resvg-pnl-card.renderer';

export * from './application/pnl.service';
export * from './application/pnl-card';
export { positionPnl } from './domain/position-pnl';

/** The PnL service with the resvg card renderer and logos read through the ipfs module. */
export function createPnlService(
  deps: Omit<PnlServiceDeps, 'renderer' | 'images'>,
  ipfs: Pick<IpfsService, 'getFile'>,
  site: SiteUrls,
): PnlService {
  return new PnlService({
    ...deps,
    renderer: new ResvgPnlCardRenderer(site.appHost),
    images: new IpfsImageLoader(ipfs),
  });
}
export * from './presentation/pnl.routes';
