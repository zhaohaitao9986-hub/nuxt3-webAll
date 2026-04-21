<template>
  <div class="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
    <TheHeader />

    <!-- ===== Section 2: Compact Hero ===== -->
    <SubCategoryHero
      v-if="category"
      :category="category"
      :parent="parent"
      :active-filter="activeFilter"
      @update:filter="activeFilter = $event"
    />

    <!-- ===== Main layout: list + sidebar ===== -->
    <main class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <!-- ---------- LEFT: tool list ---------- -->
        <section aria-labelledby="tool-list-heading">
          <div class="mb-4 flex items-end justify-between">
            <h2
              id="tool-list-heading"
              class="text-lg font-semibold tracking-tight text-ink-900 dark:text-white"
            >
              {{ category ? `Top ${pagination.total || displayedTools.length} tools` : 'Loading…' }}
            </h2>
            <p class="text-xs text-ink-400">
              Sorted by {{ activeFilter === 'new' ? 'newest' : activeFilter === 'free' ? 'free first' : 'traffic' }}
            </p>
          </div>

          <!-- Skeleton (initial load) -->
          <ToolListSkeleton v-if="pending && !category" :count="6" />

          <!-- Empty -->
          <div
            v-else-if="!displayedTools.length"
            class="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center dark:border-white/10 dark:bg-ink-800/40"
          >
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400 dark:bg-white/5">
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7"/>
                <path stroke-linecap="round" d="M21 21l-4.3-4.3"/>
              </svg>
            </div>
            <h3 class="mt-3 text-sm font-semibold text-ink-900 dark:text-white">
              No tools match this filter yet
            </h3>
            <p class="mt-1 max-w-sm text-xs text-ink-500 dark:text-ink-400">
              Try switching filters, or check related niches below for similar categories.
            </p>
          </div>

          <!-- Grid: 2-col on lg+ -->
          <div
            v-else
            class="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <template v-for="(item, index) in displayedTools" :key="item.id">
              <SubToolAdCard
                v-if="item.isAd"
                :slot-id="item.slotId"
              />
              <SubToolCard
                v-else
                :tool="item"
                :priority="index < 3"
                :rank="item.__rank"
              />
            </template>
          </div>

          <!-- Load more -->
          <div v-if="showLoadMore" class="mt-8 flex justify-center">
            <button
              type="button"
              :disabled="loadingMore"
              class="btn-shine inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-primary/50 hover:text-primary-600 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
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
              <span>{{ loadingMore ? 'Loading…' : `Load ${Math.min(pagination.pageSize, pagination.total - displayedTools.filter(t => !t.isAd).length)} more` }}</span>
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

          <!-- SEO long content -->
          <div v-if="category" class="mt-12">
            <SubCategoryContent :category="category" />
          </div>
        </section>

        <!-- ---------- RIGHT: sticky sidebar ---------- -->
        <aside class="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <!-- Quick facts -->
          <section
            v-if="category"
            class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-white/5 dark:bg-ink-800/60"
          >
            <h2 class="text-sm font-semibold text-ink-900 dark:text-white">
              Category snapshot
            </h2>
            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between gap-2">
                <dt class="text-ink-500 dark:text-ink-400">Parent</dt>
                <dd class="font-medium text-ink-800 dark:text-white">
                  <NuxtLink
                    v-if="parent"
                    :to="`/category/${parent.handle}`"
                    class="truncate transition hover:text-primary-600 dark:hover:text-accent"
                  >
                    {{ parent.name }}
                  </NuxtLink>
                  <span v-else>—</span>
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-ink-500 dark:text-ink-400">Tools listed</dt>
                <dd class="font-semibold text-ink-800 dark:text-white">
                  {{ pagination.total || 0 }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-ink-500 dark:text-ink-400">Updated</dt>
                <dd class="font-medium text-ink-800 dark:text-white">
                  {{ updatedLabel }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Related niches -->
          <RelatedNiches :items="relatedNiches" :parent="parent" />

          <!-- Sticky sidebar ad -->
          <AdSlot
            variant="sidebar"
            label="Sponsored · Sidebar"
            slot-id="sub-cat-sidebar"
            class="min-h-[600px]"
          />
        </aside>
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
import SubCategoryHero from '../components/category/SubCategoryHero.vue'
import SubToolCard from '../components/category/SubToolCard.vue'
import SubToolAdCard from '../components/category/SubToolAdCard.vue'
import ToolListSkeleton from '../components/category/ToolListSkeleton.vue'
import RelatedNiches from '../components/category/RelatedNiches.vue'
import SubCategoryContent from '../components/category/SubCategoryContent.vue'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://aiseekertools.com'

const slug = computed(() => String(route.params.slug[1] || ''))
const activeFilter = ref('popular')
console.log(slug.value,'11111')
// ---------- SSR data fetch ----------
const { data, pending } = await useAsyncData(
  () => `sub-category-${slug.value}`,
  () => $fetch(`/api/categories/${slug.value}`),
  { watch: [slug] },
)

const category = computed(() => data.value?.category || null)
const parent = computed(() => category.value?.parent || null)
const relatedNiches = computed(() => data.value?.relatedNiches || [])
const pagination = computed(
  () => data.value?.pagination || { page: 1, pageSize: 30, total: 0, totalPages: 1, hasMore: false },
)

// Tools coming back from first SSR fetch (already has ads injected at pos 3 & 10)
const ssrTools = computed(() => data.value?.tools || [])

// Appended tools via "Load More"
const appendedTools = ref([])
const loadingMore = ref(false)

// 切换 slug 时清空 appended
watch(slug, () => {
  appendedTools.value = []
  activeFilter.value = 'popular'
})

// Client-side filter (filter 只影响展示顺序/过滤，不发新请求 —— 因为首页已经 sort by traffic)
const displayedTools = computed(() => {
  const merged = [...ssrTools.value, ...appendedTools.value]
  let idx = 0
  return merged
    .filter((t) => {
      if (t.isAd) return true
      if (activeFilter.value === 'free') return t.isFree
      return true
    })
    .map((t) => {
      if (t.isAd) return t
      idx += 1
      return { ...t, __rank: idx }
    })
})

const realToolsLoaded = computed(
  () => ssrTools.value.filter((t) => !t.isAd).length + appendedTools.value.filter((t) => !t.isAd).length,
)

const showLoadMore = computed(
  () => !pending.value && pagination.value.total > realToolsLoaded.value,
)

const loadMore = async () => {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const nextPage = Math.floor(realToolsLoaded.value / pagination.value.pageSize) + 1
    const res = await $fetch(`/api/categories/${slug.value}`, {
      query: { page: nextPage, pageSize: pagination.value.pageSize },
    })
    appendedTools.value.push(...(res?.tools || []))
  } catch (e) {
    // silent fail — keep current state
  } finally {
    loadingMore.value = false
  }
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

const updatedLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// ---------- SEO: dynamic meta + JSON-LD ----------
const seoTitle = computed(() => {
  const c = category.value
  const count = pagination.value.total || 0
  if (!c) return 'AI Tools Directory · aiseekertools'
  return `Top ${count} Best ${c.name} AI Tools (${updatedLabel.value})`
})

const seoDescription = computed(() => {
  const c = category.value
  if (!c) return ''
  const topNames = ssrTools.value.filter((t) => !t.isAd).slice(0, 3).map((t) => t.name)
  if (topNames.length) {
    return `Discover the best ${c.name} AI tools in ${updatedLabel.value}. Including ${topNames.join(', ')} and ${pagination.value.total - topNames.length}+ more — compared by traffic, rating, and pricing.`
  }
  if (c.what_is_summary) {
    return `${c.name} AI tools — ${String(c.what_is_summary).slice(0, 160)}`
  }
  return `Best ${c.name} AI tools and software compared by traffic, features, and pricing.`
})

useServerSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'website',
  ogImage: `${siteUrl}/og-category.jpg`,
  twitterCard: 'summary_large_image',
})

useHead(() => {
  const realTools = ssrTools.value.filter((t) => !t.isAd)

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      parent.value && {
        '@type': 'ListItem',
        position: 2,
        name: parent.value.name,
        item: `${siteUrl}/category/${parent.value.handle}`,
      },
      category.value && {
        '@type': 'ListItem',
        position: parent.value ? 3 : 2,
        name: category.value.name,
        item: `${siteUrl}/category/${category.value.handle}`,
      },
    ].filter(Boolean),
  }

  const itemList = realTools.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: category.value?.name,
        itemListElement: realTools.slice(0, 10).map((t, i) => ({
          '@type': 'SoftwareApplication',
          position: i + 1,
          name: t.name,
          url: t.website || `${siteUrl}/tool/${t.handle}`,
          applicationCategory: category.value?.name,
          aggregateRating: t.rating
            ? { '@type': 'AggregateRating', ratingValue: t.rating, bestRating: 5, reviewCount: 1 }
            : undefined,
          offers: t.isFree ? { '@type': 'Offer', price: '0', priceCurrency: 'USD' } : undefined,
        })),
      }
    : null

  const faqLd = category.value?.faq && category.value.faq.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: category.value.faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }
    : null

  const scripts = []
  scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumb) })
  if (itemList) scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(itemList) })
  if (faqLd) scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(faqLd) })

  return {
    script: scripts,
    link: [{ rel: 'canonical', href: `${siteUrl}${route.path}` }],
  }
})
</script>
