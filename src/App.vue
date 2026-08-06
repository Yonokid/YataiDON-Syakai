<script setup lang="ts">
import { ref } from 'vue'
import AccessCodeInput from './components/AccessCodeInput.vue'
import UserPage from './components/UserPage.vue'
import DiffChartPage from './components/DiffChartPage.vue'
import LeaderboardPage from './components/LeaderboardPage.vue'
import SongLeaderboardPage from './components/SongLeaderboardPage.vue'
import type { UserData } from './types'

const accessCode = ref<string | null>(null)
const currentUser = ref<UserData | null>(null)
const view = ref<'scores' | 'charts' | 'leaderboard' | 'songs'>('scores')

function handleVerified(code: string, user: UserData) {
  accessCode.value = code
  currentUser.value = user
}

function logout() {
  accessCode.value = null
  currentUser.value = null
  view.value = 'scores'
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
      <button
        type="button"
        :class="{ active: view === 'leaderboard' }"
        @click="view = 'leaderboard'"
      >
        Leaderboard
      </button>
      <button type="button" :class="{ active: view === 'songs' }" @click="view = 'songs'">
        Song Leaderboards
      </button>
    </nav>
  </header>

  <main>
    <template v-if="currentUser && accessCode">
      <SongLeaderboardPage v-if="view === 'songs'" />
      <LeaderboardPage v-else-if="view === 'leaderboard'" />
      <DiffChartPage v-else-if="view === 'charts'" :scores="currentUser.scores" />
      <UserPage
        v-else
        :user="currentUser"
        :access-code="accessCode"
        @logout="logout"
        @username-updated="currentUser.username = $event"
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
