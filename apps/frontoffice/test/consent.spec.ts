// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// These tests load the wallet stack (viem, AppKit) on first use, which can exceed the default
// 5 s under a full parallel run.
vi.setConfig({ testTimeout: 20_000 });

async function fresh() {
  vi.resetModules();
  const consent = await import('../src/lib/consent');
  const { guardWalletWrites } = await import('../src/lib/viem-client');
  return { ...consent, guardWalletWrites };
}

function fakeWalletClient() {
  return {
    writeContract: vi.fn(async () => '0xhash'),
    sendTransaction: vi.fn(async () => '0xhash'),
    signMessage: vi.fn(async () => '0xsig'),
    getAddresses: vi.fn(async () => ['0x1111111111111111111111111111111111111111']),
    getChainId: vi.fn(async () => 46630),
  };
}

describe('terms acceptance gate', () => {
  beforeEach(() => localStorage.clear());

  it('blocks signing and sending until the terms are accepted, and opens the dialog', async () => {
    const { guardWalletWrites, termsPromptOpen, TermsNotAcceptedError } = await fresh();
    const raw = fakeWalletClient();
    const client = guardWalletWrites(raw);

    for (const call of [
      () => client.writeContract(),
      () => client.sendTransaction(),
      () => client.signMessage(),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(TermsNotAcceptedError);
    }
    expect(raw.writeContract).not.toHaveBeenCalled();
    expect(raw.sendTransaction).not.toHaveBeenCalled();
    expect(raw.signMessage).not.toHaveBeenCalled();
    expect(termsPromptOpen.value).toBe(true);
  });

  it('leaves read-only wallet calls alone', async () => {
    const { guardWalletWrites, termsPromptOpen } = await fresh();
    const client = guardWalletWrites(fakeWalletClient());
    await expect(client.getAddresses()).resolves.toHaveLength(1);
    await expect(client.getChainId()).resolves.toBe(46630);
    expect(termsPromptOpen.value).toBe(false);
  });

  it('allows wallet actions once accepted, and remembers the acceptance', async () => {
    const { guardWalletWrites, acceptTerms, termsPromptOpen } = await fresh();
    termsPromptOpen.value = true;
    acceptTerms();
    expect(termsPromptOpen.value).toBe(false);
    expect(localStorage.getItem('proto_privacy_policy_accepted_v1')).toBe('true');

    const raw = fakeWalletClient();
    await expect(guardWalletWrites(raw).writeContract()).resolves.toBe('0xhash');
    expect(raw.writeContract).toHaveBeenCalledTimes(1);

    const reloaded = await fresh();
    expect(reloaded.termsAccepted.value).toBe(true);
  });
});
