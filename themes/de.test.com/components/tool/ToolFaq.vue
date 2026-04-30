<template>
  <section
    v-if="faq && faq.length"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="faq-heading"
  >
    <header class="flex items-center gap-3">
      <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
      <h2 id="faq-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
        Frequently asked questions
      </h2>
    </header>

    <div class="mt-5 divide-y divide-ink-100 dark:divide-white/5">
      <details
        v-for="(item, i) in faq"
        :key="i"
        class="group py-3 [&_summary::-webkit-details-marker]:hidden"
        :open="i === 0"
      >
        <summary
          class="flex cursor-pointer items-start justify-between gap-3 py-2 text-sm font-semibold text-ink-900 transition hover:text-primary-600 dark:text-white dark:hover:text-accent"
        >
          <span class="pr-2">{{ item.question }}</span>
          <span
            aria-hidden="true"
            class="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-500 transition-all duration-200 group-open:rotate-180 group-open:border-primary/50 group-open:bg-primary/10 group-open:text-primary-600 dark:border-white/10 dark:text-ink-300 dark:group-open:border-primary/50 dark:group-open:text-accent"
          >
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
            </svg>
          </span>
        </summary>
        <p class="mt-2 whitespace-pre-line pr-8 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {{ item.answer }}
        </p>
      </details>
    </div>
  </section>
</template>

<script setup>
defineProps({
  faq: { type: Array, default: () => [] },
})
</script>
