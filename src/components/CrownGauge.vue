<script setup lang="ts">
import { computed } from 'vue'

import CrownIcon from './CrownIcon.vue'

// obtained counts are cumulative: clear >= fc >= dfc
const props = defineProps<{ possible: number; clear: number; fc: number; dfc: number }>()

const pct = (n: number) => (props.possible === 0 ? 0 : Math.min(100, (n / props.possible) * 100))
const bars = computed(() => [
  { cls: 'gauge-rainbow', w: pct(props.dfc) },
  { cls: 'gauge-gold', w: pct(props.fc) - pct(props.dfc) },
  { cls: 'gauge-silver', w: pct(props.clear) - pct(props.fc) },
])
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="gauge" role="img" :aria-label="`${clear} / ${possible}`">
      <div class="flex h-full">
        <div v-for="b in bars" :key="b.cls" :class="b.cls" :style="{ width: `${b.w}%` }"></div>
      </div>
    </div>
    <dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
      <div v-for="([crown, n, key]) in ([[1, clear, 'scores.tierClear'], [2, fc, 'scores.tierFullCombo'], [3, dfc, 'scores.tierDonderful']] as const)" :key="crown" class="flex items-center gap-1.5">
        <CrownIcon :crown="crown" />
        <dt class="muted">{{ $t(key) }}</dt>
        <dd class="font-semibold">{{ n }} / {{ possible }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.gauge {
  height: 28px;
  padding: 3px;
  border-radius: var(--radius-control);
  background: #1a0a08;
  box-shadow: inset 0 0 0 2px #000;
  position: relative;
}

.gauge > div {
  height: 100%;
  border-radius: var(--radius-chip);
  overflow: hidden;
  background: #5c140d;
}

.gauge > div > div {
  transition: width 200ms ease-out;
}

/* the dan gauge's notched segments */
.gauge::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: var(--radius-chip);
  pointer-events: none;
  background: repeating-linear-gradient(90deg, transparent 0 10px, rgba(0, 0, 0, 0.55) 10px 12px);
}

.gauge-silver {
  background: linear-gradient(#f2f4f7, #aeb4bc);
}

.gauge-gold {
  background: linear-gradient(#ffe27a, #e0a417);
}

.gauge-rainbow {
  background: linear-gradient(90deg, #ff3b3b, #ff9f1a, #ffe81a, #3bd84a, #26b7ff, #9a4dff);
}

@media (prefers-reduced-motion: reduce) {
  .gauge > div > div {
    transition: none;
  }
}
</style>
