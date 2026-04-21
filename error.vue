<template>
  <div class="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
    <TheHeader />

    <!-- ===== Section 2: Error Hero ===== -->
    <section class="relative isolate overflow-hidden">
      <!-- Mesh backdrop 与全站 Hero 一致 -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 -z-10"
        :style="{
          background:
            errorCode === 404
              ? 'radial-gradient(60% 60% at 20% 0%, rgba(124,92,255,0.22) 0%, transparent 60%),radial-gradient(50% 50% at 90% 10%, rgba(34,211,238,0.18) 0%, transparent 60%)'
              : 'radial-gradient(60% 60% at 20% 0%, rgba(244,114,182,0.22) 0%, transparent 60%),radial-gradient(50% 50% at 90% 10%, rgba(124,92,255,0.18) 0%, transparent 60%)',
        }"
      ></div>
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] dark:opacity-[0.08]"
        style="
          background-image:
            linear-gradient(rgba(124,92,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,92,255,0.6) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 70% 60% at 30% 0%, #000 40%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 30% 0%, #000 40%, transparent 100%);
        "
      ></div>

      <div class="mx-auto w-full max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14 lg:px-8">
        <div class="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:gap-10 md:text-left">
          <!-- Animated AI icon -->
          <div class="flex-shrink-0">
            <div
              class="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-md sm:h-32 sm:w-32 dark:border-white/10 dark:bg-ink-900"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none absolute -inset-1 rounded-2xl opacity-40 blur-md animate-pulse-slow"
                :style="{ background: iconGradient }"
              ></span>

              <!-- 404: lost AI bot -->
              <svg
                v-if="errorCode === 404"
                class="relative z-10 h-20 w-20 sm:h-24 sm:w-24"
                viewBox="0 0 100 100"
                fill="none"
                stroke="url(#grad-404)"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <defs>
                  <linearGradient id="grad-404" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#7C5CFF"/>
                    <stop offset="100%" stop-color="#22D3EE"/>
                  </linearGradient>
                </defs>
                <rect x="22" y="30" width="56" height="44" rx="10"/>
                <circle cx="38" cy="50" r="4" fill="url(#grad-404)" stroke="none"/>
                <circle cx="62" cy="50" r="4" fill="url(#grad-404)" stroke="none"/>
                <path d="M42 62 Q50 58 58 62"/>
                <path d="M50 30 V18"/>
                <circle cx="50" cy="14" r="3" fill="url(#grad-404)" stroke="none"/>
                <path d="M18 46 h6 M76 46 h6"/>
              </svg>

              <!-- 500: maintenance wrench + gear -->
              <svg
                v-else
                class="relative z-10 h-20 w-20 sm:h-24 sm:w-24"
                viewBox="0 0 100 100"
                fill="none"
                stroke="url(#grad-500)"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <defs>
                  <linearGradient id="grad-500" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#F472B6"/>
                    <stop offset="100%" stop-color="#7C5CFF"/>
                  </linearGradient>
                </defs>
                <circle cx="42" cy="42" r="14"/>
                <circle cx="42" cy="42" r="4" fill="url(#grad-500)" stroke="none"/>
                <path d="M42 22 v6 M42 56 v6 M22 42 h6 M56 42 h6"/>
                <path d="M58 58 L78 78 a6 6 0 0 1 -8 8 L50 66"/>
              </svg>
            </div>
          </div>

          <!-- Copy & actions -->
          <div class="min-w-0 flex-1">
            <div class="inline-flex items-center gap-2">
              <span
                :class="[
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  errorCode === 404
                    ? 'bg-primary/10 text-primary-600 dark:text-accent'
                    : 'bg-signal/10 text-signal-600 dark:text-signal',
                ]"
              >
                Error {{ errorCode }}
              </span>
              <NuxtLink
                to="/"
                class="text-[11px] font-medium text-ink-400 transition hover:text-primary-600 dark:text-ink-500 dark:hover:text-accent"
              >
                ← back to home
              </NuxtLink>
            </div>

            <h1
              class="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl lg:text-5xl dark:text-white"
            >
              <span class="text-gradient">{{ headline }}</span>
            </h1>
            <p class="mt-3 max-w-xl text-pretty text-sm text-ink-600 sm:text-base dark:text-ink-300">
              {{ subline }}
            </p>

            <!-- Search box -->
            <form
              class="group relative mt-5 max-w-xl"
              role="search"
              @submit.prevent="submitSearch"
            >
              <div
                :class="[
                  'relative overflow-hidden rounded-2xl border bg-white transition-all duration-300 ease-smooth dark:bg-ink-800/80',
                  searchFocused
                    ? 'border-primary/50 shadow-glow'
                    : 'border-ink-200 shadow-sm dark:border-white/10',
                ]"
              >
                <div class="relative flex items-center gap-3 px-4 py-3 sm:px-5">
                  <svg viewBox="0 0 24 24" class="h-5 w-5 flex-shrink-0 text-ink-400" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="7"/>
                    <path stroke-linecap="round" d="M21 21l-4.3-4.3"/>
                  </svg>
                  <input
                    v-model="searchDraft"
                    type="search"
                    autocomplete="off"
                    placeholder="Search 20,000+ AI tools…"
                    class="min-w-0 flex-1 bg-transparent text-base text-ink-900 placeholder:text-ink-400 focus:outline-none dark:text-white"
                    @focus="searchFocused = true"
                    @blur="searchFocused = false"
                  />
                  <button
                    type="submit"
                    class="btn-shine relative hidden flex-shrink-0 overflow-hidden rounded-xl bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow transition-transform duration-200 hover:scale-[1.03] sm:inline-flex"
                    @mousemove="onMouseMove"
                  >
                    <span class="relative z-10">Search</span>
                  </button>
                </div>
              </div>
            </form>

            <!-- Quick links (Pill buttons) -->
            <div class="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
              <NuxtLink
                v-for="link in quickLinks"
                :key="link.to"
                :to="link.to"
                :class="[
                  'btn-shine group/link inline-flex items-center gap-1.5 overflow-hidden rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ease-smooth',
                  link.variant === 'primary'
                    ? 'bg-gradient-cta text-white shadow-glow hover:scale-[1.03]'
                    : 'border border-ink-200 bg-white text-ink-700 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white',
                ]"
                @mousemove="onMouseMove"
              >
                <span v-html="iconSvgFor(link.icon)" aria-hidden="true"></span>
                {{ link.label }}
              </NuxtLink>
            </div>

            <!-- Optional: 500 retry button -->
            <div v-if="errorCode !== 404" class="mt-3">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition hover:text-primary-600 dark:text-ink-400 dark:hover:text-accent"
                @click="retry"
              >
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Main Content ===== -->
    <main class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <!-- ===== Section 4: Hot Categories (horizontal pills) ===== -->
      <section v-if="categories.length" aria-labelledby="hot-cats-heading" class="mt-4">
        <header class="mb-4 flex items-end justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
            <h2 id="hot-cats-heading" class="text-base font-semibold text-ink-900 dark:text-white">
              Explore popular categories
            </h2>
          </div>
          <NuxtLink
            to="/category"
            class="hidden items-center gap-1 text-xs font-semibold text-primary-600 transition hover:text-primary-700 sm:inline-flex dark:text-accent dark:hover:text-white"
          >
            View all
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </NuxtLink>
        </header>

        <div class="-mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
          <div class="flex gap-2.5 whitespace-nowrap pb-1">
            <NuxtLink
              v-for="(cat, i) in categories"
              :key="cat.id"
              :to="`/category/${cat.handle}`"
              class="group inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-ink-200 bg-gradient-to-br from-ink-50/60 to-white px-3.5 py-2 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm dark:border-white/5 dark:from-white/[0.03] dark:to-white/[0.01] dark:hover:border-primary/40"
            >
              <span
                aria-hidden="true"
                class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-300 group-hover:scale-110"
                :style="{ background: gradientByKey(`${cat.handle}-${i}`) }"
              >
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10l9 4 9-4V7l-9-4-9 4zM12 3v18M3 7l9 4 9-4"/>
                </svg>
              </span>
              <span class="text-xs font-semibold text-ink-800 group-hover:text-primary-600 dark:text-white">
                {{ cat.name }}
              </span>
              <span class="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500 dark:bg-white/5 dark:text-ink-400">
                {{ cat.toolCount }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- ===== Section 3: Trending AI Tools ===== -->
      <section
        v-if="tools.length"
        aria-labelledby="trending-heading"
        class="mt-10"
      >
        <header class="mb-5 flex items-end justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
            <div>
              <h2 id="trending-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
                Meanwhile, try these trending tools
              </h2>
              <p class="text-xs text-ink-500 dark:text-ink-400">
                Hand-picked by our editorial team · Updated today
              </p>
            </div>
          </div>
        </header>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <template v-for="(item, index) in tools" :key="item.id">
            <SubToolAdCard
              v-if="item.isAd"
              :slot-id="item.slotId"
            />
            <SubToolCard
              v-else
              :tool="item"
              :priority="index < 3"
              :rank="null"
            />
          </template>
        </div>
      </section>

      <!-- ===== Section 5: Banner Ad (before footer) ===== -->
      <div class="mt-10">
        <AdSlot
          variant="banner"
          label="Sponsored"
          slot-id="error-bottom"
          class="min-h-[220px]"
        />
      </div>
    </main>

    <TheFooter />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TheHeader from '~/themes/de.test.com/components/TheHeader.vue'
import TheFooter from '~/themes/de.test.com/components/TheFooter.vue'
import AdSlot from '~/themes/de.test.com/components/AdSlot.vue'
import SubToolCard from '~/themes/de.test.com/components/category/SubToolCard.vue'
import SubToolAdCard from '~/themes/de.test.com/components/category/SubToolAdCard.vue'
import { useGradientPalette } from '~/composables/useGradientPalette'

const props = defineProps({
  error: { type: Object, required: true },
})

const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://aiseekertools.com'

const { gradientByKey } = useGradientPalette()

// ---------- Error classification ----------
const errorCode = computed(() => {
  const code = Number(props.error?.statusCode || 404)
  return code === 404 ? 404 : code >= 500 ? 500 : code
})

const headline = computed(() => {
  if (errorCode.value === 404) return "This AI got lost in the matrix"
  if (errorCode.value >= 500) return 'Our AI is taking a quick coffee break'
  return 'Something unexpected happened'
})

const subline = computed(() => {
  if (errorCode.value === 404) {
    return "The page you're looking for doesn't exist or has been moved. But we've got 20,000+ other tools waiting to solve your problem."
  }
  if (errorCode.value >= 500) {
    return "We hit a temporary glitch — our engineers are on it. Meanwhile, explore trending tools or pop a keyword into the search below."
  }
  return props.error?.message || 'Pick up where you left off using the search box or links below.'
})

const iconGradient = computed(() =>
  errorCode.value === 404
    ? 'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)'
    : 'linear-gradient(135deg, #F472B6 0%, #7C5CFF 100%)',
)

// ---------- Icon helpers for quick links ----------
const iconSvgFor = (key) => {
  const size = 'class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"'
  switch (key) {
    case 'home':
      return `<svg ${size}><path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2h-4v-8h-6v8H5a2 2 0 01-2-2z"/></svg>`
    case 'grid':
      return `<svg ${size}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`
    case 'edit':
      return `<svg ${size}><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
    case 'video':
      return `<svg ${size}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`
    default:
      return `<svg ${size}><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/></svg>`
  }
}

// ---------- SSR data fetch ----------
// error.vue 作为全局错误页，和普通页面一样可用 useAsyncData
const { data } = await useAsyncData(
  'error-page-data',
  () => $fetch('/api/error-page-data'),
  { default: () => ({ tools: [], categories: [], quickLinks: [] }) },
)

const tools = computed(() => data.value?.tools || [])
const categories = computed(() => data.value?.categories || [])
const quickLinks = computed(
  () =>
    data.value?.quickLinks || [
      { label: 'Home', to: '/', variant: 'primary', icon: 'home' },
      { label: 'All Categories', to: '/category', variant: 'ghost', icon: 'grid' },
    ],
)

// ---------- Search ----------
const searchDraft = ref('')
const searchFocused = ref(false)

const submitSearch = () => {
  const q = searchDraft.value.trim()
  if (!q) {
    router.push('/search')
    return
  }
  router.push({ path: '/search', query: { q } })
}

// ---------- Retry (500) ----------
const retry = () => {
  if (!import.meta.client) return
  clearError({ redirect: router.currentRoute.value.fullPath || '/' })
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

// ---------- SEO + GA (preserve legacy GA tracking) ----------
const pageTitle = computed(() => {
  if (errorCode.value === 404) return `404 — Page Not Found | aiseekertools`
  if (errorCode.value >= 500) return `500 — Server Error | aiseekertools`
  return `Error ${errorCode.value} | aiseekertools`
})

useServerSeoMeta({
  title: pageTitle,
  description:
    errorCode.value === 404
      ? "Page not found. Explore 20,000+ curated AI tools, trending categories and hand-picked alternatives."
      : 'Server error. Please try again in a moment — or browse our directory of trending AI tools.',
  robots: 'noindex, follow',
})

useHead({
  script: [
    {
      async: true,
      src: 'https://www.googletagmanager.com/gtag/js?id=G-Q07QBT75PN',
    },
    {
      innerHTML: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-Q07QBT75PN');
        gtag('event', 'error_page_view', { error_code: ${errorCode.value} });
      `,
    },
  ],
  link: [{ rel: 'canonical', href: `${siteUrl}/` }],
})
</script>
