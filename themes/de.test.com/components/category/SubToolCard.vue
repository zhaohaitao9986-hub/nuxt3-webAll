<template>
  <article
    :class="[
      'group relative flex min-h-[200px] flex-col overflow-hidden rounded-2xl border transition-all duration-300 ease-smooth',
      'border-ink-200 bg-white hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card-hover',
      'dark:border-white/5 dark:bg-ink-800/60 dark:hover:border-primary/40',
    ]"
    @mousemove="onMouseMove"
  >
    <!-- Cursor-follow spotlight -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style="
        background: radial-gradient(400px circle at var(--mx, 50%) var(--my, 0%), rgba(124,92,255,0.12), transparent 40%);
      "
    ></div>

    <!-- Decorative corner accent -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
      :style="{ background: gradient }"
    ></div>

    <!-- Upper: icon + title block (固定 min-height 防 CLS) -->
    <div class="relative z-10 flex items-start gap-4 p-5">
      <!-- Icon: 80x80 fixed container, never stretches source image -->
      <div class="relative flex-shrink-0">
        <div
          class="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm dark:border-white/10 dark:bg-ink-900"
          :style="{
            background:
              'linear-gradient(135deg, rgb(var(--surface)) 0%, rgb(var(--surface-2)) 100%)',
          }"
        >
          <!-- Halo ring on hover -->
          <span
            aria-hidden="true"
            class="pointer-events-none absolute -inset-0.5 rounded-xl opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-50"
            :style="{ background: gradient }"
          ></span>

          <img
            v-if="tool.iconUrl && !imgError"
            :src="tool.iconUrl"
            :alt="`${tool.name} logo`"
            width="56"
            height="56"
            :loading="priority ? 'eager' : 'lazy'"
            :fetchpriority="priority ? 'high' : 'auto'"
            decoding="async"
            class="relative z-10 h-14 w-14 object-contain"
            @error="imgError = true"
          />

          <!-- Gradient-initial fallback -->
          <div
            v-else
            aria-hidden="true"
            class="relative z-10 flex h-14 w-14 items-center justify-center rounded-lg text-xl font-bold text-white"
            :style="{ background: gradient }"
          >
            {{ initial }}
          </div>
        </div>

        <!-- Rank badge (top 3 only) -->
        <span
          v-if="rank && rank <= 3"
          class="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-cta text-[10px] font-bold text-white shadow-glow"
          :aria-label="`Rank ${rank}`"
        >
          #{{ rank }}
        </span>
      </div>

      <!-- Title column -->
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="`/tool/${tool.handle}`"
            class="min-w-0 truncate text-base font-semibold text-ink-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-accent"
          >
            {{ tool.name }}
          </NuxtLink>
        </div>

        <!-- Rating + pricing inline -->
        <div class="mt-1 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
          <span v-if="tool.rating" class="inline-flex items-center gap-1 text-signal">
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-current" stroke="none">
              <path d="M12 2l2.39 4.84L20 8l-4 3.9L17 18l-5-2.6L7 18l1-6.1L4 8l5.61-1.16L12 2z"/>
            </svg>
            <span class="font-semibold text-ink-700 dark:text-ink-100">{{ tool.rating.toFixed(1) }}</span>
          </span>
          <span v-if="tool.rating" class="h-3 w-px bg-ink-200 dark:bg-white/10"></span>
          <span
            :class="[
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
              pricingStyle.bg,
              pricingStyle.text,
            ]"
          >
            {{ pricingStyle.label }}
          </span>
          <span v-if="tool.monthlyVisits" class="h-3 w-px bg-ink-200 dark:bg-white/10"></span>
          <span v-if="tool.monthlyVisits" class="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            {{ formatVisits(tool.monthlyVisits) }}/mo
          </span>
        </div>

        <p class="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-500 dark:text-ink-300">
          {{ tool.shortDesc || 'A curated AI product. Click to explore capabilities and pricing.' }}
        </p>
      </div>
    </div>

    <!-- Footer: tags + CTA (mt-auto 推到底部保证卡片等高) -->
    <div class="relative z-10 mt-auto flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 dark:border-white/5">
      <div class="flex min-w-0 flex-wrap items-center gap-1">
        <span
          v-for="tag in displayTags"
          :key="tag"
          class="inline-flex items-center rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 dark:bg-white/5 dark:text-ink-300"
        >
          {{ tag }}
        </span>
      </div>

      <a
        :href="tool.website || `/tool/${tool.handle}`"
        target="_blank"
        rel="noopener nofollow sponsored"
        class="btn-shine group/cta relative inline-flex flex-shrink-0 items-center gap-1 overflow-hidden rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all duration-200 ease-smooth hover:scale-105 hover:bg-gradient-cta hover:shadow-glow"
        @mousemove="onCtaMove"
        @click.stop
      >
        <span class="relative z-10">Visit</span>
        <svg viewBox="0 0 24 24" class="relative z-10 h-3 w-3 transition-transform duration-200 group-hover/cta:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
        </svg>
      </a>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useGradientPalette } from '~/composables/useGradientPalette'

const props = defineProps({
  tool: { type: Object, required: true },
  priority: { type: Boolean, default: false },
  rank: { type: Number, default: null },
})

const imgError = ref(false)
const { gradientByKey } = useGradientPalette()

const initial = computed(() =>
  String(props.tool.name || 'A').trim().charAt(0).toUpperCase(),
)

const gradient = computed(() =>
  gradientByKey(props.tool.handle || props.tool.id || props.tool.name),
)

const displayTags = computed(() => {
  const result = []
  const pricing = props.tool.pricing || []
  if (props.tool.isFree) result.push('Free')
  pricing
    .filter((p) => !/^free$/i.test(p))
    .slice(0, 2)
    .forEach((p) => result.push(p))
  ;(props.tool.tags || [])
    .slice(0, 2 - Math.min(2, result.length - (props.tool.isFree ? 1 : 0)))
    .forEach((t) => {
      if (result.length < 3) result.push(t)
    })
  return result.slice(0, 3)
})

const pricingStyle = computed(() => {
  const pricing = props.tool.pricing || []
  const hasFree = props.tool.isFree || pricing.some((p) => /^free$/i.test(p))
  const hasPaid = pricing.some((p) => /paid|pro|plus|premium|enterprise/i.test(p))
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

const onCtaMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
</script>
