import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const kit = vi.hoisted(() => ({
  ready: vi.fn<() => Promise<void>>(),
  open: vi.fn(async () => undefined),
  getAccount: vi.fn(() => undefined),
  getChainId: vi.fn(() => undefined),
  getWalletProvider: vi.fn(() => undefined),
  subscribeAccount: vi.fn(),
  subscribeNetwork: vi.fn(),
  subscribeProviders: vi.fn(),
}));

vi.mock('../src/lib/appkit', () => ({ appKit: kit }));

async function loadOpenAppKit() {
  vi.resetModules();
  vi.stubEnv('VITE_REOWN_PROJECT_ID', 'test-project');
  return (await import('../src/lib/appkit-loader')).openAppKit;
}

describe('openAppKit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    kit.open.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('waits for AppKit to register its connectors before opening', async () => {
    let markReady = () => {};
    kit.ready.mockReturnValue(new Promise<void>((resolve) => (markReady = resolve)));
    const opening = (await loadOpenAppKit())();

    await vi.advanceTimersByTimeAsync(1000);
    expect(kit.open).not.toHaveBeenCalled();

    markReady();
    await expect(opening).resolves.toBe(true);
    expect(kit.open).toHaveBeenCalledOnce();
  });

  it('opens anyway when AppKit never becomes ready', async () => {
    kit.ready.mockReturnValue(new Promise<void>(() => {}));
    const opening = (await loadOpenAppKit())();

    await vi.advanceTimersByTimeAsync(3000);
    await expect(opening).resolves.toBe(true);
    expect(kit.open).toHaveBeenCalledOnce();
  });

  it('opens anyway when the init fails', async () => {
    kit.ready.mockRejectedValue(new Error('relay down'));
    await expect((await loadOpenAppKit())()).resolves.toBe(true);
    expect(kit.open).toHaveBeenCalledOnce();
  });
});
