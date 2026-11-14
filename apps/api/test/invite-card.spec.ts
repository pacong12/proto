import { describe, expect, it } from 'vitest';
import { getUserIdentity } from '@goton/shared-types';
import { server } from '../src/server';
import { InviteCardService, type InviteCard } from '../src/modules/referrals';
import { inviteCardSvg } from '../src/modules/referrals/infrastructure/invite-card.svg';

const WALLET = '0x00000000000000000000000000000000000c0ffe';

function service(profile: { displayName: string; avatarUrl: string } | null, count: number) {
  return new InviteCardService({
    profiles: { getProfile: async () => profile as never },
    referrals: { getReferralStats: async () => ({ count, referees: [] }) },
    images: { pngDataUrl: async () => 'data:image/png;base64,AAAA' },
    render: () => new Uint8Array(),
    site: { appUrl: 'https://goton.fun' },
  });
}

describe('InviteCardService', () => {
  it('uses the saved name and photo, and links with the wallet slug', async () => {
    const card = await service({ displayName: 'Muting', avatarUrl: 'ipfs://bafy' }, 3).card(WALLET);
    expect(card).toEqual({
      name: 'Muting',
      avatar: 'data:image/png;base64,AAAA',
      referred: 3,
      inviteUrl: `https://goton.fun/?ref=${getUserIdentity(WALLET).slug}`,
    });
  });

  it('falls back to the wallet pseudonym and its initial without a profile', async () => {
    const card = await service(null, 0).card(WALLET);
    expect(card.name).toBe(getUserIdentity(WALLET).name);
    expect(card.avatar).toBeNull();
  });
});

describe('inviteCardSvg', () => {
  const card: InviteCard = {
    name: '<b>&evil',
    avatar: null,
    referred: 1,
    inviteUrl: 'https://goton.fun/?ref=x',
  };

  it('escapes the name and says how many joined', () => {
    const svg = inviteCardSvg(card, 'data:,', 'goton.fun');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&#60;b&#62;&#38;evil');
    expect(svg).toContain('friend has');
  });

  it('leaves the joined line out at zero', () => {
    expect(inviteCardSvg({ ...card, referred: 0 }, 'data:,', 'goton.fun')).not.toContain('joined');
  });
});

describe('GET /api/referrals/:wallet/card.png', () => {
  it('returns a PNG', async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3001/api/referrals/${WALLET}/card.png`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(1, 4), (b) => String.fromCharCode(b)).join('')).toBe('PNG');
  });
});
