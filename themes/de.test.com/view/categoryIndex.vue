<template>
  <div class="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
    <TheHeader />

    <!-- ====== Section 2: Hero + Search ====== -->
    <section class="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 -z-10 bg-mesh-hero opacity-80 animate-gradient-pan"
      ></div>
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] dark:opacity-[0.12]"
        style="
          background-image:
            linear-gradient(rgba(124,92,255,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,92,255,0.6) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, #000 50%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, #000 50%, transparent 100%);
        "
      ></div>

      <div class="mx-auto w-full max-w-5xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
        <div class="mb-6 flex justify-center">
          <span class="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-600 dark:text-ink-200">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent"></span>
            </span>
            {{ counts.level1Total }} top categories · {{ counts.level2Total }} sub-categories
          </span>
        </div>

        <h1
          class="animate-fade-up text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl dark:text-white"
        >
          Explore
          <span class="text-gradient animate-gradient-pan">{{ counts.level2Total || '400+' }} AI categories</span>
          <br class="hidden sm:block" />
          — find your edge in seconds.
        </h1>
        <p class="mx-auto mt-5 max-w-2xl text-pretty text-base text-ink-500 sm:text-lg dark:text-ink-300">
          The most comprehensive AI category atlas on the web. Search by niche,
          scan curated trending picks, and dive into any {{ counts.level2Total || 400 }}+ specialized landing pages.
        </p>

        <div class="mt-8">
          <CategorySearch :source="searchableSubs" />
        </div>

        <!-- Hot tags row -->
        <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span class="text-xs font-medium uppercase tracking-[0.16em] text-ink-400">
            Popular
          </span>
          <NuxtLink
            v-for="tag in hub.tags"
            :key="tag.handle"
            :to="`/category/${tag.handle}`"
            class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700 transition hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
          >
            <span class="text-accent">#</span>{{ tag.name }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ====== Main content ====== -->
    <main class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <!-- Section 3: Trending / High-CPC Niches -->
      <div class="mt-4">
        <TrendingNiches :items="hub.trending" />
      </div>

      <!-- Between: full-width banner ad -->
      <section class="mt-12" aria-label="Advertisement">
        <AdSlot variant="banner" label="Ad Slot · Hub Banner" slot-id="category-hub-banner" />
      </section>

      <!-- Section 4: Category Matrix -->
      <div class="mt-12">
        <CategoryMatrix :categories="hub.level1" />
      </div>

      <!-- Section 5: SEO block -->
      <div class="mt-16">
        <CategorySeoBlock
          :title="hub.seo?.title || 'Explore AI Categories'"
          :body="hub.seo?.body || ''"
          :top-subs="hub.tags"
        />
      </div>
    </main>

    <TheFooter />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TheHeader from '../components/TheHeader.vue'
import TheFooter from '../components/TheFooter.vue'
import AdSlot from '../components/AdSlot.vue'
import CategorySearch from '../components/category/CategorySearch.vue'
import TrendingNiches from '../components/category/TrendingNiches.vue'
import CategoryMatrix from '../components/category/CategoryMatrix.vue'
import CategorySeoBlock from '../components/category/CategorySeoBlock.vue'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://aiseekertools.com'

// ------- SSR data (首屏零阻塞) -------
const { data: hub } = await useAsyncData(
  'category-hub',
  () => $fetch('/api/categories/hub'),
  {
    default: () => ({
      level1: [],
      trending: [],
      tags: [],
      seo: {},
      counts: { level1Total: 0, level2Total: 0 },
    }),
  },
)

const counts = computed(() => hub.value?.counts || { level1Total: 0, level2Total: 0 })

// 聚合所有二级分类供搜索用（纯本地过滤，零网络延迟）
const searchableSubs = computed(() => {
  const list = []
  const seen = new Set()
  const push = (item) => {
    if (!item || !item.handle || seen.has(item.handle)) return
    seen.add(item.handle)
    list.push(item)
  }
  ;(hub.value?.level1 || []).forEach((l1) => {
    ;(l1.topSubs || []).forEach((s) =>
      push({ id: s.id, name: s.name, handle: s.handle, toolCount: s.toolCount }),
    )
  })
  ;(hub.value?.trending || []).forEach((t) =>
    push({ id: t.id, name: t.name, handle: t.handle, toolCount: t.toolCount }),
  )
  ;(hub.value?.tags || []).forEach((t) =>
    push({ id: t.id, name: t.name, handle: t.handle }),
  )
  return list
})

// ------- SEO meta + JSON-LD -------
useSeoMeta({
  title: `Explore ${counts.value.level2Total || 400}+ AI Categories · aiseekertools`,
  description:
    'Browse every AI category in one place. Discover writing, marketing, coding, design, video, image, voice, and automation tools — hand-curated and updated daily.',
  ogTitle: `Explore ${counts.value.level2Total || 400}+ AI Categories`,
  ogDescription:
    'The most comprehensive AI tools directory. Find the right AI for any workflow.',
  ogImage: `${siteUrl}/og-category.jpg`,
  twitterCard: 'summary_large_image',
})

const breadcrumbLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
    { '@type': 'ListItem', position: 2, name: 'Categories', item: `${siteUrl}/category` },
  ],
}))

const itemListLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'AI Categories',
  itemListElement: (hub.value?.level1 || []).slice(0, 30).map((l1, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: l1.name,
    url: `${siteUrl}/category/${l1.handle}`,
  })),
}))

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}${route.path}` }],
  script: [
    { type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumbLd.value) },
    { type: 'application/ld+json', innerHTML: JSON.stringify(itemListLd.value) },
  ],
})
</script>
