<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { UserData } from '../types'

const ACCESS_CODE_LENGTH = 24
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const STORAGE_KEY = 'yataidon_access_code'

const emit = defineEmits<{
  verified: [code: string, user: UserData]
}>()

const route = useRoute()
const router = useRouter()

const qrCode = typeof route.query.code === 'string' ? route.query.code.toUpperCase() : ''
if (qrCode) {
  // strip the code from the URL immediately so it doesn't linger in browser history
  router.replace({ query: { ...route.query, code: undefined } })
}

const accessCode = ref(qrCode || localStorage.getItem(STORAGE_KEY) || '')
const rememberMe = ref(accessCode.value !== '')
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
    if (rememberMe.value) {
      localStorage.setItem(STORAGE_KEY, requestedCode)
    }
    emit('verified', requestedCode, user)
  } catch {
    if (accessCode.value !== requestedCode) return
    verifyStatus.value = 'error'
  }
}, { immediate: true })

watch(rememberMe, (remember) => {
  if (!remember) {
    localStorage.removeItem(STORAGE_KEY)
  } else if (isComplete.value && verifyStatus.value === 'valid') {
    localStorage.setItem(STORAGE_KEY, accessCode.value)
  }
})
</script>

<template>
  <div class="flex max-w-sm flex-col items-center gap-2">
    <label for="access-code" class="text-sm font-medium">{{ $t('accessCode.label') }}</label>
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
      class="w-full rounded-md border border-neutral-300 px-4 py-2 text-center font-mono text-lg tracking-widest uppercase dark:border-neutral-700 dark:bg-neutral-900"
    />
    <span
      class="text-sm text-neutral-500 dark:text-neutral-400"
      :class="{ 'text-green-600 dark:text-green-400': isComplete }"
    >
      {{ accessCode.length }} / {{ ACCESS_CODE_LENGTH }}
    </span>
    <label class="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" v-model="rememberMe" />
      {{ $t('accessCode.rememberMe') }}
    </label>
    <span v-if="verifyStatus !== 'idle'" class="text-sm">
      <template v-if="verifyStatus === 'checking'">
        <span class="text-neutral-500 dark:text-neutral-400">{{ $t('accessCode.checking') }}</span>
      </template>
      <template v-else-if="verifyStatus === 'valid'">
        <span class="text-green-600 dark:text-green-400">{{ $t('accessCode.valid') }}</span>
      </template>
      <template v-else-if="verifyStatus === 'invalid'">
        <span class="text-red-600 dark:text-red-400">{{ $t('accessCode.invalid') }}</span>
      </template>
      <template v-else>
        <span class="text-red-600 dark:text-red-400">{{ $t('accessCode.error') }}</span>
      </template>
    </span>
  </div>
</template>
