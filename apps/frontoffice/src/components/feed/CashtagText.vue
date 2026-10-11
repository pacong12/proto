<template>
  <span class="inline leading-relaxed break-words whitespace-pre-wrap">
    <template v-for="(part, idx) in parsedParts" :key="idx">
      <button
        v-if="part.isCashtag"
        type="button"
        class="inline font-bold text-sky-500 hover:text-sky-400 hover:underline transition-colors align-baseline cursor-pointer"
        :title="part.tokenAddress ? `View $${part.symbol}` : `Search $${part.symbol}`"
        @click.stop="handleCashtagClick(part)"
      >
        ${{ part.symbol }}
      </button>
      <span v-else>{{ part.text }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

interface TokenItem {
  token: {
    address: string;
    symbol: string;
    name?: string;
  };
}

interface Part {
  text: string;
  isCashtag: boolean;
  symbol?: string;
  tokenAddress?: string;
}

const props = defineProps<{
  text: string;
  tokens?: ReadonlyArray<TokenItem>;
}>();

const emit = defineEmits<{
  (e: 'click-cashtag', payload: { symbol: string; address?: string }): void;
}>();

const router = useRouter();

const parsedParts = computed<Part[]>(() => {
  if (!props.text) return [];

  // Match cashtags: $ followed by 2 to 12 alphanumeric / underscore characters
  const regex = /(\$[A-Za-z0-9_]{2,12})\b/g;
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(props.text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: props.text.slice(lastIndex, match.index),
        isCashtag: false,
      });
    }

    const fullTag = match[0];
    const symbol = fullTag.slice(1).toUpperCase();
    const matchedToken = props.tokens?.find((t) => t.token.symbol.toUpperCase() === symbol);

    parts.push({
      text: fullTag,
      isCashtag: true,
      symbol,
      tokenAddress: matchedToken?.token.address,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < props.text.length) {
    parts.push({
      text: props.text.slice(lastIndex),
      isCashtag: false,
    });
  }

  return parts;
});

function handleCashtagClick(part: Part): void {
  if (!part.symbol) return;
  emit('click-cashtag', { symbol: part.symbol, address: part.tokenAddress });

  if (part.tokenAddress) {
    router.push(`/launchpad/${part.tokenAddress}`);
  } else {
    router.push(`/feed?q=${part.symbol}`);
  }
}
</script>
