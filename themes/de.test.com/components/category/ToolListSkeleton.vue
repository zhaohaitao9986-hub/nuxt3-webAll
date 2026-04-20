<template>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
    <div
      v-for="n in count"
      :key="n"
      class="flex min-h-[200px] flex-col rounded-2xl border border-ink-200 bg-white dark:border-white/5 dark:bg-ink-800/60"
    >
      <div class="flex items-start gap-4 p-5">
        <div class="h-[72px] w-[72px] flex-shrink-0 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-700"></div>
        <div class="min-w-0 flex-1 space-y-2">
          <div class="h-4 w-2/3 animate-pulse rounded bg-ink-100 dark:bg-ink-700"></div>
          <div class="h-3 w-1/2 animate-pulse rounded bg-ink-100/80 dark:bg-ink-700/70"></div>
          <div class="h-3 w-full animate-pulse rounded bg-ink-100/80 dark:bg-ink-700/70"></div>
          <div class="h-3 w-5/6 animate-pulse rounded bg-ink-100/80 dark:bg-ink-700/70"></div>
        </div>
      </div>
      <div class="mt-auto flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 dark:border-white/5">
        <div class="flex gap-1">
          <span class="h-4 w-10 animate-pulse rounded bg-ink-100 dark:bg-ink-700"></span>
          <span class="h-4 w-12 animate-pulse rounded bg-ink-100 dark:bg-ink-700"></span>
        </div>
        <span class="h-6 w-14 animate-pulse rounded-lg bg-ink-200 dark:bg-ink-700"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  count: { type: Number, default: 6 },
})
</script>
