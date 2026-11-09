/**
 * Wallet pseudonyms for the app. The names themselves come from `getUserIdentity` in
 * @goton/shared-types (the API derives the same ones); this module also remembers every address it
 * has named, so a name, slug or handle typed into the app resolves back to its address.
 */
import {
  buildIdentityIndex,
  getUserIdentity as identityFor,
  type UserIdentity,
} from '@goton/shared-types';

export type { UserIdentity };

// Wallets this browser has named, persisted across visits so their names resolve back. Only the
// addresses are kept: the lookup is rebuilt from them (buildIdentityIndex), so a bare name shared
// by two wallets resolves to neither instead of whichever was named last.
const known = new Set<string>();
let index: Map<string, string> | null = null;

const ADDRESS = /^0x[a-f0-9]{40}$/;

function initRegistry(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('proto_user_registry');
    if (raw) {
      // Older versions stored name -> address pairs; the addresses are what is kept.
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const v of Object.values(parsed)) {
        const addr = String(v).toLowerCase();
        if (ADDRESS.test(addr)) known.add(addr);
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
    for (const addr of known) obj[addr] = addr;
    localStorage.setItem('proto_user_registry', JSON.stringify(obj));
  } catch {
    // Ignore quota errors
  }
}

function remember(address: string): boolean {
  const addr = address.toLowerCase();
  if (!ADDRESS.test(addr) || known.has(addr)) return false;
  known.add(addr);
  index = null;
  return true;
}

initRegistry();

/**
 * The wallet's identity (e.g. "SonicBismuthChimera#aced"); the address is remembered for lookups.
 */
export function getUserIdentity(address?: string | null): UserIdentity {
  if (address) remember(address);
  return identityFor(address);
}

/**
 * Registers an address in the lookup registry, persisted across visits, so it can be resolved by
 * username, slug or handle.
 */
export function registerUserIdentity(address: string): UserIdentity {
  remember(address);
  persistRegistry();
  return identityFor(address);
}

/**
 * Resolves an Ethereum address from a hex string, slug, display name or handle, or from a bare
 * name or tag while only one known wallet has it.
 */
export function resolveUserAddress(
  query?: string | null,
  knownAddresses: string[] = [],
): string | null {
  if (!query) return null;
  let q: string;
  try {
    q = decodeURIComponent(query.trim().toLowerCase().replace(/^@/, ''));
  } catch {
    return null; // a malformed escape (a stray %) names nobody
  }
  if (!q) return null;
  if (ADDRESS.test(q)) return q;

  let added = false;
  for (const addr of knownAddresses) if (addr && remember(addr)) added = true;
  index ??= buildIdentityIndex(known);
  const found = index.get(q) ?? null;
  if (found && added) persistRegistry();
  return found;
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
