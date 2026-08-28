<script setup lang="ts">
export type NameplateColor = 'red' | 'blue' | 'wood' | 'rainbow' | 'gold' | 'purple'

const props = withDefaults(defineProps<{ username: string; color?: NameplateColor; title?: string }>(), {
  color: 'red',
})

const plateUrl = `${import.meta.env.BASE_URL}nameplates/${props.color}.png`
</script>

<template>
  <div class="nameplate">
    <div class="nameplate-frame" :style="{ backgroundImage: `url(${plateUrl})` }">
      <div class="nameplate-half">
        <span class="nameplate-title">{{ title }}</span>
      </div>
      <div class="nameplate-half">
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
  padding: 4% 8%;
  box-sizing: border-box;
}

.nameplate-half {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.nameplate-title {
  font-size: clamp(0.65rem, 2.2vw, 0.9rem);
  font-weight: 600;
  color: #4a2f1c;
  line-height: 1;
}

.nameplate-username {
  font-size: clamp(0.9rem, 3.2vw, 1.35rem);
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
