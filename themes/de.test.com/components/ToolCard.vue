<template>
  <article
    :class="[
      'group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ease-smooth',
      'border-ink-200 bg-white hover:-translate-y-1 hover:shadow-card-hover',
      'dark:border-white/5 dark:bg-ink-800/60 dark:hover:border-primary/30',
    ]"
    @mousemove="onMouseMove"
  >
    <!-- Hover glow that follows cursor (decorative) -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style="
        background: radial-gradient(
          420px circle at var(--mx, 50%) var(--my, 0%),
          rgba(124,92,255,0.12),
          transparent 40%
        );
      "
    ></div>

    <!-- Cover image: fixed aspect-ratio to eliminate CLS -->
    <NuxtLink :to="toolHref" class="relative block aspect-card overflow-hidden">
      <!-- Skeleton shimmer background, always visible below image to prevent flicker -->
      <div
        aria-hidden="true"
        class="absolute inset-0 bg-gradient-to-br from-ink-100 via-ink-50 to-ink-100 dark:from-ink-700 dark:via-ink-800 dark:to-ink-700"
      ></div>

      <img
        v-if="tool.image || tool.website_logo"
        :src="tool.image || tool.website_logo"
        :alt="`${tool.name} preview`"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : 'auto'"
        decoding="async"
        width="800"
        height="450"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-smooth group-hover:scale-[1.04]"
      />

      <!-- Gradient bottom overlay for legibility -->
      <div
        aria-hidden="true"
        class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
      ></div>

      <!-- Badges top-right -->
      <div class="absolute right-3 top-3 flex items-center gap-1.5">
        <span
          v-if="sponsored"
          class="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500"
        >
          Sponsored
        </span>
        <span
          v-else-if="tool.is_ad"
          class="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500"
        >
          Featured
        </span>
      </div>

      <!-- Logo overlay bottom-left -->
      <div
        class="absolute -bottom-5 left-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-lg dark:bg-ink-900"
      >
        <img
          v-if="tool.website_logo"
          :src="tool.website_logo"
          :alt="`${tool.name} logo`"
          width="48"
          height="48"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover"
        />
        <span v-else class="text-base font-bold text-gradient">
          {{ initial }}
        </span>
      </div>
    </NuxtLink>

    <!-- Body -->
    <div class="flex flex-1 flex-col px-4 pb-4 pt-7">
      <div class="flex items-start justify-between gap-3">
        <NuxtLink :to="toolHref" class="min-w-0">
          <h3 class="line-clamp-1 text-sm font-semibold text-ink-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-accent">
            {{ tool.name }}
          </h3>
        </NuxtLink>

        <span
          :class="[
            'inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
            pricingStyle.bg,
            pricingStyle.text,
          ]"
        >
          {{ pricingStyle.label }}
        </span>
      </div>

      <p class="mt-1.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-ink-500 dark:text-ink-300">
        {{ tool.description || 'A curated AI product. Click to explore capabilities and pricing.' }}
      </p>

      <div class="mt-3 flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-[11px] text-ink-400 dark:text-ink-400">
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>{{ formatVisits(tool.month_visited_count) }}/mo</span>
        </div>

        <a
          :href="tool.website || toolHref"
          target="_blank"
          rel="noopener nofollow sponsored"
          class="inline-flex items-center gap-1 rounded-full bg-ink-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-gradient-cta dark:bg-white dark:text-ink-900 dark:hover:bg-gradient-cta dark:hover:text-white"
        >
          Visit
          <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
          </svg>
        </a>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tool: { type: Object, required: true },
  priority: { type: Boolean, default: false },
  sponsored: { type: Boolean, default: false },
})

const toolHref = computed(() => `/tool/${props.tool.handle}`)

const initial = computed(() => (props.tool.name || 'A').trim().charAt(0).toUpperCase())

const pricingStyle = computed(() => {
  const pricing = props.tool.pricing || []
  const hasFree = props.tool.is_free || pricing.includes('Free') || pricing.includes('free')
  const hasPaid = pricing.some((p) => /paid|pro|plus|premium/i.test(p))
  if (hasFree && hasPaid) {
    return {
      label: 'Freemium',
      bg: 'bg-primary/10',
      text: 'text-primary-600 dark:text-primary-300',
    }
  }
  if (hasFree) {
    return {
      label: 'Free',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
    }
  }
  return {
    label: 'Paid',
    bg: 'bg-signal/10',
    text: 'text-signal-600 dark:text-signal',
  }
})

const formatVisits = (value) => {
  const n = Number(value || 0)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
</script>
