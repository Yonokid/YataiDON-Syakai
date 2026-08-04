<script setup lang="ts">
import { ref } from 'vue'
import AccessCodeInput from './components/AccessCodeInput.vue'
import UserPage from './components/UserPage.vue'
import DiffChartPage from './components/DiffChartPage.vue'
import type { UserData } from './types'

const accessCode = ref<string | null>(null)
const currentUser = ref<UserData | null>(null)
const view = ref<'scores' | 'charts'>('scores')

function handleVerified(code: string, user: UserData) {
  accessCode.value = code
  currentUser.value = user
}

function logout() {
  accessCode.value = null
  currentUser.value = null
  view.value = 'scores'
  localStorage.removeItem('yataidon_access_code')
}
</script>

<template>
  <header>
    <nav v-if="currentUser && accessCode" class="nav-tabs">
      <button type="button" :class="{ active: view === 'scores' }" @click="view = 'scores'">
        Scores
      </button>
      <button type="button" :class="{ active: view === 'charts' }" @click="view = 'charts'">
        Diff Charts
      </button>
    </nav>
  </header>

  <main>
    <template v-if="currentUser && accessCode">
      <DiffChartPage
        v-if="view === 'charts'"
        :scores="currentUser.scores"
        :access-code="accessCode"
      />
      <UserPage
        v-else
        :user="currentUser"
        :access-code="accessCode"
        @logout="logout"
        @username-updated="currentUser.username = $event"
        @chara-colors-updated="Object.assign(currentUser, $event)"
        @import-requested="currentUser.import_requested = true"
      />
    </template>
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

.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
}

.nav-tabs button {
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.nav-tabs button.active {
  font-weight: bold;
  border-color: currentColor;
}
</style>
