import { onMounted, onUnmounted } from 'vue';

/**
 * Re-runs `refresh` every `intervalMs` while the page is visible, and once right away when the
 * tab comes back after at least one interval in the background. A run still in flight is never
 * overlapped. The first load stays with the caller (usually its own onMounted).
 */
export function useAutoRefresh(refresh: () => unknown, intervalMs: number): void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let lastRun = Date.now();

  async function tick(): Promise<void> {
    if (running || (typeof document !== 'undefined' && document.hidden)) return;
    running = true;
    lastRun = Date.now();
    try {
      await refresh();
    } catch {
      // Keep the data on screen; the next tick tries again.
    } finally {
      running = false;
    }
  }

  function onVisibility(): void {
    if (!document.hidden && Date.now() - lastRun >= intervalMs) void tick();
  }

  onMounted(() => {
    timer = setInterval(() => void tick(), intervalMs);
    document.addEventListener('visibilitychange', onVisibility);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  });
}
