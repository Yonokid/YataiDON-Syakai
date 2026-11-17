<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SegControl from './SegControl.vue'

interface Chart {
  branched: boolean
  notes: [type: number, beat: number, count: number][]
  bars: [beat: number, visible: number][]
  bpm: [beat: number, value: number][]
  scroll: [beat: number, value: number][]
  gogo: [start: number, end: number][]
}

const API_BASE_URL = import.meta.env.NETWORK_URL
const PX = 64
const ROW_BEATS = 8
const LANE = 28
const GAP = 26
const PAD = 8
const EPS = 1e-6
const BIG = new Set([3, 4, 6])
const HEAD_COLOR: Record<number, string> = {
  1: '#f84727',
  2: '#67bfbf',
  3: '#f84727',
  4: '#67bfbf',
  5: '#f8b700',
  6: '#f8b700',
  7: '#ff7700',
  9: '#ff7700',
}
const ROLL_HEADS = new Set([5, 6, 7, 9])
const TAIL = 8

const JUDGE_RING = ['#f8d000', '#d8d8d8', '#2060f0']

const props = defineProps<{ hash: string; scoreId?: number | null }>()
const { t } = useI18n()

const branch = ref<'0' | '1' | '2'>('0')
const branchOptions = computed(() => [
  { value: '0' as const, label: t('chart.normal') },
  { value: '1' as const, label: t('chart.expert') },
  { value: '2' as const, label: t('chart.master') },
])
const chart = ref<Chart | null>(null)
const status = ref<'loading' | 'loaded' | 'error'>('loading')

watch(
  [() => props.hash, branch],
  async ([hash, b]) => {
    status.value = 'loading'
    try {
      const response = await fetch(`${API_BASE_URL}/chart?hash=${encodeURIComponent(hash)}&branch=${b}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        judgeStatus.value = body?.detail === 'No replay recorded' ? 'norecord' : 'error'
        return
      }
      chart.value = await response.json()
      status.value = 'loaded'
    } catch {
      status.value = 'error'
    }
  },
  { immediate: true },
)

const judgments = ref<Map<string, { judgment: number; offset: number | null }>>(new Map())
const judgeCounts = computed(() => [0, 1, 2].map((j) => [...judgments.value.values()].filter((v) => v.judgment === j).length))
const judgeStatus = ref<'idle' | 'loading' | 'error' | 'norecord'>('idle')
const beatKey = (beat: number) => beat.toFixed(3)

watch(
  () => props.scoreId,
  async (id) => {
    judgments.value = new Map()
    if (id == null) return (judgeStatus.value = 'idle')
    judgeStatus.value = 'loading'
    try {
      const response = await fetch(`${API_BASE_URL}/score_judgments?score_id=${id}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        judgeStatus.value = body?.detail === 'No replay recorded' ? 'norecord' : 'error'
        return
      }
      const data: { judgments: [beat: number, judgment: number, offset: number | null][] } = await response.json()
      judgments.value = new Map(data.judgments.map(([beat, judgment, offset]) => [beatKey(beat), { judgment, offset }]))
      judgeStatus.value = 'idle'
    } catch {
      judgeStatus.value = 'error'
    }
  },
  { immediate: true },
)

const round = (v: number) => Number(v.toFixed(2))

function judgmentOf(beat: number) {
  const j = judgments.value.get(beatKey(beat))
  if (!j) return { judgment: undefined, hint: '' }
  const name = t(['scores.good', 'scores.ok', 'scores.bad'][j.judgment]!)
  if (j.offset === null) return { judgment: j.judgment, hint: `${name} · ${t('chart.missed')}` }
  const ms = Math.abs(j.offset)
  if (ms < 0.05) return { judgment: j.judgment, hint: `${name} · ${t('chart.exact')}` }
  return { judgment: j.judgment, hint: `${name} · ${t(j.offset < 0 ? 'chart.early' : 'chart.late', { ms: ms.toFixed(1) })}` }
}

const layout = computed(() => {
  const c = chart.value
  if (!c) return null
  const lastBeat = Math.max(0, ...c.notes.map((n) => n[1]))
  const measures = c.bars.map(([start, visible], i) => {
    const end = c.bars[i + 1]?.[0] ?? Math.max(lastBeat + 1, start + 4)
    return { start, beats: Math.max(end - start, 0), visible: visible === 1, row: 0, x: 0, num: i + 1 }
  })
  const rows: number[] = []
  for (const m of measures) {
    const width = Math.max(m.beats, 0.25)
    if (rows.length === 0 || (rows[rows.length - 1]! > 0 && rows[rows.length - 1]! + width > ROW_BEATS + EPS)) rows.push(0)
    m.row = rows.length - 1
    m.x = PAD + rows[m.row]! * PX
    rows[m.row]! += width
  }
  const rowEnd = (r: number) => PAD + rows[r]! * PX
  const laneTop = (r: number) => PAD + r * (LANE + GAP) + GAP

  function pos(beat: number) {
    let lo = 0
    let hi = measures.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (measures[mid]!.start <= beat + EPS) lo = mid
      else hi = mid - 1
    }
    const m = measures[lo]
    if (!m) return { row: 0, x: PAD + beat * PX }
    return { row: m.row, x: m.x + (beat - m.start) * PX }
  }

  function spans(b0: number, b1: number) {
    const p0 = pos(b0)
    const p1 = pos(b1)
    if (p0.row === p1.row) return [{ row: p0.row, x0: p0.x, x1: p1.x }]
    const out = [{ row: p0.row, x0: p0.x, x1: rowEnd(p0.row) }]
    for (let r = p0.row + 1; r < p1.row; r++) out.push({ row: r, x0: PAD, x1: rowEnd(r) })
    out.push({ row: p1.row, x0: PAD, x1: p1.x })
    return out
  }

  const bodies: { row: number; x0: number; x1: number; color: string; r: number }[] = []
  c.notes.forEach(([type, beat], i) => {
    if (!ROLL_HEADS.has(type)) return
    const tail = c.notes.slice(i + 1).find((n) => n[0] === TAIL)
    if (!tail) return
    for (const s of spans(beat, tail[1])) bodies.push({ ...s, color: HEAD_COLOR[type]!, r: BIG.has(type) ? 11 : 8 })
  })

  const heads = c.notes
    .filter(([type]) => type !== TAIL)
    .map(([type, beat, count]) => ({
      ...pos(beat),
      color: HEAD_COLOR[type] ?? '#888',
      r: BIG.has(type) ? 11 : 8,
      count: type === 7 || type === 9 ? count : 0,
      ...judgmentOf(beat),
    }))
    .reverse()

  const labels = [
    ...c.bpm.map(([beat, v]) => ({ ...pos(beat), text: `${round(v)}`, cls: 'fill-don-dark', dy: 4 })),
    ...c.scroll
      .filter(([, v], i) => i > 0 || v !== 1)
      .map(([beat, v]) => ({ ...pos(beat), text: `HS ${round(v)}`, cls: 'fill-katsu', dy: 11 })),
  ]

  return {
    measures,
    rows: rows.length,
    width: Math.max(...rows.map((_, r) => rowEnd(r))) + PAD,
    height: laneTop(rows.length) - GAP + PAD,
    laneTop,
    gogo: c.gogo.flatMap(([b0, b1]) => spans(b0, b1)),
    bodies,
    heads,
    labels,
  }
})
</script>

<template>
  <section class="card flex flex-col gap-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-lg font-bold">{{ $t('chart.title') }}</h3>
      <SegControl v-if="chart?.branched" v-model="branch" :options="branchOptions" />
    </div>
    <p v-if="scoreId != null && judgeStatus === 'loading'" class="muted text-sm">{{ $t('common.loading') }}</p>
    <p v-else-if="judgeStatus === 'norecord'" class="muted text-sm">{{ $t('chart.noReplay') }}</p>
    <p v-else-if="judgeStatus === 'error'" class="error-text text-sm">{{ $t('chart.judgmentsUnavailable') }}</p>
    <p v-else-if="judgments.size" class="flex flex-wrap gap-3 text-sm">
      <span v-for="(n, j) in judgeCounts" :key="j" class="inline-flex items-center gap-1">
        <svg width="12" height="12" aria-hidden="true">
          <circle cx="6" cy="6" r="5" :fill="JUDGE_RING[j]" stroke="#000" />
        </svg>
        {{ $t(['scores.good', 'scores.ok', 'scores.bad'][j]!) }} {{ n }}
      </span>
    </p>
    <p v-if="status === 'loading' && !chart">{{ $t('common.loading') }}</p>
    <p v-else-if="status === 'error'" class="error-text">{{ $t('chart.unavailable') }}</p>
    <div v-else-if="layout" class="overflow-x-auto">
      <svg
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :style="{ minWidth: `${layout.width}px` }"
        class="w-full font-mono"
        role="img"
        :aria-label="$t('chart.title')"
      >
        <g v-for="m in layout.measures" :key="m.num">
          <rect :x="m.x" :y="layout.laneTop(m.row)" :width="m.beats * PX" :height="LANE" fill="#4a4540" />
          <text :x="m.x + 1" :y="layout.laneTop(m.row) - 18" font-size="8" class="fill-neutral-500">{{ m.num }}</text>
          <line
            v-for="b in Math.max(Math.ceil(m.beats - EPS) - 1, 0)"
            :key="b"
            :x1="m.x + b * PX"
            :x2="m.x + b * PX"
            :y1="layout.laneTop(m.row)"
            :y2="layout.laneTop(m.row) + LANE"
            stroke="#ffffff22"
          />
        </g>
        <rect
          v-for="(g, i) in layout.gogo"
          :key="`g${i}`"
          :x="g.x0"
          :y="layout.laneTop(g.row)"
          :width="Math.max(g.x1 - g.x0, 0)"
          :height="LANE"
          fill="#c0406080"
        />
        <template v-for="m in layout.measures" :key="`b${m.num}`">
          <line
            v-if="m.visible"
            :x1="m.x"
            :x2="m.x"
            :y1="layout.laneTop(m.row)"
            :y2="layout.laneTop(m.row) + LANE"
            stroke="#fff"
          />
        </template>
        <text
          v-for="(l, i) in layout.labels"
          :key="`l${i}`"
          :x="l.x + 1"
          :y="layout.laneTop(l.row) - l.dy"
          font-size="8"
          :class="l.cls"
        >
          {{ l.text }}
        </text>
        <line
          v-for="(b, i) in layout.bodies"
          :key="`r${i}`"
          :x1="b.x0"
          :x2="b.x1"
          :y1="layout.laneTop(b.row) + LANE / 2"
          :y2="layout.laneTop(b.row) + LANE / 2"
          :stroke="b.color"
          :stroke-width="b.r * 2"
          stroke-linecap="round"
        />
        <g v-for="(n, i) in layout.heads" :key="`n${i}`">
          <title v-if="n.hint">{{ n.hint }}</title>
          <circle
            :cx="n.x"
            :cy="layout.laneTop(n.row) + LANE / 2"
            :r="n.judgment === undefined ? n.r + 1.5 : n.r + 3"
            :fill="n.judgment === undefined ? '#fff' : JUDGE_RING[n.judgment]"
            stroke="#000"
          />
          <circle :cx="n.x" :cy="layout.laneTop(n.row) + LANE / 2" :r="n.r" :fill="n.color" />
          <text
            v-if="n.count"
            :x="n.x"
            :y="layout.laneTop(n.row) + LANE / 2 + 3"
            font-size="8"
            text-anchor="middle"
            fill="#fff"
          >
            {{ n.count }}
          </text>
        </g>
        <template v-for="(n, i) in layout.heads" :key="`j${i}`">
          <text
            v-if="n.judgment === 1 || n.judgment === 2"
            :x="n.x"
            :y="layout.laneTop(n.row) - 1"
            font-size="8"
            font-weight="bold"
            text-anchor="middle"
            :fill="JUDGE_RING[n.judgment]"
            stroke="#000"
            stroke-width="2"
            paint-order="stroke"
          >
            {{ n.judgment === 1 ? '可' : '不可' }}
          </text>
        </template>
      </svg>
    </div>
  </section>
</template>
