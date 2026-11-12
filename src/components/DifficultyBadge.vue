<script setup lang="ts">
import { useSongDisplay } from '../composables/useSongDisplay'

const props = defineProps<{ difficulty: number | string }>()
const NAMES = ['easy', 'normal', 'hard', 'oni', 'ura']
const index = typeof props.difficulty === 'string' ? NAMES.indexOf(props.difficulty) : props.difficulty
const { difficultyLabel } = useSongDisplay()
const BASE = import.meta.env.BASE_URL
</script>

<template>
  <span class="inline-flex items-center">
    <img
      v-if="index >= 0 && index <= 4"
      :src="`${BASE}difficulty/${index}.png`"
      :alt="difficultyLabel(index)"
      :title="difficultyLabel(index)"
      class="size-6 object-contain"
    />
    <template v-else>{{ difficultyLabel(index) }}</template>
  </span>
</template>
