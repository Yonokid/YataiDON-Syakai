<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SegControl from './SegControl.vue'

interface Title {
  number: number
  name: string
  color: string | null
  unlock_condition_ja: string | null
  unlock_condition_en: string | null
  unlock_type: string
  unlocked: boolean
}

const API_BASE_URL = import.meta.env.NETWORK_URL

const props = defineProps<{ accessCode: string }>()
const { t, te } = useI18n()

const titles = ref<Title[]>([])
const status = ref<'loading' | 'loaded' | 'error'>('loading')
const search = ref('')
const filter = ref<'all' | 'unlocked' | 'locked'>('all')
const filterOptions = computed(() => [
  { value: 'all' as const, label: t('titles.filterAll') },
  { value: 'unlocked' as const, label: t('titles.filterUnlocked') },
  { value: 'locked' as const, label: t('titles.filterLocked') },
])

const color = ref('all')
const unlockType = ref('all')
const sort = ref<'default' | 'name' | 'unlocked' | 'locked'>('default')
const colorOptions = computed(() => [...new Set(titles.value.map((x) => x.color).filter((c): c is string => !!c))].sort())

const typeOptions = computed(() => [...new Set(titles.value.map((x) => x.unlock_type))].sort())
const typeLabel = (type: string) => (te(`titles.type.${type}`) ? t(`titles.type.${type}`) : type)

const filteredTitles = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = titles.value.filter((title) => {
    if (color.value !== 'all' && title.color !== color.value) return false
    if (unlockType.value !== 'all' && title.unlock_type !== unlockType.value) return false
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
  if (sort.value === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name))
  if (sort.value === 'unlocked') return [...list].sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
  if (sort.value === 'locked') return [...list].sort((a, b) => Number(a.unlocked) - Number(b.unlocked))
  return list
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
  <div class="flex w-full max-w-2xl flex-col gap-4">
    <h1 class="text-2xl font-bold tracking-tight">{{ $t('titles.title') }}</h1>

    <div class="flex w-full flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="search" type="text" :placeholder="$t('titles.searchPlaceholder')" class="field min-w-48 flex-1" />
        <SegControl v-model="filter" :options="filterOptions" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="color" class="field text-sm" :aria-label="$t('titles.colorAll')">
          <option value="all">{{ $t('titles.colorAll') }}</option>
          <option v-for="c in colorOptions" :key="c" :value="c">{{ c }}</option>
        </select>
        <select v-model="unlockType" class="field text-sm" :aria-label="$t('titles.typeAll')">
          <option value="all">{{ $t('titles.typeAll') }}</option>
          <option v-for="type in typeOptions" :key="type" :value="type">{{ typeLabel(type) }}</option>
        </select>
        <select v-model="sort" class="field text-sm" :aria-label="$t('titles.sortLabel')">
          <option value="default">{{ $t('titles.sortDefault') }}</option>
          <option value="name">{{ $t('titles.sortName') }}</option>
          <option value="unlocked">{{ $t('titles.sortUnlockedFirst') }}</option>
          <option value="locked">{{ $t('titles.sortLockedFirst') }}</option>
        </select>
      </div>

      <p v-if="status === 'loading'">{{ $t('common.loading') }}</p>
      <p v-else-if="status === 'error'" class="error-text">{{ $t('titles.loadError') }}</p>
      <template v-else>
        <p class="muted text-xs">
          {{ t('titles.countShown', { shown: filteredTitles.length, total: titles.length }) }}
        </p>
        <p v-if="filteredTitles.length === 0" class="muted">{{ $t('titles.noTitlesFound') }}</p>
        <ul v-else class="card max-h-[32rem] w-full divide-y divide-neutral-200 overflow-y-auto p-0 dark:divide-neutral-800">
          <li
            v-for="title in filteredTitles"
            :key="title.number"
            class="px-4 py-3 text-left"
            :class="!title.unlocked && 'opacity-60'"
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
