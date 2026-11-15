<script setup lang="ts">
import { computed, ref } from 'vue'

interface EnsoBattle {
  bond: number
  exp: number
  exp_next: number | null
  best_power: number
  stones: number
  moves: number
  move_cost: number | null
  stage: number
  cleared: number
  orbs: number
  orb_cost: number | null
  bosses: Record<string, { hp: number; max: number }>
}

const ART = `${import.meta.env.BASE_URL}enso_battle`
const EX_STAGE = 11
const MOVE_MAX = 9

// Positions from the skin's chat route (Scripts/song_select/battle_story/chat.lua), shifted up by TOP
const TOP = 424
const NODE_X = [191.5, 373.5, 550.5, 732.5, 904.4]
const SEAL_X = 1108
const ROWS = [
  { stage: 1, bg: 'plains', bonds: [3, 7, 9, 11, 13], top: true, x: 0 },
  { stage: 3, bg: 'rocky', bonds: [16, 18, 20, 22, 24], top: true, x: 2 },
  { stage: 5, bg: 'seaside', bonds: [29, 30, 33, 35, 37], top: true, x: 2 },
  { stage: 7, bg: 'volcano', bonds: [41, 42, 45, 47, 49], top: true, x: 2 },
  { stage: 9, bg: 'lands_end', bonds: [53, 54, 57, 60, 61], top: false, x: 3 },
]

const props = defineProps<{ accessCode: string }>()
const data = ref<EnsoBattle | null>(null)
const failed = ref(false)

fetch(`${import.meta.env.NETWORK_URL}/enso_battle?access_code=${encodeURIComponent(props.accessCode)}`)
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((d: EnsoBattle) => (data.value = d))
  .catch(() => (failed.value = true))

const beaten = (stage: number) => !!data.value && ((data.value.cleared >> stage) & 1) === 1
const reached = (row: number, n: number) => !!data.value && data.value.stage >= row && data.value.bond >= ROWS.find((r) => r.stage === row)!.bonds[n]!
const lastNode = (row: number) => [4, 3, 2, 1, 0].find((n) => reached(row, n)) ?? -1
const currentRow = computed(() => (data.value ? Math.min(9, data.value.stage - ((data.value.stage + 1) % 2)) : 0))
const pct = (n: number, d: number) => Math.min(1, n / d)
</script>

<template>
  <div class="flex w-full max-w-5xl flex-col gap-4">
    <h1 class="text-2xl font-bold tracking-tight">{{ $t('ensoBattle.title') }}</h1>
    <p v-if="failed" class="error-text text-sm">{{ $t('ensoBattle.loadError') }}</p>
    <p v-else-if="!data" class="muted text-sm">…</p>
    <template v-else>
      <section class="card flex flex-col gap-3">
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt class="muted text-sm">{{ $t('ensoBattle.bond') }}</dt>
            <dd class="text-xl font-semibold tabular-nums">{{ data.bond }}</dd>
          </div>
          <div>
            <dt class="muted text-sm">{{ $t('ensoBattle.stage') }}</dt>
            <dd class="text-xl font-semibold tabular-nums">{{ data.stage === EX_STAGE ? 'EX' : data.stage }}</dd>
          </div>
          <div>
            <dt class="muted text-sm">{{ $t('ensoBattle.bestPower') }}</dt>
            <dd class="text-xl font-semibold tabular-nums">{{ data.best_power.toLocaleString() }}</dd>
          </div>
          <div>
            <dt class="muted text-sm">{{ $t('ensoBattle.moves') }}</dt>
            <dd class="text-xl font-semibold tabular-nums">{{ data.moves }} / {{ MOVE_MAX }}</dd>
          </div>
          <div>
            <dt class="muted text-sm">{{ $t('ensoBattle.stones') }}</dt>
            <dd class="text-xl font-semibold tabular-nums">
              {{ data.stones }}<span v-if="data.move_cost !== null" class="muted text-sm"> / {{ data.move_cost }}</span>
            </dd>
          </div>
          <div v-if="data.orb_cost !== null">
            <dt class="muted text-sm">{{ $t('ensoBattle.orbs') }}</dt>
            <dd class="text-xl font-semibold tabular-nums">
              {{ data.orbs }}<span class="muted text-sm"> / {{ data.orb_cost }}</span>
            </dd>
          </div>
        </dl>
        <div v-if="data.exp_next !== null">
          <p class="muted mb-1 text-xs">{{ $t('ensoBattle.exp', { exp: data.exp, next: data.exp_next }) }}</p>
          <div class="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div class="h-2 rounded-full bg-don" :style="{ width: `${pct(data.exp, data.exp_next) * 100}%` }" />
          </div>
        </div>
      </section>

      <section class="map overflow-hidden rounded-lg">
        <svg
          v-for="row in ROWS"
          :key="row.stage"
          viewBox="0 0 1280 270"
          class="block w-full"
          :class="{ locked: data.stage < row.stage }"
          role="img"
          :aria-label="`${$t('ensoBattle.stage')} ${row.stage}: ${$t('ensoBattle.stages.' + row.stage)}`"
        >
          <defs>
            <clipPath :id="`reached-${row.stage}`">
              <rect x="0" y="0" :width="lastNode(row.stage) < 0 ? 0 : NODE_X[lastNode(row.stage)]! + 90" height="270" />
            </clipPath>
          </defs>
          <image :href="`${ART}/stage_${row.bg}.jpg`" width="1280" height="270" preserveAspectRatio="xMidYMax slice" />
          <rect width="1280" height="270" fill="black" opacity="0.25" />
          <image :href="`${ART}/${row.stage === 9 ? 'route_path_final' : 'route_path'}.png`" y="86" />
          <image :href="`${ART}/route_islands_${row.stage}.png`" :x="row.x" :y="row.stage === 9 ? 50 : 86" opacity="0.35" />
          <g :clip-path="`url(#reached-${row.stage})`">
            <image :href="`${ART}/route_islands_${row.stage}.png`" :x="row.x" :y="row.stage === 9 ? 50 : 86" />
            <image v-if="row.top" :href="`${ART}/route_islands_top_${row.stage}.png`" :x="row.stage === 1 ? 0 : 3" y="86" />
          </g>
          <text x="24" y="40" class="label" font-size="28">
            {{ $t('ensoBattle.stage') }} {{ row.stage }} · {{ $t('ensoBattle.stages.' + row.stage) }}
          </text>
          <text
            v-for="(x, n) in NODE_X"
            :key="n"
            :x="x"
            y="242"
            class="label"
            font-size="18"
            text-anchor="middle"
            :opacity="reached(row.stage, n) ? 1 : 0.5"
          >
            {{ reached(row.stage, n) ? ($te(`ensoBattle.nodes.${row.stage}_${n + 1}`) ? $t(`ensoBattle.nodes.${row.stage}_${n + 1}`) : `${row.stage}-${n + 1}`) : `Lv ${row.bonds[n]}` }}
          </text>

          <g :opacity="beaten(row.stage + 1) ? 0.35 : data.stage > row.stage ? 1 : 0.6">
            <image :href="`${ART}/route_seal.png`" :x="SEAL_X - 90" :y="133 - 85" width="180" height="170" />
          </g>
          <text :x="SEAL_X" y="242" class="label" font-size="18" text-anchor="middle">
            {{ row.stage + 1 }} · {{ $t('ensoBattle.stages.' + (row.stage + 1)) }}
          </text>
          <text v-if="beaten(row.stage + 1)" :x="SEAL_X" y="140" class="label defeated" font-size="30" text-anchor="middle">
            {{ $t('ensoBattle.defeated') }}
          </text>
          <g v-else-if="data.stage > row.stage">
            <rect :x="SEAL_X - 80" y="254" width="160" height="10" rx="5" fill="#000" opacity="0.6" />
            <rect
              :x="SEAL_X - 80"
              y="254"
              :width="160 * pct(data.bosses[row.stage + 1]!.hp, data.bosses[row.stage + 1]!.max)"
              height="10"
              rx="5"
              fill="#ef4444"
            >
              <title>{{ data.bosses[row.stage + 1]!.hp.toLocaleString() }} / {{ data.bosses[row.stage + 1]!.max.toLocaleString() }}</title>
            </rect>
          </g>

          <g v-if="currentRow === row.stage && data.stage < EX_STAGE">
            <image
              :href="`${ART}/route_ring.png`"
              :x="(data.stage > row.stage ? SEAL_X : NODE_X[Math.max(0, lastNode(row.stage))]!) - 92"
              :y="169.5 - 84"
            />
            <image
              :href="`${ART}/${row.stage === 9 ? 'route_marker_final' : 'route_marker'}.png`"
              class="bob"
              :x="(data.stage > row.stage ? SEAL_X : NODE_X[Math.max(0, lastNode(row.stage))]!) - 92"
              :y="145 - 84"
            />
          </g>
        </svg>

        <svg
          viewBox="0 0 1280 270"
          class="block w-full"
          :class="{ locked: !beaten(10) }"
          role="img"
          :aria-label="`EX: ${$t('ensoBattle.stages.11')}`"
        >
          <image :href="`${ART}/stage_maou.jpg`" width="1280" height="270" preserveAspectRatio="xMidYMid slice" />
          <rect width="1280" height="270" fill="black" opacity="0.25" />
          <text x="24" y="40" class="label" font-size="28">EX · {{ $t('ensoBattle.stages.11') }}</text>
          <image :href="`${ART}/maou_plate.png`" x="540" y="40" width="200" height="200" :opacity="beaten(EX_STAGE) ? 0.35 : 1" />
          <text v-if="beaten(EX_STAGE)" x="640" y="148" class="label defeated" font-size="30" text-anchor="middle">
            {{ $t('ensoBattle.defeated') }}
          </text>
          <text v-else-if="data.stage < EX_STAGE && beaten(10)" x="640" y="254" class="label" font-size="18" text-anchor="middle">
            {{ $t('ensoBattle.orbsNeeded') }}
          </text>
          <g v-else-if="data.stage === EX_STAGE">
            <rect x="560" y="246" width="160" height="10" rx="5" fill="#000" opacity="0.6" />
            <rect x="560" y="246" :width="160 * pct(data.bosses[EX_STAGE]!.hp, data.bosses[EX_STAGE]!.max)" height="10" rx="5" fill="#ef4444">
              <title>{{ data.bosses[EX_STAGE]!.hp.toLocaleString() }} / {{ data.bosses[EX_STAGE]!.max.toLocaleString() }}</title>
            </rect>
            <image :href="`${ART}/route_marker_final.png`" class="bob" x="760" y="60" />
          </g>
        </svg>
      </section>
    </template>
  </div>
</template>

<style scoped>
.map {
  background: #000;
}
.label {
  fill: #fff;
  stroke: #000;
  stroke-width: 5px;
  stroke-linejoin: round;
  paint-order: stroke;
  font-weight: 700;
}
.defeated {
  fill: #e2ff40;
}
.locked {
  filter: grayscale(1) brightness(0.6);
}
.bob {
  animation: bob 1s ease-in-out infinite alternate;
}
@keyframes bob {
  to {
    transform: translateY(-9px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .bob {
    animation: none;
  }
}
</style>
