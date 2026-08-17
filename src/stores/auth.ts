import { ref } from 'vue'
import type { UserData } from '../types'

export const accessCode = ref<string | null>(null)
export const currentUser = ref<UserData | null>(null)

export function login(code: string, user: UserData) {
  accessCode.value = code
  currentUser.value = user
}

export function logout() {
  accessCode.value = null
  currentUser.value = null
}
