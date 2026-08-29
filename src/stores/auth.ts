import { ref } from 'vue'
import type { UserData } from '../types'

export const STORAGE_KEY = 'yataidon_access_code'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export const accessCode = ref<string | null>(null)
export const currentUser = ref<UserData | null>(null)

export function login(code: string, user: UserData) {
  accessCode.value = code
  currentUser.value = user
}

export function logout() {
  accessCode.value = null
  currentUser.value = null
  localStorage.removeItem(STORAGE_KEY)
}

let restorePromise: Promise<void> | null = null

// Re-verifies a remembered access code on app boot so refreshing a deep link
// (e.g. /leaderboard) doesn't bounce through the login screen.
export function restoreSession(): Promise<void> {
  if (currentUser.value) return Promise.resolve()
  if (restorePromise) return restorePromise

  const code = localStorage.getItem(STORAGE_KEY)
  if (!code) return Promise.resolve()

  restorePromise = fetch(`${API_BASE_URL}/user?access_code=${encodeURIComponent(code)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((user: UserData | null) => {
      if (user) login(code, user)
    })
    .catch(() => {})
  return restorePromise
}
