<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ crown: number }>()
const { t } = useI18n()
const BASE = import.meta.env.BASE_URL
const LABELS: Record<number, string> = { 1: 'scores.tierClear', 2: 'scores.tierFullCombo', 3: 'scores.tierDonderful' }
</script>

<template>
  <img
    v-if="LABELS[crown]"
    :src="`${BASE}crowns/${crown}.png`"
    :alt="t(LABELS[crown]!)"
    :title="t(LABELS[crown]!)"
    class="inline-block size-6 align-middle"
  />
  <span v-else class="muted">–</span>
</template>
