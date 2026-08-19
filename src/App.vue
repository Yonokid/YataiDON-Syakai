<script setup lang="ts">
import { currentUser, accessCode, login, logout } from './stores/auth'

function handleLogout() {
  logout()
}

const navBase =
  'cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
const navActive = 'border-neutral-900 font-semibold dark:border-neutral-100'
</script>

<template>
  <header>
    <nav v-if="currentUser && accessCode" class="flex flex-wrap justify-center gap-2 py-3">
      <router-link to="/" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="[navBase, isActive && navActive]" @click="navigate">{{ $t('nav.home') }}</button>
      </router-link>
      <router-link to="/scores" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="[navBase, isActive && navActive]" @click="navigate">{{ $t('nav.scores') }}</button>
      </router-link>
      <router-link to="/user" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="[navBase, isActive && navActive]" @click="navigate">{{ $t('nav.user') }}</button>
      </router-link>
      <router-link to="/charts" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="[navBase, isActive && navActive]" @click="navigate">{{ $t('nav.charts') }}</button>
      </router-link>
      <router-link to="/leaderboard" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="[navBase, isActive && navActive]" @click="navigate">{{ $t('nav.leaderboard') }}</button>
      </router-link>
      <router-link to="/songs" custom v-slot="{ navigate, isActive }">
        <button type="button" :class="[navBase, isActive && navActive]" @click="navigate">{{ $t('nav.songs') }}</button>
      </router-link>
    </nav>
  </header>

  <main class="flex min-h-[80vh] items-center justify-center p-4">
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
        @costume-updated="
          (c: {
            chara_head_index: number
            chara_body_index: number
            chara_cos_index: number
            chara_is_costume: boolean
          }) => currentUser && Object.assign(currentUser, c)
        "
        @import-requested="() => currentUser && (currentUser.import_requested = true)"
      />
    </router-view>
  </main>
</template>
