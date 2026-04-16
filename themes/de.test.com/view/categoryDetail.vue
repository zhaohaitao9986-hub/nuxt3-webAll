<template>
  <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <!-- Sticky header / hero -->
    <header
      class="sticky top-16 z-10 border-b border-slate-200 bg-white/90 pb-4 pt-3 backdrop-blur"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-wide text-slate-500">
            {{ copy.categoryLabel }}
          </p>
          <h1 class="mt-1 line-clamp-2 text-2xl font-bold text-slate-900">
            {{ category?.name }} {{ copy.h1Suffix }}
          </h1>
          <p
            v-if="category"
            class="mt-1 max-w-2xl text-sm text-slate-600"
          >
            {{ metaDescription }}
          </p>
        </div>

        <!-- Above-the-fold inline ad (highest CTR) -->
        <div class="mt-2 flex-shrink-0 sm:mt-0">
          <AdPlaceholder
            :label="copy.adInlineLabel"
            size="banner"
            class="w-full sm:w-[320px]"
          />
        </div>
      </div>
    </header>

    <div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)]">
      <!-- Tool list + content -->
      <section aria-labelledby="tool-list-heading">
        <!-- Skeleton while loading -->
        <div
          v-if="pending && !category"
          class="space-y-4"
        >
          <div
            v-for="n in 6"
            :key="n"
            class="animate-pulse rounded-xl border border-slate-200 bg-white p-4"
          >
            <div class="flex items-start gap-3">
              <div class="h-12 w-12 rounded-md bg-slate-200" />
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/2 rounded bg-slate-200" />
                <div class="h-3 w-5/6 rounded bg-slate-100" />
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between">
              <div class="h-3 w-32 rounded bg-slate-100" />
              <div class="h-8 w-28 rounded-md bg-slate-200" />
            </div>
          </div>
        </div>

        <!-- Tool list -->
        <div
          v-else
          class="space-y-4"
        >
          <h2
            id="tool-list-heading"
            class="sr-only"
          >
            {{ copy.toolListHeading }}
          </h2>

          <template
            v-for="(item, index) in toolsWithAds"
            :key="item.key"
          >
            <!-- Ad slots after 3rd, 10th, 20th cards -->
            <AdPlaceholder
              v-if="item.type === 'ad'"
              :label="item.adLabel"
              :size="item.adSize"
            />

            <!-- Tool card -->
            <article
              v-else
              class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div class="flex items-start gap-3">
                <img
                  :src="item.tool.website_logo || fallbackLogo"
                  :alt="`${item.tool.name} logo`"
                  class="h-12 w-12 rounded-md border border-slate-200 object-cover"
                  loading="lazy"
                  decoding="async"
                  :fetchpriority="index < 5 ? 'high' : 'auto'"
                >
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-1 text-base font-semibold text-slate-900">
                    {{ item.tool.name }}
                  </h3>
                  <p class="mt-1 line-clamp-2 text-sm text-slate-600">
                    {{ item.tool.description || copy.noDescription }}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span v-if="item.tool.tool_info_review">
                      ⭐ {{ item.tool.tool_info_review.toFixed(1) }}/5
                    </span>
                    <span>
                      {{ copy.monthVisits }}: {{ formatVisits(item.tool.month_visited_count) }}
                    </span>
                    <span
                      v-if="item.tool.is_free"
                      class="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600"
                    >
                      {{ copy.freeBadge }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap gap-1 text-[11px] text-slate-500">
                  <span
                    v-for="badge in (item.tool.pricing || []).slice(0, 2)"
                    :key="badge"
                    class="rounded-full bg-slate-50 px-2 py-0.5"
                  >
                    {{ badge }}
                  </span>
                </div>
                <a
                  :href="item.tool.website || '#'"
                  target="_blank"
                  rel="noopener nofollow sponsored"
                  class="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-700"
                >
                  {{ copy.visitCta }}
                </a>
              </div>
            </article>
          </template>
        </div>

        <!-- SEO content sections -->
        <section
          v-if="category"
          class="mt-10 space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <!-- Summary -->
          <section
            id="Summary"
            aria-labelledby="summary-heading"
          >
            <h2
              id="summary-heading"
              class="text-lg font-semibold text-slate-900"
            >
              {{ copy.summaryTitle }} {{ category.name }}
            </h2>
            <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              <strong>{{ category.name }}</strong>
              {{ ' ' }}
              {{ category.what_is_summary }}
              <span v-if="category.what_is_summary">
                {{ ' ' }}
                <strong>{{ category.name }}</strong>
              </span>
            </p>
          </section>

          <!-- Features -->
          <section
            id="Features"
            aria-labelledby="features-heading"
          >
            <h2
              id="features-heading"
              class="text-lg font-semibold text-slate-900"
            >
              {{ copy.featuresTitle }}
            </h2>
            <ul class="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <li
                v-for="feature in category.feature || []"
                :key="feature"
                class="flex items-start gap-2"
              >
                <span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </section>

          <!-- User Groups -->
          <section
            id="User-Groups"
            aria-labelledby="user-groups-heading"
          >
            <h2
              id="user-groups-heading"
              class="text-lg font-semibold text-slate-900"
            >
              {{ copy.userGroupsTitle }}
            </h2>
            <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {{ category.who_is_use }}
            </p>
          </section>

          <!-- Workflow -->
          <section
            id="Workflow"
            aria-labelledby="workflow-heading"
          >
            <h2
              id="workflow-heading"
              class="text-lg font-semibold text-slate-900"
            >
              {{ copy.workflowTitle }}
            </h2>
            <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {{ category.how_do_work }}
            </p>
          </section>

          <!-- Pros & Cons -->
          <section
            id="Pros-Cons"
            aria-labelledby="pros-cons-heading"
          >
            <h2
              id="pros-cons-heading"
              class="text-lg font-semibold text-slate-900"
            >
              {{ copy.prosConsTitle }}
            </h2>
            <div class="mt-3 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 class="text-sm font-semibold text-emerald-700">
                  {{ copy.prosTitle }}
                </h3>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {{ category.advantages }}
                </p>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-rose-700">
                  {{ copy.consTitle }}
                </h3>
                <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  <li
                    v-for="tool in tools.slice(0, 3)"
                    :key="tool.id"
                  >
                    {{ tool.name }} {{ copy.genericCon }}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <!-- FAQ with details/summary -->
          <section
            v-if="faqs.length"
            id="FAQ"
            aria-labelledby="faq-heading"
            class="border-t border-slate-200 pt-6"
          >
            <h2
              id="faq-heading"
              class="text-lg font-semibold text-slate-900"
            >
              {{ copy.faqTitle }}
            </h2>
            <div class="mt-3 space-y-3">
              <details
                v-for="faq in faqs"
                :key="faq.question"
                class="group rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <summary class="cursor-pointer text-sm font-medium text-slate-900">
                  {{ faq.question }}
                </summary>
                <p class="mt-2 text-sm leading-relaxed text-slate-700">
                  {{ faq.answer }}
                </p>
              </details>
            </div>
          </section>
        </section>
      </section>

      <!-- Sidebar with sticky ad -->
      <aside class="space-y-6">
        <section
          v-if="category"
          class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
        >
          <h2 class="text-sm font-semibold text-slate-900">
            {{ copy.quickFactsTitle }}
          </h2>
          <dl class="mt-3 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <dt class="text-slate-500">{{ copy.parentCategory }}</dt>
              <dd class="font-medium text-slate-900">
                {{ category.parent?.name || '—' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-2">
              <dt class="text-slate-500">{{ copy.toolCount }}</dt>
              <dd class="font-medium text-slate-900">
                {{ tools.length }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Sticky sidebar ad -->
        <div class="sticky bottom-6">
          <AdPlaceholder
            :label="copy.sidebarAdLabel"
            size="sidebar"
            class="mx-auto w-full max-w-[300px] min-h-[600px]"
          />
        </div>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import AdPlaceholder from '../components/AdPlaceholder.vue'

type FaqItem = {
  question: string
  answer: string
}

type CategoryDetail = {
  id: number
  name: string
  handle: string
  what_is_summary: string | null
  feature: string[] | null
  who_is_use: string | null
  how_do_work: string | null
  advantages: string | null
  faq: any[]
  parent?: {
    id: number
    name: string
    handle: string
  } | null
}

type ToolItem = {
  id: number
  handle: string
  name: string
  description: string | null
  website: string | null
  website_logo: string | null
  month_visited_count: number
  is_free: boolean
  tool_info_review: number | null
  pricing: string[] | null
  pros: string[]
  cons: string[]
}

type ApiResult = {
  category: CategoryDetail
  tools: ToolItem[]
}

const copy = {
  categoryLabel: 'AI Category',
  h1Suffix: 'Tools & Software',
  adInlineLabel: 'Sponsored – Top Placement',
  toolListHeading: 'Top AI tools in this category',
  noDescription: 'No description provided yet.',
  visitCta: 'Visit Website',
  freeBadge: 'Free',
  monthVisits: 'Monthly visits',
  summaryTitle: 'What is',
  featuresTitle: 'Key features',
  userGroupsTitle: 'Who uses these tools',
  workflowTitle: 'How it works in your workflow',
  prosConsTitle: 'Pros & cons of this AI category',
  prosTitle: 'Benefits',
  consTitle: 'Limitations',
  genericCon: 'may not be a fit for every workflow.',
  faqTitle: 'Frequently asked questions',
  quickFactsTitle: 'Category snapshot',
  parentCategory: 'Parent category',
  toolCount: 'Tools listed',
  sidebarAdLabel: 'Sponsored – Sticky',
}

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://example.com'

const slug = computed(() => String(route.params.slug || ''))

const {
  data,
  pending,
} = await useAsyncData<ApiResult>(
  () => `category-detail-${slug.value}`,
  () => $fetch(`/api/categories/${slug.value}`),
)
console.log(data.value,11111111)
const category = computed(() => data.value?.category || null)
const tools = computed(() => data.value?.tools || [])

const toolsWithAds = computed(() => {
  const result: Array<
    | { key: string; type: 'tool'; tool: ToolItem }
    | { key: string; type: 'ad'; adLabel: string; adSize: 'banner' | 'feed' }
  > = []

  const adPositions = new Map([
    [3, { adLabel: 'Sponsored – Recommended tool', adSize: 'feed' as const }],
    [10, { adLabel: 'Sponsored – Mid-page banner', adSize: 'banner' as const }],
    [20, { adLabel: 'Sponsored – Long-read placement', adSize: 'feed' as const }],
  ])

  tools.value.forEach((tool, index) => {
    const position = index + 1
    result.push({ key: `tool-${tool.id}`, type: 'tool', tool })

    const adConfig = adPositions.get(position)
    if (adConfig) {
      result.push({
        key: `ad-${position}`,
        type: 'ad',
        adLabel: adConfig.adLabel,
        adSize: adConfig.adSize,
      })
    }
  })

  return result
})

const faqs = computed<FaqItem[]>(() => {
  const raw = category.value?.faq || []
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item: any) => {
      if (!item) return null
      const question = item.title || item.question || ''
      const answer = item.desc || item.answer || ''
      if (!question || !answer) return null
      return {
        question: String(question),
        answer: String(answer),
      }
    })
    .filter(Boolean) as FaqItem[]
})

const fallbackLogo = '/favicon.ico'

const formatVisits = (value: number) =>
  new Intl.NumberFormat().format(value || 0)

const metaDescription = computed(() => {
  if (!category.value) return ''
  if (category.value.what_is_summary) {
    return `${category.value.name} – ${category.value.what_is_summary.slice(0, 150)}`
  }
  return `Best ${category.value.name} AI tools and software compared by traffic and features.`
})

useSeoMeta({
  title: computed(
    () => `${category.value?.name || 'AI Category'} tools & software directory`,
  ),
  description: metaDescription,
  ogTitle: computed(
    () => `${category.value?.name || 'AI Category'} tools & software directory`,
  ),
  ogDescription: metaDescription,
})

useHead(() => {
  const firstTools = tools.value.slice(0, 10)

  const faqSchema = faqs.value.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.value.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }
    : null

  const softwareListSchema = firstTools.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: firstTools.map((tool, index) => ({
          '@type': 'SoftwareApplication',
          position: index + 1,
          name: tool.name,
          url: tool.website || `${siteUrl}/tool/${tool.handle}`,
          applicationCategory: category.value?.name,
          aggregateRating: tool.tool_info_review
            ? {
                '@type': 'AggregateRating',
                ratingValue: tool.tool_info_review,
              }
            : undefined,
          offers: tool.pricing && tool.pricing.length
            ? {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              }
            : undefined,
        })),
      }
    : null

  const scripts: any[] = []

  if (faqSchema) {
    scripts.push({
      type: 'application/ld+json',
      textContent: JSON.stringify(faqSchema),
    })
  }

  if (softwareListSchema) {
    scripts.push({
      type: 'application/ld+json',
      textContent: JSON.stringify(softwareListSchema),
    })
  }

  return {
    script: scripts,
    link: [
      {
        rel: 'canonical',
        href: `${siteUrl}${route.path}`,
      },
    ],
  }
})
</script>

