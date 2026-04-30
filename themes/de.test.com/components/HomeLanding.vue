<template>
  <div class="relative">
    <!-- Hero -->
    <HeroSection />

    <!-- Main content -->
    <main class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <!-- Categories Pill Nav -->
      <section aria-labelledby="cats-heading" class="pt-2">
        <h2 id="cats-heading" class="sr-only">Browse categories</h2>
        <CategoryPills v-model="activeCategory" :items="categoryTabs" />
      </section>

      <!-- Section A: Trending AI Tools -->
      <section aria-labelledby="trending-heading" class="mt-10">
        <div class="mb-5 flex items-end justify-between gap-4">
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              Today · hand-picked
            </p>
            <h2
              id="trending-heading"
              class="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl dark:text-white"
            >
              Trending AI Tools
            </h2>
          </div>
          <NuxtLink
            to="/ai-tools"
            class="group hidden items-center gap-1 text-sm font-medium text-primary-600 transition hover:text-primary-500 dark:text-accent dark:hover:text-accent-400 sm:inline-flex"
          >
            View all
            <svg viewBox="0 0 24 24" class="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
            </svg>
          </NuxtLink>
        </div>

        <!-- Bento-ish responsive grid -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <template v-for="(item, index) in trendingWithAds" :key="item.key">
            <AdSlot
              v-if="item.type === 'ad'"
              variant="native-card"
              :label="item.label"
              :slot-id="item.slotId"
            />
            <ToolCard
              v-else
              :tool="item.tool"
              :priority="index < 4"
            />
          </template>
        </div>
      </section>

      <!-- Between A & B: Full-width banner ad slot -->
      <section class="mt-12" aria-label="Advertisement">
        <AdSlot variant="banner" label="Ad Slot · In-between Banner" slot-id="home-mid-banner" />
      </section>

      <!-- Section B: Featured Collections -->
      <section aria-labelledby="collections-heading" class="mt-12">
        <div class="mb-5 flex items-end justify-between gap-4">
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.2em] text-signal">
              Editorial · deep dives
            </p>
            <h2
              id="collections-heading"
              class="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl dark:text-white"
            >
              Featured Collections
            </h2>
            <p class="mt-1 max-w-xl text-sm text-ink-500 dark:text-ink-300">
              Themed roundups hand-picked by our editors. Perfect for decision-making.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CollectionCard
            v-for="(c, i) in collections"
            :key="c.title"
            :collection="c"
            :large="i === 0"
          />
        </div>
      </section>

      <!-- Quick stats strip (social proof) -->
      <section class="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="glass rounded-2xl p-4 text-center"
        >
          <p class="text-gradient text-2xl font-semibold">{{ stat.value }}</p>
          <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">{{ stat.label }}</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import HeroSection from './HeroSection.vue'
import CategoryPills from './CategoryPills.vue'
import ToolCard from './ToolCard.vue'
import CollectionCard from './CollectionCard.vue'
import AdSlot from './AdSlot.vue'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://aiseekertools.com'

const activeCategory = ref('all')

// ----- Data: tools + categories (SSR) -----
const { data } = await useAsyncData(
  'home-landing',
  () =>
    $fetch('/api/tools', {
      query: { page: 1, pageSize: 12, sort: 'hot' },
    }),
  {
    default: () => ({ categories: [], tools: [] }),
    transform: (res) => res || { categories: [], tools: [] },
  },
)

const tools = computed(() => data.value?.tools || [])
const categories = computed(() => data.value?.categories || [])

const categoryTabs = computed(() => [
  { name: 'All', handle: 'all', tool_count: tools.value.length },
  ...categories.value,
])

const filteredTools = computed(() => {
  if (activeCategory.value === 'all') return tools.value
  return tools.value.filter((t) =>
    (t.categories || []).some((c) => c.handle === activeCategory.value),
  )
})

// Insert 2 native-looking ads inside the trending grid (after slot 4 & 9)
const trendingWithAds = computed(() => {
  const list = []
  const injectAfter = [{ after: 4, slotId: 'home-native-1' }, { after: 9, slotId: 'home-native-2' }]
  filteredTools.value.forEach((tool, idx) => {
    list.push({ key: `tool-${tool.id}-${idx}`, type: 'tool', tool })
    const ad = injectAfter.find((s) => s.after === idx + 1)
    if (ad) {
      list.push({
        key: `ad-${ad.slotId}`,
        type: 'ad',
        slotId: ad.slotId,
        label: 'Sponsored',
      })
    }
  })
  return list
})

// ----- Featured collections (静态示例, 可接后端) -----
const collections = [
  {
    title: 'Top 10 AI Tools for SEO & Content in 2026',
    excerpt:
      'From long-form writers to schema automators — a shortlist of the highest-ROI AI tools SEOs are actually shipping with.',
    handle: 'ai-seo',
    href: '/collection/top-10-ai-tools-for-seo',
    kicker: 'Editor\'s Pick',
    count: 10,
    gradient: 0,
    cover: null,
    logos: [],
  },
  {
    title: 'AI Video Generators That Don\'t Look AI',
    excerpt: 'Photoreal lipsync, native 4K, realistic avatars — the only 6 tools worth your time.',
    handle: 'ai-video',
    kicker: 'Deep Dive',
    count: 6,
    gradient: 1,
    cover: null,
  },
  {
    title: 'Best Free ChatGPT Alternatives',
    excerpt: 'Open-source, local-first, and zero-login options that rival GPT-4.',
    handle: 'chatgpt-alternatives',
    kicker: 'Free Stack',
    count: 8,
    gradient: 3,
    cover: null,
  },
]

const stats = [
  { value: '7,200+', label: 'AI tools curated' },
  { value: '120K+', label: 'Monthly visitors' },
  { value: '98%', label: 'Editor approval' },
  { value: 'Daily', label: 'Fresh updates' },
]

// ----- SEO -----
const topToolsForSchema = computed(() => filteredTools.value.slice(0, 10))

useSeoMeta({
  title: 'aiseekertools — Discover the best AI tools for any workflow',
  description:
    'Curated AI tools directory for creators, marketers, and developers. Compare, filter, and ship with confidence. Updated daily.',
  ogTitle: 'aiseekertools — The AI tools directory that ships',
  ogDescription:
    'Hand-picked AI products, deep dives, and editorial collections. Trusted by 120K+ builders.',
  ogImage: `${siteUrl}/og-home.jpg`,
  twitterCard: 'summary_large_image',
})

useHead({
  link: [
    { rel: 'canonical', href: `${siteUrl}${route.path}` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'aiseekertools',
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: topToolsForSchema.value.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.name,
          url: t.website || `${siteUrl}/tools/${t.handle}`,
        })),
      }),
    },
  ],
})
</script>
