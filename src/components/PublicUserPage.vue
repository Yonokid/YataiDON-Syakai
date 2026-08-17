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
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
    <p v-if="status === 'loading'">Loading…</p>
    <p v-else-if="status === 'not-found'" class="error-text">User not found.</p>
    <p v-else-if="status === 'error'" class="error-text">Could not reach server.</p>
    <template v-else-if="user">
      <h1 class="text-xl font-bold">{{ user.username }}</h1>

      <p v-if="user.scores.length === 0" class="muted">No scores yet.</p>
      <div v-else class="w-full overflow-x-auto">
        <table class="w-full border-collapse text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th class="th-cell">Song</th>
              <th class="th-cell">Difficulty</th>
              <th class="th-cell">Level</th>
              <th class="th-cell">Score</th>
              <th class="th-cell">Crown</th>
              <th class="th-cell">Rank</th>
              <th class="th-cell">Max Combo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in user.scores" :key="`${entry.hash}-${entry.difficulty}`">
              <td class="td-cell">
                <router-link :to="`/songs/${entry.hash}`" class="row-link">{{ songTitle(entry.title) }}</router-link>
              </td>
              <td class="td-cell">{{ difficultyLabel(entry.difficulty) }}</td>
              <td class="td-cell">{{ entry.level }}</td>
              <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
              <td class="td-cell">{{ entry.crown }}</td>
              <td class="td-cell">{{ entry.rank }}</td>
              <td class="td-cell">{{ entry.max_combo }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
