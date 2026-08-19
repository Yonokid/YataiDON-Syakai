<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSongDisplay } from '../composables/useSongDisplay'
import type { UserData } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps<{ user: UserData; accessCode: string }>()
const { t } = useI18n()
const { songTitle, difficultyLabel } = useSongDisplay()

const jumpingHash = ref<string | null>(null)
const jumpError = ref('')

async function sendToGame(hash: string) {
  jumpingHash.value = hash
  jumpError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/request_song_jump?access_code=${encodeURIComponent(props.accessCode)}&hash=${encodeURIComponent(hash)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
  } catch {
    jumpError.value = t('diffChart.jumpError')
  } finally {
    jumpingHash.value = null
  }
}
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
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
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="jumpError" class="error-text text-sm">{{ jumpError }}</p>
  </div>
</template>
