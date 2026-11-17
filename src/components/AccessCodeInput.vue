<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { STORAGE_KEY } from '../stores/auth'
import type { UserData } from '../types'

const ACCESS_CODE_LENGTH = 20
const API_BASE_URL = import.meta.env.NETWORK_URL

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

const configError = ref(false)

function setCode(value: string) {
  accessCode.value = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ACCESS_CODE_LENGTH)
}

function handleInput(event: Event) {
  setCode((event.target as HTMLInputElement).value)
}

async function handleConfigUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const match = (await file.text()).match(/^\s*access_code_1\s*=\s*["']([^"']*)["']/m)
  configError.value = !match
  if (match) setCode(match[1] ?? '')
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
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
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
  <div class="card flex w-full max-w-sm flex-col items-center gap-3 p-6 sm:p-8">
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
      class="field w-full px-4 py-2.5 text-center font-mono text-lg tracking-widest uppercase"
    />
    <span
      class="text-sm text-neutral-500 dark:text-neutral-400"
      :class="{ 'text-green-600 dark:text-green-400': isComplete }"
    >
      {{ accessCode.length }} / {{ ACCESS_CODE_LENGTH }}
    </span>
    <label class="row-link cursor-pointer text-sm">
      {{ $t('accessCode.uploadConfig') }}
      <input type="file" accept=".toml" class="hidden" @change="handleConfigUpload" />
    </label>
    <span v-if="configError" class="text-sm text-red-600 dark:text-red-400">{{ $t('accessCode.configInvalid') }}</span>
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
    <div class="mt-2 flex gap-4 text-sm">
      <a href="https://github.com/Yonokid/YataiDON/releases" target="_blank" rel="noopener" class="row-link">
        {{ $t('accessCode.download') }}
      </a>
      <a href="https://guide.tjadataba.se/yataidon/" target="_blank" rel="noopener" class="row-link">
        {{ $t('accessCode.setupGuide') }}
      </a>
    </div>
  </div>
</template>
