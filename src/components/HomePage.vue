<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useSongDisplay } from '../composables/useSongDisplay'
import type { Score, UserData } from '../types'
import CrownIcon from './CrownIcon.vue'
import DifficultyBadge from './DifficultyBadge.vue'

const API_BASE_URL = import.meta.env.NETWORK_URL

const props = defineProps<{ user: UserData; accessCode: string }>()
const { songTitle, difficultyLabel } = useSongDisplay()

const onlineCount = ref<number | null>(null)
const recentScores = ref<Score[]>([])
const rank = ref<number | null>(null)
const rating = ref<number | null>(null)

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
    const data: { leaderboard: { username: string; rating: number }[] } =
      await leaderboardRes.value.json()
    const index = data.leaderboard.findIndex((entry) => entry.username === props.user.username)
    const entry = index !== -1 ? data.leaderboard[index] : undefined
    if (entry) {
      rank.value = index + 1
      rating.value = entry.rating
    }
  }
})
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col gap-4">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">{{ $t('home.welcome', { username: user.username }) }}</h1>
    </div>

    <section class="card flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p class="muted text-xs font-semibold tracking-wide uppercase">{{ $t('home.globalLeaderboard') }}</p>
          <p v-if="rank !== null" class="text-3xl font-bold text-don tabular-nums">#{{ rank }}</p>
          <p v-else class="muted mt-1 text-sm">{{ $t('home.notRankedYet') }}</p>
        </div>
        <div v-if="rank !== null">
          <p class="muted text-xs font-semibold tracking-wide uppercase">{{ $t('leaderboard.thRating') }}</p>
          <p class="text-3xl font-bold tabular-nums">{{ rating!.toFixed(2) }}</p>
        </div>
        <div>
          <p class="muted text-xs font-semibold tracking-wide uppercase">{{ $t('home.online') }}</p>
          <p v-if="onlineCount !== null" class="text-3xl font-bold tabular-nums">
            <span class="mr-1.5 inline-block size-2.5 rounded-full bg-green-500 align-middle"></span>{{ onlineCount }}
          </p>
          <p v-else class="muted mt-1 text-sm">{{ $t('home.onlineUnavailable') }}</p>
        </div>
      </div>

      <div class="border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <p class="muted mb-1 text-xs font-semibold tracking-wide uppercase">{{ $t('home.recentScores') }}</p>
        <p v-if="recentScores.length === 0" class="muted">{{ $t('common.noScoresYet') }}</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full border-collapse text-sm">
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
                <td class="td-cell max-w-56 truncate">
                  <router-link :to="`/songs/${entry.hash}`" class="row-link">{{ songTitle(entry.title) }}</router-link>
                </td>
                <td class="td-cell"><DifficultyBadge :difficulty="entry.difficulty" /></td>
                <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
                <td class="td-cell"><CrownIcon :crown="entry.crown" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>
