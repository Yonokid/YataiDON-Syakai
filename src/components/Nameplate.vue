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

// The client's dan_emblem sheet is 2 columns x 13 rows of 64x32 frames; frame = dan index.
const hasDan = computed(() => typeof props.dan === 'number' && props.dan >= 0 && props.dan <= 24)
const danEmblemStyle = computed(() => {
  if (!hasDan.value) return undefined
  const frame = props.dan as number
  const sheet = props.gold ? 'dan_emblem_gold' : 'dan_emblem'
  return {
    backgroundImage: `url(${import.meta.env.BASE_URL}nameplates/${sheet}.png)`,
    backgroundPosition: `${(frame % 2) * 100}% ${(Math.floor(frame / 2) / 12) * 100}%`,
  }
})
</script>

<template>
  <div class="nameplate">
    <div class="nameplate-frame" :style="{ backgroundImage: `url(${plateUrl})` }">
      <div v-if="hasDan" class="nameplate-dan" aria-hidden="true" />
      <div v-if="hasDan" class="nameplate-dan-emblem" :style="danEmblemStyle" aria-hidden="true" />
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
  width: min(90vw, 480px);
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
  height: 45.3%;
  width: 32%;
  background: #000;
}

.nameplate-dan-emblem {
  position: absolute;
  left: 15.7%;
  top: 46.9%;
  height: 50%;
  aspect-ratio: 2;
  background-repeat: no-repeat;
  background-size: 200% 1300%;
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
