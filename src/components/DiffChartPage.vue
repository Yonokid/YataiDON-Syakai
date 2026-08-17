<script setup lang="ts">
import { computed, ref } from 'vue'
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

const props = defineProps<{ scores: Score[]; accessCode: string }>()

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
    jumpError.value = 'Could not send song to game. Please try again.'
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
  if (!song.title) return '(unknown song)'
  return song.title.en ?? Object.values(song.title)[0] ?? '(unknown song)'
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="song in [...section.songs].sort((a, b) => a.order - b.order)"
            :key="song.hash ?? song.order"
            :class="crownClass(song.hash)"
          >
            <td>
              <router-link v-if="song.hash" :to="`/songs/${song.hash}`">{{ songTitle(song) }}</router-link>
              <template v-else>{{ songTitle(song) }}</template>
            </td>
            <td>{{ song.difficulty }}</td>
            <td>
              <button
                v-if="song.hash"
                type="button"
                :disabled="jumpingHash === song.hash"
                @click="sendToGame(song.hash)"
              >
                {{ jumpingHash === song.hash ? 'Sending…' : 'Send to Game' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="jumpError" class="jump-error">{{ jumpError }}</p>
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

.songs-table button {
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  white-space: nowrap;
}

.jump-error {
  color: #c0392b;
  font-size: 0.85rem;
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
