import { getUserIdentity, type SiteUrls } from '@goton/shared-types';
import type { ReferralStorePort } from '../../../core/ports/referral-store.port';
import type { SocialStorePort } from '../../../core/ports/social-store.port';

/** What the invite card shows. */
export interface InviteCard {
  /** The inviter's saved display name, else their wallet pseudonym. */
  name: string;
  /** Their profile photo as a PNG data URL, or null to draw their initial. */
  avatar: string | null;
  /** How many wallets their link has brought in. */
  referred: number;
  /** Their invite link (the app with ?ref=<their slug>), for the QR code. */
  inviteUrl: string;
}

export interface InviteCardDeps {
  profiles: Pick<SocialStorePort, 'getProfile'>;
  referrals: Pick<ReferralStorePort, 'getReferralStats'>;
  images: { pngDataUrl(uri: string): Promise<string | null> };
  render(card: InviteCard): Uint8Array | Promise<Uint8Array>;
  site: Pick<SiteUrls, 'appUrl'>;
}

/** A wallet's shareable invite card: who invites, and the link to join through. */
export class InviteCardService {
  constructor(private readonly deps: InviteCardDeps) {}

  async card(wallet: string): Promise<InviteCard> {
    const address = wallet.toLowerCase();
    const [profile, stats] = await Promise.all([
      this.deps.profiles.getProfile?.(address).catch(() => null) ?? null,
      this.deps.referrals.getReferralStats?.(address, 1).catch(() => null) ?? null,
    ]);
    const identity = getUserIdentity(address);
    const avatar = profile?.avatarUrl ? await this.deps.images.pngDataUrl(profile.avatarUrl) : null;
    return {
      name: profile?.displayName?.trim() || identity.name,
      avatar,
      referred: stats?.count ?? 0,
      inviteUrl: `${this.deps.site.appUrl}/?ref=${encodeURIComponent(identity.slug)}`,
    };
  }

  async png(wallet: string): Promise<Uint8Array> {
    return this.deps.render(await this.card(wallet));
  }
}
