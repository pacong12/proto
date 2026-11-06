import { parseAbi, type PublicClient } from 'viem';
import { launchpadTokenAbi, vestingVaultAbi } from '@goton/shared-types';

/** VestingVault's bounds: cliff <= duration, and 7 days to 4 years of duration. */
export const VESTING_MIN_DAYS = 7;
export const VESTING_MAX_DAYS = 4 * 365;
export const VESTING_DEFAULT_CLIFF_DAYS = 30;
export const VESTING_DEFAULT_DURATION_DAYS = 180;

const SECONDS_PER_DAY = 86_400n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const factoryVaultAbi = parseAbi(['function vestingVault() view returns (address)']);

export type VestingError = 'duration' | 'cliff';

/** Which field breaks the vault's bounds, so the launch does not revert after signing. */
export function validateVesting(cliffDays: number, durationDays: number): VestingError | null {
  if (
    !Number.isInteger(durationDays) ||
    durationDays < VESTING_MIN_DAYS ||
    durationDays > VESTING_MAX_DAYS
  ) {
    return 'duration';
  }
  if (!Number.isInteger(cliffDays) || cliffDays < 0 || cliffDays > durationDays) return 'cliff';
  return null;
}

export function vestingDaysToSeconds(days: number): bigint {
  return BigInt(days) * SECONDS_PER_DAY;
}

/**
 * The factory's vesting vault. Factories deployed before vesting have no such getter, so a failed
 * read means the option is not offered: their launch would revert.
 */
export async function readFactoryVestingVault(
  client: PublicClient,
  factory: `0x${string}`,
): Promise<`0x${string}` | null> {
  try {
    const vault = await client.readContract({
      address: factory,
      abi: factoryVaultAbi,
      functionName: 'vestingVault',
    });
    return vault === ZERO_ADDRESS ? null : vault;
  } catch {
    return null;
  }
}

export interface VestingPosition {
  id: bigint;
  vault: `0x${string}`;
  token: `0x${string}`;
  symbol: string;
  /** Unix seconds. */
  cliffEndsAt: number;
  fullyUnlockedAt: number;
  total: bigint;
  claimed: bigint;
  releasable: bigint;
  pendingDividends: bigint;
}

/** Every schedule `beneficiary` holds in `vault`, with what can be claimed now. */
export async function readVestingPositions(
  client: PublicClient,
  vault: `0x${string}`,
  beneficiary: `0x${string}`,
): Promise<VestingPosition[]> {
  const ids = await client.readContract({
    address: vault,
    abi: vestingVaultAbi,
    functionName: 'schedulesOf',
    args: [beneficiary],
  });
  return Promise.all(
    ids.map(async (id) => {
      const [schedule, releasable, pendingDividends] = await Promise.all([
        client.readContract({
          address: vault,
          abi: vestingVaultAbi,
          functionName: 'getSchedule',
          args: [id],
        }),
        client.readContract({
          address: vault,
          abi: vestingVaultAbi,
          functionName: 'releasable',
          args: [id],
        }),
        client.readContract({
          address: vault,
          abi: vestingVaultAbi,
          functionName: 'pendingDividends',
          args: [id],
        }),
      ]);
      const symbol = await client.readContract({
        address: schedule.token,
        abi: launchpadTokenAbi,
        functionName: 'symbol',
      });
      return {
        id,
        vault,
        token: schedule.token,
        symbol,
        cliffEndsAt: Number(schedule.start + schedule.cliff),
        fullyUnlockedAt: Number(schedule.start + schedule.duration),
        total: schedule.total,
        claimed: schedule.claimed,
        releasable,
        pendingDividends,
      };
    }),
  );
}
