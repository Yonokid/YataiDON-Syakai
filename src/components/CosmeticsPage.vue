<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type Kind = 'costume' | 'head' | 'body'

interface Condition {
  kind: Kind
  id: number
  unlock_condition_ja: string | null
  unlock_condition_en: string
}

interface Cosmetic {
  kind: Kind
  id: number
  name: string
  icon: string
  unlocked: boolean
  ja: string | null
  en: string | null
}

const API_BASE_URL = import.meta.env.NETWORK_URL
const BASE = import.meta.env.BASE_URL
const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'costume', label: 'cosmetics.kindCostume' },
  { kind: 'head', label: 'cosmetics.kindHead' },
  { kind: 'body', label: 'cosmetics.kindBody' },
]

const props = defineProps<{ accessCode: string }>()
const { t } = useI18n()

const cosmetics = ref<Cosmetic[]>([])
const status = ref<'loading' | 'loaded' | 'error'>('loading')
const search = ref('')
const filter = ref<'all' | 'unlocked' | 'locked'>('all')
const kind = ref<'all' | Kind>('all')

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return cosmetics.value.filter((c) => {
    if (kind.value !== 'all' && c.kind !== kind.value) return false
    if (filter.value === 'unlocked' && !c.unlocked) return false
    if (filter.value === 'locked' && c.unlocked) return false
    if (!term) return true
    return (
      c.name.toLowerCase().includes(term) ||
      (c.ja?.toLowerCase().includes(term) ?? false) ||
      (c.en?.toLowerCase().includes(term) ?? false)
    )
  })
})

const unlockedCount = computed(() => filtered.value.filter((c) => c.unlocked).length)

onMounted(async () => {
  try {
    const [server, names] = await Promise.all([
      fetch(`${API_BASE_URL}/cosmetics?access_code=${encodeURIComponent(props.accessCode)}`).then((r) => {
        if (!r.ok) throw new Error(`Unexpected status ${r.status}`)
        return r.json() as Promise<{ owned: Record<Kind, number[]>; conditions: Condition[] }>
      }),
      fetch(`${BASE}costumes/costume_names.json`).then(
        (r) => r.json() as Promise<Record<Kind, Record<string, { icon: string; name: string | null }>>>,
      ),
    ])
    const conditions = new Map(server.conditions.map((c) => [`${c.kind}:${c.id}`, c]))
    cosmetics.value = KINDS.flatMap(({ kind }) =>
      Object.entries(names[kind]).flatMap(([key, entry]) => {
        const id = Number(key)
        const condition = conditions.get(`${kind}:${id}`)
        const unlocked = server.owned[kind].includes(id)
        // id 0 is "take it off"; anything with no condition and not owned is unused or hidden.
        if (id === 0 || !entry.name || (!condition && !unlocked)) return []
        return [
          {
            kind,
            id,
            name: entry.name,
            icon: entry.icon,
            unlocked,
            ja: condition?.unlock_condition_ja || null,
            en: condition?.unlock_condition_en ?? null,
          },
        ]
      }),
    )
    status.value = 'loaded'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <div class="flex w-full max-w-2xl flex-col items-center gap-3">
    <h1 class="text-xl font-bold">{{ $t('cosmetics.title') }}</h1>

    <div class="flex w-full flex-col items-center gap-3">
      <input v-model="search" type="text" :placeholder="$t('cosmetics.searchPlaceholder')" class="field w-full" />
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="f in ['all', 'unlocked', 'locked'] as const"
          :key="f"
          type="button"
          class="btn"
          :class="filter === f && 'border-neutral-900 font-semibold dark:border-neutral-100'"
          @click="filter = f"
        >
          {{ $t(f === 'all' ? 'cosmetics.filterAll' : f === 'unlocked' ? 'cosmetics.filterUnlocked' : 'cosmetics.filterLocked') }}
        </button>
      </div>
      <div class="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          class="btn"
          :class="kind === 'all' && 'border-neutral-900 font-semibold dark:border-neutral-100'"
          @click="kind = 'all'"
        >
          {{ $t('cosmetics.kindAll') }}
        </button>
        <button
          v-for="k in KINDS"
          :key="k.kind"
          type="button"
          class="btn"
          :class="kind === k.kind && 'border-neutral-900 font-semibold dark:border-neutral-100'"
          @click="kind = k.kind"
        >
          {{ $t(k.label) }}
        </button>
      </div>

      <p v-if="status === 'loading'">{{ $t('common.loading') }}</p>
      <p v-else-if="status === 'error'" class="error-text">{{ $t('cosmetics.loadError') }}</p>
      <template v-else>
        <p class="muted text-xs">
          {{ t('cosmetics.countShown', { shown: filtered.length, total: cosmetics.length, unlocked: unlockedCount }) }}
        </p>
        <p v-if="filtered.length === 0" class="muted">{{ $t('cosmetics.noneFound') }}</p>
        <ul v-else class="flex max-h-[32rem] w-full flex-col gap-1 overflow-y-auto">
          <li
            v-for="c in filtered"
            :key="`${c.kind}:${c.id}`"
            class="flex items-center gap-3 rounded-md border p-3 text-left"
            :class="
              c.unlocked
                ? 'border-neutral-300 dark:border-neutral-700'
                : 'border-neutral-200 opacity-60 dark:border-neutral-800'
            "
          >
            <img :src="`${BASE}costumes/${c.icon}`" alt="" loading="lazy" class="h-12 w-12 shrink-0" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="muted text-xs">{{ $t(KINDS.find((k) => k.kind === c.kind)!.label) }}</span>
                <span class="font-semibold">{{ c.name }}</span>
                <span
                  v-if="c.unlocked"
                  class="rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"
                >
                  {{ $t('cosmetics.unlockedBadge') }}
                </span>
              </div>
              <p v-if="c.ja" class="muted mt-1 text-sm">{{ c.ja }}</p>
              <p class="mt-0.5 text-sm">{{ c.en ?? $t('cosmetics.conditionUnknown') }}</p>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
