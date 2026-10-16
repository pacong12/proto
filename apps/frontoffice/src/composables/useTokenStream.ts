import { ref, onUnmounted } from 'vue';
import { type TokenMarketData } from '@goton/shared-types';
import { API_BASE_URL } from '@/lib/api-client';

/**
 * Composable that opens a Server-Sent Events connection to
 * `GET /api/tokens/:address/stream` and exposes the latest
 * market data as a reactive ref.
 *
 * The server pushes a frame only when priceUsd / marketCapUsd /
 * graduationProgress actually changes, so no spurious re-renders occur.
 *
 * Reconnects automatically with exponential back-off (2s → 30s) if the
 * connection is lost. The caller should keep its existing poll loop as a
 * fallback: when `isStreamConnected` is false the poll loop is the only
 * source of market data.
 *
 * Clean architecture note: this composable is a pure infrastructure
 * adapter (SSE transport) that belongs in the presentation layer of the
 * frontoffice. It has no domain logic — it only maps SSE frames to a
 * reactive ref that TradeView can read.
 */
export function useTokenStream(getAddress: () => string) {
  const streamMarketData = ref<TokenMarketData | null>(null);
  const isStreamConnected = ref(false);

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 2_000;
  const MAX_RECONNECT_DELAY = 30_000;

  function connect(): void {
    const addr = getAddress();
    if (!addr || typeof EventSource === 'undefined') return;

    // Close any existing connection before opening a new one
    es?.close();

    const url = `${API_BASE_URL}/api/tokens/${addr}/stream`;
    es = new EventSource(url);

    es.onopen = () => {
      isStreamConnected.value = true;
      reconnectDelay = 2_000; // reset back-off on successful open
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          marketData?: TokenMarketData;
        };
        if (payload.marketData) {
          streamMarketData.value = payload.marketData;
        }
      } catch {
        // Malformed SSE frame — ignore silently
      }
    };

    es.onerror = () => {
      isStreamConnected.value = false;
      es?.close();
      es = null;
      // Exponential back-off reconnect so a temporary server restart
      // does not spam reconnect attempts
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        connect();
      }, reconnectDelay);
    };
  }

  function disconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    es?.close();
    es = null;
    isStreamConnected.value = false;
  }

  // Auto-disconnect when the component that owns this composable is unmounted
  onUnmounted(disconnect);

  return { streamMarketData, isStreamConnected, connect, disconnect };
}
