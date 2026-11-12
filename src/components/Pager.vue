<script setup lang="ts">
const props = defineProps<{ total: number; pageSize: number }>()
const page = defineModel<number>({ required: true })
const pages = () => Math.max(1, Math.ceil(props.total / props.pageSize))
</script>

<template>
  <div v-if="total > pageSize" class="flex items-center justify-center gap-3 text-sm">
    <button type="button" class="btn" :disabled="page <= 1" @click="page--">‹ {{ $t('common.previous') }}</button>
    <span class="muted tabular-nums">{{ $t('common.pageOf', { page, pages: pages() }) }}</span>
    <button type="button" class="btn" :disabled="page >= pages()" @click="page++">{{ $t('common.next') }} ›</button>
  </div>
</template>
