import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useNavUnderline(nav: Ref<HTMLElement | null>, trigger: () => unknown) {
  const left = ref(0)
  const width = ref(0)
  const ready = ref(false)

  async function measure() {
    await nextTick()
    const el = nav.value?.querySelector<HTMLElement>('.nav-active')
    left.value = el?.offsetLeft ?? 0
    width.value = el?.offsetWidth ?? 0
    if (!ready.value) requestAnimationFrame(() => (ready.value = true))
  }

  watch([nav, trigger], measure, { flush: 'post', immediate: true })
  window.addEventListener('resize', measure)
  onBeforeUnmount(() => window.removeEventListener('resize', measure))

  const style = computed(() => ({
    transform: `translateX(${left.value}px)`,
    width: `${width.value}px`,
    transition: ready.value ? 'transform 250ms ease, width 250ms ease' : 'none',
  }))
  return style
}
