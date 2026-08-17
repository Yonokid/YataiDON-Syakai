<script setup lang="ts">
import { ref } from 'vue'
import type { UserData } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps<{ user: UserData; accessCode: string }>()

const DIFFICULTY_LABELS = ['Easy', 'Normal', 'Hard', 'Oni', 'Ura', 'Tower', 'Dan']

function songTitle(title: Record<string, string>) {
  return title.en ?? Object.values(title)[0] ?? '(untitled)'
}

function difficultyLabel(difficulty: number) {
  return DIFFICULTY_LABELS[difficulty] ?? `Difficulty ${difficulty}`
}

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
    jumpError.value = 'Could not send song to game. Please try again.'
  } finally {
    jumpingHash.value = null
  }
}
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
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
                {{ jumpingHash === entry.hash ? 'Sending…' : 'Send to Game' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="jumpError" class="error-text text-sm">{{ jumpError }}</p>
  </div>
</template>
