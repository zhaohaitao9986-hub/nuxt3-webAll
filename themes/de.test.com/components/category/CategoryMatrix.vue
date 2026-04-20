<template>
  <section aria-labelledby="matrix-heading">
    <div class="mb-5 flex items-end justify-between gap-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.2em] text-signal">
          The full atlas
        </p>
        <h2
          id="matrix-heading"
          class="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl dark:text-white"
        >
          Browse all {{ categories.length }} category families
        </h2>
        <p class="mt-1 max-w-xl text-sm text-ink-500 dark:text-ink-300">
          Every top-level category with the 6 hottest sub-categories surfaced inside.
          Click a pill to jump straight to its landing page.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <template v-for="item in visibleItems" :key="item.key">
        <CategoryAdCard
          v-if="item.type === 'ad'"
          :class="[item.mobileHidden ? 'hidden md:flex' : '']"
          :slot-id="item.slotId"
        />
        <PrimaryCategoryCard
          v-else
          :class="[item.mobileHidden ? 'hidden md:flex' : '']"
          :category="item.data"
          :color-index="item.colorIndex"
        />
      </template>
    </div>

    <!-- Mobile progressive disclosure (only shown on < md) -->
    <div
      v-if="remaining > 0"
      class="mt-6 flex justify-center md:hidden"
    >
      <button
        type="button"
        class="btn-shine inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
        @click="expanded = true"
        @mousemove="onMouseMove"
      >
        <span v-if="!expanded">Load {{ remaining }} more categories</span>
        <span v-else>All categories loaded</span>
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
        </svg>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import PrimaryCategoryCard from './PrimaryCategoryCard.vue'
import CategoryAdCard from './CategoryAdCard.vue'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  adAfter: { type: Array, default: () => [5, 11, 17] },
  mobileInitial: { type: Number, default: 5 },
})

const expanded = ref(false)

// ----- 构造包含广告占位的完整列表 -----
// 为避免 SSR / Client hydration mismatch，始终渲染全部节点，
// 通过 "hidden md:flex" 让桌面端始终展示，移动端根据 expanded 控制。
const visibleItems = computed(() => {
  const list = []
  let cardIdx = 0

  props.categories.forEach((cat, idx) => {
    cardIdx++
    const mobileHidden = !expanded.value && cardIdx > props.mobileInitial
    list.push({
      key: `l1-${cat.id}`,
      type: 'card',
      data: cat,
      colorIndex: idx,
      mobileHidden,
    })
    if (props.adAfter.includes(idx + 1)) {
      list.push({
        key: `ad-after-${idx + 1}`,
        type: 'ad',
        slotId: `category-matrix-${idx + 1}`,
        // 广告也按 card 计数位置决定是否隐藏
        mobileHidden: !expanded.value && cardIdx > props.mobileInitial,
      })
    }
  })

  return list
})

const remaining = computed(() => {
  if (expanded.value) return 0
  return Math.max(0, props.categories.length - props.mobileInitial)
})

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
</script>
