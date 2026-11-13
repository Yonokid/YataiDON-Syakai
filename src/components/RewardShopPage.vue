<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface Good {
  type: number
  id: number
  cost: number
  owned: boolean
  name?: string
}

const API_BASE_URL = import.meta.env.NETWORK_URL
const BASE = import.meta.env.BASE_URL
const ART = `${BASE}reward_shop`
const COSTUMES = `${BASE}costumes`

const TILE_X = [340, 460, 580, 700, 820, 940]
const TILE_Y = [208, 338, 502]
// Costume, head, body, puchichara -> tile and label frame; titles have no art and borrow frame 0.
const FRAME: Record<number, number> = { 2: 0, 3: 1, 4: 2, 5: 3 }
const ICON_DIR: Record<number, string> = { 2: 'costume_icon', 3: 'costume_head_icon', 4: 'costume_body_icon', 5: 'acce' }
const NAME_KEY: Record<number, string> = { 2: 'costume', 3: 'head', 4: 'body', 5: 'puchichara' }

const props = defineProps<{ accessCode: string }>()

const goods = ref<Good[]>([])
const medals = ref(0)
const max = ref(0)
const names = ref<Record<string, Record<string, { name: string | null }>>>({})
const status = ref<'loading' | 'loaded' | 'error'>('loading')
const cursor = ref(0)
const open = ref(false)
const busy = ref(false)
const error = ref('')

// The art's seasons: 1 spring to 4 winter
const month = new Date().getMonth() + 1
const season = month >= 3 && month <= 5 ? 1 : month >= 6 && month <= 8 ? 2 : month >= 9 && month <= 11 ? 3 : 4

const selected = computed(() => goods.value[cursor.value - 1] as Good | undefined)

const stage = ref<HTMLElement | null>(null)
const scale = ref(1)
let observer: ResizeObserver | undefined

function nameOf(g: Good) {
  return g.name ?? names.value[NAME_KEY[g.type] ?? '']?.[g.id]?.name ?? `#${g.id}`
}
const tileFrame = (g: Good) => FRAME[g.type] ?? 0
const cursorPos = computed(() => slot(cursor.value))
const slot = (i: number) => ({ x: TILE_X[i % 6] ?? 0, y: TILE_Y[Math.floor(i / 6)] ?? 0 })
const at = (x: number, y: number) => ({ left: `${x}px`, top: `${y}px` })

function pick(i: number) {
  if (busy.value) return
  cursor.value = i
  error.value = ''
  open.value = true
}

function close() {
  if (!busy.value) open.value = false
}

async function buy() {
  const g = selected.value
  if (!g || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await fetch(
      `${API_BASE_URL}/reward_shop/web_buy?access_code=${encodeURIComponent(props.accessCode)}&type=${g.type}&item_id=${g.id}`,
      { method: 'POST' },
    )
    if (res.ok) {
      medals.value = (await res.json()).medals
      g.owned = true
      open.value = false
      return
    }
    const detail = (await res.json().catch(() => ({}))).detail
    if (detail === 'already') g.owned = true
    error.value = detail === 'already' || detail === 'shortage' ? detail : 'failed'
    if (detail === 'lineup') {
      open.value = false
      await load()
    }
  } catch {
    error.value = 'failed'
  } finally {
    busy.value = false
  }
}

async function load() {
  const res = await fetch(`${API_BASE_URL}/reward_shop?access_code=${encodeURIComponent(props.accessCode)}`)
  if (!res.ok) throw new Error(`Unexpected status ${res.status}`)
  const data = await res.json()
  goods.value = data.goods
  medals.value = data.medals
  max.value = data.max
  cursor.value = 0
}

function fit() {
  if (stage.value) scale.value = stage.value.clientWidth / 1000
}

onMounted(async () => {
  fit()
  observer = new ResizeObserver(fit)
  if (stage.value) observer.observe(stage.value)
  try {
    const [, n] = await Promise.all([
      load(),
      fetch(`${COSTUMES}/costume_names.json`).then((r) => r.json()),
    ])
    names.value = n
    status.value = 'loaded'
  } catch {
    status.value = 'error'
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="flex w-full max-w-5xl flex-col gap-3">
    <h1 class="text-2xl font-bold tracking-tight">{{ $t('rewardShop.title') }}</h1>
    <p class="muted text-sm">{{ $t('rewardShop.hint') }}</p>
    <p v-if="status === 'error'" class="error-text">{{ $t('rewardShop.loadError') }}</p>

    <div ref="stage" class="relative w-full overflow-hidden" :style="{ height: `${620 * scale}px` }">
      <div class="shop origin-top-left" :style="{ transform: `scale(${scale}) translateX(-136px)` }">
        <img :src="`${ART}/season_bg/${season}.png`" alt="" class="mid" :style="at(636, 310)" />

        <template v-if="status === 'loaded'">
          <img :src="`${ART}/chip_cosmetic.png`" alt="" class="mid" :style="at(350, 141)" />

          <button
            v-for="(g, i) in goods"
            :key="`${g.type}:${g.id}`"
            class="tile mid"
            :style="at(slot(i + 1).x, slot(i + 1).y)"
            :aria-label="nameOf(g)"
            @click="pick(i + 1)"
          >
            <img :src="`${ART}/tile/${tileFrame(g)}.png`" alt="" />
            <span v-if="g.type === 6" class="tag">{{ $t('rewardShop.titleTag') }}</span>
            <template v-else>
              <span class="icon" :class="{ two: g.type === 5 }">
                <img :src="`${COSTUMES}/${ICON_DIR[g.type]}/${g.id}.png`" alt="" />
              </span>
              <img :src="`${ART}/label/${tileFrame(g)}.png`" alt="" class="label" />
            </template>
            <img :src="`${ART}/coin.png`" alt="" class="cost-coin" />
            <span class="cost">{{ g.cost }}</span>
            <img v-if="g.owned" :src="`${ART}/check_1p.png`" alt="" class="check" />
          </button>

          <div v-if="cursor > 0" class="cursor mid" :style="at(cursorPos.x, cursorPos.y)" />

        </template>
      </div>
    </div>
    <Transition name="pop">
    <div
      v-if="open && selected"
      class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="pop-card card rounded-2xl flex w-full max-w-xs flex-col items-center gap-3 text-center" role="dialog" aria-modal="true">
        <div class="preview" :class="{ two: selected.type === 5 }">
          <span v-if="selected.type === 6" class="text-lg font-bold">{{ $t('rewardShop.titleTag') }}</span>
          <img v-else :src="`${COSTUMES}/${ICON_DIR[selected.type]}/${selected.id}.png`" alt="" />
        </div>
        <p class="text-lg font-semibold">{{ nameOf(selected) }}</p>
        <p class="flex items-center gap-1.5 font-semibold">
          <img :src="`${ART}/coin.png`" alt="" class="h-6 w-6" />{{ selected.cost }}
          <span class="muted text-sm font-normal">/ {{ $t('rewardShop.have', { medals }) }}</span>
        </p>
        <p v-if="selected.owned" class="text-sm text-green-700 dark:text-green-400">{{ $t('rewardShop.owned') }}</p>
        <p v-else-if="medals < selected.cost" class="error-text text-sm">{{ $t('rewardShop.shortage') }}</p>
        <p v-if="error === 'failed'" class="error-text text-sm">{{ $t('rewardShop.failed') }}</p>
        <div class="flex gap-2">
          <button type="button" class="btn" :disabled="busy" @click="close">{{ $t('rewardShop.close') }}</button>
          <button
            v-if="!selected.owned"
            type="button"
            class="btn btn-primary"
            :disabled="busy || medals < selected.cost"
            @click="buy"
          >
            {{ $t('rewardShop.buy') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
    <p v-if="status === 'loaded'" class="muted text-sm">
      <span v-if="selected" class="font-semibold">{{ nameOf(selected) }} · </span>{{ $t('rewardShop.balance', { medals, max }) }}
    </p>
  </div>
</template>

<style scoped>
.shop {
  position: absolute;
  left: 0;
  top: 0;
  width: 1280px;
  height: 620px;
  font-family: inherit;
}
.mid {
  position: absolute;
  transform: translate(-50%, -50%);
}
.tile {
  cursor: pointer;
  width: 100px;
  height: 100px;
  padding: 0;
  border: 0;
  background: none;
}
.tile > img:first-child {
  display: block;
  width: 100px;
  height: 100px;
}
.tile > *:not(:first-child) {
  position: absolute;
}
.icon {
  left: 10px;
  top: 4px;
  width: 80px;
  height: 80px;
  overflow: hidden;
}
.icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* acce sheets hold two frames stacked; show the first */
.icon.two img {
  height: 200%;
  object-fit: cover;
  object-position: top;
}
.label {
  left: 0;
  top: 60px;
  width: 100px;
}
.tag {
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  -webkit-text-stroke: 4px #000;
  paint-order: stroke fill;
}
.cost-coin {
  left: 5px;
  top: -26px;
  width: 30px;
}
.cost {
  left: 32px;
  top: -26px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  line-height: 30px;
  -webkit-text-stroke: 3px #000;
  paint-order: stroke fill;
}
.check {
  left: 0;
  top: 82px;
}
.cursor {
  width: 100px;
  height: 100px;
  border: 4px solid #ff5a3c;
  border-radius: 12px;
  box-shadow: 0 0 14px #ff5a3c;
  pointer-events: none;
  box-sizing: border-box;
  animation: pulse 1s ease-in-out infinite alternate;
}
@keyframes pulse {
  to {
    box-shadow: 0 0 4px #ff5a3c;
  }
}
.preview {
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  overflow: hidden;
}
.preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.preview.two img {
  height: 200%;
  object-fit: cover;
  object-position: top;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.18s ease-out;
}
.pop-enter-active .pop-card,
.pop-leave-active .pop-card {
  transition: transform 0.18s ease-out;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
.pop-enter-from .pop-card,
.pop-leave-to .pop-card {
  transform: translateY(12px) scale(0.95);
}
@media (prefers-reduced-motion: reduce) {
  .pop-enter-active,
  .pop-leave-active,
  .pop-enter-active .pop-card,
  .pop-leave-active .pop-card {
    transition: none;
  }
}
</style>
