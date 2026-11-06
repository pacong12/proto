import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import type { VestingPosition } from '../src/lib/vesting';

const read = vi.hoisted(() => vi.fn());

vi.mock('@/chains', () => ({
  getChainAdapter: () => ({ readVestingVault: async () => '0xvault' }),
}));
vi.mock('@/lib/viem-client', () => ({ getPublicClient: () => ({}) }));
vi.mock('@/lib/wallet-tx', () => ({ runWalletAction: vi.fn(), sendWalletTransaction: vi.fn() }));
vi.mock('@/lib/vesting', () => ({ readVestingPositions: read }));

const { useVestingSchedules } = await import('../src/composables/useVestingSchedules');

const held = { id: 1n, symbol: 'T' } as unknown as VestingPosition;
const settle = async () => {
  for (let i = 0; i < 5; i++) await nextTick();
  await new Promise((resolve) => setTimeout(resolve));
};

describe('useVestingSchedules', () => {
  it('keeps known schedules and reports it when a read fails, then recovers', async () => {
    read.mockResolvedValue([held]);
    const { positions, loadFailed, reload } = useVestingSchedules(ref('0xabc' as `0x${string}`));
    await settle();
    const known = positions.value.length;
    expect(known).toBeGreaterThan(0);
    expect(loadFailed.value).toBe(false);

    read.mockRejectedValue(new Error('429'));
    await reload();
    expect(positions.value).toHaveLength(known);
    expect(loadFailed.value).toBe(true);

    read.mockResolvedValue([]);
    await reload();
    expect(positions.value).toHaveLength(0);
    expect(loadFailed.value).toBe(false);
  });
});
