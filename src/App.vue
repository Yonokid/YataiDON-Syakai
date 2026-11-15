<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNavUnderline } from './composables/useNavUnderline'
import { SONG_LANGUAGES, songLanguage } from './composables/useSongDisplay'
import { accessCode, currentUser, login, logout } from './stores/auth'
import type { NameplateColor } from './components/Nameplate.vue'
import type { UserData } from './types'

function handleLogout() {
  logout()
}

const route = useRoute()
const nav = ref<HTMLElement | null>(null)
const underline = useNavUnderline(nav, () => route.path)

const activeCls = 'nav-active !text-neutral-900 dark:!text-neutral-100'
const links = [
  ['/', 'home'],
  ['/user', 'user'],
  ['/scores', 'scores'],
  ['/charts', 'charts'],
  ['/songs', 'songs'],
  ['/leaderboard', 'leaderboard'],
  ['/dans', 'dans'],
] as const
const extras = [
  ['/titles', 'titles'],
  ['/cosmetics', 'cosmetics'],
  ['/shop', 'shop'],
  ['/battle', 'battle'],
] as const

const extrasMenu = ref<HTMLDetailsElement | null>(null)
const closeExtras = (e?: Event) => {
  if (extrasMenu.value && !(e && extrasMenu.value.contains(e.target as Node))) extrasMenu.value.open = false
}
watch(() => route.path, () => closeExtras())
document.addEventListener('click', closeExtras)
onBeforeUnmount(() => document.removeEventListener('click', closeExtras))
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
      <div class="order-last -mb-px flex w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
        <nav ref="nav" class="relative flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Main">
          <span class="bg-don pointer-events-none absolute bottom-0 left-0 h-0.5" :style="underline" />
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
        <details ref="extrasMenu" class="relative shrink-0">
          <summary
            class="flex cursor-pointer list-none items-center gap-1 border-b-2 px-3 py-3 text-sm font-medium transition-colors select-none hover:text-neutral-900 dark:hover:text-neutral-100 [&::-webkit-details-marker]:hidden"
            :class="
              extras.some(([to]) => route.path.startsWith(to))
                ? 'border-don text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 dark:text-neutral-400'
            "
          >
            {{ $t('nav.extras') }}
            <svg viewBox="0 0 20 20" class="size-4" fill="currentColor" aria-hidden="true">
              <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
            </svg>
          </summary>
          <div
            class="absolute right-0 z-30 mt-px flex min-w-44 flex-col rounded-md border border-neutral-200 bg-neutral-50 py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
          >
            <router-link
              v-for="[to, key] in extras"
              :key="to"
              :to="to"
              class="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              active-class="!text-don font-semibold"
            >
              {{ $t('nav.' + key) }}
            </router-link>
          </div>
        </details>
      </div>
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
              : route.name === 'titles' || route.name === 'cosmetics' || route.name === 'shop' || route.name === 'battle'
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
