<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, defineAsyncComponent, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UserData } from '../types'
import { useSongDisplay } from '../composables/useSongDisplay'
import Nameplate from './Nameplate.vue'

// Keeps three.js out of the main bundle
const Chara3DViewer = defineAsyncComponent(() => import('./Chara3DViewer.vue'))

interface CostumeEntry {
  icon: string
  name: string
}
interface CostumeNames {
  body: Record<string, CostumeEntry>
  head: Record<string, CostumeEntry>
  costume: Record<string, CostumeEntry>
}

const API_BASE_URL = import.meta.env.NETWORK_URL

const DEFAULT_TITLE = 'ドンダーデビュー！'

const props = defineProps<{ user: UserData; accessCode: string }>()
const emit = defineEmits<{
  logout: []
  'username-updated': [username: string]
  'title-updated': [title: string]
  'chara-colors-updated': [colors: { chara_color_1: string; chara_color_2: string; chara_color_3: string }]
  'costume-updated': [
    costume: {
      chara_head_index: number
      chara_body_index: number
      chara_cos_index: number
      chara_is_costume: boolean
    },
  ]
  'puchi-updated': [puchichara: number | null]
  'import-requested': []
  'force-unlock-updated': [user: UserData]
}>()
const { t } = useI18n()
const { songTitle } = useSongDisplay()

const qrRevealed = ref(false)
const qrDataUrl = ref('')

watchEffect(async () => {
  const loginUrl = `${window.location.origin}${import.meta.env.BASE_URL}login?code=${encodeURIComponent(props.accessCode)}`
  qrDataUrl.value = await QRCode.toDataURL(loginUrl, { margin: 1, width: 220 })
})

const newUsername = ref('')
const isSaving = ref(false)
const saveError = ref('')

const presetTitleNames = computed(() => [
  DEFAULT_TITLE,
  ...new Set(props.user.unlocked_titles.map((t) => t.name)),
])
const isPreset = presetTitleNames.value.includes(props.user.title)

const titleMode = ref<'preset' | 'custom'>(isPreset ? 'preset' : 'custom')
const presetTitle = ref(isPreset ? props.user.title : DEFAULT_TITLE)
const customTitle = ref(isPreset ? '' : props.user.title)
const isSavingTitle = ref(false)
const titleSaveError = ref('')

async function saveTitle() {
  const title = titleMode.value === 'preset' ? presetTitle.value : customTitle.value.trim()
  if (!title) return

  isSavingTitle.value = true
  titleSaveError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/update_title?access_code=${encodeURIComponent(props.accessCode)}`,
      {
        method: 'POST',
        body: new URLSearchParams({ title }),
      },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    emit('title-updated', title)
  } catch {
    titleSaveError.value = t('user.titleSaveError')
  } finally {
    isSavingTitle.value = false
  }
}

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
    colorSaveError.value = t('user.colorSaveError')
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
    .filter((o) => props.user.force_unlock || props.user.owned_cosmetics[kind].includes(o.id))
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
    costumeSaveError.value = t('user.costumeSaveError')
  } finally {
    isSavingCostume.value = false
  }
}

function puchiUrl(id: number) {
  return `${import.meta.env.BASE_URL}costumes/acce/${id}.png`
}

// Sheets are Models/acce/<id>.png, ids 0-212
const ownedPuchis = computed(() =>
  props.user.force_unlock ? Array.from({ length: 213 }, (_, id) => id) : (props.user.owned_puchichara ?? []),
)
const puchiIndex = ref(props.user.puchichara ?? -1)
const isSavingPuchi = ref(false)
const puchiSaveError = ref('')

async function savePuchi() {
  isSavingPuchi.value = true
  puchiSaveError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/update_puchichara?access_code=${encodeURIComponent(props.accessCode)}`,
      {
        method: 'POST',
        body: new URLSearchParams({ puchichara: String(puchiIndex.value) }),
      },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    emit('puchi-updated', puchiIndex.value >= 0 ? puchiIndex.value : null)
  } catch {
    puchiSaveError.value = t('user.puchiSaveError')
  } finally {
    isSavingPuchi.value = false
  }
}

const forceUnlock = ref(props.user.force_unlock)
const isSavingForceUnlock = ref(false)
const forceUnlockError = ref('')

async function saveForceUnlock() {
  isSavingForceUnlock.value = true
  forceUnlockError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/update_force_unlock?access_code=${encodeURIComponent(props.accessCode)}`,
      { method: 'POST', body: new URLSearchParams({ enabled: String(forceUnlock.value) }) },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const fresh = await fetch(`${API_BASE_URL}/user?access_code=${encodeURIComponent(props.accessCode)}`)
    if (!fresh.ok) throw new Error(`Unexpected status ${fresh.status}`)
    emit('force-unlock-updated', await fresh.json())
  } catch {
    forceUnlock.value = props.user.force_unlock
    forceUnlockError.value = t('user.forceUnlockError')
    isSavingForceUnlock.value = false
  }
}

async function requestScoreImport() {
  if (!confirm(t('user.importConfirm'))) return

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
    importError.value = t('user.importError')
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
    saveError.value = t('user.usernameSaveError')
  } finally {
    isSaving.value = false
  }
}

const SKIN_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
]

const userSkin = ref(props.user.settings?.skin ?? '')
const userLanguage = ref(props.user.settings?.language ?? '')
const isSavingAppearance = ref(false)
const appearanceSaveError = ref('')

async function postSettings(settings: [string, string][]) {
  for (const [key, value] of settings) {
    const response = await fetch(
      `${API_BASE_URL}/update_settings?access_code=${encodeURIComponent(props.accessCode)}`,
      { method: 'POST', body: new URLSearchParams({ key, value }) },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
  }
}

async function saveAppearance() {
  isSavingAppearance.value = true
  appearanceSaveError.value = ''
  try {
    await postSettings([
      ['skin', userSkin.value.trim()],
      ['language', userLanguage.value],
    ])
  } catch {
    appearanceSaveError.value = t('user.appearanceSaveError')
  } finally {
    isSavingAppearance.value = false
  }
}

// Tenths: 1-20 is 0.1x-2.0x, then 3.0x and 4.0x, matching the in-game speed step
const SPEEDS = [...Array.from({ length: 20 }, (_, i) => i + 1), 30, 40]
// Index into the skin's Sounds/hit_sounds/<n> folders; -1 is the silence entry. Labels only.
const NEIRO_NAMES = [
  'Taiko',
  'Festival',
  'Dog & Cat',
  'Deluxe Taiko',
  'Drum',
  'Tambourine',
  'Wada-don',
  'Hand Claps',
  'Conga',
  '8-bit Taiko',
  'Soiya',
  'Mekadon',
  'Funassyi',
  'Rap',
  'Hosogai-san',
  'Akemi-chan',
  'Synth Drum',
  'Shuriken',
  'Puchipuchi',
  'Electric Guitar',
  'Fish',
]
const BOOL_MODIFIERS = [
  { key: 'auto', label: 'user.modifierAuto' },
  { key: 'display', label: 'user.modifierDisplay' },
  { key: 'inverse', label: 'user.modifierInverse' },
  { key: 'skip', label: 'user.modifierSkip' },
] as const

const mods = ref({
  auto: props.user.settings?.modifier_auto === '1',
  display: props.user.settings?.modifier_display === '1',
  inverse: props.user.settings?.modifier_inverse === '1',
  skip: props.user.settings?.modifier_skip === '1',
  speed: Number(props.user.settings?.modifier_speed ?? 10),
  random: Number(props.user.settings?.modifier_random ?? 0),
  neiro: Number(props.user.settings?.neiro_index ?? 0),
})
const isSavingModifiers = ref(false)
const modifiersSaveError = ref('')

async function saveModifiers() {
  isSavingModifiers.value = true
  modifiersSaveError.value = ''
  try {
    await postSettings([
      ['modifier_auto', mods.value.auto ? '1' : '0'],
      ['modifier_speed', String(mods.value.speed)],
      ['modifier_display', mods.value.display ? '1' : '0'],
      ['modifier_inverse', mods.value.inverse ? '1' : '0'],
      ['modifier_random', String(mods.value.random)],
      ['modifier_skip', mods.value.skip ? '1' : '0'],
      ['neiro_index', String(mods.value.neiro)],
    ])
  } catch {
    modifiersSaveError.value = t('user.modifiersSaveError')
  } finally {
    isSavingModifiers.value = false
  }
}

interface CatalogSong {
  hash: string
  title: Record<string, string>
  subtitle: Record<string, string>
  difficulty: number
}

const catalog = ref<CatalogSong[]>([])
const favorites = ref<string[]>(props.user.favorites ?? [])
const favoriteSearch = ref('')
const isSavingFavorites = ref(false)
const favoritesSaveError = ref('')

// A song's favorite hash is its difficulty hashes concatenated in course order (the client's
// get_single_hash), so grouping the catalog by title and subtitle reproduces it.
// shortcut: two chart files sharing a title and subtitle merge here, and a favorite of either
// then shows as unknown; fine while the catalog is one file per song.
const songsByHash = computed(() => {
  const groups = new Map<string, CatalogSong[]>()
  for (const song of catalog.value) {
    const key = `${JSON.stringify(song.title)}|${JSON.stringify(song.subtitle)}`
    const group = groups.get(key)
    if (group) group.push(song)
    else groups.set(key, [song])
  }
  const byHash = new Map<string, CatalogSong>()
  for (const group of groups.values()) {
    // the client's hash has five slots (Easy..Ura), so anything beyond course 4 is not part of it
    const charts = group.filter((chart) => chart.difficulty < 5).sort((a, b) => a.difficulty - b.difficulty)
    const first = charts[0]
    if (first) byHash.set(charts.map((chart) => chart.hash).join(''), first)
  }
  return byHash
})

const favoriteSongs = computed(() =>
  favorites.value.map((hash) => ({ hash, song: songsByHash.value.get(hash) })),
)
const searchResults = computed(() => {
  const query = favoriteSearch.value.trim().toLowerCase()
  if (!query) return []
  const results: { hash: string; title: Record<string, string> }[] = []
  for (const [hash, song] of songsByHash.value) {
    if (favorites.value.includes(hash)) continue
    const title = song.title.en ?? Object.values(song.title)[0] ?? ''
    const subtitle = song.subtitle.en ?? Object.values(song.subtitle)[0] ?? ''
    if (`${title} ${subtitle}`.toLowerCase().includes(query)) {
      results.push({ hash, title: song.title })
    }
    if (results.length >= 10) break
  }
  return results
})

async function saveFavorites(next: string[]) {
  isSavingFavorites.value = true
  favoritesSaveError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/update_song_list?access_code=${encodeURIComponent(props.accessCode)}`,
      { method: 'POST', body: new URLSearchParams({ kind: 'favorites', hashes: JSON.stringify(next) }) },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    favorites.value = next
  } catch {
    favoritesSaveError.value = t('user.favoritesSaveError')
  } finally {
    isSavingFavorites.value = false
  }
}

function addFavorite(hash: string) {
  if (!favorites.value.includes(hash)) saveFavorites([hash, ...favorites.value])
}

function removeFavorite(hash: string) {
  saveFavorites(favorites.value.filter((favorite) => favorite !== hash))
}

fetch(`${API_BASE_URL}/songs`)
  .then((response) => (response.ok ? response.json() : Promise.reject()))
  .then((data: { songs: CatalogSong[] }) => {
    catalog.value = data.songs
  })
  .catch(() => {})

</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
    <div
      class="flex w-full flex-col items-center gap-2 rounded-md border border-neutral-300 p-4 text-center dark:border-neutral-700"
    >
      <p>{{ $t('user.setUsername') }}</p>
      <form class="flex flex-wrap justify-center gap-2" @submit.prevent="saveUsername">
        <input
          v-model="newUsername"
          type="text"
          maxlength="32"
          :placeholder="$t('user.newUsernamePlaceholder')"
          :disabled="isSaving"
          class="field"
        />
        <button type="submit" class="btn" :disabled="isSaving || !newUsername.trim()">{{ $t('common.save') }}</button>
      </form>
      <p v-if="saveError" class="error-text text-sm">{{ saveError }}</p>
    </div>

    <Nameplate
      :username="user.username"
      :title="user.title"
      :color="user.nameplate_color"
      :dan="user.dan"
      :gold="user.gold"
    />

    <dl class="flex gap-8 text-center">
      <div>
        <dt class="muted text-sm">{{ $t('user.donPoints') }}</dt>
        <dd class="text-xl font-semibold">{{ user.don_points.toLocaleString() }}</dd>
      </div>
      <div>
        <dt class="muted text-sm">{{ $t('user.donMedals') }}</dt>
        <dd class="text-xl font-semibold">{{ user.don_medals.toLocaleString() }}</dd>
      </div>
    </dl>

    <div class="flex flex-col items-center gap-1 text-center">
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="forceUnlock" type="checkbox" :disabled="isSavingForceUnlock" @change="saveForceUnlock" />
        {{ $t('user.forceUnlock') }}
      </label>
      <p class="muted text-xs">{{ $t('user.forceUnlockHint') }}</p>
      <p v-if="forceUnlockError" class="error-text text-sm">{{ forceUnlockError }}</p>
    </div>

    <div
      class="flex w-full flex-col items-center gap-2 rounded-md border border-neutral-300 p-4 text-center dark:border-neutral-700"
    >
      <p>{{ $t('user.setTitle') }}</p>
      <form class="flex flex-wrap items-center justify-center gap-2" @submit.prevent="saveTitle">
        <label class="flex cursor-pointer items-center gap-1 text-sm">
          <input v-model="titleMode" type="radio" value="preset" :disabled="isSavingTitle" />
          {{ $t('user.titlePreset') }}
        </label>
        <label class="flex cursor-pointer items-center gap-1 text-sm">
          <input v-model="titleMode" type="radio" value="custom" :disabled="isSavingTitle" />
          {{ $t('user.titleCustom') }}
        </label>
        <select
          v-if="titleMode === 'preset'"
          v-model="presetTitle"
          :disabled="isSavingTitle"
          class="field"
        >
          <option v-for="name in presetTitleNames" :key="name" :value="name">{{ name }}</option>
        </select>
        <input
          v-if="titleMode === 'custom'"
          v-model="customTitle"
          type="text"
          maxlength="32"
          :placeholder="$t('user.customTitlePlaceholder')"
          :disabled="isSavingTitle"
          class="field"
        />
        <button
          type="submit"
          class="btn"
          :disabled="isSavingTitle || (titleMode === 'custom' && !customTitle.trim())"
        >
          {{ $t('common.save') }}
        </button>
      </form>
      <p v-if="titleSaveError" class="error-text text-sm">{{ titleSaveError }}</p>
    </div>

    <div
      class="flex w-full flex-col items-center gap-2 rounded-md border border-neutral-300 p-4 text-center dark:border-neutral-700"
    >
      <p>{{ $t('user.appearance') }}</p>
      <form class="flex flex-wrap items-center justify-center gap-2" @submit.prevent="saveAppearance">
        <input
          v-model="userSkin"
          type="text"
          maxlength="64"
          :placeholder="$t('user.skinPlaceholder')"
          :disabled="isSavingAppearance"
          class="field"
        />
        <select v-model="userLanguage" :disabled="isSavingAppearance" class="field">
          <option value="">{{ $t('user.cabinetDefault') }}</option>
          <option v-for="l in SKIN_LANGUAGES" :key="l.code" :value="l.code">{{ l.label }}</option>
        </select>
        <button type="submit" class="btn" :disabled="isSavingAppearance">{{ $t('common.save') }}</button>
      </form>
      <p class="muted text-xs">{{ $t('user.appearanceHint') }}</p>
      <p v-if="appearanceSaveError" class="error-text text-sm">{{ appearanceSaveError }}</p>
    </div>

    <div
      class="flex w-full flex-col items-center gap-2 rounded-md border border-neutral-300 p-4 text-center dark:border-neutral-700"
    >
      <p>{{ $t('user.modifiers') }}</p>
      <form class="flex flex-wrap items-center justify-center gap-3" @submit.prevent="saveModifiers">
        <label
          v-for="modifier in BOOL_MODIFIERS"
          :key="modifier.key"
          class="flex cursor-pointer items-center gap-1 text-sm"
        >
          <input v-model="mods[modifier.key]" type="checkbox" :disabled="isSavingModifiers" />
          {{ $t(modifier.label) }}
        </label>
        <label class="flex items-center gap-1 text-sm">
          {{ $t('user.speed') }}
          <select v-model.number="mods.speed" :disabled="isSavingModifiers" class="field">
            <option v-for="speed in SPEEDS" :key="speed" :value="speed">{{ (speed / 10).toFixed(1) }}×</option>
          </select>
        </label>
        <label class="flex items-center gap-1 text-sm">
          {{ $t('user.random') }}
          <select v-model.number="mods.random" :disabled="isSavingModifiers" class="field">
            <option :value="0">{{ $t('user.randomOff') }}</option>
            <option :value="1">{{ $t('user.randomKimagure') }}</option>
            <option :value="2">{{ $t('user.randomDetarame') }}</option>
          </select>
        </label>
        <label class="flex items-center gap-1 text-sm">
          {{ $t('user.neiro') }}
          <select v-model.number="mods.neiro" :disabled="isSavingModifiers" class="field">
            <option v-for="(name, index) in NEIRO_NAMES" :key="name" :value="index">{{ name }}</option>
            <option :value="-1">{{ $t('user.neiroNone') }}</option>
          </select>
        </label>
        <button type="submit" class="btn" :disabled="isSavingModifiers">{{ $t('common.save') }}</button>
      </form>
      <p class="muted text-xs">{{ $t('user.modifiersHint') }}</p>
      <p v-if="modifiersSaveError" class="error-text text-sm">{{ modifiersSaveError }}</p>
    </div>

    <div
      class="flex w-full flex-col items-center gap-2 rounded-md border border-neutral-300 p-4 text-center dark:border-neutral-700"
    >
      <p>{{ $t('user.favorites') }}</p>
      <ul class="flex w-full flex-col gap-1">
        <li
          v-for="entry in favoriteSongs"
          :key="entry.hash"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span>{{ entry.song ? songTitle(entry.song.title) : $t('user.unknownSong') }}</span>
          <button type="button" class="btn" :disabled="isSavingFavorites" @click="removeFavorite(entry.hash)">
            {{ $t('common.remove') }}
          </button>
        </li>
        <li v-if="favoriteSongs.length === 0" class="muted text-sm">{{ $t('user.noFavorites') }}</li>
      </ul>
      <input
        v-model="favoriteSearch"
        type="search"
        :placeholder="$t('user.favoriteSearch')"
        :disabled="isSavingFavorites"
        class="field"
      />
      <ul v-if="searchResults.length > 0" class="flex w-full flex-col gap-1">
        <li v-for="result in searchResults" :key="result.hash" class="flex items-center justify-between gap-2 text-sm">
          <span>{{ songTitle(result.title) }}</span>
          <button type="button" class="btn" :disabled="isSavingFavorites" @click="addFavorite(result.hash)">
            {{ $t('common.add') }}
          </button>
        </li>
      </ul>
      <p class="muted text-xs">{{ $t('user.favoritesHint') }}</p>
      <p v-if="favoritesSaveError" class="error-text text-sm">{{ favoritesSaveError }}</p>
    </div>

    <div class="flex flex-col items-center gap-1">
      <p v-if="user.import_completed" class="muted text-center text-sm">{{ $t('user.importCompleted') }}</p>
      <p v-else-if="user.import_requested" class="muted text-center text-sm">
        {{ $t('user.importRequested') }}
      </p>
      <button
        v-else
        type="button"
        class="btn"
        :disabled="isRequestingImport"
        @click="requestScoreImport"
      >
        {{ $t('user.importButton') }}
      </button>
      <p v-if="importError" class="error-text text-sm">{{ importError }}</p>
    </div>

    <div class="flex w-full flex-col-reverse gap-4 sm:flex-row sm:items-start">
      <div class="flex min-w-0 flex-1 flex-col items-center gap-4">
        <div class="flex flex-col items-center gap-2">
          <span class="muted text-sm">{{ $t('user.donColors') }}</span>
          <div class="flex gap-4">
            <label class="flex cursor-pointer flex-col items-center gap-1 text-sm">
              <input v-model="charaColor1" type="color" class="h-10 w-10 cursor-pointer" />
              {{ $t('user.body') }}
            </label>
            <label class="flex cursor-pointer flex-col items-center gap-1 text-sm">
              <input v-model="charaColor2" type="color" class="h-10 w-10 cursor-pointer" />
              {{ $t('user.face') }}
            </label>
            <label class="flex cursor-pointer flex-col items-center gap-1 text-sm">
              <input v-model="charaColor3" type="color" class="h-10 w-10 cursor-pointer" />
              {{ $t('user.accent') }}
            </label>
          </div>
          <button type="button" class="btn" :disabled="isSavingColors" @click="saveCharaColors">{{ $t('user.saveColors') }}</button>
          <p v-if="colorSaveError" class="error-text text-sm">{{ colorSaveError }}</p>
        </div>

        <div class="flex w-full flex-col items-center gap-2">
          <span class="muted text-sm">{{ $t('user.costume') }}</span>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="isCostumeMode" type="checkbox" />
            {{ $t('user.fullCostume') }}
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
              <span class="muted text-xs">{{ $t('user.head') }} — {{ costumeNames?.head[headIndex]?.name }}</span>
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
              <span class="muted text-xs">{{ $t('user.body') }} — {{ costumeNames?.body[bodyIndex]?.name }}</span>
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

          <button type="button" class="btn" :disabled="isSavingCostume" @click="saveCostume">{{ $t('user.saveCostume') }}</button>
          <p v-if="costumeSaveError" class="error-text text-sm">{{ costumeSaveError }}</p>
        </div>

        <div v-if="ownedPuchis.length" class="flex w-full flex-col items-center gap-2">
          <span class="muted text-sm">{{ $t('user.puchichara') }}</span>
          <div class="grid max-h-72 w-full grid-cols-4 gap-2 overflow-y-auto rounded-md border border-neutral-300 p-2 sm:grid-cols-6 dark:border-neutral-700">
            <button
              v-for="id in [-1, ...ownedPuchis]"
              :key="id"
              type="button"
              class="flex items-center justify-center rounded-md border p-1"
              :class="puchiIndex === id ? 'border-neutral-900 bg-neutral-200 dark:border-neutral-100 dark:bg-neutral-700' : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'"
              @click="puchiIndex = id"
            >
              <!-- sheets are two frames stacked vertically; show the top one -->
              <img
                v-if="id >= 0"
                :src="puchiUrl(id)"
                alt=""
                class="h-12 w-12 object-cover object-top"
              />
              <span v-else class="muted flex h-12 w-12 items-center justify-center text-xs">{{ $t('user.puchiNone') }}</span>
            </button>
          </div>
          <button type="button" class="btn" :disabled="isSavingPuchi" @click="savePuchi">{{ $t('user.savePuchi') }}</button>
          <p v-if="puchiSaveError" class="error-text text-sm">{{ puchiSaveError }}</p>
        </div>
      </div>
      <div class="w-full shrink-0 sm:sticky sm:top-4 sm:w-72">
        <Chara3DViewer
          :is-costume="isCostumeMode"
          :head="headIndex"
          :body="bodyIndex"
          :cos="cosIndex"
          :colors="[charaColor1, charaColor2, charaColor3]"
          :puchi="puchiIndex"
        />
      </div>
    </div>

    <div class="flex flex-col items-center gap-2">
      <span class="muted text-sm">{{ $t('user.loginOnPhone') }}</span>
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
          {{ $t('user.tapToReveal') }}
        </span>
      </button>
      <p class="muted max-w-xs text-center text-xs">
        {{ $t('user.qrHint') }}
      </p>
    </div>

    <button type="button" class="btn" @click="$emit('logout')">{{ $t('user.logout') }}</button>
  </div>
</template>
