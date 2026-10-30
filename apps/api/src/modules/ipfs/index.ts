import { IpfsService } from './application/ipfs.service';
import { LocalFileStore } from './infrastructure/local-file.store';
import { PinataPinningAdapter } from './infrastructure/pinata-pinning.adapter';
import { PublicGatewayFetcher } from './infrastructure/public-gateway.fetcher';

export * from './application/ipfs.service';
export * from './presentation/ipfs.controller';
export { generateDeterministicCid, verifyCidContent } from './domain/cid';

/** The IPFS service on local disk, Pinata and the public gateways. */
export function createIpfsService(): IpfsService {
  return new IpfsService(
    new LocalFileStore(),
    new PinataPinningAdapter(),
    new PublicGatewayFetcher(),
  );
}
