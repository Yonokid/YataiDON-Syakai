<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSongDisplay } from '../composables/useSongDisplay'
import TabNav from './TabNav.vue'
import SegControl from './SegControl.vue'
import Pager from './Pager.vue'

interface AdminUser {
  id: number
  access_code: string
  username: string
  title: string | null
  dan: number | null
  gold: boolean | null
  score_count: number
  play_count: number
  last_played: string | null
}

interface AdminUserDetail extends AdminUser {
  force_unlock: boolean
  nameplate_bg: number | null
  import_requested: boolean | null
  import_completed: boolean | null
  first_played: string | null
  dan_play_count: number
  don_points: number | null
  don_medals: number | null
  title_count: number
  cosmetic_count: number
  puchichara_count: number
  discord_id: string | null
  ai_wins: number | null
  online_battles: number
  pending_suspicious: number
  aliases: string[]
  enso: EnsoProgress
}

const ENSO_FIELDS = ['bond', 'exp', 'best_power', 'stones', 'moves', 'orbs', 'orb_rewards'] as const
type EnsoField = (typeof ENSO_FIELDS)[number]

interface EnsoProgress extends Record<EnsoField, number> {
  exp_next: number | null
  stage: number
  cleared: number
  bosses: Record<string, { hp: number; max: number }>
  limits: { bond_max: number; move_max: number; orb_rewards_max: number }
}

type UserSortKey = 'username' | 'dan' | 'score_count' | 'play_count' | 'last_played'

const NAMEPLATE_COLORS = ['red', 'blue', 'wood', 'purple', 'gold']
const USERS_PAGE_SIZE = 50

interface AdminTitle {
  number: number
  name: string
  color: string | null
  unlock_condition_ja: string | null
  unlock_condition_en: string | null
  default_unlocked: boolean
  owner_count: number
  has_structured_condition: boolean
}

interface TitleOwner {
  access_code: string
  username: string
  unlocked_at: string | null
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
// Kept across searches so log links still resolve users filtered out of the table.
const userByAccessCode = ref(new Map<string, { id: number; username: string }>())
const songTitles = ref(new Map<string, Record<string, string>>())
const query = ref('')
const isLoading = ref(false)
const loadError = ref('')

const userSortKey = ref<UserSortKey>('username')
const userSortDesc = ref(false)
const usersPage = ref(1)

const sortedUsers = computed(() => {
  const key = userSortKey.value
  const dir = userSortDesc.value ? -1 : 1
  return [...users.value].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    if (x == null) return y == null ? 0 : 1
    if (y == null) return -1
    return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * dir
  })
})

const pagedUsers = computed(() =>
  sortedUsers.value.slice((usersPage.value - 1) * USERS_PAGE_SIZE, usersPage.value * USERS_PAGE_SIZE),
)

function sortUsersBy(key: UserSortKey) {
  if (userSortKey.value === key) {
    userSortDesc.value = !userSortDesc.value
  } else {
    userSortKey.value = key
    userSortDesc.value = key !== 'username'
  }
}

function sortArrow(key: UserSortKey) {
  if (userSortKey.value !== key) return ''
  return userSortDesc.value ? ' ▼' : ' ▲'
}

watch([query, userSortKey, userSortDesc], () => (usersPage.value = 1))

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : t('admin.dash')
}

const editing = ref<AdminUser | null>(null)
const detail = ref<AdminUserDetail | null>(null)
const detailError = ref('')
const editUsername = ref('')
const editDan = ref('')
const editGold = ref(false)
const editTitle = ref('')
const editNameplate = ref('')
const editForceUnlock = ref(false)
const editMedals = ref('')
const ensoEdit = ref({} as Record<EnsoField, string>)
const ensoCleared = ref<string[]>([])
const ensoBossHp = ref<Record<string, string>>({})
const isSaving = ref(false)
const saveError = ref('')

type Tab = 'users' | 'review' | 'titles' | 'merge' | 'keys' | 'log' | 'online'
const activeTab = ref<Tab>('users')

interface AdminLog {
  seq: number
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
  'GET /enso_battle': 'Enso battle data',
  'POST /enso_battle': 'Enso battle played',
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
const historyDate = ref('')
let logsSocket: WebSocket | null = null
let logsReconnectTimer: ReturnType<typeof setTimeout> | undefined

const ACCESS_LOG_RE = /^\S+ - "(\S+) (\S+) HTTP\/[\d.]+" (\d{3})(?:.*\[key=([^\]]+)\])?/

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
    keyId: match[4] ?? null,
    params: [...new URLSearchParams(query)],
  }
}

function logKeyName(keyId: string) {
  return apiKeys.value.find((k) => k.key_id === keyId)?.label || keyId
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

function logSongName(hash: string) {
  const title = songTitles.value.get(hash)
  return title ? songTitle(title) : hash
}

function logUsername(accessCode: string) {
  return userByAccessCode.value.get(accessCode)?.username ?? accessCode
}

function logUserPath(accessCode: string) {
  const user = userByAccessCode.value.get(accessCode)
  return user ? `/u/${user.id}` : ''
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
    for (const user of data.users as AdminUser[]) {
      userByAccessCode.value.set(user.access_code, { id: user.id, username: user.username })
    }
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
const creatingTitle = ref(false)
const newTitleNumber = ref('')
const titleOwners = ref<TitleOwner[]>([])
const grantCode = ref('')
const ownersError = ref('')

function titleUrl(path: string, params: Record<string, string | number> = {}) {
  const query = new URLSearchParams({ admin_key: adminKey.value, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  return `${API_BASE_URL}/admin/${path}?${query}`
}

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
  creatingTitle.value = false
  titleOwners.value = []
  grantCode.value = ''
  ownersError.value = ''
  fetchTitleOwners(title.number)
}

function startCreateTitle() {
  editingTitle.value = null
  creatingTitle.value = true
  newTitleNumber.value = ''
  editTitleName.value = ''
  editTitleColor.value = ''
  editTitleConditionJa.value = ''
  editTitleDefaultUnlocked.value = false
  saveTitleError.value = ''
}

function cancelEditTitle() {
  editingTitle.value = null
  creatingTitle.value = false
}

async function fetchTitleOwners(number: number) {
  try {
    const response = await fetch(titleUrl('title_owners', { number }))
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    titleOwners.value = (await response.json()).owners
  } catch {
    ownersError.value = t('admin.titleOwnersError')
  }
}

async function ownerAction(action: 'grant_title' | 'revoke_title', accessCode: string) {
  if (!editingTitle.value) return
  ownersError.value = ''
  try {
    const response = await fetch(titleUrl(action, { number: editingTitle.value.number, access_code: accessCode }), {
      method: 'POST',
    })
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    grantCode.value = ''
    await Promise.all([fetchTitleOwners(editingTitle.value.number), fetchTitles()])
  } catch {
    ownersError.value = t('admin.titleOwnersError')
  }
}

async function grantTitleToAll() {
  if (!editingTitle.value) return
  if (!confirm(t('admin.grantAllConfirm', { number: editingTitle.value.number, name: editingTitle.value.name }))) return
  ownersError.value = ''
  try {
    const response = await fetch(titleUrl('grant_title_all', { number: editingTitle.value.number }), { method: 'POST' })
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    await Promise.all([fetchTitleOwners(editingTitle.value.number), fetchTitles()])
  } catch {
    ownersError.value = t('admin.titleOwnersError')
  }
}

async function deleteTitle() {
  if (!editingTitle.value) return
  if (!confirm(t('admin.titleDeleteConfirm', { number: editingTitle.value.number, name: editingTitle.value.name }))) return
  try {
    const response = await fetch(titleUrl('delete_title', { number: editingTitle.value.number }), { method: 'POST' })
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    editingTitle.value = null
    await fetchTitles()
  } catch {
    saveTitleError.value = t('admin.titleDeleteError')
  }
}

async function saveEditTitle() {
  if (!editingTitle.value && !creatingTitle.value) return
  isSavingTitle.value = true
  saveTitleError.value = ''
  const body = new URLSearchParams({
    name: editTitleName.value,
    color: editTitleColor.value,
    unlock_condition: editTitleConditionJa.value,
    default_unlocked: editTitleDefaultUnlocked.value ? 'true' : 'false',
  })
  try {
    let response: Response
    if (creatingTitle.value) {
      body.set('number', newTitleNumber.value)
      response = await fetch(titleUrl('create_title'), { method: 'POST', body })
    } else {
      response = await fetch(titleUrl('update_title', { number: editingTitle.value!.number }), { method: 'POST', body })
    }
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    editingTitle.value = null
    creatingTitle.value = false
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

const adminTabs = computed(() => [
  { value: 'users' as const, label: t('admin.tabUsers') },
  {
    value: 'review' as const,
    label:
      suspiciousTab.value === 'pending' && suspiciousScores.value.length
        ? `${t('admin.tabReview')} (${suspiciousScores.value.length})`
        : t('admin.tabReview'),
  },
  { value: 'titles' as const, label: t('admin.tabTitles') },
  { value: 'merge' as const, label: t('admin.tabMerge') },
  { value: 'keys' as const, label: t('admin.tabApiKeys') },
  { value: 'log' as const, label: t('admin.tabLog') },
  { value: 'online' as const, label: t('admin.tabOnline') },
])

const onlineDays = ref('7')
const onlineSamples = ref<{ ts: string; online: number }[]>([])
const onlineError = ref('')
const onlineDayOptions = ['1', '7', '30', '90'].map((days) => ({ value: days, label: `${days}d` }))

async function fetchOnlineHistory() {
  onlineError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/online_history?admin_key=${encodeURIComponent(adminKey.value)}&days=${onlineDays.value}`,
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    onlineSamples.value = await response.json()
  } catch (error) {
    onlineError.value = String(error)
  }
}

function switchOnlineDays(days: string) {
  onlineDays.value = days
  fetchOnlineHistory()
}

const onlineChart = computed(() => {
  const samples = onlineSamples.value
  if (samples.length < 2) return null
  const times = samples.map((sample) => Date.parse(sample.ts))
  const start = times[0]!
  const span = times[times.length - 1]! - start || 1
  const peak = Math.max(1, ...samples.map((sample) => sample.online))
  const points = samples
    .map((sample, i) => `${(((times[i]! - start) / span) * 1000).toFixed(1)},${(200 - (sample.online / peak) * 190).toFixed(1)}`)
    .join(' ')
  return {
    points,
    peak,
    latest: samples[samples.length - 1]!.online,
    from: new Date(start).toLocaleString(),
    to: new Date(times[times.length - 1]!).toLocaleString(),
  }
})

function switchTab(tab: Tab) {
  if (tab !== 'log') closeLogs()
  activeTab.value = tab
  if (tab === 'keys') fetchApiKeys()
  if (tab === 'review') fetchSuspiciousScores()
  if (tab === 'titles' && !titlesLoaded.value) fetchTitles()
  if (tab === 'online') fetchOnlineHistory()
  if (tab === 'log') {
    if (apiKeys.value.length === 0) fetchApiKeys()
    historyDate.value = ''
    connectLogs()
  }
}

function closeLogs() {
  clearTimeout(logsReconnectTimer)
  logsReconnectTimer = undefined
  logsSocket?.close()
  logsSocket = null
  logsLive.value = false
}

async function fetchSongTitles() {
  try {
    const response = await fetch(`${API_BASE_URL}/songs`)
    if (!response.ok) return
    const data = (await response.json()) as { songs: { hash: string; title: Record<string, string> }[] }
    songTitles.value = new Map(data.songs.map((song) => [song.hash, song.title]))
  } catch {
    // leave raw hashes if the song list is unavailable
  }
}

function connectLogs() {
  closeLogs()
  if (songTitles.value.size === 0) fetchSongTitles()
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

async function loadLogHistory() {
  if (!historyDate.value) {
    connectLogs()
    return
  }
  closeLogs()
  logsError.value = ''
  logsLoading.value = true
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/logs/history?admin_key=${encodeURIComponent(adminKey.value)}&date=${historyDate.value}`,
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    logs.value = ((await response.json()) as { logs: AdminLog[] }).logs
  } catch {
    logsError.value = t('admin.logsLoadError')
  } finally {
    logsLoading.value = false
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

onUnmounted(() => {
  closeLogs()
  clearTimeout(searchTimer)
  clearTimeout(copiedTimer)
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  if (!unlocked.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchUsers, 300)
})

const titleSearch = ref('')
const titleColorFilter = ref('')
const titleDefaultFilter = ref('')
const titleConditionFilter = ref('')
type TitleSortKey = 'number' | 'name' | 'owner_count'
const titleSortKey = ref<TitleSortKey>('number')
const titleSortAsc = ref(true)
const titleColors = computed(() => [...new Set(titles.value.map((x) => x.color).filter((c): c is string => !!c))].sort())

function sortTitlesBy(key: TitleSortKey) {
  if (titleSortKey.value === key) titleSortAsc.value = !titleSortAsc.value
  else {
    titleSortKey.value = key
    titleSortAsc.value = true
  }
}

const visibleTitles = computed(() => {
  const term = titleSearch.value.trim().toLowerCase()
  const list = titles.value.filter((x) => {
    if (titleColorFilter.value && (x.color ?? 'none') !== titleColorFilter.value) return false
    if (titleDefaultFilter.value && x.default_unlocked !== (titleDefaultFilter.value === 'yes')) return false
    if (titleConditionFilter.value && x.has_structured_condition !== (titleConditionFilter.value === 'structured'))
      return false
    if (!term) return true
    return [String(x.number), x.name, x.color, x.unlock_condition_ja, x.unlock_condition_en].some((v) =>
      v?.toLowerCase().includes(term),
    )
  })
  const key = titleSortKey.value
  const dir = titleSortAsc.value ? 1 : -1
  return list.sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name) : a[key] - b[key]) * dir)
})

async function startEdit(user: AdminUser) {
  editing.value = user
  detail.value = null
  detailError.value = ''
  editUsername.value = user.username
  editDan.value = user.dan?.toString() ?? ''
  editGold.value = !!user.gold
  saveError.value = ''
  if (!titlesLoaded.value) fetchTitles()
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/user?admin_key=${encodeURIComponent(adminKey.value)}&access_code=${encodeURIComponent(user.access_code)}`,
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: AdminUserDetail = await response.json()
    if (editing.value?.access_code !== user.access_code) return
    detail.value = data
    editTitle.value = data.title ?? ''
    editNameplate.value = data.nameplate_bg?.toString() ?? ''
    editForceUnlock.value = data.force_unlock
    editMedals.value = data.don_medals?.toString() ?? '0'
    const enso = data.enso
    ensoEdit.value = Object.fromEntries(ENSO_FIELDS.map((k) => [k, String(enso[k])])) as Record<EnsoField, string>
    ensoCleared.value = Object.keys(enso.bosses).filter((s) => (enso.cleared >> Number(s)) & 1)
    ensoBossHp.value = Object.fromEntries(Object.entries(enso.bosses).map(([s, b]) => [s, String(b.hp)]))
  } catch {
    detailError.value = t('admin.detailLoadError')
  }
}

function cancelEdit() {
  editing.value = null
  detail.value = null
}

async function saveEdit() {
  if (!editing.value) return
  isSaving.value = true
  saveError.value = ''
  const accessCode = editing.value.access_code
  const post = async (path: string, body: Record<string, string>) => {
    const response = await fetch(
      `${API_BASE_URL}${path}?admin_key=${encodeURIComponent(adminKey.value)}&access_code=${encodeURIComponent(accessCode)}`,
      { method: 'POST', body: new URLSearchParams(body) },
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(typeof data.detail === 'string' ? data.detail : '')
    }
  }
  try {
    await post('/admin/update_user', {
      username: editUsername.value,
      dan: editDan.value,
      gold: editGold.value ? 'true' : 'false',
      title: editTitle.value,
      nameplate_bg: editNameplate.value,
      force_unlock: editForceUnlock.value ? 'true' : 'false',
      don_medals: editMedals.value,
    })
    const bosses = detail.value!.enso.bosses
    await post('/admin/update_enso', {
      ...ensoEdit.value,
      cleared: String(ensoCleared.value.reduce((bits, s) => bits | (1 << Number(s)), 0)),
      boss_hp: JSON.stringify(
        Object.fromEntries(
          Object.entries(ensoBossHp.value).filter(([s, hp]) => !ensoCleared.value.includes(s) && Number(hp) < bosses[s]!.max),
        ),
      ),
    })
    cancelEdit()
    await fetchUsers()
  } catch (e) {
    saveError.value = (e instanceof Error && e.message) || t('admin.saveError')
  } finally {
    isSaving.value = false
  }
}

const copied = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = text
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = ''), 1500)
}

async function copyAccessCode(user: AdminUser) {
  try {
    await copyText(user.access_code)
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
    cancelEdit()
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
    cancelEdit()
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

const suspiciousOptions = computed(() => [
  { value: 'pending' as const, label: t('admin.suspiciousTabPending') },
  { value: 'import_warning' as const, label: t('admin.suspiciousTabImportWarning') },
])

function switchSuspiciousTab(tab: 'pending' | 'import_warning') {
  suspiciousTab.value = tab
  fetchSuspiciousScores()
}
</script>

<template>
  <div class="flex w-full max-w-6xl flex-col gap-4">
    <h1 class="text-2xl font-bold tracking-tight">{{ $t('admin.title') }}</h1>

    <form v-if="!unlocked" class="card flex w-full max-w-sm flex-col gap-3 self-center" @submit.prevent="fetchUsers">
      <input
        v-model="adminKey"
        type="password"
        :placeholder="$t('admin.adminKeyPlaceholder')"
        class="field"
        autofocus
        autocomplete="current-password"
        :disabled="isLoading"
      />
      <button type="submit" class="btn btn-primary" :disabled="isLoading || !adminKey">{{ $t('admin.unlock') }}</button>
      <p v-if="authError" class="error-text text-sm">{{ authError }}</p>
    </form>

    <template v-else>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <TabNav
          :model-value="activeTab"
          :tabs="adminTabs"
          class="min-w-0 flex-1"
          @update:model-value="switchTab"
        />
        <button type="button" class="btn" @click="logout">{{ $t('admin.lock') }}</button>
      </div>

      <template v-if="activeTab === 'keys'">
        <form class="flex flex-wrap gap-2" @submit.prevent="createApiKey">
          <input v-model="apiKeyLabel" type="text" :placeholder="$t('admin.apiKeyLabelPlaceholder')" class="field" />
          <button type="submit" class="btn btn-primary">{{ $t('admin.apiKeyCreate') }}</button>
        </form>
        <p v-if="apiKeyError" class="error-text text-sm">{{ apiKeyError }}</p>
        <div v-if="newApiKey" class="card flex w-full flex-col gap-2 border-green-500/50 text-sm">
          <p>{{ $t('admin.apiKeyCreated') }}</p>
          <div class="flex flex-wrap items-center gap-2">
            <code class="min-w-0 flex-1 break-all">{{ newApiKey }}</code>
            <button type="button" class="btn" @click="copyText(newApiKey)">
              {{ copied === newApiKey ? $t('admin.copied') : $t('admin.copyCode') }}
            </button>
          </div>
        </div>
        <div class="card w-full overflow-x-auto p-0">
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
              <tr v-for="key in apiKeys" :key="key.key_id" :class="key.revoked_at && 'opacity-50'">
                <td class="td-cell">{{ key.key_id }}</td>
                <td class="td-cell">{{ key.label }}</td>
                <td class="td-cell">{{ new Date(key.created_at).toLocaleString() }}</td>
                <td class="td-cell">{{ key.last_used ? new Date(key.last_used).toLocaleString() : $t('admin.neverUsed') }}</td>
                <td class="td-cell">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="key.revoked_at ? 'bg-red-600/10 text-red-700 dark:text-red-400' : 'bg-green-600/10 text-green-700 dark:text-green-400'"
                  >
                    {{ key.revoked_at ? $t('admin.apiKeyRevoked') : $t('admin.apiKeyActive') }}
                  </span>
                </td>
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
                  <button v-if="!key.revoked_at" type="button" class="btn btn-danger" @click="revokeApiKey(key)">
                    {{ $t('admin.apiKeyRevoke') }}
                  </button>
                  <button v-else type="button" class="btn btn-danger" @click="deleteApiKey(key)">
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
        <div class="flex w-full flex-wrap items-center gap-2">
          <span
            class="flex items-center gap-1.5 text-xs"
            :class="logsLive ? 'text-green-600 dark:text-green-400' : 'muted'"
          >
            <span class="h-2 w-2 rounded-full" :class="logsLive ? 'bg-green-500' : 'bg-neutral-400'"></span>
            {{ logsLive ? $t('admin.logLive') : $t('admin.logDisconnected') }}
          </span>
          <select v-model="levelFilter" class="field text-sm" :aria-label="$t('admin.logLevel')">
            <option value="">{{ $t('admin.logAllLevels') }}</option>
            <option v-for="level in LOG_LEVELS" :key="level" :value="level">{{ level }}</option>
          </select>
          <select v-model="endpointFilter" class="field text-sm" :aria-label="$t('admin.logEndpoint')">
            <option value="">{{ $t('admin.logAllEndpoints') }}</option>
            <option v-for="(label, key) in LOG_ENDPOINTS" :key="key" :value="key">{{ label }}</option>
          </select>
          <input
            v-model="historyDate"
            type="date"
            class="field text-sm"
            :aria-label="$t('admin.logDate')"
            @change="loadLogHistory"
          />
          <span class="muted ml-auto text-xs">{{ $t('admin.logCount', { count: filteredLogs.length }) }}</span>
          <button v-if="!historyDate" type="button" class="btn btn-danger" @click="clearLogs">{{ $t('admin.logClear') }}</button>
        </div>
        <p v-if="logsError" class="error-text text-sm">{{ logsError }}</p>
        <p v-if="logsLoading" class="muted text-sm">{{ $t('common.loading') }}</p>
        <div v-else class="card w-full overflow-x-auto p-0">
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
              <tr v-for="entry in filteredLogs" :key="entry.seq" class="text-sm">
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
                    <div v-if="entry.access.keyId" class="text-xs muted" :title="entry.access.keyId">
                      {{ $t('admin.logApiKey') }}: {{ logKeyName(entry.access.keyId) }}
                    </div>
                    <details v-if="entry.access.params.length" class="mt-1 text-xs">
                      <summary class="cursor-pointer muted">
                        {{ $t('admin.logParameters') }} ({{ entry.access.params.length }})
                      </summary>
                      <dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
                        <template v-for="([key, value], paramIndex) in entry.access.params" :key="paramIndex">
                          <dt class="muted">{{ key }}</dt>
                          <dd class="break-all">
                            <router-link
                              v-if="key === 'hash'"
                              :to="`/songs/${value}`"
                              :title="value"
                              class="row-link"
                            >
                              {{ logSongName(value) }}
                            </router-link>
                            <router-link
                              v-else-if="key.endsWith('access_code') && userByAccessCode.get(value)"
                              :to="logUserPath(value)"
                              :title="value"
                              class="row-link"
                            >
                              {{ logUsername(value) }}
                            </router-link>
                            <template v-else>{{ value }}</template>
                          </dd>
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
        <form class="card flex w-full max-w-sm flex-col gap-3" @submit.prevent="mergeUsers">
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
            class="btn btn-primary self-start"
            :disabled="isMerging || !mergeTargetCode.trim() || !mergeSourceCode.trim() || mergeTargetCode.trim() === mergeSourceCode.trim()"
          >
            {{ $t('admin.mergeButton') }}
          </button>
        </form>
      </template>

      <template v-else-if="activeTab === 'titles'">
        <div class="flex flex-wrap items-center gap-2">
          <input v-model="titleSearch" type="search" :placeholder="$t('admin.searchTitles')" class="field w-full max-w-sm" />
          <select v-model="titleColorFilter" class="field">
            <option value="">{{ $t('admin.filterAnyColor') }}</option>
            <option v-for="c in titleColors" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="titleDefaultFilter" class="field">
            <option value="">{{ $t('admin.filterAnyDefault') }}</option>
            <option value="yes">{{ $t('admin.filterDefaultYes') }}</option>
            <option value="no">{{ $t('admin.filterDefaultNo') }}</option>
          </select>
          <select v-model="titleConditionFilter" class="field">
            <option value="">{{ $t('admin.filterAnyCondition') }}</option>
            <option value="structured">{{ $t('admin.filterStructured') }}</option>
            <option value="unmapped">{{ $t('admin.filterUnmapped') }}</option>
          </select>
          <button type="button" class="btn btn-primary" @click="startCreateTitle">{{ $t('admin.newTitle') }}</button>
          <span class="muted text-sm">{{ $t('admin.titlesShown', { shown: visibleTitles.length, total: titles.length }) }}</span>
        </div>
        <p v-if="titlesError" class="error-text text-sm">{{ titlesError }}</p>
        <p v-if="titlesLoading" class="muted text-sm">{{ $t('common.loading') }}</p>

        <div v-else class="card w-full overflow-x-auto p-0">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th class="th-cell cursor-pointer select-none" @click="sortTitlesBy('number')">
                  {{ $t('admin.thNumber') }}{{ titleSortKey === 'number' ? (titleSortAsc ? ' ▲' : ' ▼') : '' }}
                </th>
                <th class="th-cell cursor-pointer select-none" @click="sortTitlesBy('name')">
                  {{ $t('admin.thName') }}{{ titleSortKey === 'name' ? (titleSortAsc ? ' ▲' : ' ▼') : '' }}
                </th>
                <th class="th-cell">{{ $t('admin.thColor') }}</th>
                <th class="th-cell">{{ $t('admin.thDefaultUnlocked') }}</th>
                <th class="th-cell cursor-pointer select-none" @click="sortTitlesBy('owner_count')">
                  {{ $t('admin.thOwners') }}{{ titleSortKey === 'owner_count' ? (titleSortAsc ? ' ▲' : ' ▼') : '' }}
                </th>
                <th class="th-cell">{{ $t('admin.thConditionJa') }}</th>
                <th class="th-cell">{{ $t('admin.thCondition') }}</th>
                <th class="th-cell"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="title in visibleTitles" :key="title.number">
                <td class="td-cell">{{ title.number }}</td>
                <td class="td-cell">{{ title.name }}</td>
                <td class="td-cell">{{ title.color ?? $t('admin.dash') }}</td>
                <td class="td-cell">{{ title.default_unlocked ? $t('admin.yes') : $t('admin.no') }}</td>
                <td class="td-cell">{{ title.owner_count }}</td>
                <td class="td-cell">{{ title.unlock_condition_ja ?? $t('admin.dash') }}</td>
                <td class="td-cell">{{ title.unlock_condition_en ?? $t('admin.dash') }}</td>
                <td class="td-cell">
                  <button type="button" class="btn" @click="startEditTitle(title)">{{ $t('admin.edit') }}</button>
                </td>
              </tr>
              <tr v-if="visibleTitles.length === 0">
                <td class="td-cell muted" colspan="8">{{ $t('admin.noTitlesFound') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="editingTitle || creatingTitle"
          class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          @click.self="cancelEditTitle"
        >
          <form
            class="card flex w-full max-w-sm flex-col gap-3"
            @keydown.esc="cancelEditTitle"
            @submit.prevent="saveEditTitle"
          >
            <h2 class="font-semibold">
              {{ editingTitle ? $t('admin.editTitle', { number: editingTitle.number }) : $t('admin.newTitle') }}
            </h2>
            <label v-if="creatingTitle" class="flex flex-col gap-1 text-sm">
              {{ $t('admin.titleNumberLabel') }}
              <input v-model="newTitleNumber" type="number" min="0" class="field" :placeholder="$t('admin.titleNumberAuto')" />
            </label>
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
            <p v-if="editingTitle" class="muted text-xs">
              {{
                editingTitle.has_structured_condition
                  ? $t('admin.structuredConditionNote')
                  : $t('admin.noStructuredConditionNote')
              }}
            </p>
            <div v-if="editingTitle" class="flex flex-col gap-2 text-sm">
              <h3 class="font-semibold">{{ $t('admin.titleOwners', { count: titleOwners.length }) }}</h3>
              <div class="flex gap-2">
                <input v-model="grantCode" type="text" class="field flex-1" :placeholder="$t('admin.grantPlaceholder')" />
                <button type="button" class="btn" :disabled="!grantCode.trim()" @click="ownerAction('grant_title', grantCode)">
                  {{ $t('admin.grant') }}
                </button>
                <button type="button" class="btn" @click="grantTitleToAll">{{ $t('admin.grantAll') }}</button>
              </div>
              <ul class="flex max-h-40 flex-col gap-1 overflow-y-auto">
                <li v-for="o in titleOwners" :key="o.access_code" class="flex items-center justify-between gap-2">
                  <span>{{ o.username }} <span class="muted">{{ o.access_code }}</span></span>
                  <button type="button" class="btn btn-danger" @click="ownerAction('revoke_title', o.access_code)">
                    {{ $t('admin.revoke') }}
                  </button>
                </li>
              </ul>
              <p v-if="ownersError" class="error-text">{{ ownersError }}</p>
            </div>
            <p v-if="saveTitleError" class="error-text text-sm">{{ saveTitleError }}</p>
            <div class="flex justify-end gap-2">
              <button v-if="editingTitle && editingTitle.number !== 0" type="button" class="btn btn-danger mr-auto" @click="deleteTitle">
                {{ $t('admin.delete') }}
              </button>
              <button type="button" class="btn" @click="cancelEditTitle">{{ $t('common.cancel') }}</button>
              <button type="submit" class="btn btn-primary" :disabled="isSavingTitle">{{ $t('common.save') }}</button>
            </div>
          </form>
        </div>
      </template>

      <template v-else-if="activeTab === 'online'">
        <SegControl
          :model-value="onlineDays"
          :options="onlineDayOptions"
          class="self-start"
          @update:model-value="switchOnlineDays"
        />
        <p v-if="onlineError" class="error-text text-sm">{{ onlineError }}</p>
        <div v-if="onlineChart" class="card flex w-full flex-col gap-2 text-sm">
          <p>{{ $t('admin.onlineSummary', { latest: onlineChart.latest, peak: onlineChart.peak }) }}</p>
          <svg viewBox="0 0 1000 200" preserveAspectRatio="none" class="h-48 w-full">
            <polyline
              :points="onlineChart.points"
              fill="none"
              stroke="var(--color-don)"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="muted flex justify-between text-xs">
            <span>{{ onlineChart.from }}</span>
            <span>{{ onlineChart.to }}</span>
          </div>
        </div>
        <p v-else-if="!onlineError" class="muted text-sm">{{ $t('admin.onlineNoData') }}</p>
      </template>

      <template v-else-if="activeTab === 'review'">
      <SegControl
        :model-value="suspiciousTab"
        :options="suspiciousOptions"
        class="self-start"
        @update:model-value="switchSuspiciousTab"
      />

      <p v-if="suspiciousError" class="error-text text-sm">{{ suspiciousError }}</p>
      <p v-if="suspiciousLoading" class="muted text-sm">{{ $t('common.loading') }}</p>

      <div v-else class="card w-full overflow-x-auto p-0">
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
                  <button type="button" class="btn btn-primary" @click="reviewScore(item, 'approve')">
                    {{ $t('admin.allow') }}
                  </button>
                  <button type="button" class="btn btn-danger" @click="reviewScore(item, 'deny')">
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

      <template v-else>
      <form class="flex gap-2" @submit.prevent="fetchUsers">
        <input v-model="query" type="search" :placeholder="$t('admin.searchPlaceholder')" class="field w-full max-w-sm" autofocus />
        <button type="submit" class="btn" :disabled="isLoading">{{ $t('admin.search') }}</button>
      </form>

      <p v-if="loadError" class="error-text text-sm">{{ loadError }}</p>
      <p v-if="isLoading" class="muted text-sm">{{ $t('common.loading') }}</p>

      <template v-else>
      <p class="muted text-sm">{{ $t('admin.userCount', users.length) }}</p>
      <div class="card w-full overflow-x-auto p-0">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th v-for="col in (['username', 'dan', 'score_count', 'play_count', 'last_played'] as const)" :key="col" class="th-cell">
                <button type="button" class="whitespace-nowrap font-semibold" @click="sortUsersBy(col)">
                  {{ $t(`admin.sort.${col}`) }}{{ sortArrow(col) }}
                </button>
              </th>
              <th class="th-cell">{{ $t('admin.thTitle') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in pagedUsers"
              :key="user.access_code"
              class="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
              @click="startEdit(user)"
            >
              <td class="td-cell">
                <button type="button" class="text-left font-medium hover:underline">{{ user.username }}</button>
              </td>
              <td class="td-cell whitespace-nowrap">
                {{ user.dan ?? $t('admin.dash') }}<span v-if="user.gold" class="muted"> ({{ $t('admin.thGold') }})</span>
              </td>
              <td class="td-cell tabular-nums">{{ user.score_count }}</td>
              <td class="td-cell tabular-nums">{{ user.play_count }}</td>
              <td class="td-cell whitespace-nowrap">{{ formatDate(user.last_played) }}</td>
              <td class="td-cell muted">{{ user.title ?? $t('admin.dash') }}</td>
            </tr>
            <tr v-if="users.length === 0">
              <td class="td-cell muted" colspan="6">{{ $t('admin.noUsersFound') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pager v-model="usersPage" :total="users.length" :page-size="USERS_PAGE_SIZE" />
      </template>

      <div
        v-if="editing"
        class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        @click.self="cancelEdit"
      >
        <form
          class="card flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto"
          @keydown.esc="cancelEdit"
          @submit.prevent="saveEdit"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-lg font-semibold">{{ editing.username }}</h2>
            <router-link :to="`/u/${editing.id}`" class="text-sm hover:underline">{{ $t('admin.viewProfile') }}</router-link>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <code class="muted break-all">{{ editing.access_code }}</code>
            <span class="muted">#{{ editing.id }}</span>
          </div>

          <p v-if="detailError" class="error-text text-sm">{{ detailError }}</p>
          <p v-else-if="!detail" class="muted text-sm">{{ $t('common.loading') }}</p>
          <template v-else>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div v-for="[label, value] in ([
                ['firstPlayed', formatDate(detail.first_played)],
                ['lastPlayed', formatDate(detail.last_played)],
                ['plays', detail.play_count],
                ['charts', detail.score_count],
                ['danPlays', detail.dan_play_count],
                ['onlineBattles', detail.online_battles],
                ['donPoints', detail.don_points ?? 0],
                ['titles', detail.title_count],
                ['cosmetics', detail.cosmetic_count],
                ['puchichara', detail.puchichara_count],
                ['aiWins', detail.ai_wins ?? 0],
                ['discord', detail.discord_id ?? $t('admin.dash')],
                ['pendingReview', detail.pending_suspicious],
                ['import', detail.import_completed ? $t('admin.yes') : detail.import_requested ? $t('admin.importPending') : $t('admin.no')],
              ] as const)" :key="label" class="flex flex-col">
                <dt class="muted text-xs">{{ $t(`admin.stat.${label}`) }}</dt>
                <dd class="tabular-nums">{{ value }}</dd>
              </div>
            </dl>
            <p v-if="detail.aliases.length" class="muted text-xs break-all">
              {{ $t('admin.aliases') }}: {{ detail.aliases.join(', ') }}
            </p>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-sm">
                {{ $t('common.username') }}
                <input v-model="editUsername" type="text" maxlength="32" class="field" />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                {{ $t('admin.thTitle') }}
                <input v-model="editTitle" type="text" list="admin-title-names" class="field" />
                <datalist id="admin-title-names">
                  <option v-for="x in titles" :key="x.number" :value="x.name" />
                </datalist>
              </label>
              <label class="flex flex-col gap-1 text-sm">
                {{ $t('admin.thDan') }}
                <input v-model="editDan" type="number" class="field" />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                {{ $t('admin.nameplateBg') }}
                <select v-model="editNameplate" class="field">
                  <option value="">{{ $t('admin.nameplateFromTitle') }}</option>
                  <option v-for="(color, i) in NAMEPLATE_COLORS" :key="color" :value="String(i)">
                    {{ $t(`admin.nameplate.${color}`) }}
                  </option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-sm">
                {{ $t('admin.stat.donMedals') }}
                <input v-model="editMedals" type="number" min="0" class="field" />
              </label>
              <div class="flex flex-col justify-end gap-2 text-sm">
                <label class="flex items-center gap-2">
                  <input v-model="editGold" type="checkbox" />
                  {{ $t('admin.goldDan') }}
                </label>
                <label class="flex items-center gap-2">
                  <input v-model="editForceUnlock" type="checkbox" />
                  {{ $t('admin.forceUnlock') }}
                </label>
              </div>
            </div>

            <fieldset class="flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10">
              <legend class="font-semibold">
                {{ $t('admin.enso.title') }}
                <span class="muted text-sm font-normal">{{ $t('admin.enso.stage', { stage: detail.enso.stage }) }}</span>
              </legend>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label v-for="field in ENSO_FIELDS" :key="field" class="flex flex-col gap-1 text-sm">
                  {{ $t(`admin.enso.${field}`) }}
                  <input
                    v-model="ensoEdit[field]"
                    type="number"
                    :min="field === 'bond' || field === 'moves' ? 1 : 0"
                    :max="
                      field === 'bond' ? detail.enso.limits.bond_max
                      : field === 'moves' ? detail.enso.limits.move_max
                      : field === 'orb_rewards' ? detail.enso.limits.orb_rewards_max
                      : undefined
                    "
                    class="field"
                  />
                </label>
              </div>
              <p class="muted text-xs">{{ $t('admin.enso.hint') }}</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <div v-for="(boss, stage) in detail.enso.bosses" :key="stage" class="flex items-center gap-2 text-sm">
                  <label class="flex w-28 items-center gap-2">
                    <input v-model="ensoCleared" type="checkbox" :value="String(stage)" />
                    {{ $t('admin.enso.boss', { stage }) }}
                  </label>
                  <input
                    v-model="ensoBossHp[stage]"
                    type="number"
                    min="1"
                    :max="boss.max"
                    :disabled="ensoCleared.includes(String(stage))"
                    class="field w-32"
                  />
                  <span class="muted tabular-nums">/ {{ boss.max }}</span>
                </div>
              </div>
            </fieldset>
          </template>

          <p v-if="saveError" class="error-text text-sm">{{ saveError }}</p>
          <div class="flex flex-wrap justify-between gap-2">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn" @click="copyAccessCode(editing)">
                {{ copied === editing.access_code ? $t('admin.copied') : $t('admin.copyCode') }}
              </button>
              <button type="button" class="btn" @click="startChangeAccessCode(editing)">{{ $t('admin.changeAccessCode') }}</button>
              <button type="button" class="btn btn-danger" @click="deleteUser(editing)">{{ $t('admin.delete') }}</button>
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn" @click="cancelEdit">{{ $t('common.cancel') }}</button>
              <button type="submit" class="btn btn-primary" :disabled="isSaving || !detail">{{ $t('common.save') }}</button>
            </div>
          </div>
        </form>
      </div>

      <div
        v-if="changingAccessCode"
        class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        @click.self="cancelChangeAccessCode"
      >
        <form
          class="card flex w-full max-w-sm flex-col gap-3"
          @keydown.esc="cancelChangeAccessCode"
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
            <button type="submit" class="btn btn-primary" :disabled="isChangingAccessCode">{{ $t('common.save') }}</button>
          </div>
        </form>
      </div>
      </template>
    </template>
  </div>
</template>
