import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ apiFetch }));

import { getProfile, loadProfile, setProfile } from '../src/composables/useProfiles';

const ADDR = '0xAbC0000000000000000000000000000000000001';
const profile = {
  displayName: 'Muting',
  bio: '',
  avatarUrl: 'ipfs://cid',
  twitter: '',
  telegram: '',
};

describe('useProfiles', () => {
  beforeEach(() => apiFetch.mockReset());

  it('loads a profile once and shares it by lowercase address', async () => {
    apiFetch.mockResolvedValue({ success: true, data: { profile } });
    await Promise.all([loadProfile(ADDR), loadProfile(ADDR.toLowerCase())]);
    await loadProfile(ADDR);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(getProfile(ADDR)?.displayName).toBe('Muting');
  });

  it('a save on /profile is what the navbar reads next', () => {
    setProfile(ADDR, { ...profile, displayName: 'Renamed' });
    expect(getProfile(ADDR.toLowerCase())?.displayName).toBe('Renamed');
    setProfile(ADDR, null);
    expect(getProfile(ADDR)).toBeNull();
  });
});
