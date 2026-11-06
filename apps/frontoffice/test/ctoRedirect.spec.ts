import { describe, expect, it, vi } from 'vitest';
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  zeroAddress,
  type PublicClient,
} from 'viem';
import { gotonFeeSplitterAbi } from '@goton/shared-types';
import {
  formatCountdown,
  isRedirected,
  readSplitterRedirectState,
  redirectUiState,
  type RedirectState,
} from '../src/lib/cto-redirect';

const SPLITTER = '0x00000000000000000000000000000000000000aa';
const CREATOR = '0x00000000000000000000000000000000000000Bb';
const COMMUNITY = '0x00000000000000000000000000000000000000cc';
const STRANGER = '0x00000000000000000000000000000000000000dd';
const NOW = 1_000_000;

function state(overrides: Partial<RedirectState> = {}): RedirectState {
  return {
    splitter: SPLITTER,
    creator: CREATOR,
    recipient: CREATOR,
    pending: null,
    validAfter: 0,
    locked: false,
    lockSupported: true,
    ...overrides,
  };
}

describe('isRedirected', () => {
  it('ignores address case when the creator is still paid', () => {
    expect(isRedirected(state({ recipient: CREATOR.toLowerCase() as `0x${string}` }))).toBe(false);
  });

  it('is true for another recipient and false for the zero address', () => {
    expect(isRedirected(state({ recipient: COMMUNITY }))).toBe(true);
    expect(isRedirected(state({ recipient: zeroAddress }))).toBe(false);
  });
});

describe('redirectUiState', () => {
  it('lets the creator propose and lock when nothing is pending', () => {
    const ui = redirectUiState(state(), CREATOR.toLowerCase(), NOW);
    expect(ui).toMatchObject({
      isCreator: true,
      redirected: false,
      hasPending: false,
      canPropose: true,
      showAccept: false,
      canCancel: false,
      canLock: true,
    });
  });

  it('shows a disabled accept with a countdown during the timelock', () => {
    const pending = state({ pending: COMMUNITY, validAfter: NOW + 90 });
    const ui = redirectUiState(pending, CREATOR, NOW);
    expect(ui).toMatchObject({
      secondsLeft: 90,
      showAccept: true,
      canAccept: false,
      canCancel: true,
    });
  });

  it('enables accept from the second the timelock ends', () => {
    const pending = state({ pending: COMMUNITY, validAfter: NOW });
    expect(redirectUiState(pending, CREATOR, NOW)).toMatchObject({
      secondsLeft: 0,
      canAccept: true,
    });
  });

  it('lets the pending recipient accept but not cancel, propose or lock', () => {
    const pending = state({ pending: COMMUNITY, validAfter: NOW - 1 });
    expect(redirectUiState(pending, COMMUNITY, NOW)).toMatchObject({
      isCreator: false,
      canAccept: true,
      canCancel: false,
      canPropose: false,
      canLock: false,
    });
  });

  it('gives a stranger or a disconnected wallet no action', () => {
    const pending = state({ pending: COMMUNITY, validAfter: NOW - 1 });
    for (const account of [STRANGER, null, undefined]) {
      expect(redirectUiState(pending, account, NOW)).toMatchObject({
        showAccept: false,
        canAccept: false,
        canCancel: false,
        canPropose: false,
        canLock: false,
      });
    }
  });

  it('offers nothing once locked', () => {
    const locked = state({ recipient: COMMUNITY, locked: true });
    expect(redirectUiState(locked, CREATOR, NOW)).toMatchObject({
      redirected: true,
      hasPending: false,
      canPropose: false,
      canCancel: false,
      canLock: false,
    });
  });

  it('hides the lock on a v1 splitter but keeps propose', () => {
    const v1 = state({ lockSupported: false });
    expect(redirectUiState(v1, CREATOR, NOW)).toMatchObject({ canPropose: true, canLock: false });
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '0s'],
    [-5, '0s'],
    [59, '59s'],
    [65, '1m 05s'],
    [3_725, '1h 02m 05s'],
    [172_800, '2d 00h 00m 00s'],
  ])('formats %d seconds as %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

describe('readSplitterRedirectState', () => {
  const views: Record<string, unknown> = {
    creator: CREATOR,
    creatorRecipient: COMMUNITY,
    pendingCreatorRecipient: zeroAddress,
    pendingCreatorRecipientValidAfter: 0n,
    creatorRecipientLocked: true,
  };

  function client(lockRead: () => Promise<unknown>) {
    return {
      readContract: vi.fn(({ functionName }: { functionName: string }) =>
        functionName === 'creatorRecipientLocked'
          ? lockRead()
          : Promise.resolve(views[functionName]),
      ),
    } as unknown as PublicClient;
  }

  it('maps a zero pending address to null and reads the lock', async () => {
    const result = await readSplitterRedirectState(
      client(() => Promise.resolve(true)),
      SPLITTER,
    );
    expect(result).toMatchObject({
      creator: CREATOR,
      recipient: COMMUNITY,
      pending: null,
      validAfter: 0,
      locked: true,
      lockSupported: true,
    });
  });

  it('treats a revert on the lock view as a v1 splitter', async () => {
    const functionName = 'creatorRecipientLocked';
    const reverted = new ContractFunctionExecutionError(
      new ContractFunctionRevertedError({ abi: gotonFeeSplitterAbi, functionName }),
      { abi: gotonFeeSplitterAbi, functionName },
    );
    const result = await readSplitterRedirectState(
      client(() => Promise.reject(reverted)),
      SPLITTER,
    );
    expect(result).toMatchObject({ locked: false, lockSupported: false });
  });

  it('does not mistake a network failure for a v1 splitter', async () => {
    await expect(
      readSplitterRedirectState(
        client(() => Promise.reject(new Error('fetch failed'))),
        SPLITTER,
      ),
    ).rejects.toThrow('fetch failed');
  });
});

describe('CTO locale keys', () => {
  const locales = import.meta.glob<{ default: Record<string, string> }>('../src/lib/locales/*.ts', {
    eager: true,
  });

  it('are translated in all 11 locales', () => {
    const en = locales['../src/lib/locales/en.ts'].default;
    const keys = Object.keys(en).filter((key) => /^cto[A-Z]/.test(key));
    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(locales)).toHaveLength(11);
    for (const [path, { default: messages }] of Object.entries(locales)) {
      for (const key of keys) expect(messages[key], `${path}: ${key}`).toBeTruthy();
    }
  });
});
