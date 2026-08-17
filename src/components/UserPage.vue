<script setup lang="ts">
import { ref } from 'vue'
import type { UserData } from '../types'

const DEFAULT_USERNAME = 'Don-chan'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps<{ user: UserData; accessCode: string }>()
const emit = defineEmits<{
  logout: []
  'username-updated': [username: string]
  'chara-colors-updated': [colors: { chara_color_1: string; chara_color_2: string; chara_color_3: string }]
  'import-requested': []
}>()

const promptDismissed = ref(false)
const newUsername = ref('')
const isSaving = ref(false)
const saveError = ref('')

const isRequestingImport = ref(false)
const importError = ref('')

const charaColor1 = ref(props.user.chara_color_1)
const charaColor2 = ref(props.user.chara_color_2)
const charaColor3 = ref(props.user.chara_color_3)
const isSavingColors = ref(false)
const colorSaveError = ref('')

async function saveCharaColors() {
  isSavingColors.value = true
  colorSaveError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/update_chara_colors?access_code=${encodeURIComponent(props.accessCode)}`,
      {
        method: 'POST',
        body: new URLSearchParams({
          chara_color_1: charaColor1.value,
          chara_color_2: charaColor2.value,
          chara_color_3: charaColor3.value,
        }),
      },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    emit('chara-colors-updated', {
      chara_color_1: charaColor1.value,
      chara_color_2: charaColor2.value,
      chara_color_3: charaColor3.value,
    })
  } catch {
    colorSaveError.value = 'Could not save colors. Please try again.'
  } finally {
    isSavingColors.value = false
  }
}

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

    <div class="chara-colors-section">
      <span class="chara-colors-label">Don Colors</span>
      <div class="chara-colors-swatches">
        <label class="chara-color-swatch">
          <input v-model="charaColor1" type="color" />
          Body
        </label>
        <label class="chara-color-swatch">
          <input v-model="charaColor2" type="color" />
          Face
        </label>
        <label class="chara-color-swatch">
          <input v-model="charaColor3" type="color" />
          Accent
        </label>
      </div>
      <button type="button" :disabled="isSavingColors" @click="saveCharaColors">Save Colors</button>
      <p v-if="colorSaveError" class="username-prompt-error">{{ colorSaveError }}</p>
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

.chara-colors-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.chara-colors-label {
  font-size: 0.9rem;
  color: #888;
}

.chara-colors-swatches {
  display: flex;
  gap: 1rem;
}

.chara-color-swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.chara-color-swatch input {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: none;
  cursor: pointer;
}

.chara-colors-section button {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.logout {
  padding: 0.4rem 1rem;
  cursor: pointer;
}
</style>
