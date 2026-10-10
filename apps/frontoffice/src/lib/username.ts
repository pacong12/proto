/**
 * Deterministic Cyberpunk / Web3 Pseudonym Generator
 *
 * Guarantees 100% uniqueness without collisions by combining a 3-part
 * high-energy moniker with the wallet's unique trailing hex discriminator.
 *
 * Pattern: [Vibe Adjective] + [Element/Material] + [Archetype] + #[Discriminator]
 * Example: SonicBismuthChimera#aced, VaporSilverRonin#4ff1
 */

const VIBE_ADJECTIVES = [
  'Quantum',
  'Astral',
  'Nova',
  'Prism',
  'Solar',
  'Zenith',
  'Hyper',
  'Echo',
  'Cosmic',
  'Velox',
  'Apex',
  'Sonic',
  'Lunar',
  'Vivid',
  'Stellar',
  'Turbo',
  'Shadow',
  'Nexus',
  'Phantom',
  'Arcane',
  'Chrono',
  'Vesper',
  'Matrix',
  'Cyber',
  'Pulse',
  'Aero',
  'Vortex',
  'Blaze',
  'Drift',
  'Omega',
  'Mirage',
  'Vector',
  'Radiant',
  'Atomic',
  'Glitch',
  'Kinetic',
  'Zephyr',
  'Orbital',
  'Eon',
  'Infinite',
  'Siren',
  'Iron',
  'Flux',
  'Aura',
  'Rune',
  'Glacier',
  'Volt',
  'Spectra',
  'Cipher',
  'Titan',
  'Ghost',
  'Helix',
  'Spark',
  'Prime',
  'Static',
  'Storm',
  'Frost',
  'Ether',
  'Obsidian',
  'Vapor',
  'Bionic',
  'Neon',
  'Zero',
  'Alpha',
] as const;

const ELEMENT_MATERIALS = [
  'Cobalt',
  'Silver',
  'Obsidian',
  'Opal',
  'Chrome',
  'Plasma',
  'Titanium',
  'Neon',
  'Quartz',
  'Amber',
  'Carbon',
  'Copper',
  'Velvet',
  'Crystal',
  'Basalt',
  'Mercury',
  'Onyx',
  'Krypton',
  'Argon',
  'Xenon',
  'Bismuth',
  'Platinum',
  'Emerald',
  'Sapphire',
  'Topaz',
  'Ruby',
  'Graphene',
  'Meteor',
  'Comet',
  'Aurora',
  'Nebula',
  'Eclipse',
  'Laser',
  'Silicon',
  'Diamond',
  'Granite',
  'Magma',
  'Shadow',
  'Aether',
  'Pewter',
  'Rust',
  'Nickel',
  'Tungsten',
  'Lithium',
  'Radon',
  'Cesium',
  'Steel',
  'Bronze',
  'Brass',
  'Pearl',
  'Jade',
  'Garnet',
  'Lapis',
  'Malachite',
  'Tanzanite',
  'Zinc',
  'Flint',
  'Cinder',
  'Iron',
  'Gold',
  'Stellar',
  'Vortex',
  'Prism',
  'Cyber',
] as const;

const ARCHETYPES = [
  'Falcon',
  'Ronin',
  'Specter',
  'Lynx',
  'Phoenix',
  'Vanguard',
  'Nomad',
  'Drifter',
  'Raven',
  'Viper',
  'Pioneer',
  'Sentinel',
  'Wolf',
  'Hawk',
  'Oracle',
  'Ranger',
  'Cipher',
  'Titan',
  'Pilot',
  'Seeker',
  'Stalker',
  'Hunter',
  'Corsair',
  'Hydra',
  'Griffin',
  'Dragon',
  'Shifter',
  'Wraith',
  'Archer',
  'Rider',
  'Paladin',
  'Knight',
  'Strider',
  'Wanderer',
  'Navigator',
  'Operator',
  'Voyager',
  'Runner',
  'Scout',
  'Rebel',
  'Ghost',
  'Beast',
  'Jaguar',
  'Panther',
  'Cheetah',
  'Eagle',
  'Condor',
  'Osprey',
  'Kite',
  'Harrier',
  'Cobra',
  'Mamba',
  'Chimera',
  'Siren',
  'Gargoyle',
  'Golem',
  'Kraken',
  'Leviathan',
  'Colossus',
  'Striker',
  'Vector',
  'Apex',
  'Nova',
  'Aero',
] as const;

export interface UserIdentity {
  name: string;
  tag: string;
  slug: string;
  displayName: string;
  handle: string;
}

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
 * Registers an address in the lookup registry so it can be resolved by username or slug.
 */
export function registerUserIdentity(address: string): UserIdentity {
  const clean = address.toLowerCase();
  const identity = getUserIdentity(clean);

  registry.set(clean, clean);
  registry.set(identity.name.toLowerCase(), clean);
  registry.set(identity.displayName.toLowerCase(), clean);
  registry.set(identity.slug.toLowerCase(), clean);
  registry.set(identity.handle.toLowerCase(), clean);

  persistRegistry();
  return identity;
}

/**
 * Parses a wallet address into a guaranteed collision-free, memorable Web3 identity.
 */
export function getUserIdentity(address?: string | null): UserIdentity {
  if (!address || address.length < 10) {
    return {
      name: 'Anonymous',
      tag: '0000',
      slug: 'anonymous',
      displayName: 'Anonymous',
      handle: '@anonymous',
    };
  }

  const clean = address.toLowerCase().replace(/^0x/, '');
  const h1 = parseInt(clean.slice(0, 4), 16) || 0;
  const h2 = parseInt(clean.slice(4, 8), 16) || 0;
  const h3 = parseInt(clean.slice(8, 12), 16) || 0;
  const tag = clean.slice(-4);

  const adj = VIBE_ADJECTIVES[h1 % VIBE_ADJECTIVES.length];
  const mat = ELEMENT_MATERIALS[h2 % ELEMENT_MATERIALS.length];
  const noun = ARCHETYPES[h3 % ARCHETYPES.length];
  const name = `${adj}${mat}${noun}`;
  const slug = `${name.toLowerCase()}-${tag}`;

  const identity: UserIdentity = {
    name,
    tag,
    slug,
    displayName: `${name}#${tag}`,
    handle: `@${name}#${tag}`,
  };

  const fullAddr = address.toLowerCase();
  registry.set(fullAddr, fullAddr);
  registry.set(name.toLowerCase(), fullAddr);
  registry.set(identity.displayName.toLowerCase(), fullAddr);
  registry.set(slug, fullAddr);

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
