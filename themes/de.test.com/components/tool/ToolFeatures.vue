<template>
  <section
    v-if="features && features.length"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="features-heading"
  >
    <header class="flex items-center gap-3">
      <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
      <h2 id="features-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
        Key features
      </h2>
    </header>

    <ul class="mt-5 grid gap-3 sm:grid-cols-2">
      <li
        v-for="(feature, i) in features"
        :key="i"
        class="group flex items-start gap-3 rounded-xl border border-ink-100 bg-gradient-to-br from-ink-50/80 to-white p-3.5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm dark:border-white/5 dark:from-white/[0.03] dark:to-white/[0.01] dark:hover:border-primary/30"
        :style="{ animationDelay: `${i * 40}ms` }"
      >
        <span
          aria-hidden="true"
          class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
          :style="{ background: gradientByKey(`${seed}-${i}`) }"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </span>
        <span class="text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          {{ feature }}
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { useGradientPalette } from '~/composables/useGradientPalette'

defineProps({
  features: { type: Array, default: () => [] },
  seed: { type: String, default: 'feature' },
})

const { gradientByKey } = useGradientPalette()
</script>
