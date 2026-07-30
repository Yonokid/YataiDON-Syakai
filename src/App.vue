<script setup lang="ts">
import { ref } from 'vue'
import AccessCodeInput from './components/AccessCodeInput.vue'
import UserPage from './components/UserPage.vue'
import type { UserData } from './types'

const accessCode = ref<string | null>(null)
const currentUser = ref<UserData | null>(null)

function handleVerified(code: string, user: UserData) {
  accessCode.value = code
  currentUser.value = user
}

function logout() {
  accessCode.value = null
  currentUser.value = null
}
</script>

<template>
  <header>
  </header>

  <main>
    <UserPage
      v-if="currentUser && accessCode"
      :user="currentUser"
      :access-code="accessCode"
      @logout="logout"
      @username-updated="currentUser.username = $event"
    />
    <AccessCodeInput v-else @verified="handleVerified" />
  </main>
</template>

<style scoped>
main {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}
</style>
