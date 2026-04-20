<template>
  <section class="relative isolate overflow-hidden">
    <!-- Mesh backdrop -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10"
      :style="{
        background:
          `radial-gradient(60% 60% at 15% 20%, ${accent[0]}40 0%, transparent 60%),` +
          `radial-gradient(50% 50% at 85% 0%, ${accent[1]}30 0%, transparent 60%)`,
      }"
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.1]"
      style="
        background-image:
          linear-gradient(rgba(124,92,255,0.6) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,92,255,0.6) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(ellipse 60% 60% at 30% 20%, #000 40%, transparent 100%);
        -webkit-mask-image: radial-gradient(ellipse 60% 60% at 30% 20%, #000 40%, transparent 100%);
      "
    ></div>

    <div class="mx-auto w-full max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-12 lg:px-8">
      <!-- Breadcrumb -->
      <CategoryBreadcrumb :parent="parent" :current="tool.name" />

      <div class="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <!-- LEFT: Logo container -->
        <div class="flex-shrink-0">
          <div
            class="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-md dark:border-white/10 dark:bg-ink-900 sm:h-28 sm:w-28"
          >
            <!-- Gradient halo -->
            <span
              aria-hidden="true"
              class="pointer-events-none absolute -inset-1 rounded-2xl opacity-40 blur-md"
              :style="{ background: gradient }"
            ></span>

            <img
              v-if="tool.logoUrl && !imgError"
              :src="tool.logoUrl"
              :alt="`${tool.name} logo`"
              width="80"
              height="80"
              fetchpriority="high"
              decoding="async"
              class="relative z-10 h-20 w-20 object-contain sm:h-24 sm:w-24"
              @error="imgError = true"
            />
            <div
              v-else
              aria-hidden="true"
              class="relative z-10 flex h-20 w-20 items-center justify-center rounded-xl text-2xl font-bold text-white sm:h-24 sm:w-24 sm:text-3xl"
              :style="{ background: gradient }"
            >
              {{ initial }}
            </div>
          </div>
        </div>

        <!-- MIDDLE: Name + badges + description -->
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              :class="[
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                pricingStyle.bg,
                pricingStyle.text,
              ]"
            >
              {{ pricingStyle.label }}
            </span>
            <span
              v-if="tool.rating"
              class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-signal dark:border-white/10 dark:bg-white/5"
            >
              <svg viewBox="0 0 24 24" class="h-3 w-3 fill-current" stroke="none">
                <path d="M12 2l2.39 4.84L20 8l-4 3.9L17 18l-5-2.6L7 18l1-6.1L4 8l5.61-1.16L12 2z"/>
              </svg>
              {{ tool.rating.toFixed(1) }} / 5
            </span>
            <span
              v-if="tool.monthlyVisits >= 1000"
              class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-ink-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-300"
            >
              <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {{ formatVisits(tool.monthlyVisits) }}/mo
            </span>
            <span
              v-if="updatedAgo"
              class="text-[11px] text-ink-400 dark:text-ink-500"
            >
              Updated {{ updatedAgo }}
            </span>
          </div>

          <h1
            class="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl lg:text-5xl dark:text-white"
          >
            {{ tool.name }}
            <span
              v-if="tool.websiteName && tool.websiteName !== tool.name"
              class="text-ink-400 dark:text-ink-500 text-2xl sm:text-3xl"
            >
              · {{ tool.websiteName }}
            </span>
          </h1>

          <p
            v-if="tool.shortDesc"
            class="mt-3 line-clamp-2 max-w-2xl text-pretty text-sm text-ink-600 sm:text-base dark:text-ink-300"
          >
            {{ tool.shortDesc }}
          </p>

          <!-- Trust line -->
          <p class="mt-4 text-[11px] text-ink-400 dark:text-ink-500">
            {{ trustLine }}
          </p>

          <!-- Category pills -->
          <div v-if="tool.categories && tool.categories.length" class="mt-4 flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="cat in tool.categories"
              :key="cat.handle"
              :to="`/category/${cat.handle}`"
              class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-700 transition hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
            >
              <span class="text-accent">#</span>{{ cat.name }}
            </NuxtLink>
          </div>
        </div>

        <!-- RIGHT: CTAs (desktop) / Full-width on mobile -->
        <div class="flex w-full flex-shrink-0 flex-col gap-2 md:w-auto md:min-w-[200px]">
          <a
            :href="tool.website || '#'"
            target="_blank"
            rel="noopener nofollow sponsored"
            class="btn-shine group/cta relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-cta px-5 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 ease-smooth hover:scale-[1.02] hover:shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_16px_56px_-12px_rgba(34,211,238,0.6)] active:scale-[0.98]"
            @mousemove="onMouseMove"
          >
            <span class="relative z-10">Visit {{ tool.name }}</span>
            <svg viewBox="0 0 24 24" class="relative z-10 h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M7 7h10v10"/>
            </svg>
          </a>

          <div class="flex gap-2">
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs font-semibold text-ink-700 transition hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
              @click="$emit('bookmark')"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
              </svg>
              Save
            </button>
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs font-semibold text-ink-700 transition hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
              @click="onShare"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14"/>
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import CategoryBreadcrumb from '../category/CategoryBreadcrumb.vue'
import { useGradientPalette } from '~/composables/useGradientPalette'

const props = defineProps({
  tool: { type: Object, required: true },
})
defineEmits(['bookmark'])

const imgError = ref(false)
const { pickByKey, gradientByKey } = useGradientPalette()

const parent = computed(() => props.tool?.parentCategory || null)

const accent = computed(() => pickByKey(props.tool?.handle || 'tool'))
const gradient = computed(() => gradientByKey(props.tool?.handle || 'tool'))
const initial = computed(() =>
  String(props.tool?.name || 'A').trim().charAt(0).toUpperCase(),
)

const pricingStyle = computed(() => {
  const pricing = props.tool?.pricing || []
  const pricingText = pricing.join(' ').toLowerCase()
  const hasFree = props.tool?.isFree || /\bfree\b/.test(pricingText)
  const hasPaid = /paid|pro|plus|premium|enterprise|\$/i.test(pricingText)
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

const trustLine = computed(() => {
  const visits = props.tool?.monthlyVisits || 0
  const collected = props.tool?.collected || 0
  if (visits > 1_000_000) return `Trusted by ${formatVisits(visits)}+ monthly users worldwide`
  if (visits > 100_000) return `${formatVisits(visits)}+ monthly visitors · Featured on aiseekertools`
  if (collected > 100) return `${collected}+ builders have bookmarked this tool`
  return `Curated by aiseekertools.com editorial team · Verified`
})

const updatedAgo = computed(() => {
  const d = props.tool?.updatedAt
  if (!d) return null
  const then = new Date(d).getTime()
  if (Number.isNaN(then)) return null
  const diff = Date.now() - then
  const day = Math.floor(diff / 86400000)
  if (day < 1) return 'today'
  if (day < 7) return `${day}d ago`
  if (day < 30) return `${Math.floor(day / 7)}w ago`
  if (day < 365) return `${Math.floor(day / 30)}mo ago`
  return `${Math.floor(day / 365)}y ago`
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

const onShare = async () => {
  if (!import.meta.client) return
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({ title: props.tool.name, url })
    } catch (e) {
      // user cancelled
    }
  } else if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url)
    } catch (e) {
      // ignore
    }
  }
}
</script>
