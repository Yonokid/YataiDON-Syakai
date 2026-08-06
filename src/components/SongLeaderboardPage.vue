<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

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

const songs = ref<Song[]>([])
const songsStatus = ref<'loading' | 'loaded' | 'error'>('loading')
const search = ref('')

const selected = ref<Song | null>(null)
const entries = ref<ScoreEntry[]>([])
const entriesStatus = ref<'loading' | 'loaded' | 'error'>('loaded')

function songTitle(title: Record<string, string>) {
  return title.en ?? Object.values(title)[0] ?? '(untitled)'
}

function difficultyLabel(difficulty: number) {
  return DIFFICULTY_LABELS[difficulty] ?? `Difficulty ${difficulty}`
}

const filteredSongs = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return songs.value
  return songs.value.filter((song) => songTitle(song.title).toLowerCase().includes(term))
})

async function selectSong(song: Song) {
  selected.value = song
  entriesStatus.value = 'loading'
  try {
    const response = await fetch(
      `${API_BASE_URL}/song_leaderboard?hash=${encodeURIComponent(song.hash)}`,
    )
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
</script>

<template>
  <div class="song-leaderboard-page">
    <h1>Song Leaderboards</h1>

    <div v-if="!selected" class="song-picker">
      <input v-model="search" type="text" placeholder="Search songs…" class="song-search" />
      <p v-if="songsStatus === 'loading'">Loading…</p>
      <p v-else-if="songsStatus === 'error'" class="error">Could not reach server.</p>
      <p v-else-if="filteredSongs.length === 0" class="empty">No songs found.</p>
      <ul v-else class="song-list">
        <li v-for="song in filteredSongs" :key="song.hash">
          <button type="button" @click="selectSong(song)">
            {{ songTitle(song.title) }}
            <span class="song-meta">{{ difficultyLabel(song.difficulty) }} ★{{ song.level }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div v-else class="song-detail">
      <button type="button" class="back" @click="selected = null">&larr; Back to songs</button>
      <h2>{{ songTitle(selected.title) }}</h2>
      <p class="song-meta">{{ difficultyLabel(selected.difficulty) }} ★{{ selected.level }}</p>

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
            <td>{{ entry.username }}</td>
            <td>{{ entry.score.toLocaleString() }}</td>
            <td>{{ entry.crown }}</td>
            <td>{{ entry.max_combo }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.song-leaderboard-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 32rem;
}

.song-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.song-search {
  width: 100%;
  padding: 0.4rem 0.6rem;
}

.song-list {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 24rem;
  overflow-y: auto;
}

.song-list button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  cursor: pointer;
  text-align: left;
}

.song-meta {
  color: #888;
  font-size: 0.85rem;
  white-space: nowrap;
}

.song-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.back {
  align-self: flex-start;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
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
