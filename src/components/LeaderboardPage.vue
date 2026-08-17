<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface LeaderboardEntry {
  username: string
  total_score: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const entries = ref<LeaderboardEntry[]>([])
const status = ref<'loading' | 'loaded' | 'error'>('loading')

onMounted(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: { leaderboard: LeaderboardEntry[] } = await response.json()
    entries.value = data.leaderboard
    status.value = 'loaded'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <div class="flex w-full max-w-lg flex-col items-center gap-3">
    <h1 class="text-xl font-bold">Leaderboard</h1>
    <p class="muted -mt-2">Total score, Oni + Ura difficulties</p>

    <p v-if="status === 'loading'">Loading…</p>
    <p v-else-if="status === 'error'" class="error-text">Could not reach server.</p>
    <p v-else-if="entries.length === 0" class="muted">No scores yet.</p>
    <table v-else class="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th class="th-cell">Rank</th>
          <th class="th-cell">Username</th>
          <th class="th-cell">Total Score</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in entries" :key="entry.username">
          <td class="td-cell">{{ index + 1 }}</td>
          <td class="td-cell"><router-link :to="`/u/${entry.username}`" class="row-link">{{ entry.username }}</router-link></td>
          <td class="td-cell">{{ entry.total_score.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
