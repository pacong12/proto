/**
 * Wallet pseudonyms for the app. The names themselves come from `getUserIdentity` in
 * @goton/shared-types (the API derives the same ones); this module also remembers every address it
 * has named, so a name, slug or handle typed into the app resolves back to its address.
 */
import { getUserIdentity as identityFor, type UserIdentity } from '@goton/shared-types';

export type { UserIdentity };

// In-memory lookup registry for bi-directional address <-> username resolution
const registry = new Map<string, string>();

function initRegistry(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('proto_user_registry');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed)) {
        registry.set(k.toLowerCase(), v.toLowerCase());
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

function persistRegistry(): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of registry.entries()) {
      obj[k] = v;
    }
    localStorage.setItem('proto_user_registry', JSON.stringify(obj));
  } catch {
    // Ignore quota errors
  }
}

initRegistry();

/**
 * The wallet's identity (e.g. "SonicBismuthChimera#aced"); the address is remembered for lookups.
 */
export function getUserIdentity(address?: string | null): UserIdentity {
  const identity = identityFor(address);
  if (address && address.length >= 10) {
    const fullAddr = address.toLowerCase();
    registry.set(fullAddr, fullAddr);
    registry.set(identity.name.toLowerCase(), fullAddr);
    registry.set(identity.displayName.toLowerCase(), fullAddr);
    registry.set(identity.slug, fullAddr);
  }
  return identity;
}

/**
 * Registers an address in the lookup registry, persisted across visits, so it can be resolved by
 * username, slug or handle.
 */
export function registerUserIdentity(address: string): UserIdentity {
  const identity = getUserIdentity(address);
  registry.set(identity.handle.toLowerCase(), address.toLowerCase());
  persistRegistry();
  return identity;
}

/**
 * Resolves an Ethereum address from a hex string, username, tag, slug, or handle.
 */
export function resolveUserAddress(
  query?: string | null,
  knownAddresses: string[] = [],
): string | null {
  if (!query) return null;
  const q = decodeURIComponent(query.trim().toLowerCase().replace(/^@/, ''));
  if (!q) return null;

  // 1. Direct Ethereum Hex Address
  if (/^0x[a-f0-9]{40}$/i.test(q)) {
    return q.toLowerCase();
  }

  // 2. Direct Registry Match
  const cached = registry.get(q);
  if (cached) return cached.toLowerCase();

  // 3. Match against known addresses (deployers, traders, authors)
  for (const addr of knownAddresses) {
    if (!addr) continue;
    const id = getUserIdentity(addr);
    if (
      id.displayName.toLowerCase() === q ||
      id.name.toLowerCase() === q ||
      id.slug.toLowerCase() === q ||
      id.tag.toLowerCase() === q
    ) {
      registerUserIdentity(addr);
      return addr.toLowerCase();
    }
  }

  // 4. Try matching tag suffix (#xxxx or -xxxx)
  const tagMatch = q.match(/(?:#|-)([a-f0-9]{4})$/);
  if (tagMatch) {
    const tag = tagMatch[1];
    for (const addr of knownAddresses) {
      if (addr.toLowerCase().endsWith(tag)) {
        registerUserIdentity(addr);
        return addr.toLowerCase();
      }
    }
  }

  return null;
}

/**
 * Returns the collision-free username string with discriminator (e.g. "SonicBismuthChimera#aced").
 */
export function generateUsername(address?: string | null): string {
  return getUserIdentity(address).displayName;
}

/**
 * Returns formatted handle (e.g. "@SonicBismuthChimera#aced").
 */
export function formatHandle(address?: string | null): string {
  return getUserIdentity(address).handle;
}
