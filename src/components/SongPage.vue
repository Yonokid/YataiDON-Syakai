<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

interface Song {
  hash: string
  title: Record<string, string>
  subtitle: Record<string, string>
  difficulty: number
  level: number
}

interface ScoreEntry {
  username: string
  score: number
  crown: number
  rank: number
  max_combo: number
}

const DIFFICULTY_LABELS = ['Easy', 'Normal', 'Hard', 'Oni', 'Ura', 'Tower', 'Dan']
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const tabBase =
  'cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const tabActive = 'border-neutral-900 font-semibold dark:border-neutral-100'

const route = useRoute()

const songs = ref<Song[]>([])
const songsStatus = ref<'loading' | 'loaded' | 'error'>('loading')
const entries = ref<ScoreEntry[]>([])
const entriesStatus = ref<'loading' | 'loaded' | 'error'>('loading')

function songTitle(title: Record<string, string>) {
  return title.en ?? Object.values(title)[0] ?? '(untitled)'
}

function difficultyLabel(difficulty: number) {
  return DIFFICULTY_LABELS[difficulty] ?? `Difficulty ${difficulty}`
}

const currentSong = computed(() => songs.value.find((s) => s.hash === route.params.hash))
const variants = computed(() => {
  if (!currentSong.value) return []
  const title = songTitle(currentSong.value.title)
  return songs.value
    .filter((s) => songTitle(s.title) === title)
    .sort((a, b) => a.difficulty - b.difficulty)
})

async function loadLeaderboard(hash: string) {
  entriesStatus.value = 'loading'
  try {
    const response = await fetch(`${API_BASE_URL}/song_leaderboard?hash=${encodeURIComponent(hash)}`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: { leaderboard: ScoreEntry[] } = await response.json()
    entries.value = data.leaderboard
    entriesStatus.value = 'loaded'
  } catch {
    entriesStatus.value = 'error'
  }
}

onMounted(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/songs`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: { songs: Song[] } = await response.json()
    songs.value = data.songs
    songsStatus.value = 'loaded'
  } catch {
    songsStatus.value = 'error'
  }
})

watch(
  () => route.params.hash,
  (hash) => loadLeaderboard(hash as string),
  { immediate: true },
)
</script>

<template>
  <div class="flex w-full max-w-lg flex-col items-center gap-2">
    <router-link to="/songs" class="self-start px-2 py-1 text-sm hover:underline">&larr; Back to songs</router-link>

    <template v-if="currentSong">
      <h2 class="text-lg font-bold">{{ songTitle(currentSong.title) }}</h2>
      <p class="-mt-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">{{ currentSong.hash }}</p>

      <div class="flex flex-wrap justify-center gap-2">
        <router-link
          v-for="variant in variants"
          :key="variant.hash"
          :to="`/songs/${variant.hash}`"
          custom
          v-slot="{ navigate, isActive }"
        >
          <button type="button" :class="[tabBase, isActive && tabActive]" @click="navigate">
            {{ difficultyLabel(variant.difficulty) }} ★{{ variant.level }}
          </button>
        </router-link>
      </div>
    </template>
    <p v-else-if="songsStatus === 'loading'">Loading…</p>
    <p v-else-if="songsStatus === 'error'" class="error-text">Could not reach server.</p>
    <p v-else class="error-text">Song not found.</p>

    <p v-if="entriesStatus === 'loading'">Loading…</p>
    <p v-else-if="entriesStatus === 'error'" class="error-text">Could not reach server.</p>
    <p v-else-if="entries.length === 0" class="muted">No scores yet.</p>
    <table v-else class="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th class="th-cell">Rank</th>
          <th class="th-cell">Username</th>
          <th class="th-cell">Score</th>
          <th class="th-cell">Crown</th>
          <th class="th-cell">Max Combo</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in entries" :key="entry.username">
          <td class="td-cell">{{ index + 1 }}</td>
          <td class="td-cell"><router-link :to="`/u/${entry.username}`" class="row-link">{{ entry.username }}</router-link></td>
          <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
          <td class="td-cell">{{ entry.crown }}</td>
          <td class="td-cell">{{ entry.max_combo }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
