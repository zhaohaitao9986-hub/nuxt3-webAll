<template>
  <!-- Variant: native card (looks identical to ToolCard) -->
  <article
    v-if="variant === 'native-card'"
    class="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white transition-all duration-300 ease-smooth hover:-translate-y-1 hover:shadow-card-hover dark:border-white/5 dark:bg-ink-800/60"
    :data-ad-slot="slotId"
    :aria-label="label"
  >
    <div class="relative aspect-card overflow-hidden">
      <!-- AdSense will render here; we render a placeholder skeleton meanwhile -->
      <div
        aria-hidden="true"
        class="absolute inset-0 bg-gradient-to-br from-ink-100 via-ink-50 to-ink-100 dark:from-ink-700 dark:via-ink-800 dark:to-ink-700"
      ></div>
      <div class="relative flex h-full items-center justify-center">
        <!-- AdSense injection target -->
        <ins
          class="adsbygoogle block h-full w-full"
          style="display:block;width:100%;height:100%;"
          :data-ad-client="adClient"
          :data-ad-slot="slotId"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
      <span
        class="absolute right-2 top-2 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-500 backdrop-blur dark:bg-black/40 dark:text-ink-300"
      >
        Sponsored
      </span>
    </div>
    <div class="flex flex-1 flex-col px-4 pb-4 pt-4">
      <div class="h-4 w-3/4 rounded bg-ink-100 dark:bg-ink-700"></div>
      <div class="mt-2 h-3 w-full rounded bg-ink-100 dark:bg-ink-700"></div>
      <div class="mt-1 h-3 w-5/6 rounded bg-ink-100 dark:bg-ink-700"></div>
    </div>
  </article>

  <!-- Variant: full-width banner between sections -->
  <aside
    v-else-if="variant === 'banner'"
    class="relative flex min-h-[120px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-200 bg-gradient-to-r from-ink-50 via-white to-ink-50 dark:border-white/10 dark:from-ink-800 dark:via-ink-900 dark:to-ink-800 sm:min-h-[160px]"
    :data-ad-slot="slotId"
    :aria-label="label"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-40"
      style="
        background:
          radial-gradient(40% 80% at 10% 50%, rgba(124,92,255,0.18) 0%, transparent 60%),
          radial-gradient(40% 80% at 90% 50%, rgba(34,211,238,0.18) 0%, transparent 60%);
      "
    ></div>

    <ins
      class="adsbygoogle absolute inset-0 block h-full w-full"
      style="display:block;"
      :data-ad-client="adClient"
      :data-ad-slot="slotId"
      data-ad-format="horizontal"
      data-full-width-responsive="true"
    ></ins>

    <div class="relative flex items-center gap-3 text-center">
      <span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-cta text-white">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
        </svg>
      </span>
      <div class="text-left">
        <p class="text-xs font-medium uppercase tracking-[0.2em] text-ink-400 dark:text-ink-400">
          {{ label }}
        </p>
        <p class="text-sm font-medium text-ink-700 dark:text-ink-200">
          AdSense Slot · 970×250 / Responsive
        </p>
      </div>
    </div>

    <span class="absolute bottom-2 right-3 text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-500">
      Advertisement
    </span>
  </aside>

  <!-- Variant: sidebar -->
  <aside
    v-else
    class="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-4 dark:border-white/10 dark:bg-ink-800/60"
    :data-ad-slot="slotId"
    :aria-label="label"
  >
    <ins
      class="adsbygoogle absolute inset-0 block"
      style="display:block;"
      :data-ad-client="adClient"
      :data-ad-slot="slotId"
    ></ins>
    <p class="relative text-xs font-medium uppercase tracking-[0.2em] text-ink-400">
      {{ label }}
    </p>
    <p class="relative mt-1 text-xs text-ink-400">300 × 250</p>
  </aside>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'native-card', // 'native-card' | 'banner' | 'sidebar'
  },
  label: { type: String, default: 'Sponsored' },
  slotId: { type: String, default: '' },
  adClient: { type: String, default: '' },
})
</script>
