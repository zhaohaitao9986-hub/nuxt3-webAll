<template>
  <section
    class="relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/40"
    aria-labelledby="seo-heading"
  >
    <!-- Decorative gradient -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-30 blur-3xl"
      style="background: radial-gradient(circle, rgba(124,92,255,0.4), transparent 70%)"
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full opacity-20 blur-3xl"
      style="background: radial-gradient(circle, rgba(34,211,238,0.4), transparent 70%)"
    ></div>

    <div class="relative z-10 grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
      <div>
        <p class="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
          About this directory
        </p>
        <h2
          id="seo-heading"
          class="mt-2 text-xl font-semibold leading-tight text-ink-900 dark:text-white"
        >
          {{ title }}
        </h2>
      </div>

      <div class="space-y-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        <p>{{ body }}</p>

        <!-- Internal-link paragraph boosts crawl depth -->
        <p v-if="topSubs && topSubs.length" class="text-ink-500 dark:text-ink-400">
          <span class="font-medium text-ink-700 dark:text-ink-200">Jump to popular niches:</span>
          <template v-for="(sub, i) in topSubs" :key="sub.handle">
            <NuxtLink
              :to="`/category/${sub.handle}`"
              class="text-primary-600 underline-offset-4 transition hover:underline dark:text-accent"
            >{{ sub.name }}</NuxtLink><span v-if="i < topSubs.length - 1">, </span>
          </template>.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Explore AI Categories' },
  body: { type: String, default: '' },
  topSubs: { type: Array, default: () => [] },
})
</script>
