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
  <div class="scores-page">
    <p v-if="user.scores.length === 0" class="empty">No scores yet.</p>
    <div v-else class="scores-table-wrap">
      <table class="scores-table">
        <thead>
          <tr>
            <th>Song</th>
            <th>Difficulty</th>
            <th>Level</th>
            <th>Score</th>
            <th>Crown</th>
            <th>Rank</th>
            <th>Max Combo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in user.scores" :key="`${entry.hash}-${entry.difficulty}`">
            <td><router-link :to="`/songs/${entry.hash}`">{{ songTitle(entry.title) }}</router-link></td>
            <td>{{ difficultyLabel(entry.difficulty) }}</td>
            <td>{{ entry.level }}</td>
            <td>{{ entry.score.toLocaleString() }}</td>
            <td>{{ entry.crown }}</td>
            <td>{{ entry.rank }}</td>
            <td>{{ entry.max_combo }}</td>
            <td>
              <button
                type="button"
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
    <p v-if="jumpError" class="username-prompt-error">{{ jumpError }}</p>
  </div>
</template>

<style scoped>
.scores-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 48rem;
}

.empty {
  color: #888;
}

.username-prompt-error {
  color: #c0392b;
  font-size: 0.85rem;
}

.scores-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.scores-table {
  width: 100%;
  border-collapse: collapse;
}

.scores-table th,
.scores-table td {
  padding: 0.4rem 0.6rem;
  text-align: left;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
  white-space: nowrap;
}

.scores-table button {
  padding: 0.3rem 0.6rem;
  cursor: pointer;
}
</style>
