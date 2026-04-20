<template>
  <section
    v-if="hasAnything"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="proscons-heading"
  >
    <header class="flex items-center gap-3">
      <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
      <h2 id="proscons-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
        Pros &amp; cons
      </h2>
    </header>

    <div class="mt-5 grid gap-4 sm:grid-cols-2">
      <!-- Pros -->
      <div
        v-if="pros && pros.length"
        class="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent p-4"
      >
        <h3 class="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 10v12M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H7V10l5.34-7.12A2 2 0 0114 3h.17a2 2 0 011.74 2.88z"/>
          </svg>
          Pros
        </h3>
        <ul class="mt-3 space-y-2">
          <li
            v-for="(p, i) in pros"
            :key="i"
            class="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-200"
          >
            <span class="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <svg viewBox="0 0 24 24" class="h-2.5 w-2.5" fill="none" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </span>
            <span>{{ p }}</span>
          </li>
        </ul>
      </div>

      <!-- Cons -->
      <div
        v-if="cons && cons.length"
        class="relative overflow-hidden rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-transparent to-transparent p-4"
      >
        <h3 class="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 14V2M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H17v12l-5.34 7.12A2 2 0 0110 21h-.17a2 2 0 01-1.74-2.88z"/>
          </svg>
          Cons
        </h3>
        <ul class="mt-3 space-y-2">
          <li
            v-for="(c, i) in cons"
            :key="i"
            class="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-200"
          >
            <span class="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <svg viewBox="0 0 24 24" class="h-2.5 w-2.5" fill="none" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </span>
            <span>{{ c }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  pros: { type: Array, default: () => [] },
  cons: { type: Array, default: () => [] },
})

const hasAnything = computed(
  () => (props.pros && props.pros.length) || (props.cons && props.cons.length),
)
</script>
