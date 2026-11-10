<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSongDisplay } from '../composables/useSongDisplay'

interface AdminUser {
  access_code: string
  username: string
  title: string | null
  dan: number | null
  gold: boolean | null
  score_count: number
}

interface AdminTitle {
  number: number
  name: string
  color: string | null
  unlock_condition_ja: string | null
  unlock_condition_en: string | null
  default_unlocked: boolean
  has_structured_condition: boolean
}

interface SuspiciousScore {
  id: number
  access_code: string
  username: string | null
  hash: string
  title: Record<string, string> | null
  difficulty: number
  score: number
  good: number
  ok: number
  bad: number
  max_combo: number
  reason: string
  is_import: boolean
  status: string
  ts: string
}

const API_BASE_URL = import.meta.env.NETWORK_URL
const STORAGE_KEY = 'admin_key'
const { t } = useI18n()
const { songTitle, difficultyLabel } = useSongDisplay()

const adminKey = ref(localStorage.getItem(STORAGE_KEY) ?? '')
const unlocked = ref(false)
const authError = ref('')

const users = ref<AdminUser[]>([])
const query = ref('')
const isLoading = ref(false)
const loadError = ref('')

const editing = ref<AdminUser | null>(null)
const editUsername = ref('')
const editDan = ref('')
const editGold = ref(false)
const isSaving = ref(false)
const saveError = ref('')

type Tab = 'users' | 'titles' | 'merge' | 'keys' | 'log'
const activeTab = ref<Tab>('users')

interface AdminLog {
  time: string
  level: string
  message: string
}

// Friendly names for the backend endpoints, keyed by "METHOD path". `:id` stands in
// for the API key id in the dynamic admin routes.
const LOG_ENDPOINTS: Record<string, string> = {
  'GET /': 'Health check',
  'GET /health': 'Health check',
  'GET /online_users': 'Online users',
  'GET /leaderboard': 'Leaderboard',
  'GET /songs': 'Song list',
  'GET /most_played_songs': 'Most played songs',
  'GET /song_leaderboard': 'Song leaderboard',
  'GET /song_ranking': 'Song ranking',
  'POST /gacha': 'Gacha roll',
  'GET /kinotake': 'Kinotake status',
  'POST /kinotake': 'Kinotake play',
  'GET /rewards': 'Rewards',
  'GET /cosmetics': 'Cosmetics',
  'POST /campaign_costume': 'Campaign costume',
  'POST /don_points': 'Don points',
  'POST /register_user': 'User registered',
  'GET /user': 'User profile',
  'GET /recent_scores': 'Recent scores',
  'GET /public_user': 'Public profile',
  'POST /update_username': 'Username updated',
  'POST /update_title': 'Title updated',
  'POST /update_chara_colors': 'Chara colors updated',
  'POST /update_costume': 'Costume updated',
  'POST /update_force_unlock': 'Force unlock updated',
  'POST /update_puchichara': 'Puchichara updated',
  'POST /request_score_import': 'Score import requested',
  'POST /clear_import_flag': 'Import flag cleared',
  'POST /request_song_jump': 'Song jump requested',
  'GET /poll_song_jump': 'Song jump polled',
  'POST /request_replay_jump': 'Replay jump requested',
  'GET /poll_replay_jump': 'Replay jump polled',
  'GET /poll_jump': 'Jump polled',
  'GET /ai_battle': 'AI battle data',
  'POST /ai_battle': 'AI battle played',
  'GET /admin/users': 'Admin: users',
  'POST /admin/update_user': 'Admin: user updated',
  'POST /admin/delete_user': 'Admin: user deleted',
  'POST /admin/merge_users': 'Admin: users merged',
  'POST /admin/change_access_code': 'Admin: access code changed',
  'POST /admin/api_keys': 'Admin: API key created',
  'GET /admin/api_keys': 'Admin: API keys',
  'DELETE /admin/api_keys/:id': 'Admin: API key deleted',
  'POST /admin/api_keys/:id/revoke': 'Admin: API key revoked',
  'POST /admin/api_keys/:id/tournament': 'Admin: key tournament mode',
  'POST /admin/api_keys/:id/campaign': 'Admin: key campaign',
  'GET /admin/logs': 'Admin: logs',
  'POST /admin/logs/clear': 'Admin: logs cleared',
  'GET /titles': 'Titles',
  'GET /admin/titles': 'Admin: titles',
  'POST /admin/update_title': 'Admin: title updated',
  'POST /medals': 'Medals',
  'GET /reward_shop': 'Reward shop',
  'POST /reward_shop/buy': 'Reward bought',
  'POST /submit_score': 'Score submitted',
  'POST /submit_dan': 'Dan submitted',
  'POST /revive_result': 'Revive result',
  'GET /replay': 'Replay',
  'GET /admin/suspicious_scores': 'Admin: suspicious scores',
  'POST /admin/review_score': 'Admin: score reviewed',
  'POST /online/queue': 'Online: queued',
  'POST /online/state': 'Online: state',
  'POST /online/sync': 'Online: synced',
  'POST /online/leave': 'Online: left',
  'POST /online/finish': 'Online: finished',
}

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

const logs = ref<AdminLog[]>([])
const logsLoading = ref(false)
const logsError = ref('')
const logsLive = ref(false)
const levelFilter = ref('')
const endpointFilter = ref('')
let logsSocket: WebSocket | null = null
let logsReconnectTimer: ReturnType<typeof setTimeout> | undefined

const ACCESS_LOG_RE = /^\S+ - "(\S+) (\S+) HTTP\/[\d.]+" (\d{3})/

function parseAccessLog(message: string) {
  const match = message.match(ACCESS_LOG_RE)
  if (!match) return null
  const method = match[1]
  const url = match[2]
  const status = match[3]
  if (!method || !url || !status) return null
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  return {
    method,
    path: url.split('?')[0] ?? url,
    status: Number(status),
    params: [...new URLSearchParams(query)],
  }
}

function logEndpointKey(method: string, path: string) {
  return `${method} ${path.replace(/^(\/admin\/api_keys\/)[^/]+/, '$1:id')}`
}

const filteredLogs = computed(() =>
  [...logs.value]
    .reverse()
    .map((entry) => ({ ...entry, access: parseAccessLog(entry.message) }))
    .filter((entry) => {
      if (levelFilter.value && entry.level !== levelFilter.value) return false
      if (!endpointFilter.value) return true
      return (
        entry.access !== null &&
        logEndpointKey(entry.access.method, entry.access.path) === endpointFilter.value
      )
    }),
)

function logLabel(method: string, path: string) {
  return LOG_ENDPOINTS[logEndpointKey(method, path)] ?? `${method} ${path}`
}

function logTime(iso: string) {
  return new Date(iso).toLocaleTimeString()
}

function logLevelClass(level: string) {
  if (level === 'ERROR' || level === 'CRITICAL') return 'text-red-600 dark:text-red-400'
  if (level === 'WARNING') return 'text-amber-600 dark:text-amber-400'
  return 'muted'
}

function logStatusClass(status: number) {
  if (status >= 500) return 'text-red-600 dark:text-red-400'
  if (status >= 400) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

const mergeTargetCode = ref('')
const mergeSourceCode = ref('')
const isMerging = ref(false)
const mergeError = ref('')
const mergeSuccess = ref(false)

const changingAccessCode = ref<AdminUser | null>(null)
const changeAccessCodeNew = ref('')
const isChangingAccessCode = ref(false)
const changeAccessCodeError = ref('')

async function fetchUsers() {
  isLoading.value = true
  loadError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/users?admin_key=${encodeURIComponent(adminKey.value)}&q=${encodeURIComponent(query.value)}`,
    )
    if (response.status === 401) {
      unlocked.value = false
      authError.value = t('admin.invalidKey')
      return
    }
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data = await response.json()
    users.value = data.users
    unlocked.value = true
    localStorage.setItem(STORAGE_KEY, adminKey.value)
    fetchSuspiciousScores()
  } catch {
    loadError.value = t('admin.loadError')
  } finally {
    isLoading.value = false
  }
}

const suspiciousScores = ref<SuspiciousScore[]>([])
const suspiciousTab = ref<'pending' | 'import_warning'>('pending')
const suspiciousLoading = ref(false)
const suspiciousError = ref('')

async function fetchSuspiciousScores() {
  suspiciousLoading.value = true
  suspiciousError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/suspicious_scores?admin_key=${encodeURIComponent(adminKey.value)}&status=${suspiciousTab.value}`,
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data = await response.json()
    suspiciousScores.value = data.scores
  } catch {
    suspiciousError.value = t('admin.suspiciousLoadError')
  } finally {
    suspiciousLoading.value = false
  }
}

async function reviewScore(item: SuspiciousScore, action: 'approve' | 'deny') {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/review_score?admin_key=${encodeURIComponent(adminKey.value)}&id=${item.id}&action=${action}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    suspiciousScores.value = suspiciousScores.value.filter((s) => s.id !== item.id)
  } catch {
    suspiciousError.value = t('admin.suspiciousReviewError')
  }
}

const titles = ref<AdminTitle[]>([])
const titlesLoading = ref(false)
const titlesLoaded = ref(false)
const titlesError = ref('')

const editingTitle = ref<AdminTitle | null>(null)
const editTitleName = ref('')
const editTitleColor = ref('')
const editTitleConditionJa = ref('')
const editTitleDefaultUnlocked = ref(false)
const isSavingTitle = ref(false)
const saveTitleError = ref('')

async function fetchTitles() {
  titlesLoading.value = true
  titlesError.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/admin/titles?admin_key=${encodeURIComponent(adminKey.value)}`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data = await response.json()
    titles.value = data.titles
    titlesLoaded.value = true
  } catch {
    titlesError.value = t('admin.titlesLoadError')
  } finally {
    titlesLoading.value = false
  }
}

function startEditTitle(title: AdminTitle) {
  editingTitle.value = title
  editTitleName.value = title.name
  editTitleColor.value = title.color ?? ''
  editTitleConditionJa.value = title.unlock_condition_ja ?? ''
  editTitleDefaultUnlocked.value = title.default_unlocked
  saveTitleError.value = ''
}

function cancelEditTitle() {
  editingTitle.value = null
}

async function saveEditTitle() {
  if (!editingTitle.value) return
  isSavingTitle.value = true
  saveTitleError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/update_title?admin_key=${encodeURIComponent(adminKey.value)}&number=${editingTitle.value.number}`,
      {
        method: 'POST',
        body: new URLSearchParams({
          name: editTitleName.value,
          color: editTitleColor.value,
          unlock_condition: editTitleConditionJa.value,
          default_unlocked: editTitleDefaultUnlocked.value ? 'true' : 'false',
        }),
      },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    editingTitle.value = null
    await fetchTitles()
  } catch {
    saveTitleError.value = t('admin.titleSaveError')
  } finally {
    isSavingTitle.value = false
  }
}

interface ApiKey {
  key_id: string
  label: string
  created_at: string
  revoked_at: string | null
  last_used: string | null
  tournament: boolean
  campaigns: string[]
}

// campaigns the backend knows (KNOWN_CAMPAIGNS in hiroba lib/security.py)
const CAMPAIGNS = ['mac', 'v3c', 'korokoro', 'chao', 'mario', 'kinotake'] as const

const apiKeys = ref<ApiKey[]>([])
const apiKeyLabel = ref('')
const newApiKey = ref('')
const apiKeyError = ref('')

async function fetchApiKeys() {
  apiKeyError.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/admin/api_keys?admin_key=${encodeURIComponent(adminKey.value)}`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    apiKeys.value = (await response.json()).keys
  } catch {
    apiKeyError.value = t('admin.apiKeyLoadError')
  }
}

async function createApiKey() {
  apiKeyError.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/admin/api_keys?admin_key=${encodeURIComponent(adminKey.value)}`, {
      method: 'POST',
      body: new URLSearchParams({ label: apiKeyLabel.value }),
    })
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    newApiKey.value = (await response.json()).network_auth_key
    apiKeyLabel.value = ''
    await fetchApiKeys()
  } catch {
    apiKeyError.value = t('admin.apiKeyCreateError')
  }
}

async function revokeApiKey(key: ApiKey) {
  if (!confirm(t('admin.apiKeyRevokeConfirm', { keyId: key.key_id }))) return
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/api_keys/${encodeURIComponent(key.key_id)}/revoke?admin_key=${encodeURIComponent(adminKey.value)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    await fetchApiKeys()
  } catch {
    apiKeyError.value = t('admin.apiKeyRevokeError')
  }
}

async function deleteApiKey(key: ApiKey) {
  if (!confirm(t('admin.apiKeyDeleteConfirm', { keyId: key.key_id }))) return
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/api_keys/${encodeURIComponent(key.key_id)}?admin_key=${encodeURIComponent(adminKey.value)}`,
      { method: 'DELETE' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    await fetchApiKeys()
  } catch {
    apiKeyError.value = t('admin.apiKeyDeleteError')
  }
}

async function setTournament(key: ApiKey, enabled: boolean) {
  apiKeyError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/api_keys/${encodeURIComponent(key.key_id)}/tournament?enabled=${enabled}&admin_key=${encodeURIComponent(adminKey.value)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    await fetchApiKeys()
  } catch {
    apiKeyError.value = t('admin.apiKeyTournamentError')
  }
}

async function setCampaign(key: ApiKey, campaign: string, enabled: boolean) {
  apiKeyError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/api_keys/${encodeURIComponent(key.key_id)}/campaign?campaign=${encodeURIComponent(campaign)}&enabled=${enabled}&admin_key=${encodeURIComponent(adminKey.value)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    await fetchApiKeys()
  } catch {
    apiKeyError.value = t('admin.apiKeyCampaignError')
  }
}

function switchTab(tab: Tab) {
  if (tab !== 'log') closeLogs()
  activeTab.value = tab
  if (tab === 'keys') fetchApiKeys()
  if (tab === 'titles' && !titlesLoaded.value) fetchTitles()
  if (tab === 'log') connectLogs()
}

function closeLogs() {
  clearTimeout(logsReconnectTimer)
  logsReconnectTimer = undefined
  logsSocket?.close()
  logsSocket = null
  logsLive.value = false
}

function connectLogs() {
  closeLogs()
  logsError.value = ''
  logs.value = []
  logsLoading.value = true
  const socket = new WebSocket(
    `${API_BASE_URL.replace(/^http/, 'ws')}/admin/logs/ws?admin_key=${encodeURIComponent(adminKey.value)}`,
  )
  logsSocket = socket
  socket.onopen = () => {
    logsLoading.value = false
    logsLive.value = true
  }
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data) as { logs: AdminLog[] }
    logs.value = [...logs.value, ...data.logs].slice(-500)
  }
  socket.onerror = () => {
    logsError.value = t('admin.logsLoadError')
  }
  socket.onclose = (event) => {
    if (logsSocket !== socket) return
    logsLive.value = false
    logsLoading.value = false
    if (event.code === 1008) {
      unlocked.value = false
      authError.value = t('admin.invalidKey')
      closeLogs()
      return
    }
    logsReconnectTimer = setTimeout(connectLogs, 3000)
  }
}

async function clearLogs() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/logs/clear?admin_key=${encodeURIComponent(adminKey.value)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    logs.value = []
  } catch {
    logsError.value = t('admin.logsClearError')
  }
}

onMounted(() => {
  if (adminKey.value) {
    fetchUsers()
    fetchSuspiciousScores()
  }
})

onUnmounted(closeLogs)

function startEdit(user: AdminUser) {
  editing.value = user
  editUsername.value = user.username
  editDan.value = user.dan?.toString() ?? ''
  editGold.value = !!user.gold
  saveError.value = ''
}

function cancelEdit() {
  editing.value = null
}

async function saveEdit() {
  if (!editing.value) return
  isSaving.value = true
  saveError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/update_user?admin_key=${encodeURIComponent(adminKey.value)}&access_code=${encodeURIComponent(editing.value.access_code)}`,
      {
        method: 'POST',
        body: new URLSearchParams({
          username: editUsername.value,
          dan: editDan.value,
          gold: editGold.value ? 'true' : 'false',
        }),
      },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    editing.value = null
    await fetchUsers()
  } catch {
    saveError.value = t('admin.saveError')
  } finally {
    isSaving.value = false
  }
}

async function copyAccessCode(user: AdminUser) {
  try {
    await navigator.clipboard.writeText(user.access_code)
    loadError.value = ''
  } catch {
    loadError.value = t('admin.copyCodeError')
  }
}

async function deleteUser(user: AdminUser) {
  if (!confirm(t('admin.deleteConfirm', { username: user.username }))) return
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/delete_user?admin_key=${encodeURIComponent(adminKey.value)}&access_code=${encodeURIComponent(user.access_code)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    users.value = users.value.filter((u) => u.access_code !== user.access_code)
  } catch {
    loadError.value = t('admin.deleteError')
  }
}

async function mergeUsers() {
  const target = mergeTargetCode.value.trim()
  const source = mergeSourceCode.value.trim()
  if (!target || !source || target === source) return
  if (!confirm(t('admin.mergeConfirm', { target, source }))) return
  isMerging.value = true
  mergeError.value = ''
  mergeSuccess.value = false
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/merge_users?admin_key=${encodeURIComponent(adminKey.value)}` +
        `&target_access_code=${encodeURIComponent(target)}&source_access_code=${encodeURIComponent(source)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    mergeSuccess.value = true
    mergeTargetCode.value = ''
    mergeSourceCode.value = ''
    fetchUsers()
  } catch {
    mergeError.value = t('admin.mergeError')
  } finally {
    isMerging.value = false
  }
}

function startChangeAccessCode(user: AdminUser) {
  changingAccessCode.value = user
  changeAccessCodeNew.value = ''
  changeAccessCodeError.value = ''
}

function cancelChangeAccessCode() {
  changingAccessCode.value = null
}

async function saveChangeAccessCode() {
  if (!changingAccessCode.value) return
  const newCode = changeAccessCodeNew.value.trim()
  if (!newCode || !/^\d{20}$/.test(newCode)) {
    changeAccessCodeError.value = t('admin.changeAccessCodeError')
    return
  }
  isChangingAccessCode.value = true
  changeAccessCodeError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/change_access_code?admin_key=${encodeURIComponent(adminKey.value)}&old_access_code=${encodeURIComponent(changingAccessCode.value.access_code)}&new_access_code=${encodeURIComponent(newCode)}`,
      { method: 'POST' },
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.detail || `Unexpected status ${response.status}`)
    }
    changingAccessCode.value = null
    await fetchUsers()
  } catch (e: any) {
    changeAccessCodeError.value = e.message || t('admin.changeAccessCodeError')
  } finally {
    isChangingAccessCode.value = false
  }
}

function logout() {
  closeLogs()
  unlocked.value = false
  users.value = []
  suspiciousScores.value = []
  logs.value = []
  newApiKey.value = ''
  localStorage.removeItem(STORAGE_KEY)
}

function switchSuspiciousTab(tab: 'pending' | 'import_warning') {
  suspiciousTab.value = tab
  fetchSuspiciousScores()
}
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
    <h1 class="text-xl font-bold">{{ $t('admin.title') }}</h1>

    <form v-if="!unlocked" class="flex flex-col items-center gap-2" @submit.prevent="fetchUsers">
      <input
        v-model="adminKey"
        type="password"
        :placeholder="$t('admin.adminKeyPlaceholder')"
        class="field"
        :disabled="isLoading"
      />
      <button type="submit" class="btn" :disabled="isLoading || !adminKey">{{ $t('admin.unlock') }}</button>
      <p v-if="authError" class="error-text text-sm">{{ authError }}</p>
    </form>

    <template v-else>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <button type="button" class="btn" :disabled="activeTab === 'users'" @click="switchTab('users')">
            {{ $t('admin.tabUsers') }}
          </button>
          <button type="button" class="btn" :disabled="activeTab === 'titles'" @click="switchTab('titles')">
            {{ $t('admin.tabTitles') }}
          </button>
          <button type="button" class="btn" :disabled="activeTab === 'merge'" @click="switchTab('merge')">
            {{ $t('admin.tabMerge') }}
          </button>
          <button type="button" class="btn" :disabled="activeTab === 'keys'" @click="switchTab('keys')">
            {{ $t('admin.tabApiKeys') }}
          </button>
          <button type="button" class="btn" :disabled="activeTab === 'log'" @click="switchTab('log')">
            {{ $t('admin.tabLog') }}
          </button>
        </div>
        <button type="button" class="btn" @click="logout">{{ $t('admin.lock') }}</button>
      </div>

      <template v-if="activeTab === 'keys'">
        <form class="flex gap-2" @submit.prevent="createApiKey">
          <input v-model="apiKeyLabel" type="text" :placeholder="$t('admin.apiKeyLabelPlaceholder')" class="field" />
          <button type="submit" class="btn">{{ $t('admin.apiKeyCreate') }}</button>
        </form>
        <p v-if="apiKeyError" class="error-text text-sm">{{ apiKeyError }}</p>
        <div v-if="newApiKey" class="w-full text-sm">
          <p>{{ $t('admin.apiKeyCreated') }}</p>
          <code class="break-all">{{ newApiKey }}</code>
        </div>
        <div class="w-full overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th class="th-cell">{{ $t('admin.thKeyId') }}</th>
                <th class="th-cell">{{ $t('admin.thLabel') }}</th>
                <th class="th-cell">{{ $t('admin.thCreated') }}</th>
                <th class="th-cell">{{ $t('admin.thLastUsed') }}</th>
                <th class="th-cell">{{ $t('admin.thStatus') }}</th>
                <th class="th-cell" :title="$t('admin.apiKeyTournamentHint')">{{ $t('admin.thTournament') }}</th>
                <th
                  v-for="campaign in CAMPAIGNS"
                  :key="campaign"
                  class="th-cell"
                  :title="$t('admin.apiKeyCampaignHint')"
                >
                  {{ $t(`admin.campaign.${campaign}`) }}
                </th>
                <th class="th-cell"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="key in apiKeys" :key="key.key_id">
                <td class="td-cell">{{ key.key_id }}</td>
                <td class="td-cell">{{ key.label }}</td>
                <td class="td-cell">{{ new Date(key.created_at).toLocaleString() }}</td>
                <td class="td-cell">{{ key.last_used ? new Date(key.last_used).toLocaleString() : $t('admin.neverUsed') }}</td>
                <td class="td-cell">{{ key.revoked_at ? $t('admin.apiKeyRevoked') : $t('admin.apiKeyActive') }}</td>
                <td class="td-cell">
                  <input
                    type="checkbox"
                    :checked="key.tournament"
                    :disabled="!!key.revoked_at"
                    :aria-label="$t('admin.thTournament')"
                    @change="setTournament(key, ($event.target as HTMLInputElement).checked)"
                  />
                </td>
                <td v-for="campaign in CAMPAIGNS" :key="campaign" class="td-cell">
                  <input
                    type="checkbox"
                    :checked="key.campaigns?.includes(campaign)"
                    :disabled="!!key.revoked_at"
                    :aria-label="$t(`admin.campaign.${campaign}`)"
                    @change="setCampaign(key, campaign, ($event.target as HTMLInputElement).checked)"
                  />
                </td>
                <td class="td-cell">
                  <button v-if="!key.revoked_at" type="button" class="btn" @click="revokeApiKey(key)">
                    {{ $t('admin.apiKeyRevoke') }}
                  </button>
                  <button v-else type="button" class="btn" @click="deleteApiKey(key)">
                    {{ $t('admin.apiKeyDelete') }}
                  </button>
                </td>
              </tr>
              <tr v-if="apiKeys.length === 0">
                <td class="td-cell muted" :colspan="7 + CAMPAIGNS.length">{{ $t('admin.noApiKeys') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="activeTab === 'log'">
        <div class="flex w-full items-center justify-between gap-2">
          <span
            class="flex items-center gap-1.5 text-xs"
            :class="logsLive ? 'text-green-600 dark:text-green-400' : 'muted'"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="logsLive ? 'bg-green-500' : 'bg-neutral-400'"
            ></span>
            {{ logsLive ? $t('admin.logLive') : $t('admin.logDisconnected') }}
          </span>
          <button type="button" class="btn" @click="clearLogs">{{ $t('admin.logClear') }}</button>
          <span class="text-xs muted">{{ $t('admin.logCount', { count: filteredLogs.length }) }}</span>
        </div>
        <div class="flex w-full flex-wrap items-center gap-2">
          <select v-model="levelFilter" class="field text-sm" :aria-label="$t('admin.logLevel')">
            <option value="">{{ $t('admin.logAllLevels') }}</option>
            <option v-for="level in LOG_LEVELS" :key="level" :value="level">{{ level }}</option>
          </select>
          <select v-model="endpointFilter" class="field text-sm" :aria-label="$t('admin.logEndpoint')">
            <option value="">{{ $t('admin.logAllEndpoints') }}</option>
            <option v-for="(label, key) in LOG_ENDPOINTS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <p v-if="logsError" class="error-text text-sm">{{ logsError }}</p>
        <p v-if="logsLoading" class="muted text-sm">{{ $t('common.loading') }}</p>
        <div v-else class="w-full overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th class="th-cell">{{ $t('admin.logTime') }}</th>
                <th class="th-cell">{{ $t('admin.logLevel') }}</th>
                <th class="th-cell">{{ $t('admin.logEvent') }}</th>
                <th class="th-cell">{{ $t('admin.logStatus') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, index) in filteredLogs" :key="index" class="text-sm">
                <td class="td-cell whitespace-nowrap" :title="entry.time">{{ logTime(entry.time) }}</td>
                <td class="td-cell">
                  <span :class="logLevelClass(entry.level)">{{ entry.level }}</span>
                </td>
                <td class="td-cell">
                  <template v-if="entry.access">
                    <div>{{ logLabel(entry.access.method, entry.access.path) }}</div>
                    <div class="font-mono text-xs muted">
                      {{ entry.access.method }} {{ entry.access.path }}
                    </div>
                    <details v-if="entry.access.params.length" class="mt-1 text-xs">
                      <summary class="cursor-pointer muted">
                        {{ $t('admin.logParameters') }} ({{ entry.access.params.length }})
                      </summary>
                      <dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
                        <template v-for="([key, value], paramIndex) in entry.access.params" :key="paramIndex">
                          <dt class="muted">{{ key }}</dt>
                          <dd class="break-all">{{ value }}</dd>
                        </template>
                      </dl>
                    </details>
                  </template>
                  <span v-else class="break-all">{{ entry.message }}</span>
                </td>
                <td class="td-cell">
                  <span v-if="entry.access" :class="logStatusClass(entry.access.status)">
                    {{ entry.access.status }}
                  </span>
                </td>
              </tr>
              <tr v-if="filteredLogs.length === 0">
                <td class="td-cell muted" colspan="4">
                  {{ logs.length === 0 ? $t('admin.noLogs') : $t('admin.noMatchingLogs') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="activeTab === 'merge'">
        <form class="flex w-full max-w-sm flex-col gap-3" @submit.prevent="mergeUsers">
          <label class="flex flex-col gap-1 text-sm">
            {{ $t('admin.mergeTargetLabel') }}
            <input v-model="mergeTargetCode" type="text" class="field" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            {{ $t('admin.mergeSourceLabel') }}
            <input v-model="mergeSourceCode" type="text" class="field" />
          </label>
          <p v-if="mergeError" class="error-text text-sm">{{ mergeError }}</p>
          <p v-if="mergeSuccess" class="text-sm">{{ $t('admin.mergeSuccess') }}</p>
          <button
            type="submit"
            class="btn"
            :disabled="isMerging || !mergeTargetCode.trim() || !mergeSourceCode.trim() || mergeTargetCode.trim() === mergeSourceCode.trim()"
          >
            {{ $t('admin.mergeButton') }}
          </button>
        </form>
      </template>

      <template v-else-if="activeTab === 'titles'">
        <p v-if="titlesError" class="error-text text-sm">{{ titlesError }}</p>
        <p v-if="titlesLoading" class="muted text-sm">{{ $t('common.loading') }}</p>

        <div v-else class="w-full overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th class="th-cell">{{ $t('admin.thNumber') }}</th>
                <th class="th-cell">{{ $t('admin.thName') }}</th>
                <th class="th-cell">{{ $t('admin.thColor') }}</th>
                <th class="th-cell">{{ $t('admin.thDefaultUnlocked') }}</th>
                <th class="th-cell">{{ $t('admin.thConditionJa') }}</th>
                <th class="th-cell">{{ $t('admin.thCondition') }}</th>
                <th class="th-cell"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="title in titles" :key="title.number">
                <td class="td-cell">{{ title.number }}</td>
                <td class="td-cell">{{ title.name }}</td>
                <td class="td-cell">{{ title.color ?? $t('admin.dash') }}</td>
                <td class="td-cell">{{ title.default_unlocked ? $t('admin.yes') : $t('admin.no') }}</td>
                <td class="td-cell">{{ title.unlock_condition_ja ?? $t('admin.dash') }}</td>
                <td class="td-cell">{{ title.unlock_condition_en ?? $t('admin.dash') }}</td>
                <td class="td-cell">
                  <button type="button" class="btn" @click="startEditTitle(title)">{{ $t('admin.edit') }}</button>
                </td>
              </tr>
              <tr v-if="titles.length === 0">
                <td class="td-cell muted" colspan="7">{{ $t('admin.noTitlesFound') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="editingTitle"
          class="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
          @click.self="cancelEditTitle"
        >
          <form
            class="flex w-full max-w-sm flex-col gap-3 rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
            @submit.prevent="saveEditTitle"
          >
            <h2 class="font-semibold">{{ $t('admin.editTitle', { number: editingTitle.number }) }}</h2>
            <label class="flex flex-col gap-1 text-sm">
              {{ $t('admin.nameLabel') }}
              <input v-model="editTitleName" type="text" class="field" />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              {{ $t('admin.colorLabel') }}
              <input v-model="editTitleColor" type="text" class="field" />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              {{ $t('admin.unlockConditionJaLabel') }}
              <textarea v-model="editTitleConditionJa" rows="3" class="field" />
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="editTitleDefaultUnlocked" type="checkbox" />
              {{ $t('admin.thDefaultUnlocked') }}
            </label>
            <p class="muted text-xs">
              {{
                editingTitle.has_structured_condition
                  ? $t('admin.structuredConditionNote')
                  : $t('admin.noStructuredConditionNote')
              }}
            </p>
            <p v-if="saveTitleError" class="error-text text-sm">{{ saveTitleError }}</p>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn" @click="cancelEditTitle">{{ $t('common.cancel') }}</button>
              <button type="submit" class="btn" :disabled="isSavingTitle">{{ $t('common.save') }}</button>
            </div>
          </form>
        </div>
      </template>

      <template v-else>
      <form class="flex gap-2" @submit.prevent="fetchUsers">
        <input v-model="query" type="text" :placeholder="$t('admin.searchPlaceholder')" class="field" />
        <button type="submit" class="btn" :disabled="isLoading">{{ $t('admin.search') }}</button>
      </form>

      <p v-if="loadError" class="error-text text-sm">{{ loadError }}</p>
      <p v-if="isLoading" class="muted text-sm">{{ $t('common.loading') }}</p>

      <div v-else class="w-full overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="th-cell">{{ $t('common.username') }}</th>
              <th class="th-cell">{{ $t('admin.thTitle') }}</th>
              <th class="th-cell">{{ $t('admin.thDan') }}</th>
              <th class="th-cell">{{ $t('admin.thGold') }}</th>
              <th class="th-cell">{{ $t('admin.thScores') }}</th>
              <th class="th-cell"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.access_code">
              <td class="td-cell">{{ user.username }}</td>
              <td class="td-cell">{{ user.title ?? $t('admin.dash') }}</td>
              <td class="td-cell">{{ user.dan ?? $t('admin.dash') }}</td>
              <td class="td-cell">{{ user.gold ? $t('admin.yes') : $t('admin.no') }}</td>
              <td class="td-cell">{{ user.score_count }}</td>
              <td class="td-cell">
                <div class="flex gap-2">
                  <button type="button" class="btn" @click="copyAccessCode(user)">{{ $t('admin.copyCode') }}</button>
                  <button type="button" class="btn" @click="startEdit(user)">{{ $t('admin.edit') }}</button>
                  <button type="button" class="btn" @click="startChangeAccessCode(user)">{{ $t('admin.changeAccessCode') }}</button>
                  <button type="button" class="btn" @click="deleteUser(user)">{{ $t('admin.delete') }}</button>
                </div>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td class="td-cell muted" colspan="6">{{ $t('admin.noUsersFound') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="editing"
        class="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
        @click.self="cancelEdit"
      >
        <form
          class="flex w-full max-w-sm flex-col gap-3 rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
          @submit.prevent="saveEdit"
        >
          <h2 class="font-semibold">{{ $t('admin.editUser', { username: editing.username }) }}</h2>
          <label class="flex flex-col gap-1 text-sm">
            {{ $t('common.username') }}
            <input v-model="editUsername" type="text" maxlength="32" class="field" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            {{ $t('admin.thDan') }}
            <input v-model="editDan" type="number" class="field" />
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="editGold" type="checkbox" />
            {{ $t('admin.goldDan') }}
          </label>
          <p v-if="saveError" class="error-text text-sm">{{ saveError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" @click="cancelEdit">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn" :disabled="isSaving">{{ $t('common.save') }}</button>
          </div>
        </form>
      </div>

      <div
        v-if="changingAccessCode"
        class="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
        @click.self="cancelChangeAccessCode"
      >
        <form
          class="flex w-full max-w-sm flex-col gap-3 rounded-md border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
          @submit.prevent="saveChangeAccessCode"
        >
          <h2 class="font-semibold">{{ $t('admin.changeAccessCode', { username: changingAccessCode.username }) }}</h2>
          <p class="muted text-sm">{{ $t('admin.changeAccessCodeConfirm', { username: changingAccessCode.username, oldCode: changingAccessCode.access_code }) }}</p>
          <label class="flex flex-col gap-1 text-sm">
            {{ $t('admin.changeAccessCodeLabel') }}
            <input v-model="changeAccessCodeNew" type="text" maxlength="20" class="field" placeholder="20-digit number" />
          </label>
          <p v-if="changeAccessCodeError" class="error-text text-sm">{{ changeAccessCodeError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" @click="cancelChangeAccessCode">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn" :disabled="isChangingAccessCode">{{ $t('common.save') }}</button>
          </div>
        </form>
      </div>

      <h2 class="mt-4 text-lg font-bold">{{ $t('admin.suspiciousTitle') }}</h2>
      <div class="flex w-full gap-2">
        <button
          type="button"
          class="btn"
          :disabled="suspiciousTab === 'pending'"
          @click="switchSuspiciousTab('pending')"
        >
          {{ $t('admin.suspiciousTabPending') }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="suspiciousTab === 'import_warning'"
          @click="switchSuspiciousTab('import_warning')"
        >
          {{ $t('admin.suspiciousTabImportWarning') }}
        </button>
      </div>

      <p v-if="suspiciousError" class="error-text text-sm">{{ suspiciousError }}</p>
      <p v-if="suspiciousLoading" class="muted text-sm">{{ $t('common.loading') }}</p>

      <div v-else class="w-full overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="th-cell">{{ $t('common.username') }}</th>
              <th class="th-cell">{{ $t('admin.thSong') }}</th>
              <th class="th-cell">{{ $t('admin.thScore') }}</th>
              <th class="th-cell">{{ $t('admin.thReason') }}</th>
              <th class="th-cell" v-if="suspiciousTab === 'pending'"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in suspiciousScores" :key="item.id">
              <td class="td-cell">{{ item.username ?? item.access_code }}</td>
              <td class="td-cell">
                {{ item.title ? songTitle(item.title) : item.hash }}
                ({{ difficultyLabel(item.difficulty) }})
              </td>
              <td class="td-cell">{{ item.score }}</td>
              <td class="td-cell">{{ item.reason }}</td>
              <td class="td-cell" v-if="suspiciousTab === 'pending'">
                <div class="flex gap-2">
                  <button type="button" class="btn" @click="reviewScore(item, 'approve')">
                    {{ $t('admin.allow') }}
                  </button>
                  <button type="button" class="btn" @click="reviewScore(item, 'deny')">
                    {{ $t('admin.deny') }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="suspiciousScores.length === 0">
              <td class="td-cell muted" colspan="5">{{ $t('admin.noSuspiciousScores') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </template>
    </template>
  </div>
</template>
