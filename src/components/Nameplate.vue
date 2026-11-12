<script setup lang="ts">
import { computed } from 'vue'

export type NameplateColor = 'red' | 'blue' | 'wood' | 'rainbow' | 'gold' | 'purple'

const props = withDefaults(
  defineProps<{ username: string; color?: NameplateColor; title?: string; dan?: number | null; gold?: boolean }>(),
  {
    color: 'red',
    dan: null,
    gold: false,
  },
)

const plateUrl = computed(() => `${import.meta.env.BASE_URL}nameplates/${props.color}.png`)

// Same order as the client's dan ranks (0 = 初級 … 24 = 達人).
const DAN_NAMES = [
  '初級',
  '十級',
  '九級',
  '八級',
  '七級',
  '六級',
  '五級',
  '四級',
  '三級',
  '二級',
  '一級',
  '初段',
  '二段',
  '三段',
  '四段',
  '五段',
  '六段',
  '七段',
  '八段',
  '九段',
  '十段',
  '玄人',
  '名人',
  '超人',
  '達人',
]

const hasDan = computed(() => typeof props.dan === 'number' && props.dan >= 0 && props.dan < DAN_NAMES.length)
const danName = computed(() => (hasDan.value ? DAN_NAMES[props.dan as number] : ''))
</script>

<template>
  <div class="nameplate">
    <div class="nameplate-frame" :style="{ backgroundImage: `url(${plateUrl})` }">
      <div v-if="hasDan" class="nameplate-dan">
        <span class="nameplate-dan-label" :class="{ 'nameplate-dan-gold': gold }">{{ danName }}</span>
      </div>
      <div class="nameplate-half">
        <span class="nameplate-title">{{ title }}</span>
      </div>
      <div class="nameplate-half" :class="{ 'nameplate-name-dan': hasDan }">
        <span class="nameplate-username">{{ username }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nameplate {
  font-family: 'Kanteiryu', 'Noto Sans JP', system-ui, sans-serif;
  width: min(100%, 480px);
  position: relative;
}

.nameplate::before {
  content: '';
  display: block;
  padding-top: calc(90 / 556 * 100%);
}

.nameplate-frame {
  position: absolute;
  inset: 0;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
  padding: 0 8%;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 999px;
}

.nameplate-dan {
  position: absolute;
  left: 0;
  top: 46.9%;
  height: 49.5%;
  width: 32%;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nameplate-dan-label {
  font-size: clamp(0.85rem, 2.9vw, 1.25rem);
  font-weight: 700;
  line-height: 1;
  color: #fff;
}

.nameplate-dan-gold {
  color: #efcf39;
}

.nameplate-half {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.nameplate-name-dan {
  padding-left: 30%;
}

.nameplate-title,
.nameplate-username {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nameplate-title {
  font-size: clamp(0.9rem, 3vw, 1.3rem);
  font-weight: 600;
  color: #4a2f1c;
  line-height: 1;
}

.nameplate-username {
  font-size: clamp(1.05rem, 3.8vw, 1.6rem);
  font-weight: 700;
  color: #2b1a0e;
  line-height: 1;
  text-shadow:
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff;
}
</style>
