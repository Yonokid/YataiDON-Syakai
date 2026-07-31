<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Score } from '../types'

interface ChartSong {
  songNo: string
  order: number
  difficulty: string
  hash: string
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

const props = defineProps<{ scores: Score[] }>()

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

const titleByHash = ref(new Map<string, string>())

onMounted(async () => {
  const allHashes = new Set(
    charts.flatMap((chart) => chart.data.sections.flatMap((s) => s.songs.map((song) => song.hash))),
  )
  const params = new URLSearchParams()
  for (const hash of allHashes) params.append('hashes', hash)

  const response = await fetch(`${API_BASE_URL}/songs?${params}`)
  if (!response.ok) return
  const songs: { hash: string; title: Record<string, string> }[] = await response.json()

  const map = new Map<string, string>()
  for (const song of songs) {
    map.set(song.hash, song.title.en ?? Object.values(song.title)[0] ?? '')
  }
  titleByHash.value = map
})

function crownClass(hash: string) {
  return CROWN_CLASSES[crownByHash.value.get(hash) ?? 0]
}

function songTitle(song: ChartSong) {
  return titleByHash.value.get(song.hash) || song.songNo
}
</script>

<template>
  <div class="diffchart-page">
    <div class="chart-tabs">
      <button
        v-for="chart in charts"
        :key="chart.name"
        type="button"
        :class="{ active: chart === selected }"
        @click="selected = chart"
      >
        {{ chart.name }}
      </button>
    </div>

    <div v-for="section in sections" :key="section.order" class="section">
      <h2>{{ section.name }}</h2>
      <table class="songs-table">
        <thead>
          <tr>
            <th>Song</th>
            <th>Difficulty</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="song in [...section.songs].sort((a, b) => a.order - b.order)"
            :key="song.hash"
            :class="crownClass(song.hash)"
          >
            <td>{{ songTitle(song) }}</td>
            <td>{{ song.difficulty }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.diffchart-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 48rem;
}

.chart-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chart-tabs button {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.chart-tabs button.active {
  font-weight: bold;
  border-color: currentColor;
}

.songs-table {
  width: 100%;
  border-collapse: collapse;
}

.songs-table th,
.songs-table td {
  padding: 0.4rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}

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
