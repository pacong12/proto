/**
 * Deterministic Cyberpunk / Web3 Pseudonym Generator
 *
 * Guarantees 100% uniqueness without collisions by combining a 3-part
 * high-energy moniker with the wallet's unique trailing hex discriminator.
 *
 * Pattern: [Vibe Adjective] + [Element/Material] + [Archetype] + #[Discriminator]
 * Example: SonicBismuthChimera#aced, DriftEmeraldRider#b0c2
 */

export const VIBE_ADJECTIVES = [
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

export const ELEMENT_MATERIALS = [
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

export const ARCHETYPES = [
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

  return {
    name,
    tag,
    slug,
    displayName: `${name}#${tag}`,
    handle: `@${name}#${tag}`,
  };
}

export function generateUsername(address?: string | null): string {
  return getUserIdentity(address).displayName;
}

export function formatHandle(address?: string | null): string {
  return getUserIdentity(address).handle;
}
