<script setup lang="ts">
import { SONG_LANGUAGES, songLanguage } from './composables/useSongDisplay'
import { accessCode, currentUser, login, logout } from './stores/auth'
import type { NameplateColor } from './components/Nameplate.vue'
import type { UserData } from './types'

function handleLogout() {
  logout()
}

const activeCls = '!border-don !text-neutral-900 dark:!text-neutral-100'
const links = [
  ['/', 'home'],
  ['/scores', 'scores'],
  ['/dans', 'dans'],
  ['/user', 'user'],
  ['/charts', 'charts'],
  ['/leaderboard', 'leaderboard'],
  ['/songs', 'songs'],
  ['/titles', 'titles'],
  ['/cosmetics', 'cosmetics'],
] as const
</script>

<template>
  <header
    v-if="currentUser && accessCode"
    class="sticky top-0 z-20 border-b border-neutral-200 bg-neutral-50/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85"
  >
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 sm:flex-nowrap">
      <router-link to="/" class="shrink-0 py-1.5">
        <img src="/logo.png" alt="YataiDON" class="h-10 w-auto" />
      </router-link>
      <nav class="order-last -mb-px flex w-full min-w-0 gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1" aria-label="Main">
        <router-link
          v-for="[to, key] in links"
          :key="to"
          :to="to"
          class="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          :active-class="to === '/' ? '' : activeCls"
          :exact-active-class="activeCls"
        >
          {{ $t('nav.' + key) }}
        </router-link>
      </nav>
      <select v-model="songLanguage" class="field ml-auto shrink-0 text-sm sm:ml-0" :aria-label="$t('nav.songLanguage')" :title="$t('nav.songLanguage')">
        <option v-for="lang in SONG_LANGUAGES" :key="lang.code" :value="lang.code">{{ lang.label }}</option>
      </select>
    </div>
  </header>

  <main class="mx-auto flex min-h-[80vh] max-w-6xl justify-center p-4 pt-8 sm:p-8">
    <router-view v-slot="{ Component, route }">
      <component
        :is="Component"
        :key="String(currentUser?.force_unlock)"
        v-bind="
          route.name === 'home' || route.name === 'scores' || route.name === 'user'
            ? { user: currentUser, accessCode }
            : route.name === 'charts'
              ? { scores: currentUser?.scores, accessCode }
              : route.name === 'titles' || route.name === 'cosmetics'
                ? { accessCode }
                : {}
        "
        @verified="login"
        @logout="handleLogout"
        @username-updated="(v: string) => currentUser && (currentUser.username = v)"
        @title-updated="
          (v: { title: string; nameplate_color?: NameplateColor }) => {
            if (!currentUser) return
            currentUser.title = v.title
            if (v.nameplate_color) currentUser.nameplate_color = v.nameplate_color
          }
        "
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
        @puchi-updated="(v: number | null) => currentUser && (currentUser.puchichara = v)"
        @force-unlock-updated="(u: UserData) => login(accessCode!, u)"
        @import-requested="() => currentUser && (currentUser.import_requested = true)"
      />
    </router-view>
  </main>
</template>
