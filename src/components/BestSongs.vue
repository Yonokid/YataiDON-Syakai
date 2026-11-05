<script setup lang="ts">
import { computed } from 'vue'

import { useSongDisplay } from '../composables/useSongDisplay'
import type { UserData } from '../types'

const DIFFICULTY_ONI = 3
const DIFFICULTY_URA = 4
const BEST_N = 50

const props = defineProps<{ scores: UserData['scores'] }>()
const { songTitle, difficultyLabel } = useSongDisplay()

// Same set the leaderboard rating averages: Oni + Ura only, missing slots count as 0.
const bestSongs = computed(() =>
  props.scores
    .filter((s) => (s.difficulty === DIFFICULTY_ONI || s.difficulty === DIFFICULTY_URA) && s.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, BEST_N),
)
const playerRating = computed(() => bestSongs.value.reduce((sum, s) => sum + s.rating, 0) / BEST_N)
</script>

<template>
  <section v-if="bestSongs.length > 0" class="flex w-full flex-col gap-2">
    <h2 class="text-lg font-bold">{{ $t('scores.bestSongsTitle') }}</h2>
    <p class="muted">{{ $t('leaderboard.subtitle') }}: {{ playerRating.toFixed(2) }}</p>
    <div class="max-h-96 w-full overflow-auto">
      <table class="w-full border-collapse text-xs whitespace-nowrap">
        <thead>
          <tr>
            <th class="th-cell">#</th>
            <th class="th-cell">{{ $t('common.song') }}</th>
            <th class="th-cell">{{ $t('common.difficulty') }}</th>
            <th class="th-cell">{{ $t('common.level') }}</th>
            <th class="th-cell">{{ $t('common.score') }}</th>
            <th class="th-cell">{{ $t('common.crown') }}</th>
            <th class="th-cell">{{ $t('leaderboard.thRating') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in bestSongs" :key="`${entry.hash}-${entry.difficulty}`">
            <td class="td-cell">{{ index + 1 }}</td>
            <td class="td-cell">
              <router-link :to="`/songs/${entry.hash}`" class="row-link">{{ songTitle(entry.title) }}</router-link>
            </td>
            <td class="td-cell">{{ difficultyLabel(entry.difficulty) }}</td>
            <td class="td-cell">{{ entry.level }}</td>
            <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
            <td class="td-cell">{{ entry.crown }}</td>
            <td class="td-cell">{{ entry.rating.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
