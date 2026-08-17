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
  <div class="song-page">
    <router-link to="/songs" class="back">&larr; Back to songs</router-link>

    <template v-if="currentSong">
      <h2>{{ songTitle(currentSong.title) }}</h2>
      <p class="hash-subtitle">{{ currentSong.hash }}</p>

      <div class="difficulty-tabs">
        <router-link
          v-for="variant in variants"
          :key="variant.hash"
          :to="`/songs/${variant.hash}`"
          custom
          v-slot="{ navigate, isActive }"
        >
          <button type="button" :class="{ active: isActive }" @click="navigate">
            {{ difficultyLabel(variant.difficulty) }} ★{{ variant.level }}
          </button>
        </router-link>
      </div>
    </template>
    <p v-else-if="songsStatus === 'loading'">Loading…</p>
    <p v-else-if="songsStatus === 'error'" class="error">Could not reach server.</p>
    <p v-else class="error">Song not found.</p>

    <p v-if="entriesStatus === 'loading'">Loading…</p>
    <p v-else-if="entriesStatus === 'error'" class="error">Could not reach server.</p>
    <p v-else-if="entries.length === 0" class="empty">No scores yet.</p>
    <table v-else class="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Username</th>
          <th>Score</th>
          <th>Crown</th>
          <th>Max Combo</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in entries" :key="entry.username">
          <td>{{ index + 1 }}</td>
          <td><router-link :to="`/u/${entry.username}`">{{ entry.username }}</router-link></td>
          <td>{{ entry.score.toLocaleString() }}</td>
          <td>{{ entry.crown }}</td>
          <td>{{ entry.max_combo }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.song-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 32rem;
}

.back {
  align-self: flex-start;
  padding: 0.3rem 0.6rem;
}

.hash-subtitle {
  margin: -0.3rem 0 0;
  font-size: 0.75rem;
  font-family: monospace;
  color: #888;
}

.difficulty-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.difficulty-tabs button {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.difficulty-tabs button.active {
  font-weight: bold;
  border-color: currentColor;
}

.error {
  color: #c0392b;
}

.empty {
  color: #888;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th,
.leaderboard-table td {
  padding: 0.4rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}
</style>
