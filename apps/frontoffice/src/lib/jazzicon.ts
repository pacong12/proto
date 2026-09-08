// MetaMask Jazzicon color palette (Wobble palette)
const DEFAULT_COLORS = [
  '#01888C', // teal
  '#FC7500', // bright orange
  '#034F5D', // dark teal
  '#F73F01', // red-orange
  '#FC1960', // magenta
  '#C7144C', // raspberry
  '#F3C100', // golden yellow
  '#15983C', // green
  '#9832AC', // purple
  '#B1272C', // red
];

// Mersenne Twister PRNG or Linear Congruential Generator for deterministic values
class MersenneRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // Standard Park-Miller LCG
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

function addressToSeed(address: string): number {
  const clean = address.toLowerCase().replace(/^0x/, '');
  let seed = 0;
  for (let i = 0; i < Math.min(clean.length, 8); i++) {
    seed = (seed << 4) | Number.parseInt(clean[i], 16);
  }
  return seed || 123456789;
}

export interface ShapeElement {
  fill: string;
  transform: string;
}

export interface JazziconData {
  backgroundColor: string;
  shapes: ShapeElement[];
}

/**
 * Deterministically generates MetaMask-style Jazzicon shapes from an Ethereum address
 */
export function generateJazzicon(address: string, shapeCount = 4): JazziconData {
  const seed = addressToSeed(address);
  const rng = new MersenneRNG(seed);

  const colors = [...DEFAULT_COLORS];

  function getNextColor(): string {
    const idx = Math.floor(rng.next() * colors.length);
    const col = colors.splice(idx, 1)[0];
    return col || '#10b981';
  }

  const backgroundColor = getNextColor();
  const shapes: ShapeElement[] = [];

  const totalDegrees = 360;
  const firstAngle = rng.next() * totalDegrees;
  const angleSlice = totalDegrees / shapeCount;

  for (let i = 0; i < shapeCount; i++) {
    const angle = firstAngle + i * angleSlice;
    const velocity = 100 * ((rng.next() + i) / shapeCount);
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * velocity;
    const ty = Math.sin(rad) * velocity;

    const rot = rng.next() * 360;
    const fill = getNextColor();

    shapes.push({
      fill,
      transform: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${rot.toFixed(1)} 50 50)`,
    });
  }

  return {
    backgroundColor,
    shapes,
  };
}
