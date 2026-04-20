<template>
  <section
    v-if="tools && tools.length"
    aria-labelledby="related-heading"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
  >
    <header class="flex items-end justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        <h2 id="related-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
          Related tools
        </h2>
      </div>
      <NuxtLink
        v-if="parentHandle"
        :to="`/category/${parentHandle}`"
        class="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition hover:text-primary-700 dark:text-accent dark:hover:text-white"
      >
        Browse all
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </NuxtLink>
    </header>

    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <template v-for="(tool, index) in tools" :key="tool.id">
        <!-- Insert native ad at position 3 (mid-grid) for monetization -->
        <SubToolAdCard
          v-if="showAd && index === 2"
          slot-id="tool-related-inline"
        />
        <SubToolCard :tool="tool" :rank="null" :priority="false" />
      </template>
    </div>
  </section>
</template>

<script setup>
import SubToolCard from '../category/SubToolCard.vue'
import SubToolAdCard from '../category/SubToolAdCard.vue'

defineProps({
  tools: { type: Array, default: () => [] },
  parentHandle: { type: String, default: '' },
  showAd: { type: Boolean, default: false },
})
</script>
