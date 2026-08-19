<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import QRCode from 'qrcode'
import type { UserData } from '../types'

interface CostumeEntry {
  icon: string
  name: string
}
interface CostumeNames {
  body: Record<string, CostumeEntry>
  head: Record<string, CostumeEntry>
  costume: Record<string, CostumeEntry>
}

const DEFAULT_USERNAME = 'Don-chan'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const props = defineProps<{ user: UserData; accessCode: string }>()
const emit = defineEmits<{
  logout: []
  'username-updated': [username: string]
  'chara-colors-updated': [colors: { chara_color_1: string; chara_color_2: string; chara_color_3: string }]
  'costume-updated': [
    costume: {
      chara_head_index: number
      chara_body_index: number
      chara_cos_index: number
      chara_is_costume: boolean
    },
  ]
  'import-requested': []
}>()

const qrRevealed = ref(false)
const qrDataUrl = ref('')

watchEffect(async () => {
  const loginUrl = `${window.location.origin}${import.meta.env.BASE_URL}login?code=${encodeURIComponent(props.accessCode)}`
  qrDataUrl.value = await QRCode.toDataURL(loginUrl, { margin: 1, width: 220 })
})

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

const costumeNames = ref<CostumeNames | null>(null)
fetch(`${import.meta.env.BASE_URL}costumes/costume_names.json`)
  .then((r) => r.json())
  .then((d) => (costumeNames.value = d))

const isCostumeMode = ref(props.user.chara_is_costume)
const headIndex = ref(props.user.chara_head_index)
const bodyIndex = ref(props.user.chara_body_index)
const cosIndex = ref(props.user.chara_cos_index)
const isSavingCostume = ref(false)
const costumeSaveError = ref('')

function costumeOptions(kind: 'head' | 'body' | 'costume') {
  const entries = costumeNames.value?.[kind]
  if (!entries) return []
  return Object.entries(entries)
    .map(([id, entry]) => ({ id: Number(id), ...entry }))
    .sort((a, b) => a.id - b.id)
}

const headOptions = computed(() => costumeOptions('head'))
const bodyOptions = computed(() => costumeOptions('body'))
const costumeOptionsList = computed(() => costumeOptions('costume'))

function iconUrl(kind: 'head' | 'body' | 'costume', id: number) {
  const entry = costumeNames.value?.[kind]?.[id]
  return entry ? `${import.meta.env.BASE_URL}costumes/${entry.icon}` : ''
}

async function saveCostume() {
  isSavingCostume.value = true
  costumeSaveError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/update_costume?access_code=${encodeURIComponent(props.accessCode)}`,
      {
        method: 'POST',
        body: new URLSearchParams({
          chara_head_index: String(headIndex.value),
          chara_body_index: String(bodyIndex.value),
          chara_cos_index: String(cosIndex.value),
          chara_is_costume: String(isCostumeMode.value),
        }),
      },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    emit('costume-updated', {
      chara_head_index: headIndex.value,
      chara_body_index: bodyIndex.value,
      chara_cos_index: cosIndex.value,
      chara_is_costume: isCostumeMode.value,
    })
  } catch {
    costumeSaveError.value = 'Could not save costume. Please try again.'
  } finally {
    isSavingCostume.value = false
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
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
    <div
      v-if="user.username === DEFAULT_USERNAME && !promptDismissed"
      class="flex w-full flex-col items-center gap-2 rounded-md border border-neutral-300 p-4 text-center dark:border-neutral-700"
    >
      <p>Please set a new username</p>
      <form class="flex flex-wrap justify-center gap-2" @submit.prevent="saveUsername">
        <input
          v-model="newUsername"
          type="text"
          maxlength="32"
          placeholder="New username"
          :disabled="isSaving"
          class="field"
        />
        <button type="submit" class="btn" :disabled="isSaving || !newUsername.trim()">Save</button>
      </form>
      <p v-if="saveError" class="error-text text-sm">{{ saveError }}</p>
    </div>

    <h1 class="text-xl font-bold">{{ user.username }}</h1>

    <div class="flex flex-col items-center gap-1">
      <p v-if="user.import_completed" class="muted text-center text-sm">Pre-existing scores imported.</p>
      <p v-else-if="user.import_requested" class="muted text-center text-sm">
        Import requested — scores will be imported next time YataiDON is launched.
      </p>
      <button
        v-else
        type="button"
        class="btn"
        :disabled="isRequestingImport"
        @click="requestScoreImport"
      >
        Import pre-existing scores
      </button>
      <p v-if="importError" class="error-text text-sm">{{ importError }}</p>
    </div>

    <div class="flex flex-col items-center gap-2">
      <span class="muted text-sm">Don Colors</span>
      <div class="flex gap-4">
        <label class="flex cursor-pointer flex-col items-center gap-1 text-sm">
          <input v-model="charaColor1" type="color" class="h-10 w-10 cursor-pointer" />
          Body
        </label>
        <label class="flex cursor-pointer flex-col items-center gap-1 text-sm">
          <input v-model="charaColor2" type="color" class="h-10 w-10 cursor-pointer" />
          Face
        </label>
        <label class="flex cursor-pointer flex-col items-center gap-1 text-sm">
          <input v-model="charaColor3" type="color" class="h-10 w-10 cursor-pointer" />
          Accent
        </label>
      </div>
      <button type="button" class="btn" :disabled="isSavingColors" @click="saveCharaColors">Save Colors</button>
      <p v-if="colorSaveError" class="error-text text-sm">{{ colorSaveError }}</p>
    </div>

    <div class="flex flex-col items-center gap-2">
      <span class="muted text-sm">Costume</span>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="isCostumeMode" type="checkbox" />
        Full costume (unchecked = separate head/body)
      </label>

      <div v-if="isCostumeMode" class="flex flex-col items-center gap-1">
        <span class="muted text-xs">{{ costumeNames?.costume[cosIndex]?.name }}</span>
        <div class="grid max-h-72 w-full grid-cols-4 gap-2 overflow-y-auto rounded-md border border-neutral-300 p-2 sm:grid-cols-6 dark:border-neutral-700">
          <button
            v-for="o in costumeOptionsList"
            :key="o.id"
            type="button"
            :title="o.name"
            class="rounded-md border p-1"
            :class="cosIndex === o.id ? 'border-neutral-900 bg-neutral-200 dark:border-neutral-100 dark:bg-neutral-700' : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'"
            @click="cosIndex = o.id"
          >
            <img :src="iconUrl('costume', o.id)" alt="" class="h-12 w-12" />
          </button>
        </div>
      </div>
      <div v-else class="flex w-full flex-col gap-4">
        <div class="flex flex-col items-center gap-1">
          <span class="muted text-xs">Head — {{ costumeNames?.head[headIndex]?.name }}</span>
          <div class="grid max-h-72 w-full grid-cols-4 gap-2 overflow-y-auto rounded-md border border-neutral-300 p-2 sm:grid-cols-6 dark:border-neutral-700">
            <button
              v-for="o in headOptions"
              :key="o.id"
              type="button"
              :title="o.name"
              class="rounded-md border p-1"
              :class="headIndex === o.id ? 'border-neutral-900 bg-neutral-200 dark:border-neutral-100 dark:bg-neutral-700' : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'"
              @click="headIndex = o.id"
            >
              <img :src="iconUrl('head', o.id)" alt="" class="h-12 w-12" />
            </button>
          </div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="muted text-xs">Body — {{ costumeNames?.body[bodyIndex]?.name }}</span>
          <div class="grid max-h-72 w-full grid-cols-4 gap-2 overflow-y-auto rounded-md border border-neutral-300 p-2 sm:grid-cols-6 dark:border-neutral-700">
            <button
              v-for="o in bodyOptions"
              :key="o.id"
              type="button"
              :title="o.name"
              class="rounded-md border p-1"
              :class="bodyIndex === o.id ? 'border-neutral-900 bg-neutral-200 dark:border-neutral-100 dark:bg-neutral-700' : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'"
              @click="bodyIndex = o.id"
            >
              <img :src="iconUrl('body', o.id)" alt="" class="h-12 w-12" />
            </button>
          </div>
        </div>
      </div>

      <button type="button" class="btn" :disabled="isSavingCostume" @click="saveCostume">Save Costume</button>
      <p v-if="costumeSaveError" class="error-text text-sm">{{ costumeSaveError }}</p>
    </div>

    <div class="flex flex-col items-center gap-2">
      <span class="muted text-sm">Log in on phone</span>
      <button
        type="button"
        class="relative h-[220px] w-[220px] overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700"
        @click="qrRevealed = !qrRevealed"
      >
        <img
          v-if="qrDataUrl"
          :src="qrDataUrl"
          alt="QR login code"
          class="h-full w-full transition-[filter]"
          :class="qrRevealed ? '' : 'blur-xl'"
        />
        <span
          v-if="!qrRevealed"
          class="absolute inset-0 flex items-center justify-center bg-white/40 text-center text-sm font-medium dark:bg-black/40"
        >
          Tap to reveal
        </span>
      </button>
      <p class="muted max-w-xs text-center text-xs">
        Scan with your phone's camera to log in instantly. Anyone who scans this can access your
        account — keep it hidden from others.
      </p>
    </div>

    <button type="button" class="btn" @click="$emit('logout')">Log out</button>
  </div>
</template>
