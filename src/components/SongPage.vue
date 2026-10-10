<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { useSongDisplay } from '../composables/useSongDisplay'
import { accessCode } from '../stores/auth'

interface Song {
  hash: string
  title: Record<string, string>
  subtitle: Record<string, string>
  difficulty: number
  level: number
}

interface ScoreEntry {
  id: number
  score_id: number
  has_replay: boolean
  username: string
  score: number
  crown: number
  rank: number
  max_combo: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const tabBase =
  'cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const tabActive = 'border-neutral-900 font-semibold dark:border-neutral-100'

const route = useRoute()
const { t } = useI18n()

const jumpingReplayId = ref<number | null>(null)
const replayJumpError = ref('')

async function sendReplayToGame(scoreId: number) {
  jumpingReplayId.value = scoreId
  replayJumpError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/request_replay_jump?access_code=${encodeURIComponent(accessCode.value ?? '')}&score_id=${scoreId}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
  } catch {
    replayJumpError.value = t('diffChart.replayJumpError')
  } finally {
    jumpingReplayId.value = null
  }
}

const songs = ref<Song[]>([])
const songsStatus = ref<'loading' | 'loaded' | 'error'>('loading')
const entries = ref<ScoreEntry[]>([])
const entriesStatus = ref<'loading' | 'loaded' | 'error'>('loading')
const { songTitle, difficultyLabel } = useSongDisplay()

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
  <div class="flex w-full max-w-lg flex-col items-center gap-2">
    <router-link to="/songs" class="self-start px-2 py-1 text-sm hover:underline">{{ $t('song.backToSongs') }}</router-link>

    <template v-if="currentSong">
      <h2 class="text-lg font-bold">{{ songTitle(currentSong.title) }}</h2>
      <p class="-mt-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">{{ currentSong.hash }}</p>

      <div class="flex flex-wrap justify-center gap-2">
        <router-link
          v-for="variant in variants"
          :key="variant.hash"
          :to="`/songs/${variant.hash}`"
          custom
          v-slot="{ navigate, isActive }"
        >
          <button type="button" :class="[tabBase, isActive && tabActive]" @click="navigate">
            {{ difficultyLabel(variant.difficulty) }} ★{{ variant.level }}
          </button>
        </router-link>
      </div>
    </template>
    <p v-else-if="songsStatus === 'loading'">{{ $t('common.loading') }}</p>
    <p v-else-if="songsStatus === 'error'" class="error-text">{{ $t('common.serverError') }}</p>
    <p v-else class="error-text">{{ $t('song.songNotFound') }}</p>

    <p v-if="entriesStatus === 'loading'">{{ $t('common.loading') }}</p>
    <p v-else-if="entriesStatus === 'error'" class="error-text">{{ $t('common.serverError') }}</p>
    <p v-else-if="entries.length === 0" class="muted">{{ $t('common.noScoresYet') }}</p>
    <table v-else class="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th class="th-cell">{{ $t('common.rank') }}</th>
          <th class="th-cell">{{ $t('common.username') }}</th>
          <th class="th-cell">{{ $t('common.score') }}</th>
          <th class="th-cell">{{ $t('common.crown') }}</th>
          <th class="th-cell">{{ $t('common.maxCombo') }}</th>
          <th class="th-cell"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in entries" :key="entry.id">
          <td class="td-cell">{{ index + 1 }}</td>
          <td class="td-cell"><router-link :to="`/u/${entry.id}`" class="row-link">{{ entry.username }}</router-link></td>
          <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
          <td class="td-cell">{{ entry.crown }}</td>
          <td class="td-cell">{{ entry.max_combo }}</td>
          <td class="td-cell">
            <button
              type="button"
              class="btn"
              :disabled="jumpingReplayId === entry.score_id || !entry.has_replay"
              @click="sendReplayToGame(entry.score_id)"
            >
              {{ jumpingReplayId === entry.score_id ? $t('common.sending') : $t('common.watchReplay') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="replayJumpError" class="error-text text-sm">{{ replayJumpError }}</p>
  </div>
</template>
