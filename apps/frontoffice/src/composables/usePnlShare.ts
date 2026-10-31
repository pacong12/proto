import { computed, ref, watch, type Ref } from 'vue';
import type { ApiEnvelope, PnlShare } from '@goton/shared-types';
import { API_BASE_URL, ApiError, apiFetch } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { SITE } from '@/lib/site';
import { formatCompactUsd } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

/** +$35.23K / -$12.40. */
export function formatSignedUsd(value: number): string {
  return `${value < 0 ? '-' : '+'}${formatCompactUsd(Math.abs(value))}`;
}

/** +5,725% / -12.5%, or an empty string without an investment. */
export function formatSignedPercent(value: number | null): string {
  if (value === null) return '';
  const digits = Math.abs(value) < 10 ? 1 : 0;
  return `${value < 0 ? '-' : '+'}${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: digits })}%`;
}

/**
 * A wallet's PnL on a token from the API, its card (rendered by the API) and the shared page,
 * with the share actions: save or copy the card, copy the link, post on X.
 */
export function usePnlShare(wallet: Ref<string | undefined>, token: Ref<string | undefined>) {
  const share = ref<PnlShare | null>(null);
  const loading = ref(false);
  /** The wallet has no trades of the token, or the token does not exist. */
  const notFound = ref(false);

  const position = computed(() =>
    wallet.value && token.value
      ? `${wallet.value.toLowerCase()}/${token.value.toLowerCase()}`
      : null,
  );
  const cardUrl = computed(() =>
    position.value ? `${API_BASE_URL}/api/pnl/${position.value}/card.png` : '',
  );
  const pageUrl = computed(() => (position.value ? `${SITE.appUrl}/pnl/${position.value}` : ''));

  async function load(): Promise<void> {
    if (!position.value) return;
    loading.value = true;
    notFound.value = false;
    try {
      const res = await apiFetch<ApiEnvelope<PnlShare>>(`/api/pnl/${position.value}`);
      share.value = res.data;
    } catch (e) {
      share.value = null;
      notFound.value = e instanceof ApiError && e.status === 404;
    } finally {
      loading.value = false;
    }
  }
  watch(position, load, { immediate: true });

  const cardBlob = async () => {
    const res = await fetch(cardUrl.value);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  };

  async function saveImage(): Promise<void> {
    try {
      const url = URL.createObjectURL(await cardBlob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `goton-pnl-${share.value?.token.symbol.toLowerCase() ?? 'card'}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t('pnlImageFailed'));
    }
  }

  async function copyImage(): Promise<void> {
    try {
      // A promise of the blob keeps Safari's user-gesture check satisfied while it downloads.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob() })]);
      toast.success(t('pnlImageCopied'));
    } catch {
      toast.error(t('pnlImageFailed'));
    }
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(pageUrl.value);
      toast.success(t('pnlLinkCopied'));
    } catch {
      toast.error(t('pnlLinkFailed'));
    }
  }

  function postOnX(): void {
    if (!share.value) return;
    const { pnl, token: tk } = share.value;
    const percent = formatSignedPercent(pnl.percent);
    const text = `${formatSignedUsd(pnl.totalUsd)}${percent ? ` (${percent})` : ''} on $${tk.symbol} on @gotondotfun\n${pageUrl.value}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return {
    share,
    loading,
    notFound,
    cardUrl,
    pageUrl,
    load,
    saveImage,
    copyImage,
    copyLink,
    postOnX,
  };
}
