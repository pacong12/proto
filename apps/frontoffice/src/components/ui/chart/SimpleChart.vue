<script setup lang="ts">
import { computed } from 'vue';

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
  color?: string;
  fillColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  height: 200,
  color: '#10b981',
  fillColor: 'rgba(16, 185, 129, 0.1)',
});

const padding = 20;
const width = 600;

const points = computed(() => {
  if (props.data.length < 2) return '';
  const values = props.data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const dx = (width - padding * 2) / (props.data.length - 1);

  return props.data
    .map((d, i) => {
      const x = padding + i * dx;
      const y = props.height - padding - ((d.value - min) / range) * (props.height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');
});

const fillPath = computed(() => {
  if (!points.value) return '';
  const pts = points.value.split(' ');
  if (pts.length === 0) return '';
  const firstX = pts[0].split(',')[0];
  const lastX = pts[pts.length - 1].split(',')[0];
  const bottomY = props.height - padding;

  return `M ${firstX},${bottomY} L ${pts.join(' L ')} L ${lastX},${bottomY} Z`;
});
</script>

<template>
  <div class="w-full overflow-hidden">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="w-full h-auto overflow-visible"
      preserveAspectRatio="none"
    >
      <!-- Horizontal Grid Lines -->
      <line
        :x1="padding"
        :y1="padding"
        :x2="width - padding"
        :y2="padding"
        stroke="#27272a"
        stroke-dasharray="4 4"
        stroke-width="1"
      />
      <line
        :x1="padding"
        :y1="height / 2"
        :x2="width - padding"
        :y2="height / 2"
        stroke="#27272a"
        stroke-dasharray="4 4"
        stroke-width="1"
      />
      <line
        :x1="padding"
        :y1="height - padding"
        :x2="width - padding"
        :y2="height - padding"
        stroke="#3f3f46"
        stroke-width="1"
      />

      <!-- Area Fill -->
      <path v-if="fillPath" :d="fillPath" :fill="fillColor" />

      <!-- Line Graph -->
      <polyline
        v-if="points"
        fill="none"
        :stroke="color"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        :points="points"
      />

      <!-- Dots for Data Points -->
      <g v-if="points">
        <circle
          v-for="(p, i) in points.split(' ')"
          :key="i"
          :cx="p.split(',')[0]"
          :cy="p.split(',')[1]"
          r="3"
          :fill="color"
          class="hover:r-4 transition-all"
        />
      </g>
    </svg>

    <!-- X-Axis Labels -->
    <div class="flex justify-between px-4 pt-2 text-[10px] font-mono text-zinc-500">
      <span v-for="(d, i) in data" :key="i">{{ d.label }}</span>
    </div>
  </div>
</template>
