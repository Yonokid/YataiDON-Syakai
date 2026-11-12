<script setup lang="ts" generic="T extends string">
defineProps<{ tabs: readonly { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <nav class="flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800" role="tablist">
    <button
      v-for="t in tabs"
      :key="t.value"
      type="button"
      role="tab"
      :aria-selected="model === t.value"
      class="-mb-px shrink-0 cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors"
      :class="
        model === t.value
          ? 'border-don text-don'
          : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
      "
      @click="model = t.value"
    >
      {{ t.label }}
    </button>
  </nav>
</template>
