<template>
  <article
    class="group relative flex min-h-[200px] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-card-hover dark:border-white/5 dark:bg-ink-800/60"
    :data-ad-slot="slotId"
    :aria-label="label"
  >
    <!-- Tiny sponsored marker -->
    <span
      class="absolute right-2.5 top-2.5 z-20 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-400 backdrop-blur dark:bg-black/40 dark:text-ink-400"
    >
      Sponsored
    </span>

    <!-- AdSense target fills the card -->
    <ins
      class="adsbygoogle absolute inset-0 block"
      style="display:block;width:100%;height:100%;"
      :data-ad-client="adClient"
      :data-ad-slot="slotId"
      data-ad-format="fluid"
      data-full-width-responsive="true"
    ></ins>

    <!-- Camouflage skeleton (matches SubToolCard layout 1:1) -->
    <div class="relative z-10 flex items-start gap-4 p-5">
      <div
        class="h-[72px] w-[72px] flex-shrink-0 animate-pulse rounded-xl bg-gradient-to-br from-ink-100 to-ink-50 dark:from-ink-700 dark:to-ink-800"
      ></div>
      <div class="min-w-0 flex-1 space-y-2">
        <div class="h-4 w-2/3 animate-pulse rounded bg-ink-100 dark:bg-ink-700"></div>
        <div class="h-3 w-1/2 animate-pulse rounded bg-ink-100/80 dark:bg-ink-700/70"></div>
        <div class="h-3 w-full animate-pulse rounded bg-ink-100/80 dark:bg-ink-700/70"></div>
        <div class="h-3 w-5/6 animate-pulse rounded bg-ink-100/80 dark:bg-ink-700/70"></div>
      </div>
    </div>

    <div class="relative z-10 mt-auto flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 dark:border-white/5">
      <div class="flex gap-1">
        <span
          v-for="i in 2"
          :key="i"
          class="h-4 w-12 animate-pulse rounded bg-ink-100 dark:bg-ink-700"
        ></span>
      </div>
      <span class="h-6 w-14 animate-pulse rounded-lg bg-ink-200 dark:bg-ink-700"></span>
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
