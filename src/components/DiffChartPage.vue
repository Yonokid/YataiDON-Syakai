<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Score } from '../types'

interface ChartSong {
  order: number
  difficulty: string
  hash: string | null
  title?: Record<string, string>
}

interface ChartSection {
  name: string
  order: number
  songs: ChartSong[]
}

interface ChartFile {
  name: string
  level: number
  type: string
  data: { name: string; sections: ChartSection[] }
}

const CROWN_CLASSES = ['crown-none', 'crown-clear', 'crown-fc', 'crown-dfc']
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const tabBase =
  'cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const tabActive = 'border-neutral-900 font-semibold dark:border-neutral-100'

const props = defineProps<{ scores: Score[]; accessCode: string }>()
const { t } = useI18n()

const jumpingHash = ref<string | null>(null)
const jumpError = ref('')

async function sendToGame(hash: string | null) {
  if (!hash) return
  jumpingHash.value = hash
  jumpError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/request_song_jump?access_code=${encodeURIComponent(props.accessCode)}&hash=${encodeURIComponent(hash)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
  } catch {
    jumpError.value = t('diffChart.jumpError')
  } finally {
    jumpingHash.value = null
  }
}

const modules = import.meta.glob('../data/diffchart/*.json', { eager: true }) as Record<
  string,
  { default: ChartFile }
>

const charts = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.type.localeCompare(b.type) || a.level - b.level)

const selected = ref<ChartFile>(charts[0]!)

const sections = computed(() =>
  [...selected.value.data.sections].sort((a, b) => a.order - b.order),
)

const crownByHash = computed(() => {
  const map = new Map<string, number>()
  for (const score of props.scores) map.set(score.hash, score.crown)
  return map
})

function crownClass(hash: string | null) {
  const crown = (hash ? crownByHash.value.get(hash) : undefined) ?? 0
  return CROWN_CLASSES[crown]
}

function songTitle(song: ChartSong) {
  if (!song.title) return t('diffChart.unknownSong')
  return song.title.en ?? Object.values(song.title)[0] ?? t('diffChart.unknownSong')
}
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col gap-4">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="chart in charts"
        :key="chart.name"
        type="button"
        :class="[tabBase, chart === selected && tabActive]"
        @click="selected = chart"
      >
        {{ chart.name }}
      </button>
    </div>

    <div v-for="section in sections" :key="section.order" class="flex flex-col gap-2">
      <h2 class="text-lg font-bold">{{ section.name }}</h2>
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="th-cell">{{ $t('common.song') }}</th>
            <th class="th-cell">{{ $t('common.difficulty') }}</th>
            <th class="th-cell"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="song in [...section.songs].sort((a, b) => a.order - b.order)"
            :key="song.hash ?? song.order"
            :class="crownClass(song.hash)"
          >
            <td class="td-cell">
              <router-link v-if="song.hash" :to="`/songs/${song.hash}`" class="row-link">{{ songTitle(song) }}</router-link>
              <template v-else>{{ songTitle(song) }}</template>
            </td>
            <td class="td-cell">{{ song.difficulty }}</td>
            <td class="td-cell">
              <button
                v-if="song.hash"
                type="button"
                class="btn whitespace-nowrap"
                :disabled="jumpingHash === song.hash"
                @click="sendToGame(song.hash)"
              >
                {{ jumpingHash === song.hash ? $t('common.sending') : $t('common.sendToGame') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="jumpError" class="error-text text-sm">{{ jumpError }}</p>
  </div>
</template>

<style scoped>
.crown-clear {
  background-color: rgba(192, 192, 192, 0.35);
}

.crown-fc {
  background-color: rgba(255, 215, 0, 0.35);
}

.crown-dfc {
  background: linear-gradient(
    90deg,
    rgba(255, 0, 0, 0.35),
    rgba(255, 165, 0, 0.35),
    rgba(255, 255, 0, 0.35),
    rgba(0, 255, 0, 0.35),
    rgba(0, 191, 255, 0.35),
    rgba(148, 0, 211, 0.35)
  );
}
</style>
