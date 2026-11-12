<script setup lang="ts" generic="T extends string">
defineProps<{ options: readonly { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="inline-flex flex-wrap gap-0.5 rounded-control bg-neutral-200/70 p-0.5 dark:bg-neutral-800" role="group">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :aria-pressed="model === o.value"
      class="cursor-pointer rounded-chip px-3 py-1 text-sm font-medium transition-colors"
      :class="
        model === o.value
          ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-600 dark:text-neutral-50'
          : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
      "
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>
