<script setup lang="ts">
import { ref } from 'vue'
import type { UserData } from '../types'

const DEFAULT_USERNAME = 'Don-chan'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps<{ user: UserData; accessCode: string }>()
const emit = defineEmits<{
  logout: []
  'username-updated': [username: string]
  'import-requested': []
}>()

const DIFFICULTY_LABELS = ['Easy', 'Normal', 'Hard', 'Oni', 'Ura', 'Tower', 'Dan']

function songTitle(title: Record<string, string>) {
  return title.en ?? Object.values(title)[0] ?? '(untitled)'
}

function difficultyLabel(difficulty: number) {
  return DIFFICULTY_LABELS[difficulty] ?? `Difficulty ${difficulty}`
}

const promptDismissed = ref(false)
const newUsername = ref('')
const isSaving = ref(false)
const saveError = ref('')

const isRequestingImport = ref(false)
const importError = ref('')

async function requestScoreImport() {
  if (
    !confirm(
      'Import your pre-existing scores? You can only do this once.',
    )
  )
    return

  isRequestingImport.value = true
  importError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/request_score_import?access_code=${encodeURIComponent(props.accessCode)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    emit('import-requested')
  } catch {
    importError.value = 'Could not request import. Please try again.'
  } finally {
    isRequestingImport.value = false
  }
}

async function saveUsername() {
  const username = newUsername.value.trim()
  if (!username) return

  isSaving.value = true
  saveError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/update_username?access_code=${encodeURIComponent(props.accessCode)}`,
      {
        method: 'POST',
        body: new URLSearchParams({ username }),
      },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    emit('username-updated', username)
  } catch {
    saveError.value = 'Could not save username. Please try again.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="user-page">
    <div v-if="user.username === DEFAULT_USERNAME && !promptDismissed" class="username-prompt">
      <p>Please set a new username</p>
      <form class="username-prompt-form" @submit.prevent="saveUsername">
        <input
          v-model="newUsername"
          type="text"
          maxlength="32"
          placeholder="New username"
          :disabled="isSaving"
        />
        <button type="submit" :disabled="isSaving || !newUsername.trim()">Save</button>
      </form>
      <p v-if="saveError" class="username-prompt-error">{{ saveError }}</p>
    </div>

    <h1>{{ user.username }}</h1>

    <div class="import-section">
      <p v-if="user.import_completed" class="import-pending">Pre-existing scores imported.</p>
      <p v-else-if="user.import_requested" class="import-pending">
        Import requested — scores will be imported next time YataiDON is launched.
      </p>
      <button
        v-else
        type="button"
        :disabled="isRequestingImport"
        @click="requestScoreImport"
      >
        Import pre-existing scores
      </button>
      <p v-if="importError" class="username-prompt-error">{{ importError }}</p>
    </div>

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
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in user.scores" :key="`${entry.hash}-${entry.difficulty}`">
            <td>{{ songTitle(entry.title) }}</td>
            <td>{{ difficultyLabel(entry.difficulty) }}</td>
            <td>{{ entry.level }}</td>
            <td>{{ entry.score.toLocaleString() }}</td>
            <td>{{ entry.crown }}</td>
            <td>{{ entry.rank }}</td>
            <td>{{ entry.max_combo }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button type="button" class="logout" @click="$emit('logout')">Log out</button>
  </div>
</template>

<style scoped>
.user-page {
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

.username-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.4rem;
  text-align: center;
}

.username-prompt-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.username-prompt-form input {
  padding: 0.4rem 0.6rem;
}

.username-prompt-form button {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.username-prompt-form button.secondary {
  background: none;
}

.username-prompt-error {
  color: #c0392b;
  font-size: 0.85rem;
}

.import-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.import-section button {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.import-pending {
  color: #888;
  font-size: 0.9rem;
  text-align: center;
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

.logout {
  padding: 0.4rem 1rem;
  cursor: pointer;
}
</style>
