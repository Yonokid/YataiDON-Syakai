<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Score } from '../types'

interface PublicUser {
  username: string
  chara_color_1: string
  chara_color_2: string
  chara_color_3: string
  scores: Score[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const route = useRoute()

const user = ref<PublicUser | null>(null)
const status = ref<'loading' | 'loaded' | 'error' | 'not-found'>('loading')

const DIFFICULTY_LABELS = ['Easy', 'Normal', 'Hard', 'Oni', 'Ura', 'Tower', 'Dan']

function songTitle(title: Record<string, string>) {
  return title.en ?? Object.values(title)[0] ?? '(untitled)'
}

function difficultyLabel(difficulty: number) {
  return DIFFICULTY_LABELS[difficulty] ?? `Difficulty ${difficulty}`
}

async function load(username: string) {
  status.value = 'loading'
  try {
    const response = await fetch(`${API_BASE_URL}/public_user?username=${encodeURIComponent(username)}`)
    if (response.status === 404) {
      status.value = 'not-found'
      return
    }
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    user.value = await response.json()
    status.value = 'loaded'
  } catch {
    status.value = 'error'
  }
}

onMounted(() => load(route.params.username as string))
watch(() => route.params.username, (username) => load(username as string))
</script>

<template>
  <div class="public-user-page">
    <p v-if="status === 'loading'">Loading…</p>
    <p v-else-if="status === 'not-found'" class="error">User not found.</p>
    <p v-else-if="status === 'error'" class="error">Could not reach server.</p>
    <template v-else-if="user">
      <h1>{{ user.username }}</h1>

      <p v-if="user.scores.length === 0" class="empty">No scores yet.</p>
      <div v-else class="scores-table-wrap">
        <table class="scores-table">
          <thead>
            <tr>
              <th>Song</th>
              <th>Difficulty</th>
              <th>Level</th>
              <th>Score</th>
              <th>Crown</th>
              <th>Rank</th>
              <th>Max Combo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in user.scores" :key="`${entry.hash}-${entry.difficulty}`">
              <td><router-link :to="`/songs/${entry.hash}`">{{ songTitle(entry.title) }}</router-link></td>
              <td>{{ difficultyLabel(entry.difficulty) }}</td>
              <td>{{ entry.level }}</td>
              <td>{{ entry.score.toLocaleString() }}</td>
              <td>{{ entry.crown }}</td>
              <td>{{ entry.rank }}</td>
              <td>{{ entry.max_combo }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.public-user-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 48rem;
}

.error {
  color: #c0392b;
}

.empty {
  color: #888;
}

.scores-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.scores-table {
  width: 100%;
  border-collapse: collapse;
}

.scores-table th,
.scores-table td {
  padding: 0.4rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
  white-space: nowrap;
}
</style>
