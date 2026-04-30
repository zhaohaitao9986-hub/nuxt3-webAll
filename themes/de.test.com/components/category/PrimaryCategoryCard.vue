<template>
  <article
    :class="[
      'group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300 ease-smooth',
      'border-ink-200 bg-white hover:-translate-y-0.5 hover:shadow-card-hover',
      'dark:border-white/5 dark:bg-ink-800/60 dark:hover:border-primary/30',
    ]"
    @mousemove="onMouseMove"
  >
    <!-- Cursor-follow spotlight -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      style="
        background: radial-gradient(520px circle at var(--mx, 50%) var(--my, 0%), rgba(124,92,255,0.12), transparent 40%);
      "
    ></div>

    <!-- Header: icon + name + counts -->
    <div class="relative z-10 flex items-start gap-3 p-5 pb-3">
      <span
        aria-hidden="true"
        class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
        :style="{ background: gradient }"
        v-html="icon"
      ></span>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="`/${category.handle}`"
            class="min-w-0 truncate text-base font-semibold text-ink-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-accent"
          >
            {{ category.name }}
          </NuxtLink>
        </div>
        <p class="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
          <span class="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h10M4 18h16"/>
            </svg>
            {{ category.subCount }} sub-categories
          </span>
          <span class="text-ink-300 dark:text-ink-600">·</span>
          <span class="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 2l2.39 4.84L20 8l-4 3.9L17 18l-5-2.6L7 18l1-6.1L4 8l5.61-1.16L12 2z"/>
            </svg>
            {{ formatCount(category.totalTools) }} tools
          </span>
        </p>
      </div>
    </div>

    <!-- Top sub-category pills -->
    <div class="relative z-10 flex flex-wrap gap-1.5 px-5 pb-4">
      <NuxtLink
        v-for="sub in category.topSubs"
        :key="sub.handle"
        :to="`/${category.handle}/${sub.handle}`"
        class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-700 transition hover:border-primary/50 hover:bg-white hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:border-primary/60 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <span class="truncate max-w-[140px]">{{ sub.name }}</span>
        <span
          v-if="sub.toolCount"
          class="rounded-full bg-ink-200/70 px-1.5 py-[1px] text-[9px] font-semibold text-ink-500 dark:bg-white/10 dark:text-ink-300"
        >
          {{ formatCount(sub.toolCount) }}
        </span>
      </NuxtLink>
    </div>

    <!-- Footer CTA -->
    <div class="relative z-10 mt-auto border-t border-ink-100 px-5 py-3 dark:border-white/5">
      <NuxtLink
        :to="`/${category.handle}`"
        class="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition hover:gap-2 dark:text-accent"
      >
        View all {{ category.subCount }} sub-categories
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
        </svg>
      </NuxtLink>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useCategoryIcon } from '~/composables/useCategoryIcon'

const props = defineProps({
  category: { type: Object, required: true },
  colorIndex: { type: Number, default: 0 },
})

const { resolve } = useCategoryIcon()
const icon = computed(() => resolve(props.category.handle || props.category.name))

const gradients = [
  'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F472B6 0%, #7C5CFF 100%)',
  'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
  'linear-gradient(135deg, #22C55E 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #F472B6 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
  'linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%)',
]
const gradient = computed(() => gradients[props.colorIndex % gradients.length])

const formatCount = (n) => {
  if (!n && n !== 0) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k'
  return (n / 1_000_000).toFixed(1) + 'M'
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
</script>
