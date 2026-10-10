<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useSongDisplay } from '../composables/useSongDisplay'
import type { Score, UserData } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps<{ user: UserData; accessCode: string }>()
const { songTitle, difficultyLabel } = useSongDisplay()

const onlineCount = ref<number | null>(null)
const recentScores = ref<Score[]>([])
const rank = ref<number | null>(null)
const totalScore = ref<number | null>(null)

onMounted(async () => {
  const [onlineRes, recentRes, leaderboardRes] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/online_users`),
    fetch(`${API_BASE_URL}/recent_scores?access_code=${encodeURIComponent(props.accessCode)}`),
    fetch(`${API_BASE_URL}/leaderboard`),
  ])

  if (onlineRes.status === 'fulfilled' && onlineRes.value.ok) {
    const data: { online: number } = await onlineRes.value.json()
    onlineCount.value = data.online
  }

  if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
    const data: { scores: Score[] } = await recentRes.value.json()
    recentScores.value = data.scores
  }

  if (leaderboardRes.status === 'fulfilled' && leaderboardRes.value.ok) {
    const data: { leaderboard: { username: string; total_score: number }[] } =
      await leaderboardRes.value.json()
    const index = data.leaderboard.findIndex((entry) => entry.username === props.user.username)
    const entry = index !== -1 ? data.leaderboard[index] : undefined
    if (entry) {
      rank.value = index + 1
      totalScore.value = entry.total_score
    }
  }
})
</script>

<template>
  <div class="flex w-full max-w-lg flex-col items-center gap-4">
    <h1 class="text-xl font-bold">{{ $t('home.welcome', { username: user.username }) }}</h1>

    <p>
      <span v-if="onlineCount !== null">{{ $t('home.usersOnline', onlineCount) }}</span>
      <span v-else class="muted">{{ $t('home.onlineUnavailable') }}</span>
    </p>

    <div class="flex w-full flex-col items-center gap-1">
      <span class="muted text-sm">{{ $t('home.globalLeaderboard') }}</span>
      <p v-if="rank !== null">
        {{ $t('home.rankPoints', { rank, points: totalScore!.toLocaleString() }) }}
      </p>
      <p v-else class="muted">{{ $t('home.notRankedYet') }}</p>
    </div>

    <div class="flex w-full flex-col items-center gap-1">
      <span class="muted text-sm">{{ $t('home.recentScores') }}</span>
      <p v-if="recentScores.length === 0" class="muted">{{ $t('common.noScoresYet') }}</p>
      <table v-else class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="th-cell">{{ $t('common.song') }}</th>
            <th class="th-cell">{{ $t('common.difficulty') }}</th>
            <th class="th-cell">{{ $t('common.score') }}</th>
            <th class="th-cell">{{ $t('common.crown') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in recentScores" :key="`${entry.hash}-${entry.difficulty}`">
            <td class="td-cell">
              <router-link :to="`/songs/${entry.hash}`" class="row-link">{{ songTitle(entry.title) }}</router-link>
            </td>
            <td class="td-cell">{{ difficultyLabel(entry.difficulty) }}</td>
            <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
            <td class="td-cell">{{ entry.crown }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
