<template>
  <NuxtLink
    :to="collection.href || `/category/${collection.handle}`"
    :class="[
      'group relative flex overflow-hidden rounded-2xl border transition-all duration-300 ease-smooth',
      'border-ink-200 bg-white hover:-translate-y-1 hover:shadow-card-hover',
      'dark:border-white/5 dark:bg-ink-800/60 dark:hover:border-accent/30',
      large ? 'md:col-span-2 aspect-[16/9] md:aspect-[21/9]' : 'aspect-[4/5] sm:aspect-[3/4]',
    ]"
  >
    <!-- Cover -->
    <div class="absolute inset-0">
      <img
        v-if="collection.cover"
        :src="collection.cover"
        :alt="collection.title"
        loading="lazy"
        decoding="async"
        class="h-full w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-[1.06]"
      />
      <!-- Fallback mesh gradient -->
      <div
        v-else
        aria-hidden="true"
        class="h-full w-full"
        :style="{
          background: gradients[collection.gradient % gradients.length],
        }"
      ></div>
    </div>

    <!-- Dark overlay for text legibility -->
    <div
      aria-hidden="true"
      class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5"
    ></div>

    <!-- Decorative blur ring on hover -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      style="
        background: radial-gradient(60% 60% at 80% 20%, rgba(34,211,238,0.35), transparent 70%);
        mix-blend-mode: screen;
      "
    ></div>

    <!-- Content -->
    <div class="relative z-10 flex w-full flex-col justify-between p-5 text-white sm:p-6">
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/90 backdrop-blur"
        >
          <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 2l3 7 7 .7-5 4.8 1.5 7-6.5-4-6.5 4L7 14.5 2 9.7 9 9l3-7z"/>
          </svg>
          {{ collection.kicker || 'Featured Collection' }}
        </span>
        <span
          v-if="collection.count"
          class="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur"
        >
          {{ collection.count }} tools
        </span>
      </div>

      <div>
        <h3
          :class="[
            'text-balance font-semibold leading-tight tracking-tight text-white',
            large ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl',
          ]"
        >
          {{ collection.title }}
        </h3>
        <p
          v-if="collection.excerpt"
          :class="[
            'mt-2 text-pretty text-white/80',
            large ? 'max-w-xl text-sm sm:text-base' : 'line-clamp-2 text-xs sm:text-sm',
          ]"
        >
          {{ collection.excerpt }}
        </p>

        <div class="mt-4 flex items-center gap-3">
          <!-- Avatar stack -->
          <div v-if="collection.logos && collection.logos.length" class="flex -space-x-2">
            <img
              v-for="(logo, i) in collection.logos.slice(0, 4)"
              :key="i"
              :src="logo"
              :alt="`Included tool ${i + 1}`"
              width="28"
              height="28"
              loading="lazy"
              decoding="async"
              class="h-7 w-7 rounded-full border-2 border-white/80 object-cover"
            />
          </div>

          <span
            class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 transition group-hover:bg-gradient-cta group-hover:text-white"
          >
            Explore
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
            </svg>
          </span>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup>
defineProps({
  collection: { type: Object, required: true },
  large: { type: Boolean, default: false },
})

const gradients = [
  'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F472B6 0%, #7C5CFF 100%)',
  'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
  'linear-gradient(135deg, #22C55E 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #F472B6 100%)',
]
</script>
