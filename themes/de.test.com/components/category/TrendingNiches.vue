<template>
  <section aria-labelledby="trending-niches-heading">
    <div class="mb-5 flex items-end justify-between gap-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          High-demand · editor's pick
        </p>
        <h2
          id="trending-niches-heading"
          class="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl dark:text-white"
        >
          Trending Niches
        </h2>
      </div>
    </div>

    <div
      class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6"
      style="grid-auto-rows: minmax(150px, auto)"
    >
      <NuxtLink
        v-for="(item, i) in items"
        :key="item.handle"
        :to="`/category/${item.handle}`"
        :class="[
          'group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-300 ease-smooth',
          'border-ink-200 bg-white hover:-translate-y-1 hover:shadow-card-hover',
          'dark:border-white/5 dark:bg-ink-800/60 dark:hover:border-primary/30',
          layoutClass(i),
        ]"
        @mousemove="onMouseMove"
      >
        <!-- Cursor-follow spotlight -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          :style="spotStyle(i)"
        ></div>

        <!-- Decorative blob -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
          :style="{ background: gradientOf(i) }"
        ></div>

        <div class="relative z-10 p-4 sm:p-5">
          <div
            class="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
            :style="{ background: gradientOf(i) }"
            aria-hidden="true"
            v-html="resolve(item.handle)"
          ></div>

          <h3 class="text-sm font-semibold leading-snug text-ink-900 sm:text-base dark:text-white">
            {{ item.name }}
          </h3>
          <p
            v-if="item.parentName"
            class="mt-1 line-clamp-1 text-xs text-ink-500 dark:text-ink-400"
          >
            in {{ item.parentName }}
          </p>
        </div>

        <div class="relative z-10 flex items-center justify-between px-4 pb-4 sm:px-5 sm:pb-5">
          <span class="text-[11px] font-medium text-ink-400 dark:text-ink-400">
            {{ formatCount(item.toolCount) }} tools
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-full bg-ink-900 px-2.5 py-1 text-[10px] font-semibold text-white transition group-hover:bg-gradient-cta dark:bg-white dark:text-ink-900 dark:group-hover:bg-gradient-cta dark:group-hover:text-white"
          >
            Explore
            <svg viewBox="0 0 24 24" class="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
            </svg>
          </span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup>
import { useCategoryIcon } from '~/composables/useCategoryIcon'

defineProps({
  items: { type: Array, default: () => [] },
})

const { resolve } = useCategoryIcon()

const gradients = [
  'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F472B6 0%, #7C5CFF 100%)',
  'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
  'linear-gradient(135deg, #22C55E 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #F472B6 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
]
const gradientOf = (i) => gradients[i % gradients.length]

// Bento 布局：第 0 个占 2x2 更醒目（仅桌面端）
const layoutClass = (i) => {
  if (i === 0) return 'lg:col-span-2 lg:row-span-2'
  if (i === 1) return 'lg:col-span-2'
  return ''
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

const spotStyle = () => ({
  background:
    'radial-gradient(360px circle at var(--mx, 50%) var(--my, 0%), rgba(124,92,255,0.18), transparent 45%)',
})

const formatCount = (n) => {
  if (!n && n !== 0) return '—'
  if (n < 1000) return String(n)
  return (n / 1000).toFixed(1) + 'k'
}
</script>
