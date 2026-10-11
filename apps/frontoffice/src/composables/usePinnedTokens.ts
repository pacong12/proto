/**
 * Shared singleton composable for the user watchlist (pinned tokens).
 *
 * Persists to localStorage under the key 'proto_pinned_tokens'.
 * Both ExploreView and FeedView share this state so pins are reflected
 * immediately across both views without a page reload.
 *
 * Rule FE-02: shared state lives in a singleton composable, never duplicated
 * across sibling components.
 */
import { ref } from 'vue';

const STORAGE_KEY = 'proto_pinned_tokens';

// Module-level singleton — one instance shared across all component trees.
const pinnedTokens = ref<Set<string>>(new Set());
let initialised = false;

function init(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      pinnedTokens.value = new Set(JSON.parse(raw) as string[]);
    }
  } catch {
    // Ignore storage parse errors — start with empty watchlist.
  }
}

export function usePinnedTokens() {
  init();

  function togglePin(address: string): void {
    if (!address) return;
    const lower = address.toLowerCase();
    const next = new Set(pinnedTokens.value);
    if (next.has(lower)) {
      next.delete(lower);
    } else {
      next.add(lower);
    }
    pinnedTokens.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // Ignore storage quota errors.
    }
  }

  function isPinned(address: string): boolean {
    return pinnedTokens.value.has(address.toLowerCase());
  }

  return { pinnedTokens, togglePin, isPinned };
}
