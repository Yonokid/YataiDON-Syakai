<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Title {
  number: number
  name: string
  color: string | null
  unlock_condition_ja: string | null
  unlock_condition_en: string | null
  unlocked: boolean
}

const API_BASE_URL = import.meta.env.NETWORK_URL

const props = defineProps<{ accessCode: string }>()
const { t } = useI18n()

const titles = ref<Title[]>([])
const status = ref<'loading' | 'loaded' | 'error'>('loading')
const search = ref('')
const filter = ref<'all' | 'unlocked' | 'locked'>('all')

const filteredTitles = computed(() => {
  const term = search.value.trim().toLowerCase()
  return titles.value.filter((title) => {
    if (filter.value === 'unlocked' && !title.unlocked) return false
    if (filter.value === 'locked' && title.unlocked) return false
    if (!term) return true
    return (
      title.name.toLowerCase().includes(term) ||
      String(title.number).includes(term) ||
      (title.unlock_condition_ja?.toLowerCase().includes(term) ?? false) ||
      (title.unlock_condition_en?.toLowerCase().includes(term) ?? false)
    )
  })
})

onMounted(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/titles?access_code=${encodeURIComponent(props.accessCode)}`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: { titles: Title[] } = await response.json()
    titles.value = data.titles
    status.value = 'loaded'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <div class="flex w-full max-w-2xl flex-col items-center gap-3">
    <h1 class="text-xl font-bold">{{ $t('titles.title') }}</h1>

    <div class="flex w-full flex-col items-center gap-3">
      <input v-model="search" type="text" :placeholder="$t('titles.searchPlaceholder')" class="field w-full" />
      <div class="flex gap-2">
        <button
          type="button"
          class="btn"
          :class="filter === 'all' && 'border-neutral-900 font-semibold dark:border-neutral-100'"
          @click="filter = 'all'"
        >
          {{ $t('titles.filterAll') }}
        </button>
        <button
          type="button"
          class="btn"
          :class="filter === 'unlocked' && 'border-neutral-900 font-semibold dark:border-neutral-100'"
          @click="filter = 'unlocked'"
        >
          {{ $t('titles.filterUnlocked') }}
        </button>
        <button
          type="button"
          class="btn"
          :class="filter === 'locked' && 'border-neutral-900 font-semibold dark:border-neutral-100'"
          @click="filter = 'locked'"
        >
          {{ $t('titles.filterLocked') }}
        </button>
      </div>

      <p v-if="status === 'loading'">{{ $t('common.loading') }}</p>
      <p v-else-if="status === 'error'" class="error-text">{{ $t('titles.loadError') }}</p>
      <template v-else>
        <p class="muted text-xs">
          {{ t('titles.countShown', { shown: filteredTitles.length, total: titles.length }) }}
        </p>
        <p v-if="filteredTitles.length === 0" class="muted">{{ $t('titles.noTitlesFound') }}</p>
        <ul v-else class="flex max-h-[32rem] w-full flex-col gap-1 overflow-y-auto">
          <li
            v-for="title in filteredTitles"
            :key="title.number"
            class="rounded-md border p-3 text-left"
            :class="
              title.unlocked
                ? 'border-neutral-300 dark:border-neutral-700'
                : 'border-neutral-200 opacity-60 dark:border-neutral-800'
            "
          >
            <div class="flex items-center gap-2">
              <span class="muted text-xs">#{{ title.number }}</span>
              <span class="font-semibold">{{ title.name }}</span>
              <span
                v-if="title.unlocked"
                class="rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"
              >
                {{ $t('titles.unlockedBadge') }}
              </span>
            </div>
            <p v-if="title.unlock_condition_ja" class="muted mt-1 text-sm">{{ title.unlock_condition_ja }}</p>
            <p class="mt-0.5 text-sm">{{ title.unlock_condition_en ?? $t('titles.unlockConditionUnknown') }}</p>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
