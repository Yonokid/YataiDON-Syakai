<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { useSongDisplay } from '../composables/useSongDisplay'
import { accessCode } from '../stores/auth'
import type { Score } from '../types'
import Nameplate, { type NameplateColor } from './Nameplate.vue'

interface PublicUser {
  id: number
  username: string
  title: string
  nameplate_color: NameplateColor
  chara_color_1: string
  chara_color_2: string
  chara_color_3: string
  scores: Score[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const route = useRoute()
const { t } = useI18n()

const user = ref<PublicUser | null>(null)
const status = ref<'loading' | 'loaded' | 'error' | 'not-found'>('loading')

const { songTitle, difficultyLabel } = useSongDisplay()

const jumpingHash = ref<string | null>(null)
const jumpError = ref('')
const jumpingReplayId = ref<number | null>(null)
const replayJumpError = ref('')

async function sendToGame(hash: string) {
  jumpingHash.value = hash
  jumpError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/request_song_jump?access_code=${encodeURIComponent(accessCode.value ?? '')}&hash=${encodeURIComponent(hash)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
  } catch {
    jumpError.value = t('diffChart.jumpError')
  } finally {
    jumpingHash.value = null
  }
}

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

async function load(id: string) {
  status.value = 'loading'
  try {
    const response = await fetch(`${API_BASE_URL}/public_user?id=${encodeURIComponent(id)}`)
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

onMounted(() => load(route.params.id as string))
watch(() => route.params.id, (id) => load(id as string))
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
    <p v-if="status === 'loading'">{{ $t('common.loading') }}</p>
    <p v-else-if="status === 'not-found'" class="error-text">{{ $t('publicUser.userNotFound') }}</p>
    <p v-else-if="status === 'error'" class="error-text">{{ $t('common.serverError') }}</p>
    <template v-else-if="user">
      <Nameplate :username="user.username" :title="user.title" :color="user.nameplate_color" />

      <p v-if="user.scores.length === 0" class="muted">{{ $t('common.noScoresYet') }}</p>
      <div v-else class="w-full overflow-x-auto">
        <table class="w-full border-collapse text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th class="th-cell">{{ $t('common.song') }}</th>
              <th class="th-cell">{{ $t('common.difficulty') }}</th>
              <th class="th-cell">{{ $t('common.level') }}</th>
              <th class="th-cell">{{ $t('common.score') }}</th>
              <th class="th-cell">{{ $t('common.crown') }}</th>
              <th class="th-cell">{{ $t('common.rank') }}</th>
              <th class="th-cell">{{ $t('common.maxCombo') }}</th>
              <th class="th-cell"></th>
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
              <td class="td-cell">
                <button
                  type="button"
                  class="btn"
                  :disabled="jumpingHash === entry.hash"
                  @click="sendToGame(entry.hash)"
                >
                  {{ jumpingHash === entry.hash ? $t('common.sending') : $t('common.sendToGame') }}
                </button>
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
      </div>
      <p v-if="jumpError" class="error-text text-sm">{{ jumpError }}</p>
      <p v-if="replayJumpError" class="error-text text-sm">{{ replayJumpError }}</p>
    </template>
  </div>
</template>
