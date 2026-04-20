<template>
  <div class="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
    <TheHeader />

    <!-- ===== Section 2: Tool Hero (Golden above-the-fold) ===== -->
    <ToolHero v-if="tool" :tool="tool" @bookmark="onBookmark" />

    <!-- Skeleton for initial load (prevents CLS) -->
    <div
      v-else-if="pending"
      class="mx-auto w-full max-w-7xl animate-pulse px-4 pb-8 pt-12 sm:px-6 lg:px-8"
    >
      <div class="flex gap-6">
        <div class="h-28 w-28 flex-shrink-0 rounded-2xl bg-ink-100 dark:bg-white/5"></div>
        <div class="flex-1 space-y-3">
          <div class="h-4 w-24 rounded-full bg-ink-100 dark:bg-white/5"></div>
          <div class="h-10 w-2/3 rounded-lg bg-ink-100 dark:bg-white/5"></div>
          <div class="h-4 w-full rounded bg-ink-100 dark:bg-white/5"></div>
          <div class="h-4 w-1/2 rounded bg-ink-100 dark:bg-white/5"></div>
        </div>
      </div>
    </div>

    <!-- ===== Main layout: content + sticky sidebar ===== -->
    <main v-if="tool" class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <!-- ---------- LEFT: rich content ---------- -->
        <div class="min-w-0 space-y-6">
          <!-- About + use cases + jobs -->
          <ToolDescription
            :long-desc="tool.longDesc"
            :tool-name="tool.name"
            :use-cases="tool.useCases"
            :for-jobs="tool.forJobs"
          />

          <!-- Key features -->
          <ToolFeatures :features="tool.features" :seed="tool.handle" />

          <!-- Pros / Cons -->
          <ToolProsCons :pros="tool.pros" :cons="tool.cons" />

          <!-- Screenshots / Preview wall (small-image friendly) -->
          <ToolScreenshots
            :images="previewImages"
            :tool-name="tool.name"
            :seed="tool.handle"
          />

          <!-- Pricing (rich text array) -->
          <ToolPricing :pricing="tool.pricing" />

          <!-- Company info (rich text HTML → structured definition list) -->
          <ToolCompanyInfo :company-info="tool.companyInfo" />

          <!-- ===== Section 5: Native Ad (between content and related) ===== -->
          <AdSlot
            variant="banner"
            label="Sponsored"
            slot-id="tool-detail-mid"
            class="min-h-[220px]"
          />

          <!-- FAQ -->
          <ToolFaq :faq="tool.faq" />

          <!-- Related tools -->
          <RelatedTools
            :tools="relatedTools"
            :parent-handle="tool.parentCategory?.handle"
            :show-ad="relatedTools.length >= 4"
          />

          <!-- Similar categories -->
          <SimilarCategories :items="similarCategories" />
        </div>

        <!-- ---------- RIGHT: sticky sidebar ---------- -->
        <aside class="lg:sticky lg:top-24 lg:self-start">
          <ToolSidebar :tool="tool" />
        </aside>
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
import ToolHero from '../components/tool/ToolHero.vue'
import ToolDescription from '../components/tool/ToolDescription.vue'
import ToolFeatures from '../components/tool/ToolFeatures.vue'
import ToolProsCons from '../components/tool/ToolProsCons.vue'
import ToolScreenshots from '../components/tool/ToolScreenshots.vue'
import ToolPricing from '../components/tool/ToolPricing.vue'
import ToolCompanyInfo from '../components/tool/ToolCompanyInfo.vue'
import ToolFaq from '../components/tool/ToolFaq.vue'
import RelatedTools from '../components/tool/RelatedTools.vue'
import SimilarCategories from '../components/tool/SimilarCategories.vue'
import ToolSidebar from '../components/tool/ToolSidebar.vue'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://aiseekertools.com'

// route.params.slug 来自正则 —— index 1 是第一个捕获组
const slug = computed(() => {
  const raw = route.params.slug
  if (Array.isArray(raw)) return String(raw[1] || raw[0] || '')
  return String(raw || '')
})

// ---------- SSR data fetch ----------
const { data, pending, error } = await useAsyncData(
  () => `tool-${slug.value}`,
  () => $fetch(`/api/tools/${slug.value}`),
  { watch: [slug] },
)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Tool not found', fatal: true })
}

const tool = computed(() => data.value?.tool || null)
const relatedTools = computed(() => data.value?.relatedTools || [])
const similarCategories = computed(() => data.value?.similarCategories || [])

// 小图预览池：把 logo + image 合并，去重
const previewImages = computed(() => {
  const t = tool.value
  if (!t) return []
  const list = []
  if (t.imageUrl) list.push(t.imageUrl)
  return Array.from(new Set(list))
})

const onBookmark = () => {
  if (!import.meta.client) return
  try {
    const key = 'aiseeker:bookmarks'
    const current = JSON.parse(localStorage.getItem(key) || '[]')
    if (!current.includes(tool.value.handle)) {
      current.push(tool.value.handle)
      localStorage.setItem(key, JSON.stringify(current))
    }
  } catch (e) {
    // ignore
  }
}

// ---------- SEO: dynamic meta + JSON-LD ----------
const updatedLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const seoTitle = computed(() => {
  const t = tool.value
  if (!t) return 'AI Tool · aiseekertools'
  const cat = t.parentCategory?.name || (t.categories?.[0]?.name || 'AI')
  return `${t.name} — Best ${cat} AI Tool (${updatedLabel.value})`
})

const seoDescription = computed(() => {
  const t = tool.value
  if (!t) return ''
  const base = (t.shortDesc || '').replace(/\s+/g, ' ').trim().slice(0, 150)
  const tagLine = t.tags && t.tags.length ? ` · ${t.tags.slice(0, 3).join(', ')}` : ''
  if (base) return `${base}${tagLine}`
  return `Review, features and pricing for ${t.name}${tagLine}. Try this AI tool today.`
})

const canonicalPath = computed(() => `/tool/${slug.value}`)

useServerSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'website',
  ogImage: () => tool.value?.logoUrl || `${siteUrl}/og-tool.jpg`,
  twitterCard: 'summary_large_image',
})

useHead(() => {
  const t = tool.value
  if (!t) return { link: [{ rel: 'canonical', href: `${siteUrl}${canonicalPath.value}` }] }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      t.parentCategory && {
        '@type': 'ListItem',
        position: 2,
        name: t.parentCategory.name,
        item: `${siteUrl}/category/${t.parentCategory.handle}`,
      },
      t.categories?.[0] && {
        '@type': 'ListItem',
        position: t.parentCategory ? 3 : 2,
        name: t.categories[0].name,
        item: `${siteUrl}/category/${t.categories[0].handle}`,
      },
      {
        '@type': 'ListItem',
        position: t.parentCategory ? 4 : 3,
        name: t.name,
        item: `${siteUrl}/tool/${t.handle}`,
      },
    ].filter(Boolean),
  }

  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: t.name,
    applicationCategory: t.parentCategory?.name || 'AIApplication',
    operatingSystem: t.websiteType?.join(', ') || 'Web',
    description: t.shortDesc,
    image: t.logoUrl || undefined,
    url: t.website || `${siteUrl}/tool/${t.handle}`,
    aggregateRating: t.rating
      ? { '@type': 'AggregateRating', ratingValue: t.rating, bestRating: 5, reviewCount: 1 }
      : undefined,
    offers: t.isFree
      ? { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      : t.pricing && t.pricing.length
        ? { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
        : undefined,
  }

  const faqLd = t.faq && t.faq.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: t.faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }
    : null

  const scripts = [
    { type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumb) },
    { type: 'application/ld+json', innerHTML: JSON.stringify(softwareLd) },
  ]
  if (faqLd) scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(faqLd) })

  return {
    script: scripts,
    link: [{ rel: 'canonical', href: `${siteUrl}${canonicalPath.value}` }],
  }
})
</script>
