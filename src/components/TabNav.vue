<script setup lang="ts" generic="T extends string">
import { ref } from 'vue'
import { useNavUnderline } from '../composables/useNavUnderline'

defineProps<{ tabs: readonly { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
const nav = ref<HTMLElement | null>(null)
const underline = useNavUnderline(nav, () => model.value)
</script>

<template>
  <nav ref="nav" class="relative flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800" role="tablist">
    <span class="bg-don pointer-events-none absolute bottom-0 left-0 h-0.5" :style="underline" />
    <button
      v-for="t in tabs"
      :key="t.value"
      type="button"
      role="tab"
      :aria-selected="model === t.value"
      class="-mb-px shrink-0 cursor-pointer border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors"
      :class="
        model === t.value
          ? 'nav-active text-don'
          : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
      "
      @click="model = t.value"
    >
      {{ t.label }}
    </button>
  </nav>
</template>
