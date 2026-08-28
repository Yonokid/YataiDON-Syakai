<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSongDisplay } from '../composables/useSongDisplay'
import Nameplate, { type NameplateColor } from './Nameplate.vue'
import type { Score } from '../types'

interface PublicUser {
  username: string
  title: string
  nameplate_color: NameplateColor
  chara_color_1: string
  chara_color_2: string
  chara_color_3: string
  scores: Score[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const route = useRoute()

const user = ref<PublicUser | null>(null)
const status = ref<'loading' | 'loaded' | 'error' | 'not-found'>('loading')

const { songTitle, difficultyLabel } = useSongDisplay()

async function load(username: string) {
  status.value = 'loading'
  try {
    const response = await fetch(`${API_BASE_URL}/public_user?username=${encodeURIComponent(username)}`)
    if (response.status === 404) {
      status.value = 'not-found'
      return
    }
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    user.value = await response.json()
    status.value = 'loaded'
  } catch {
    status.value = 'error'
  }
}

onMounted(() => load(route.params.username as string))
watch(() => route.params.username, (username) => load(username as string))
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-4">
    <p v-if="status === 'loading'">{{ $t('common.loading') }}</p>
    <p v-else-if="status === 'not-found'" class="error-text">{{ $t('publicUser.userNotFound') }}</p>
    <p v-else-if="status === 'error'" class="error-text">{{ $t('common.serverError') }}</p>
    <template v-else-if="user">
      <Nameplate :username="user.username" :title="user.title" :color="user.nameplate_color" />

      <p v-if="user.scores.length === 0" class="muted">{{ $t('common.noScoresYet') }}</p>
      <div v-else class="w-full overflow-x-auto">
        <table class="w-full border-collapse text-sm whitespace-nowrap">
          <thead>
            <tr>
              <th class="th-cell">{{ $t('common.song') }}</th>
              <th class="th-cell">{{ $t('common.difficulty') }}</th>
              <th class="th-cell">{{ $t('common.level') }}</th>
              <th class="th-cell">{{ $t('common.score') }}</th>
              <th class="th-cell">{{ $t('common.crown') }}</th>
              <th class="th-cell">{{ $t('common.rank') }}</th>
              <th class="th-cell">{{ $t('common.maxCombo') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in user.scores" :key="`${entry.hash}-${entry.difficulty}`">
              <td class="td-cell">
                <router-link :to="`/songs/${entry.hash}`" class="row-link">{{ songTitle(entry.title) }}</router-link>
              </td>
              <td class="td-cell">{{ difficultyLabel(entry.difficulty) }}</td>
              <td class="td-cell">{{ entry.level }}</td>
              <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
              <td class="td-cell">{{ entry.crown }}</td>
              <td class="td-cell">{{ entry.rank }}</td>
              <td class="td-cell">{{ entry.max_combo }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
