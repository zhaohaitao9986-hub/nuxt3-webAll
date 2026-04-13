<template>
  <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <section class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {{ copy.heroTitle }}
        </h1>
        <p class="mt-3 max-w-3xl text-slate-600">
          {{ copy.heroDescription }}
        </p>
        <div class="mt-4">
          <label for="tool-search" class="sr-only">{{ copy.searchPlaceholder }}</label>
          <input
            id="tool-search"
            v-model="search"
            type="search"
            :placeholder="copy.searchPlaceholder"
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none ring-slate-300 transition focus:ring"
          >
        </div>
      </div>
      <AdPlaceholder :label="copy.topAdLabel" size="sidebar" />
    </section>

    <section class="mt-6 flex flex-wrap gap-2">
      <button
        v-for="item in categoryTabs"
        :key="item.handle"
        type="button"
        class="rounded-full border px-3 py-1.5 text-sm transition"
        :class="
          activeCategory === item.handle
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
        "
        @click="activeCategory = item.handle"
      >
        {{ item.name }}
      </button>
    </section>

    <section class="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <div class="grid gap-4 sm:grid-cols-2">
          <template v-for="(item, index) in mergedList" :key="item.key">
            <AdPlaceholder
              v-if="item.type === 'ad'"
              :label="item.label"
              size="feed"
            />
            <ToolCard
              v-else
              :tool="item.tool"
            />
          </template>
        </div>
        <AdPlaceholder class="mt-6" :label="copy.bottomAdLabel" size="banner" />
      </div>

      <aside class="space-y-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <h2 class="text-base font-semibold text-slate-900">
            {{ copy.sidebarTitle }}
          </h2>
          <ul class="mt-3 space-y-2 text-sm text-slate-600">
            <li
              v-for="tool in tools.slice(0, 5)"
              :key="tool.handle"
              class="line-clamp-1"
            >
              {{ tool.name }}
            </li>
          </ul>
        </div>
        <AdPlaceholder :label="copy.sidebarAdLabel" size="sidebar" />
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import ToolCard from './ToolCard.vue'
import AdPlaceholder from './AdPlaceholder.vue'
type CategoryItem = { name: string; handle: string; tool_count: number }
type ToolItem = {
  id: number
  handle: string
  name: string
  description: string | null
  website: string | null
  website_logo: string | null
  month_visited_count: number
  collected_count: number
  is_free: boolean
  categories: Array<{ name: string; handle: string }>
}

type ApiResult = {
  categories: CategoryItem[]
  tools: ToolItem[]
}

const copy = {
  pageTitle: 'Best AI Tools Directory 2026',
  pageDescription:
    'Discover trending AI tools, compare categories, and find the right product faster with curated summaries.',
  heroTitle: 'Discover the Best AI Tools for Every Workflow',
  heroDescription:
    'Compare curated AI products by category, popularity, and use-case. Updated frequently for marketers, creators, and developers.',
  searchPlaceholder: 'Search AI tools, categories or use-cases...',
  topAdLabel: 'Top Sponsored Placement',
  bottomAdLabel: 'In-feed Ad Placement',
  sidebarAdLabel: 'Sidebar Sponsored Slot',
  sidebarTitle: 'Trending Right Now',
  allTab: 'All',
  insertedAdA: 'Sponsored Result',
  insertedAdB: 'Recommended Sponsor',
}

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://example.com'
const search = ref('')
const activeCategory = ref('all')

const { data } = await useAsyncData<ApiResult>(
  'home-tools-data',
  () =>
    $fetch('/api/tools', {
      query: {
        page: 1,
        pageSize: 20,
        sort: 'hot',
      },
    }),
  {
    default: () => ({ categories: [], tools: [] }),
  },
)

const tools = computed(() => data.value?.tools || [])
const categories = computed(() => data.value?.categories || [])

const categoryTabs = computed(() => [
  { name: copy.allTab, handle: 'all', tool_count: tools.value.length },
  ...categories.value,
])

const filteredTools = computed(() => {
  return tools.value.filter((tool) => {
    const matchedCategory =
      activeCategory.value === 'all' ||
      tool.categories.some((category) => category.handle === activeCategory.value)
    if (!matchedCategory) return false
    if (!search.value.trim()) return true

    const keyword = search.value.toLowerCase()
    return (
      tool.name.toLowerCase().includes(keyword) ||
      (tool.description || '').toLowerCase().includes(keyword) ||
      tool.categories.some((category) => category.name.toLowerCase().includes(keyword))
    )
  })
})

const mergedList = computed(() => {
  const adSlots = [
    { after: 4, label: copy.insertedAdA },
    { after: 9, label: copy.insertedAdB },
  ]

  const list: Array<
    | { key: string; type: 'tool'; tool: ToolItem }
    | { key: string; type: 'ad'; label: string }
  > = []

  filteredTools.value.forEach((tool, index) => {
    list.push({ key: `tool-${tool.id}`, type: 'tool', tool })
    const ad = adSlots.find((slot) => slot.after === index + 1)
    if (ad) {
      list.push({ key: `ad-${ad.after}`, type: 'ad', label: ad.label })
    }
  })

  return list
})

const topToolsForSchema = computed(() => filteredTools.value.slice(0, 10))

useSeoMeta({
  title: copy.pageTitle,
  description: copy.pageDescription,
  ogTitle: copy.pageTitle,
  ogDescription: copy.pageDescription,
  ogImage: `${siteUrl}/og-home.jpg`,
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      textContent: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: copy.pageTitle,
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    {
      type: 'application/ld+json',
      textContent: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: topToolsForSchema.value.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.name,
          url: tool.website || `${siteUrl}/tools/${tool.handle}`,
        })),
      }),
    },
  ],
  link: [
    {
      rel: 'canonical',
      href: `${siteUrl}${route.path}`,
    },
  ],
})
</script>
