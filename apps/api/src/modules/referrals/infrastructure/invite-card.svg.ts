import { CARD_HEIGHT, CARD_WIDTH, clip, escapeXml, qr } from '../../pnl';
import type { InviteCard } from '../application/invite-card.service';

const C = {
  background: '#09090b',
  border: '#27272a',
  text: '#ffffff',
  muted: '#a1a1aa',
  surface: '#18181b',
  brand: '#E7239F',
};

/** The inviter's photo in a circle, or their initial on the brand colour. */
function avatar(card: InviteCard): string {
  const cx = 112;
  const cy = 236;
  const r = 48;
  if (card.avatar) {
    return `<clipPath id="avatar"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
      <image href="${card.avatar}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.border}" stroke-width="2"/>`;
  }
  const initial = escapeXml(card.name.slice(0, 1).toUpperCase() || '?');
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.brand}"/>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="44" font-weight="700" fill="${C.text}">${initial}</text>`;
}

/** The invite card (1200×630, the Open Graph size); `brandLogo` is the Goton mark as an href. */
export function inviteCardSvg(card: InviteCard, brandLogo: string, siteHost: string): string {
  const shortLink = card.inviteUrl.replace(/^https?:\/\//, '');
  const joined =
    card.referred > 0
      ? `<text x="64" y="540" font-size="24" fill="${C.muted}"><tspan font-weight="700" fill="${C.text}">${card.referred.toLocaleString('en-US')}</tspan> ${
          card.referred === 1 ? 'friend has' : 'friends have'
        } joined</text>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" font-family="Inter">
  <defs>
    <radialGradient id="brand" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.brand}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${C.brand}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${C.background}"/>
  <circle cx="1040" cy="60" r="420" fill="url(#brand)"/>
  <image href="${brandLogo}" x="64" y="56" width="40" height="44"/>
  <text x="116" y="78" font-size="28" font-weight="700" fill="${C.text}">Goton</text>
  <text x="116" y="102" font-size="16" fill="${C.muted}">${escapeXml(siteHost)}</text>
  ${avatar(card)}
  <text x="184" y="230" font-size="36" font-weight="700" fill="${C.text}">${escapeXml(clip(card.name, 24))}</text>
  <text x="184" y="266" font-size="24" fill="${C.muted}">invites you to Goton</text>
  <text x="64" y="384" font-size="56" font-weight="700" fill="${C.text}">Launch and trade</text>
  <text x="64" y="452" font-size="56" font-weight="700" fill="${C.text}">memecoins on-chain.</text>
  ${joined}
  <rect x="820" y="150" width="316" height="400" rx="24" fill="${C.surface}" stroke="${C.border}" stroke-width="2"/>
  ${qr(card.inviteUrl, 858, 182, 240)}
  <text x="978" y="478" text-anchor="middle" font-size="22" font-weight="700" fill="${C.text}">Scan to join</text>
  <text x="978" y="510" text-anchor="middle" font-size="16" fill="${C.muted}">${escapeXml(clip(shortLink, 34))}</text>
</svg>`;
}
