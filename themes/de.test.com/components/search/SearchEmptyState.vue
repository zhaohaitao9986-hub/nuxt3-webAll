<template>
  <section aria-labelledby="empty-heading" class="space-y-6">
    <!-- Empty message card -->
    <div
      v-if="query"
      class="relative overflow-hidden rounded-2xl border border-dashed border-ink-200 bg-gradient-to-br from-ink-50/60 to-white p-8 text-center dark:border-white/10 dark:from-white/[0.03] dark:to-white/[0.01]"
    >
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style="background: radial-gradient(circle, rgba(124,92,255,0.35), transparent 70%);"
      ></div>

      <div class="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-cta shadow-glow">
        <svg viewBox="0 0 24 24" class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/>
          <path stroke-linecap="round" d="M21 21l-4.3-4.3"/>
        </svg>
      </div>

      <h2 id="empty-heading" class="relative mt-4 text-xl font-semibold text-ink-900 dark:text-white">
        No matches for <span class="text-gradient">"{{ query }}"</span>
      </h2>
      <p class="relative mx-auto mt-2 max-w-md text-sm text-ink-500 dark:text-ink-400">
        Try a shorter keyword, switch filters, or explore one of these popular categories below.
      </p>

      <div v-if="suggestedCategories && suggestedCategories.length" class="relative mt-5 flex flex-wrap justify-center gap-1.5">
        <NuxtLink
          v-for="c in suggestedCategories.slice(0, 8)"
          :key="c.id"
          :to="l2UrlFor(c)"
          class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
        >
          <span class="text-accent">#</span>
          {{ c.name }}
        </NuxtLink>
      </div>
    </div>

    <!-- Popular tools fallback grid -->
    <div v-if="tools && tools.length">
      <header class="mb-4 flex items-end justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
          <div>
            <h3 class="text-lg font-semibold text-ink-900 dark:text-white">
              {{ query ? 'Popular alternatives' : 'Trending AI tools today' }}
            </h3>
            <p class="text-xs text-ink-500 dark:text-ink-400">
              Hand-picked by traffic, rating and recency.
            </p>
          </div>
        </div>
        <NuxtLink
          to="/ai-tools"
          class="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition hover:text-primary-700 dark:text-accent dark:hover:text-white"
        >
          All categories
          <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
        </NuxtLink>
      </header>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SubToolCard
          v-for="(tool, i) in tools"
          :key="tool.id"
          :tool="tool"
          :priority="i < 3"
          :rank="null"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import SubToolCard from '../category/SubToolCard.vue'
import { useAppRoutes } from '~/composables/useAppRoutes'

defineProps({
  query: { type: String, default: '' },
  tools: { type: Array, default: () => [] },
  suggestedCategories: { type: Array, default: () => [] },
})

const { l2Url } = useAppRoutes()
const l2UrlFor = (c) => l2Url(c?.parentHandle || '', c?.handle)
</script>
