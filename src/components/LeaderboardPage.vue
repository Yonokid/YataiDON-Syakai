<script setup lang="ts">
import { onMounted, ref } from 'vue'
import CrownIcon from './CrownIcon.vue'
import RatingFormula from './RatingFormula.vue'

interface LeaderboardEntry {
  id: number
  username: string
  rating: number
  crown_clear: number
  crown_full_combo: number
  crown_donderful: number
}

const API_BASE_URL = import.meta.env.NETWORK_URL

const LEADERBOARD_LIMIT = 100
const entries = ref<LeaderboardEntry[]>([])
const status = ref<'loading' | 'loaded' | 'error'>('loading')

onMounted(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: { leaderboard: LeaderboardEntry[] } = await response.json()
    entries.value = data.leaderboard.slice(0, LEADERBOARD_LIMIT)
    status.value = 'loaded'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <div class="flex w-full max-w-2xl flex-col gap-3">
    <h1 class="text-2xl font-bold tracking-tight">{{ $t('leaderboard.title') }}</h1>
    <RatingFormula class="-mt-1" />

    <p v-if="status === 'loading'">{{ $t('common.loading') }}</p>
    <p v-else-if="status === 'error'" class="error-text">{{ $t('common.serverError') }}</p>
    <p v-else-if="entries.length === 0" class="muted">{{ $t('common.noScoresYet') }}</p>
    <table v-else class="card w-full border-collapse text-sm">
      <thead>
        <tr>
          <th class="th-cell">{{ $t('common.rank') }}</th>
          <th class="th-cell">{{ $t('common.username') }}</th>
          <th class="th-cell">{{ $t('leaderboard.thRating') }}</th>
          <th class="th-cell"><CrownIcon :crown="1" /></th>
          <th class="th-cell"><CrownIcon :crown="2" /></th>
          <th class="th-cell"><CrownIcon :crown="3" /></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in entries" :key="entry.id">
          <td class="td-cell">{{ index + 1 }}</td>
          <td class="td-cell max-w-48 truncate"><router-link :to="`/u/${entry.id}`" class="row-link">{{ entry.username }}</router-link></td>
          <td class="td-cell">{{ entry.rating.toFixed(2) }}</td>
          <td class="td-cell">{{ entry.crown_clear }}</td>
          <td class="td-cell">{{ entry.crown_full_combo }}</td>
          <td class="td-cell">{{ entry.crown_donderful }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
