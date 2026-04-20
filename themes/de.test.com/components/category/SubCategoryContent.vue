<template>
  <section
    class="space-y-8 rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/40"
    aria-label="About this category"
  >
    <!-- Summary -->
    <section v-if="category.what_is_summary" id="summary">
      <h2 class="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        What is {{ category.name }}?
      </h2>
      <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        <strong class="text-ink-800 dark:text-ink-100">{{ category.name }}</strong>
        — {{ category.what_is_summary }}
      </p>
    </section>

    <!-- Features grid -->
    <section
      v-if="category.feature && category.feature.length"
      id="features"
      class="border-t border-ink-100 pt-8 dark:border-white/5"
    >
      <h2 class="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        Key features to look for
      </h2>
      <ul class="mt-4 grid gap-3 sm:grid-cols-2">
        <li
          v-for="(feature, i) in category.feature"
          :key="i"
          class="flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-sm text-ink-700 dark:border-white/5 dark:bg-white/5 dark:text-ink-200"
        >
          <span class="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-cta text-white">
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </span>
          <span>{{ feature }}</span>
        </li>
      </ul>
    </section>

    <!-- Who uses -->
    <section
      v-if="category.who_is_use"
      id="audience"
      class="border-t border-ink-100 pt-8 dark:border-white/5"
    >
      <h2 class="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        Who uses these tools?
      </h2>
      <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        {{ category.who_is_use }}
      </p>
    </section>

    <!-- Workflow -->
    <section
      v-if="category.how_do_work"
      id="workflow"
      class="border-t border-ink-100 pt-8 dark:border-white/5"
    >
      <h2 class="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        How it fits your workflow
      </h2>
      <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        {{ category.how_do_work }}
      </p>
    </section>

    <!-- Advantages -->
    <section
      v-if="category.advantages"
      id="advantages"
      class="border-t border-ink-100 pt-8 dark:border-white/5"
    >
      <h2 class="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        Benefits
      </h2>
      <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        {{ category.advantages }}
      </p>
    </section>

    <!-- FAQ -->
    <section
      v-if="category.faq && category.faq.length"
      id="faq"
      class="border-t border-ink-100 pt-8 dark:border-white/5"
    >
      <h2 class="flex items-center gap-2 text-lg font-semibold text-ink-900 dark:text-white">
        <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
        Frequently asked questions
      </h2>
      <div class="mt-4 space-y-2">
        <details
          v-for="(faq, i) in category.faq"
          :key="i"
          class="group rounded-xl border border-ink-200 bg-ink-50/50 p-4 transition hover:border-primary/30 dark:border-white/5 dark:bg-white/5"
        >
          <summary class="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-ink-900 dark:text-white">
            <span class="flex-1">{{ faq.question }}</span>
            <svg viewBox="0 0 24 24" class="h-4 w-4 flex-shrink-0 text-ink-400 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
            </svg>
          </summary>
          <p class="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
            {{ faq.answer }}
          </p>
        </details>
      </div>
    </section>
  </section>
</template>

<script setup>
defineProps({
  category: { type: Object, required: true },
})
</script>

<style scoped>
details summary::-webkit-details-marker {
  display: none;
}
</style>
