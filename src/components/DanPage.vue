<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSongDisplay } from '../composables/useSongDisplay'
import danData from '../data/dan_courses.json'

type ExamValue = number[] | (number[] | null)[]

interface DanExam {
  type: string
  range: string
  value: ExamValue
}

interface DanChart {
  title: string
  subtitle?: string
  difficulty: number
}

interface DanCourse {
  path: string
  title: string
  color: number
  charts: DanChart[]
  exams: DanExam[]
  gen3?: boolean
}

const courses = danData as unknown as DanCourse[]
const { t } = useI18n()
const { difficultyLabel } = useSongDisplay()

const EXAM_LABEL_KEYS: Record<string, string> = {
  gauge: 'dans.examTypes.gauge',
  judgeperfect: 'dans.examTypes.judgeperfect',
  judgegood: 'dans.examTypes.judgegood',
  judgebad: 'dans.examTypes.judgebad',
  hit: 'dans.examTypes.hit',
  combo: 'dans.examTypes.combo',
  score: 'dans.examTypes.score',
  renda: 'dans.examTypes.renda',
}
const search = ref('')
const selectedVersion = ref('all')

function versionOf(path: string) {
  const version = path.split('/')[1]
  return version ? version.replace(/^\d+\s+/, '') : path
}

function courseIndex(path: string) {
  return path.split('/').at(-2)?.match(/^\d+/)?.[0] ?? ''
}

const versions = [...new Set(courses.map((course) => versionOf(course.path)))]

const filteredCourses = computed(() => {
  const term = search.value.trim().toLowerCase()
  return courses.filter((course) => {
    if (selectedVersion.value !== 'all' && versionOf(course.path) !== selectedVersion.value) return false
    if (!term) return true
    return (
      course.title.toLowerCase().includes(term) ||
      course.charts.some(
        (chart) =>
          chart.title.toLowerCase().includes(term) ||
          (chart.subtitle ?? '').toLowerCase().includes(term),
      )
    )
  })
})

const groupedCourses = computed(() => {
  const groups = new Map<string, DanCourse[]>()
  for (const course of filteredCourses.value) {
    const version = versionOf(course.path)
    const list = groups.get(version)
    if (list) list.push(course)
    else groups.set(version, [course])
  }
  return [...groups.entries()].map(([version, items]) => ({ version, items }))
})

function examLabel(type: string) {
  const key = EXAM_LABEL_KEYS[type]
  return key ? t(key) : type
}

function formatBorder(border: unknown, range: string) {
  if (!Array.isArray(border) || border.length === 0) return '—'
  const red = typeof border[0] === 'number' ? border[0] : 0
  const gold = border.length > 1 && typeof border[1] === 'number' ? border[1] : null
  const operator = range === 'less' ? '≤' : '≥'
  const goldText = gold !== null && gold !== red && gold !== -1 ? ` / ${gold}` : ''
  return `${operator} ${red}${goldText}`
}

function examValue(exam: DanExam) {
  if (!Array.isArray(exam.value)) return '—'
  if (exam.value.some((value) => Array.isArray(value) || value === null)) {
    return exam.value
      .map((value, index) => `${index + 1}: ${formatBorder(value, exam.range)}`)
      .join(' · ')
  }
  return formatBorder(exam.value, exam.range)
}
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col items-center gap-3">
    <h1 class="text-xl font-bold">{{ $t('dans.title') }}</h1>

    <div class="flex w-full flex-col items-center gap-3">
      <div class="flex w-full flex-wrap justify-center gap-2">
        <input v-model="search" type="text" :placeholder="$t('dans.searchPlaceholder')" class="field min-w-56 flex-1" />
        <select v-model="selectedVersion" class="field" :aria-label="$t('dans.allVersions')">
          <option value="all">{{ $t('dans.allVersions') }}</option>
          <option v-for="version in versions" :key="version" :value="version">
            {{ version }}
          </option>
        </select>
      </div>

      <p class="muted text-xs">
        {{ t('dans.countShown', { shown: filteredCourses.length, total: courses.length }) }}
      </p>
      <p v-if="filteredCourses.length === 0" class="muted">{{ $t('dans.noCourses') }}</p>

      <div v-else class="flex w-full flex-col gap-4">
        <section v-for="group in groupedCourses" :key="group.version" class="flex flex-col gap-2">
          <h2 class="text-left text-sm font-semibold">{{ group.version }}</h2>

          <details
            v-for="course in group.items"
            :key="course.path"
            class="rounded-md border border-neutral-300 p-3 text-left dark:border-neutral-700"
          >
            <summary class="cursor-pointer">
              <span class="flex flex-wrap items-center gap-2">
                <span class="muted text-xs">#{{ courseIndex(course.path) }}</span>
                <span class="font-semibold">{{ course.title }}</span>
                <span class="muted text-xs">{{ t('dans.songCount', { n: course.charts.length }) }}</span>
                <span v-if="course.gen3" class="rounded-full bg-neutral-200 px-2 py-0.5 text-xs dark:bg-neutral-700">
                  {{ $t('dans.gen3') }}
                </span>
              </span>
            </summary>

            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <h3 class="mb-1 text-sm font-medium">{{ $t('dans.songs') }}</h3>
                <ol class="ml-4 list-decimal text-sm">
                  <li v-for="(chart, index) in course.charts" :key="index" class="mb-1">
                    <span>{{ chart.title || $t('common.untitled') }}</span>
                    <span v-if="chart.subtitle" class="muted"> — {{ chart.subtitle }}</span>
                    <span class="muted ml-1 text-xs">({{ difficultyLabel(chart.difficulty) }})</span>
                  </li>
                </ol>
              </div>

              <div>
                <h3 class="mb-1 text-sm font-medium">{{ $t('dans.exams') }}</h3>
                <ul class="flex flex-col gap-1 text-sm">
                  <li v-for="(exam, index) in course.exams" :key="index" class="break-words">
                    <span class="font-medium">{{ examLabel(exam.type) }}</span>
                    <span class="muted"> {{ examValue(exam) }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>
  </div>
</template>
