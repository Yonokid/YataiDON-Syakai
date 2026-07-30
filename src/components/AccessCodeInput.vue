<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { UserData } from '../types'

const ACCESS_CODE_LENGTH = 24
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const emit = defineEmits<{
  verified: [code: string, user: UserData]
}>()

const accessCode = ref('')
const verifyStatus = ref<'idle' | 'checking' | 'valid' | 'invalid' | 'error'>('idle')

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  accessCode.value = target.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ACCESS_CODE_LENGTH)
}

const isComplete = computed(() => accessCode.value.length === ACCESS_CODE_LENGTH)

watch(accessCode, async (code) => {
  if (code.length !== ACCESS_CODE_LENGTH) {
    verifyStatus.value = 'idle'
    return
  }

  verifyStatus.value = 'checking'
  const requestedCode = code
  try {
    const response = await fetch(`${API_BASE_URL}/user?access_code=${encodeURIComponent(code)}`)
    if (accessCode.value !== requestedCode) return

    if (response.status === 404) {
      verifyStatus.value = 'invalid'
      return
    }
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)

    const user: UserData = await response.json()
    verifyStatus.value = 'valid'
    emit('verified', requestedCode, user)
  } catch {
    if (accessCode.value !== requestedCode) return
    verifyStatus.value = 'error'
  }
})
</script>

<template>
  <div class="access-code-field">
    <label for="access-code">Access Code</label>
    <input
      id="access-code"
      type="text"
      inputmode="text"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      :maxlength="ACCESS_CODE_LENGTH"
      :placeholder="'X'.repeat(ACCESS_CODE_LENGTH)"
      :value="accessCode"
      @input="handleInput"
    />
    <span class="access-code-count" :class="{ complete: isComplete }">
      {{ accessCode.length }} / {{ ACCESS_CODE_LENGTH }}
    </span>
    <span v-if="verifyStatus !== 'idle'" class="access-code-status" :class="verifyStatus">
      <template v-if="verifyStatus === 'checking'">Checking…</template>
      <template v-else-if="verifyStatus === 'valid'">Access code verified</template>
      <template v-else-if="verifyStatus === 'invalid'">Access code not found</template>
      <template v-else>Could not reach server</template>
    </span>
  </div>
</template>

<style scoped>
.access-code-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  max-width: 24rem;
}

.access-code-field input {
  font-family: monospace;
  font-size: 1.1rem;
  letter-spacing: 0.15em;
  padding: 0.5rem 1rem;
  text-transform: uppercase;
  text-align: center;
}

.access-code-count {
  font-size: 0.85rem;
  color: #888;
}

.access-code-count.complete {
  color: #2e8b57;
}

.access-code-status {
  font-size: 0.85rem;
}

.access-code-status.checking {
  color: #888;
}

.access-code-status.valid {
  color: #2e8b57;
}

.access-code-status.invalid,
.access-code-status.error {
  color: #c0392b;
}
</style>
