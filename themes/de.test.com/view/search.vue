<template>
  <div class="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
    <TheHeader />

    <!-- ===== Section 2: Search Hero ===== -->
    <SearchHero
      :query="query"
      :total="pagination.total"
      :trending-tags="trendingTags"
      @submit="handleSubmit"
    />

    <!-- ===== Section 3: Filter bar (sticky) ===== -->
    <SearchFilterBar
      v-if="query && pagination.total > 0"
      :price="filters.price"
      :sort="filters.sort"
      @update:price="updateFilter('price', $event)"
      @update:sort="updateFilter('sort', $event)"
    />

    <!-- ===== Main layout ===== -->
    <main class="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <!-- A. Empty / no-query state: fallback tools + suggested categories -->
      <SearchEmptyState
        v-if="!query || pagination.total === 0"
        :query="query"
        :tools="popularFallback"
        :suggested-categories="similarCategories"
      />

      <!-- B. Results state -->
      <template v-else>
        <!-- Section 4: Results Grid -->
        <section aria-labelledby="results-heading" class="space-y-6">
          <div class="flex items-end justify-between gap-4">
            <h2
              id="results-heading"
              class="text-lg font-semibold text-ink-900 dark:text-white"
            >
              Showing
              <strong class="text-gradient">{{ visibleRealCount }}</strong>
              of {{ pagination.total }}
            </h2>
            <p class="text-xs text-ink-500 dark:text-ink-400">
              Sorted by {{ sortLabel }}
            </p>
          </div>

          <!-- Results grid — 3 cols desktop / 2 tablet / 1 mobile -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <template v-for="(item, index) in displayedTools" :key="item.id">
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

            <!-- Loading more skeleton -->
            <template v-if="loadingMore">
              <div
                v-for="n in 3"
                :key="`sk-${n}`"
                class="min-h-[200px] animate-pulse rounded-2xl border border-ink-200 bg-white p-5 dark:border-white/5 dark:bg-ink-800/40"
              >
                <div class="flex items-start gap-4">
                  <div class="h-[72px] w-[72px] flex-shrink-0 rounded-xl bg-ink-100 dark:bg-white/5"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-4 w-1/2 rounded bg-ink-100 dark:bg-white/5"></div>
                    <div class="h-3 w-1/3 rounded bg-ink-100 dark:bg-white/5"></div>
                    <div class="h-3 w-full rounded bg-ink-100 dark:bg-white/5"></div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Load more -->
          <div v-if="showLoadMore" class="flex justify-center pt-4">
            <button
              type="button"
              :disabled="loadingMore"
              class="btn-shine inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-primary/50 hover:text-primary-600 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
              @click="loadMore"
              @mousemove="onMouseMove"
            >
              <svg
                v-if="loadingMore"
                viewBox="0 0 24 24"
                class="h-4 w-4 animate-spin"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path stroke-linecap="round" d="M12 2a10 10 0 0110 10"/>
              </svg>
              <span v-if="loadingMore">Loading…</span>
              <span v-else>Load {{ nextLoadSize }} more</span>
              <svg
                v-if="!loadingMore"
                viewBox="0 0 24 24"
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>
        </section>

        <!-- ===== Section 6: Retention — You May Also Like ===== -->
        <section
          v-if="popularFallback.length"
          aria-labelledby="umal-heading"
          class="mt-12"
        >
          <header class="mb-5 flex items-end justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
              <div>
                <h2 id="umal-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
                  You may also like
                </h2>
                <p class="text-xs text-ink-500 dark:text-ink-400">
                  Discover what others are using this week.
                </p>
              </div>
            </div>
          </header>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SubToolCard
              v-for="t in popularFallback.slice(0, 6)"
              :key="t.id"
              :tool="t"
              :priority="false"
              :rank="null"
            />
          </div>
        </section>
      </template>

      <!-- Similar categories (always bottom, drives站内分发) -->
      <div v-if="similarCategories.length" class="mt-10">
        <SimilarCategoriesBar :items="similarCategories" />
      </div>

      <!-- Banner ad (低干扰位置 —— 底部) -->
      <div class="mt-10">
        <AdSlot
          variant="banner"
          label="Sponsored"
          slot-id="search-bottom"
          class="min-h-[220px]"
        />
      </div>
    </main>

    <TheFooter />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TheHeader from '../components/TheHeader.vue'
import TheFooter from '../components/TheFooter.vue'
import AdSlot from '../components/AdSlot.vue'
import SubToolCard from '../components/category/SubToolCard.vue'
import SubToolAdCard from '../components/category/SubToolAdCard.vue'
import SearchHero from '../components/search/SearchHero.vue'
import SearchFilterBar from '../components/search/SearchFilterBar.vue'
import SearchEmptyState from '../components/search/SearchEmptyState.vue'
import SimilarCategoriesBar from '../components/search/SimilarCategoriesBar.vue'

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://aiseekertools.com'

// ---------- URL state ----------
const query = computed(() => String(route.query.q || '').trim().slice(0, 80))
const filters = ref({
  price: ['free', 'freemium', 'pro'].includes(route.query.price) ? route.query.price : 'all',
  sort: ['relevance', 'rating', 'new'].includes(route.query.sort) ? route.query.sort : 'relevance',
})

// Key for useAsyncData — 任何参数变化都重新取
const dataKey = computed(
  () => `search:${query.value}:${filters.value.price}:${filters.value.sort}`,
)

// ---------- SSR data ----------
const { data, pending, refresh } = await useAsyncData(
  () => dataKey.value,
  () =>
    $fetch('/api/search', {
      query: {
        q: query.value,
        price: filters.value.price,
        sort: filters.value.sort,
        page: 1,
      },
    }),
  { watch: [dataKey] },
)

const pagination = computed(
  () =>
    data.value?.pagination || {
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 1,
      hasMore: false,
    },
)
const ssrTools = computed(() => data.value?.tools || [])
const popularFallback = computed(() => data.value?.popularFallback || [])
const similarCategories = computed(() => data.value?.similarCategories || [])
const trendingTags = computed(() => data.value?.trendingTags || [])

// ---------- Load-more ----------
const appendedTools = ref([])
const loadingMore = ref(false)

watch(dataKey, () => {
  appendedTools.value = []
})

const displayedTools = computed(() => [...ssrTools.value, ...appendedTools.value])

const visibleRealCount = computed(
  () => displayedTools.value.filter((t) => !t.isAd).length,
)

const realToolsLoaded = computed(
  () =>
    ssrTools.value.filter((t) => !t.isAd).length +
    appendedTools.value.filter((t) => !t.isAd).length,
)

const showLoadMore = computed(
  () => !pending.value && pagination.value.total > realToolsLoaded.value,
)

const nextLoadSize = computed(() =>
  Math.min(pagination.value.pageSize, pagination.value.total - realToolsLoaded.value),
)

const loadMore = async () => {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const nextPage = Math.floor(realToolsLoaded.value / pagination.value.pageSize) + 1
    const res = await $fetch('/api/search', {
      query: {
        q: query.value,
        price: filters.value.price,
        sort: filters.value.sort,
        page: nextPage,
      },
    })
    // Load-more 分页不再注入广告（单页广告密度已达 2/12 = 16.7% 的健康值）
    appendedTools.value.push(...(res?.tools || []))
  } catch (e) {
    // silent
  } finally {
    loadingMore.value = false
  }
}

// ---------- Filter / Search handlers (URL-driven, SSR friendly) ----------
const pushUrl = (nextQuery) => {
  const clean = { ...route.query, ...nextQuery }
  Object.keys(clean).forEach((k) => {
    if (clean[k] === '' || clean[k] === null || clean[k] === undefined) delete clean[k]
  })
  router.push({ path: '/search', query: clean })
}

const handleSubmit = (value) => {
  pushUrl({ q: value || undefined, page: undefined })
}

const updateFilter = (key, value) => {
  filters.value[key] = value
  const defaults = { price: 'all', sort: 'relevance' }
  pushUrl({ [key]: value === defaults[key] ? undefined : value })
}

// ---------- Display helpers ----------
const sortLabel = computed(() => {
  switch (filters.value.sort) {
    case 'rating':
      return 'rating'
    case 'new':
      return 'newest'
    default:
      return 'relevance'
  }
})

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

// ---------- SEO ----------
const seoTitle = computed(() => {
  if (query.value) {
    return `"${query.value}" AI Tools Search Results | 2026 Best AI Tools`
  }
  return `Search 20,000+ AI Tools | aiseekertools`
})

const seoDescription = computed(() => {
  if (query.value) {
    const total = pagination.value.total
    if (total > 0) {
      return `Find the best AI tools for ${query.value}. Browse ${total} free & premium AI tools with ratings & reviews. Updated April 2026.`
    }
    return `Discover popular AI tools similar to "${query.value}". Hand-picked by traffic, rating and recency.`
  }
  return 'Search thousands of hand-curated AI tools by keyword, category or pricing. Find exactly what you need in seconds.'
})

const canonical = computed(() => {
  if (query.value) {
    return `${siteUrl}/search?q=${encodeURIComponent(query.value)}`
  }
  return `${siteUrl}/search`
})

useServerSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'website',
  ogImage: `${siteUrl}/og-search.jpg`,
  twitterCard: 'summary_large_image',
  // 无 query 或空结果时避免 Google 索引碎片 URL
  robots: () =>
    !query.value || pagination.value.total === 0 ? 'noindex, follow' : 'index, follow',
})

useHead(() => {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: query.value ? `Search: ${query.value}` : 'Search',
        item: canonical.value,
      },
    ],
  }

  const scripts = [{ type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumb) }]

  // 有结果时塞一个 ItemList 进去增加 SERP 丰富度
  if (query.value && ssrTools.value.length) {
    const realTools = ssrTools.value.filter((t) => !t.isAd).slice(0, 10)
    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `AI tools for "${query.value}"`,
      itemListElement: realTools.map((t, i) => ({
        '@type': 'SoftwareApplication',
        position: i + 1,
        name: t.name,
        url: t.website || `${siteUrl}/tools/${t.handle}`,
        aggregateRating: t.rating
          ? { '@type': 'AggregateRating', ratingValue: t.rating, bestRating: 5, reviewCount: 1 }
          : undefined,
      })),
    }
    scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(itemList) })
  }

  return {
    script: scripts,
    link: [{ rel: 'canonical', href: canonical.value }],
  }
})

// Compatibility: manual refresh exposed for potential HMR / external trigger
defineExpose({ refresh })
</script>
