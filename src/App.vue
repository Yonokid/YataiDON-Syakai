<script setup lang="ts">
import { currentUser, accessCode, login, logout } from './stores/auth'

function handleLogout() {
  logout()
}
</script>

<template>
  <header>
    <nav v-if="currentUser && accessCode" class="nav-tabs">
      <router-link to="/" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="{ active: isActive }" @click="navigate">Home</button>
      </router-link>
      <router-link to="/scores" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="{ active: isActive }" @click="navigate">Scores</button>
      </router-link>
      <router-link to="/user" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="{ active: isActive }" @click="navigate">User</button>
      </router-link>
      <router-link to="/charts" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="{ active: isActive }" @click="navigate">Diff Charts</button>
      </router-link>
      <router-link to="/leaderboard" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="{ active: isActive }" @click="navigate">Leaderboard</button>
      </router-link>
      <router-link to="/songs" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="{ active: isActive }" @click="navigate">Song Leaderboards</button>
      </router-link>
    </nav>
  </header>

  <main>
    <router-view v-slot="{ Component, route }">
      <component
        :is="Component"
        v-bind="
          route.name === 'home' || route.name === 'scores' || route.name === 'user'
            ? { user: currentUser, accessCode }
            : route.name === 'charts'
              ? { scores: currentUser?.scores, accessCode }
              : {}
        "
        @verified="login"
        @logout="handleLogout"
        @username-updated="(v: string) => currentUser && (currentUser.username = v)"
        @chara-colors-updated="
          (c: { chara_color_1: string; chara_color_2: string; chara_color_3: string }) =>
            currentUser && Object.assign(currentUser, c)
        "
        @import-requested="() => currentUser && (currentUser.import_requested = true)"
      />
    </router-view>
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
