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
  <div class="leaderboard-page">
    <h1>Leaderboard</h1>
    <p class="subtitle">Total score, Oni + Ura difficulties</p>

    <p v-if="status === 'loading'">Loading…</p>
    <p v-else-if="status === 'error'" class="error">Could not reach server.</p>
    <p v-else-if="entries.length === 0" class="empty">No scores yet.</p>
    <table v-else class="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Username</th>
          <th>Total Score</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in entries" :key="entry.username">
          <td>{{ index + 1 }}</td>
          <td>{{ entry.username }}</td>
          <td>{{ entry.total_score.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.leaderboard-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 32rem;
}

.subtitle {
  color: #888;
  margin-top: -0.5rem;
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
