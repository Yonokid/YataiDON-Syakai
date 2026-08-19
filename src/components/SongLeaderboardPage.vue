<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSongDisplay } from '../composables/useSongDisplay'

interface Song {
  hash: string
  title: Record<string, string>
  subtitle: Record<string, string>
  difficulty: number
  level: number
}

interface SongGroup {
  title: Record<string, string>
  variants: Song[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const songs = ref<Song[]>([])
const songsStatus = ref<'loading' | 'loaded' | 'error'>('loading')
const search = ref('')
const { songTitle } = useSongDisplay()

const songGroups = computed(() => {
  const groups = new Map<string, SongGroup>()
  for (const song of songs.value) {
    const key = songTitle(song.title)
    const existing = groups.get(key)
    if (existing) {
      existing.variants.push(song)
    } else {
      groups.set(key, { title: song.title, variants: [song] })
    }
  }
  for (const group of groups.values()) {
    group.variants.sort((a, b) => a.difficulty - b.difficulty)
  }
  return [...groups.values()].sort((a, b) => songTitle(a.title).localeCompare(songTitle(b.title)))
})

const filteredGroups = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return songGroups.value
  return songGroups.value.filter((group) => songTitle(group.title).toLowerCase().includes(term))
})

onMounted(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/songs`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: { songs: Song[] } = await response.json()
    songs.value = data.songs
    songsStatus.value = 'loaded'
  } catch {
    songsStatus.value = 'error'
  }
})
</script>

<template>
  <div class="flex w-full max-w-lg flex-col items-center gap-3">
    <h1 class="text-xl font-bold">{{ $t('songLeaderboard.title') }}</h1>

    <div class="flex w-full flex-col items-center gap-3">
      <input v-model="search" type="text" :placeholder="$t('songLeaderboard.searchPlaceholder')" class="field w-full" />
      <p v-if="songsStatus === 'loading'">{{ $t('common.loading') }}</p>
      <p v-else-if="songsStatus === 'error'" class="error-text">{{ $t('common.serverError') }}</p>
      <p v-else-if="filteredGroups.length === 0" class="muted">{{ $t('songLeaderboard.noSongsFound') }}</p>
      <ul v-else class="flex max-h-96 w-full flex-col gap-1 overflow-y-auto">
        <li v-for="group in filteredGroups" :key="songTitle(group.title)">
          <router-link
            :to="`/songs/${group.variants[0]!.hash}`"
            class="block w-full rounded-md px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {{ songTitle(group.title) }}
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>
