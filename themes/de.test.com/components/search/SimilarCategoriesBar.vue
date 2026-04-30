<template>
  <section
    v-if="items && items.length"
    class="rounded-2xl border border-ink-200 bg-white p-6 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="similar-bar-heading"
  >
    <header class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        <h2 id="similar-bar-heading" class="text-base font-semibold text-ink-900 dark:text-white">
          Explore categories
        </h2>
      </div>
      <NuxtLink
        to="/ai-tools"
        class="hidden items-center gap-1 text-xs font-semibold text-primary-600 transition hover:text-primary-700 sm:inline-flex dark:text-accent dark:hover:text-white"
      >
        View all
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </NuxtLink>
    </header>

    <div class="mt-4 -mx-6 overflow-x-auto px-6 scrollbar-hide">
      <div class="flex gap-2.5 whitespace-nowrap pb-1">
        <NuxtLink
          v-for="(cat, i) in items"
          :key="cat.id"
          :to="l2UrlFor(cat)"
          class="group inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-ink-200 bg-gradient-to-br from-ink-50/60 to-white px-3.5 py-2 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm dark:border-white/5 dark:from-white/[0.03] dark:to-white/[0.01] dark:hover:border-primary/40"
        >
          <span
            aria-hidden="true"
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-300 group-hover:scale-110"
            :style="{ background: gradientByKey(`${cat.handle}-${i}`) }"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10l9 4 9-4V7l-9-4-9 4zM12 3v18M3 7l9 4 9-4"/>
            </svg>
          </span>
          <span class="text-xs font-semibold text-ink-800 group-hover:text-primary-600 dark:text-white">
            {{ cat.name }}
          </span>
          <span class="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500 dark:bg-white/5 dark:text-ink-400">
            {{ cat.toolCount }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useGradientPalette } from '~/composables/useGradientPalette'
import { useAppRoutes } from '~/composables/useAppRoutes'

defineProps({
  items: { type: Array, default: () => [] },
})

const { gradientByKey } = useGradientPalette()
const { l2Url } = useAppRoutes()
const l2UrlFor = (cat) => l2Url(cat?.parentHandle || '', cat?.handle)
</script>
