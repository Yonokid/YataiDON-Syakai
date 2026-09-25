<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSongDisplay } from '../composables/useSongDisplay'
import versionHashes from '../data/versions.json'
import type { UserData } from '../types'

interface CatalogSong {
  hash: string
  title: Record<string, string>
  subtitle: Record<string, string>
  difficulty: number
  level: number
  genre: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const CROWN_TIERS = [
  { tier: 1, labelKey: 'scores.tierClear' },
  { tier: 2, labelKey: 'scores.tierFullCombo' },
  { tier: 3, labelKey: 'scores.tierDonderful' },
] as const
const CROWN_CLASSES = ['crown-none', 'crown-clear', 'crown-fc', 'crown-dfc']
const DIFFICULTY_ONI = 3
const DIFFICULTY_URA = 4
const DIFFICULTY_TOWER = 5
const DIFFICULTY_DAN = 6

const props = defineProps<{ user: UserData; accessCode: string }>()
const { t } = useI18n()
const { songTitle, difficultyLabel } = useSongDisplay()

const jumpingHash = ref<string | null>(null)
const jumpError = ref('')
const jumpingReplayId = ref<number | null>(null)
const replayJumpError = ref('')
const search = ref('')

const filteredScores = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.user.scores
  return props.user.scores.filter((entry) => songTitle(entry.title).toLowerCase().includes(q))
})

async function sendToGame(hash: string) {
  jumpingHash.value = hash
  jumpError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/request_song_jump?access_code=${encodeURIComponent(props.accessCode)}&hash=${encodeURIComponent(hash)}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
  } catch {
    jumpError.value = t('diffChart.jumpError')
  } finally {
    jumpingHash.value = null
  }
}

async function sendReplayToGame(scoreId: number) {
  jumpingReplayId.value = scoreId
  replayJumpError.value = ''
  try {
    const response = await fetch(
      `${API_BASE_URL}/request_replay_jump?access_code=${encodeURIComponent(props.accessCode)}&score_id=${scoreId}`,
      { method: 'POST' },
    )
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
  } catch {
    replayJumpError.value = t('diffChart.replayJumpError')
  } finally {
    jumpingReplayId.value = null
  }
}

// Crown statistics
const catalog = ref<CatalogSong[]>([])
const catalogStatus = ref<'loading' | 'loaded' | 'error'>('loading')
const selectedVersion = ref('all')
const selectedDifficulty = ref('all')

onMounted(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/songs`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const data: { songs: CatalogSong[] } = await response.json()
    catalog.value = data.songs
    catalogStatus.value = 'loaded'
  } catch {
    catalogStatus.value = 'error'
  }
})

const versionOptions = computed(() => Object.keys(versionHashes).sort())

function versionLabel(key: string) {
  return key.replace('/', ' - ')
}

const difficultyOptions = computed(() =>
  [...new Set(catalog.value.map((s) => s.difficulty))]
    .filter((d) => d !== DIFFICULTY_TOWER && d !== DIFFICULTY_DAN)
    .sort((a, b) => a - b),
)

function difficultyMatches(d: number): boolean {
  if (selectedDifficulty.value === 'all') return true
  if (selectedDifficulty.value === 'oni_ura') return d === DIFFICULTY_ONI || d === DIFFICULTY_URA
  return d === Number(selectedDifficulty.value)
}

const crownByKey = computed(() => {
  const map = new Map<string, number>()
  for (const entry of props.user.scores) map.set(`${entry.hash}-${entry.difficulty}`, entry.crown)
  return map
})

const possibleCharts = computed(() => {
  const hashSet =
    selectedVersion.value === 'all'
      ? null
      : new Set((versionHashes as Record<string, string[]>)[selectedVersion.value] ?? [])
  return catalog.value.filter((s) => (hashSet === null || hashSet.has(s.hash)) && difficultyMatches(s.difficulty))
})

const crownStats = computed(() =>
  CROWN_TIERS.map(({ tier, labelKey }) => {
    const possible = possibleCharts.value.length
    const obtained = possibleCharts.value.filter(
      (s) => (crownByKey.value.get(`${s.hash}-${s.difficulty}`) ?? 0) >= tier,
    ).length
    return { labelKey, obtained, possible, percent: possible === 0 ? 0 : (obtained / possible) * 100 }
  }),
)

function crownClass(crown: number) {
  return CROWN_CLASSES[crown] ?? CROWN_CLASSES[0]
}

// Same song, different difficulties, share the same TITLE/SUBTITLE (populate_songs.py parses
// them once per file, outside the per-difficulty loop) -- there's no other field tying charts
// of one song together, so that pair is the grouping key.
function songKey(s: CatalogSong) {
  return `${JSON.stringify(s.title)}|${JSON.stringify(s.subtitle)}`
}

interface GenreRow {
  key: string
  title: Record<string, string>
  hash: string
  rowCrown: number | null
  badges: { difficulty: number; crown: number }[]
}

// Per-song crown breakdown, grouped by genre -- only meaningful for one version at a time
// (the catalog has thousands of songs; "all versions" would produce an unusable wall).
const genreSections = computed(() => {
  if (selectedVersion.value === 'all') return []
  const hashSet = new Set((versionHashes as Record<string, string[]>)[selectedVersion.value] ?? [])
  const inVersion = catalog.value.filter((s) => hashSet.has(s.hash))

  const bySong = new Map<string, CatalogSong[]>()
  for (const s of inVersion) {
    const key = songKey(s)
    if (!bySong.has(key)) bySong.set(key, [])
    bySong.get(key)!.push(s)
  }

  const byGenre = new Map<string, GenreRow[]>()
  for (const group of bySong.values()) {
    const charts = group.filter((s) => difficultyMatches(s.difficulty))
    if (charts.length === 0) continue
    const sorted = [...charts].sort((a, b) => a.difficulty - b.difficulty)
    const badges = sorted.map((s) => ({
      difficulty: s.difficulty,
      crown: crownByKey.value.get(`${s.hash}-${s.difficulty}`) ?? 0,
    }))
    const crowns = new Set(badges.map((b) => b.crown))
    const row: GenreRow = {
      key: songKey(sorted[0]!),
      title: sorted[0]!.title,
      hash: sorted[sorted.length - 1]!.hash,
      rowCrown: crowns.size === 1 ? badges[0]!.crown : null,
      badges,
    }
    const genre = sorted[0]!.genre
    if (!byGenre.has(genre)) byGenre.set(genre, [])
    byGenre.get(genre)!.push(row)
  }

  return [...byGenre.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([genre, rows]) => ({
      genre,
      rows: rows.sort((a, b) => songTitle(a.title).localeCompare(songTitle(b.title))),
    }))
})
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col gap-6">
    <section class="flex w-full flex-col gap-2">
      <input v-model="search" type="text" :placeholder="$t('scores.searchPlaceholder')" class="field w-full" />
      <p v-if="user.scores.length === 0" class="muted">{{ $t('common.noScoresYet') }}</p>
      <p v-else-if="filteredScores.length === 0" class="muted">{{ $t('scores.noResults') }}</p>
      <div v-else class="max-h-96 w-full overflow-auto">
        <table class="w-full border-collapse text-xs whitespace-nowrap">
          <thead>
            <tr>
              <th class="th-cell">{{ $t('common.song') }}</th>
              <th class="th-cell">{{ $t('common.difficulty') }}</th>
              <th class="th-cell">{{ $t('common.level') }}</th>
              <th class="th-cell">{{ $t('common.score') }}</th>
              <th class="th-cell">{{ $t('common.crown') }}</th>
              <th class="th-cell">{{ $t('common.rank') }}</th>
              <th class="th-cell">{{ $t('common.maxCombo') }}</th>
              <th class="th-cell"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in filteredScores" :key="`${entry.hash}-${entry.difficulty}`">
              <td class="td-cell">
                <router-link :to="`/songs/${entry.hash}`" class="row-link">{{ songTitle(entry.title) }}</router-link>
              </td>
              <td class="td-cell">{{ difficultyLabel(entry.difficulty) }}</td>
              <td class="td-cell">{{ entry.level }}</td>
              <td class="td-cell">{{ entry.score.toLocaleString() }}</td>
              <td class="td-cell">{{ entry.crown }}</td>
              <td class="td-cell">{{ entry.rank }}</td>
              <td class="td-cell">{{ entry.max_combo }}</td>
              <td class="td-cell">
                <button
                  type="button"
                  class="btn"
                  :disabled="jumpingHash === entry.hash"
                  @click="sendToGame(entry.hash)"
                >
                  {{ jumpingHash === entry.hash ? $t('common.sending') : $t('common.sendToGame') }}
                </button>
                <button
                  type="button"
                  class="btn"
                  :disabled="jumpingReplayId === entry.score_id"
                  @click="sendReplayToGame(entry.score_id)"
                >
                  {{ jumpingReplayId === entry.score_id ? $t('common.sending') : $t('common.watchReplay') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="jumpError" class="error-text text-sm">{{ jumpError }}</p>
      <p v-if="replayJumpError" class="error-text text-sm">{{ replayJumpError }}</p>
    </section>

    <section class="flex w-full flex-col gap-2">
      <h2 class="text-lg font-bold">{{ $t('scores.statsTitle') }}</h2>
      <div class="flex flex-wrap gap-2">
        <select v-model="selectedVersion" class="field">
          <option value="all">{{ $t('scores.allVersions') }}</option>
          <option v-for="key in versionOptions" :key="key" :value="key">{{ versionLabel(key) }}</option>
        </select>
        <select v-model="selectedDifficulty" class="field">
          <option value="all">{{ $t('scores.allDifficulties') }}</option>
          <option v-for="d in difficultyOptions" :key="d" :value="d">{{ difficultyLabel(d) }}</option>
          <option value="oni_ura">{{ $t('scores.oniUra') }}</option>
        </select>
      </div>
      <p v-if="catalogStatus === 'loading'">{{ $t('common.loading') }}</p>
      <p v-else-if="catalogStatus === 'error'" class="error-text">{{ $t('common.serverError') }}</p>
      <table v-else class="w-full max-w-md border-collapse text-sm">
        <thead>
          <tr>
            <th class="th-cell">{{ $t('common.crown') }}</th>
            <th class="th-cell w-full">{{ $t('scores.obtainedOfPossible') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in crownStats" :key="stat.labelKey">
            <td class="td-cell whitespace-nowrap">{{ $t(stat.labelKey) }}</td>
            <td class="td-cell">
              <div class="flex items-center gap-2">
                <progress class="h-2 w-full" :value="stat.obtained" :max="stat.possible || 1"></progress>
                <span class="whitespace-nowrap text-xs">{{ stat.obtained }} / {{ stat.possible }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="selectedVersion === 'all'" class="muted">{{ $t('scores.selectVersionForBreakdown') }}</p>
      <template v-else>
        <div v-for="section in genreSections" :key="section.genre" class="flex flex-col gap-2">
          <h3 class="font-bold">{{ section.genre }}</h3>
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th class="th-cell">{{ $t('common.song') }}</th>
                <th class="th-cell">{{ $t('common.difficulty') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in section.rows"
                :key="row.key"
                :class="row.rowCrown !== null ? crownClass(row.rowCrown) : ''"
              >
                <td class="td-cell">
                  <router-link :to="`/songs/${row.hash}`" class="row-link">{{ songTitle(row.title) }}</router-link>
                </td>
                <td class="td-cell">
                  <span class="flex flex-wrap gap-1">
                    <span
                      v-for="badge in row.badges"
                      :key="badge.difficulty"
                      class="rounded px-1.5 py-0.5 text-xs"
                      :class="row.rowCrown === null ? crownClass(badge.crown) : ''"
                    >
                      {{ difficultyLabel(badge.difficulty) }}
                    </span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.crown-clear {
  background-color: rgba(192, 192, 192, 0.35);
}

.crown-fc {
  background-color: rgba(255, 215, 0, 0.35);
}

.crown-dfc {
  background: linear-gradient(
    90deg,
    rgba(255, 0, 0, 0.35),
    rgba(255, 165, 0, 0.35),
    rgba(255, 255, 0, 0.35),
    rgba(0, 255, 0, 0.35),
    rgba(0, 191, 255, 0.35),
    rgba(148, 0, 211, 0.35)
  );
}
</style>
