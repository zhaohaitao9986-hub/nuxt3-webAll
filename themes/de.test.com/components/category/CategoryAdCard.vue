<template>
  <article
    :class="[
      'group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300 ease-smooth',
      'border-ink-200 bg-white hover:-translate-y-0.5 hover:shadow-card-hover',
      'dark:border-white/5 dark:bg-ink-800/60',
    ]"
    :data-ad-slot="slotId"
    :aria-label="label"
  >
    <!-- Sponsored marker, intentionally tiny -->
    <span
      class="absolute right-2.5 top-2.5 z-20 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-400 backdrop-blur dark:bg-black/40 dark:text-ink-400"
    >
      Sponsored
    </span>

    <!-- AdSense injection target: fills the whole card shape -->
    <ins
      class="adsbygoogle pointer-events-none absolute inset-0 block opacity-0"
      style="display:block;"
      :data-ad-client="adClient"
      :data-ad-slot="slotId"
      data-ad-format="fluid"
      data-full-width-responsive="true"
    ></ins>

    <!-- Camouflage skeleton so it matches PrimaryCategoryCard shape while AdSense boots -->
    <div class="relative z-10 flex items-start gap-3 p-5 pb-3">
      <span
        class="flex h-11 w-11 flex-shrink-0 animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-ink-100 to-ink-50 dark:from-ink-700 dark:to-ink-800"
      ></span>
      <div class="min-w-0 flex-1 space-y-2">
        <div class="h-4 w-2/3 animate-pulse rounded bg-ink-100 dark:bg-ink-700"></div>
        <div class="h-3 w-1/2 animate-pulse rounded bg-ink-100/80 dark:bg-ink-700/70"></div>
      </div>
    </div>

    <div class="relative z-10 flex flex-wrap gap-1.5 px-5 pb-4">
      <span
        v-for="i in 4"
        :key="i"
        class="h-6 w-16 animate-pulse rounded-full bg-ink-100 dark:bg-ink-700"
      ></span>
    </div>

    <div class="relative z-10 mt-auto border-t border-ink-100 px-5 py-3 dark:border-white/5">
      <div class="h-3 w-36 animate-pulse rounded bg-ink-100 dark:bg-ink-700"></div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  slotId: { type: String, default: '' },
  adClient: { type: String, default: '' },
  label: { type: String, default: 'Sponsored' },
})
</script>
