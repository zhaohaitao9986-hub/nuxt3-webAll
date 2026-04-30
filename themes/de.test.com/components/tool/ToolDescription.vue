<template>
  <section
    v-if="hasAnything"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="about-heading"
  >
    <header class="flex items-center gap-3">
      <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
      <h2 id="about-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
        About {{ toolName }}
      </h2>
    </header>

    <div
      v-if="longDesc"
      class="prose-tool mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300"
    >
      <p>
        <strong class="text-ink-800 dark:text-ink-100">{{ toolName }}</strong> — {{ longDesc }}
      </p>
    </div>

    <!-- Use cases -->
    <div
      v-if="useCases && useCases.length"
      class="mt-6 border-t border-ink-100 pt-6 dark:border-white/5"
    >
      <h3 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
        <svg viewBox="0 0 24 24" class="h-4 w-4 text-accent" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
        </svg>
        Top use cases
      </h3>
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        <li
          v-for="(uc, i) in useCases"
          :key="i"
          class="flex items-start gap-2 text-sm text-ink-600 dark:text-ink-300"
        >
          <span class="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"></span>
          <span>{{ uc }}</span>
        </li>
      </ul>
    </div>

    <!-- For jobs -->
    <div
      v-if="forJobs && forJobs.length"
      class="mt-6 border-t border-ink-100 pt-6 dark:border-white/5"
    >
      <h3 class="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
        <svg viewBox="0 0 24 24" class="h-4 w-4 text-primary-500" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="7" width="18" height="13" rx="2"/>
          <path stroke-linecap="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
        Built for
      </h3>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <span
          v-for="(job, i) in forJobs"
          :key="i"
          class="inline-flex items-center rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-700 dark:border-white/10 dark:bg-white/5 dark:text-ink-200"
        >
          {{ job }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  longDesc: { type: String, default: '' },
  toolName: { type: String, required: true },
  useCases: { type: Array, default: () => [] },
  forJobs: { type: Array, default: () => [] },
})

const hasAnything = computed(
  () =>
    Boolean(props.longDesc) ||
    (props.useCases && props.useCases.length) ||
    (props.forJobs && props.forJobs.length),
)
</script>
