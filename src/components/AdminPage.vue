<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
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

const activeTab = ref<'users' | 'titles' | 'merge'>('users')
const mergeTargetCode = ref('')
const mergeSourceCode = ref('')
const isMerging = ref(false)
const mergeError = ref('')
const mergeSuccess = ref(false)

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

function switchTab(tab: 'users' | 'titles' | 'merge') {
  activeTab.value = tab
  if (tab === 'titles' && !titlesLoaded.value) fetchTitles()
}

onMounted(() => {
  if (adminKey.value) {
    fetchUsers()
    fetchSuspiciousScores()
  }
})

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

function logout() {
  unlocked.value = false
  users.value = []
  suspiciousScores.value = []
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
        </div>
        <button type="button" class="btn" @click="logout">{{ $t('admin.lock') }}</button>
      </div>

      <template v-if="activeTab === 'merge'">
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
                <td class="td-cell">{{ title.unlock_condition_en ?? $t('admin.dash') }}</td>
                <td class="td-cell">
                  <button type="button" class="btn" @click="startEditTitle(title)">{{ $t('admin.edit') }}</button>
                </td>
              </tr>
              <tr v-if="titles.length === 0">
                <td class="td-cell muted" colspan="6">{{ $t('admin.noTitlesFound') }}</td>
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
