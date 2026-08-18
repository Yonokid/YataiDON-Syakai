<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface AdminUser {
  access_code: string
  username: string
  title: string | null
  dan: number | null
  gold: boolean | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const STORAGE_KEY = 'admin_key'

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

async function fetchUsers() {
  isLoading.value = true
  loadError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/users?admin_key=${encodeURIComponent(adminKey.value)}&q=${encodeURIComponent(query.value)}`,
    )
    if (response.status === 401) {
      unlocked.value = false
      authError.value = 'Invalid admin key.'
      return
    }
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data = await response.json()
    users.value = data.users
    unlocked.value = true
    localStorage.setItem(STORAGE_KEY, adminKey.value)
  } catch {
    loadError.value = 'Could not load users. Please try again.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (adminKey.value) fetchUsers()
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
    saveError.value = 'Could not save changes. Please try again.'
  } finally {
    isSaving.value = false
  }
}

async function deleteUser(user: AdminUser) {
  if (!confirm(`Delete user "${user.username}"? This also deletes their scores. This cannot be undone.`)) return
  try {
    const response = await fetch(
      `${API_BASE_URL}/admin/delete_user?admin_key=${encodeURIComponent(adminKey.value)}&access_code=${encodeURIComponent(user.access_code)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    users.value = users.value.filter((u) => u.access_code !== user.access_code)
  } catch {
    loadError.value = 'Could not delete user. Please try again.'
  }
}

function logout() {
  unlocked.value = false
  users.value = []
  localStorage.removeItem(STORAGE_KEY)
}
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
    <h1 class="text-xl font-bold">Admin</h1>

    <form v-if="!unlocked" class="flex flex-col items-center gap-2" @submit.prevent="fetchUsers">
      <input
        v-model="adminKey"
        type="password"
        placeholder="Admin key"
        class="field"
        :disabled="isLoading"
      />
      <button type="submit" class="btn" :disabled="isLoading || !adminKey">Unlock</button>
      <p v-if="authError" class="error-text text-sm">{{ authError }}</p>
    </form>

    <template v-else>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <form class="flex gap-2" @submit.prevent="fetchUsers">
          <input v-model="query" type="text" placeholder="Search username" class="field" />
          <button type="submit" class="btn" :disabled="isLoading">Search</button>
        </form>
        <button type="button" class="btn" @click="logout">Lock</button>
      </div>

      <p v-if="loadError" class="error-text text-sm">{{ loadError }}</p>
      <p v-if="isLoading" class="muted text-sm">Loading…</p>

      <div v-else class="w-full overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="th-cell">Username</th>
              <th class="th-cell">Title</th>
              <th class="th-cell">Dan</th>
              <th class="th-cell">Gold</th>
              <th class="th-cell"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.access_code">
              <td class="td-cell">{{ user.username }}</td>
              <td class="td-cell">{{ user.title ?? '—' }}</td>
              <td class="td-cell">{{ user.dan ?? '—' }}</td>
              <td class="td-cell">{{ user.gold ? 'Yes' : 'No' }}</td>
              <td class="td-cell">
                <div class="flex gap-2">
                  <button type="button" class="btn" @click="startEdit(user)">Edit</button>
                  <button type="button" class="btn" @click="deleteUser(user)">Delete</button>
                </div>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td class="td-cell muted" colspan="5">No users found.</td>
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
          <h2 class="font-semibold">Edit {{ editing.username }}</h2>
          <label class="flex flex-col gap-1 text-sm">
            Username
            <input v-model="editUsername" type="text" maxlength="32" class="field" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Dan
            <input v-model="editDan" type="number" class="field" />
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="editGold" type="checkbox" />
            Gold dan
          </label>
          <p v-if="saveError" class="error-text text-sm">{{ saveError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" @click="cancelEdit">Cancel</button>
            <button type="submit" class="btn" :disabled="isSaving">Save</button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>
