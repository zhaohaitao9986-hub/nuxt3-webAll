<template>
  <section
    v-if="items && items.length"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="similar-cats-heading"
  >
    <header class="flex items-end justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        <h2 id="similar-cats-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
          Explore similar categories
        </h2>
      </div>
      <NuxtLink
        to="/ai-tools"
        class="hidden items-center gap-1 text-xs font-semibold text-primary-600 transition hover:text-primary-700 sm:inline-flex dark:text-accent dark:hover:text-white"
      >
        All categories
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </NuxtLink>
    </header>

    <div class="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
      <NuxtLink
        v-for="(cat, i) in items"
        :key="cat.id"
        :to="`/category/${cat.handle}`"
        class="group relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-ink-200 bg-gradient-to-br from-ink-50/60 to-white px-3 py-2.5 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm dark:border-white/5 dark:from-white/[0.03] dark:to-white/[0.01] dark:hover:border-primary/40"
      >
        <span
          aria-hidden="true"
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-300 group-hover:scale-110"
          :style="{ background: gradientByKey(`${cat.handle}-${i}`) }"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10l9 4 9-4V7l-9-4-9 4zM12 3v18M3 7l9 4 9-4"/>
          </svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold text-ink-800 group-hover:text-primary-600 dark:text-white dark:group-hover:text-white">
            {{ cat.name }}
          </span>
          <span class="block text-[11px] text-ink-400 dark:text-ink-500">
            {{ cat.toolCount }} tools
          </span>
        </span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup>
import { useGradientPalette } from '~/composables/useGradientPalette'

defineProps({
  items: { type: Array, default: () => [] },
})

const { gradientByKey } = useGradientPalette()
</script>
