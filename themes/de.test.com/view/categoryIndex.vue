<template>
  <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 scroll-smooth">
    <div class="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <!-- Sidebar -->
      <aside class="self-start sticky top-24 space-y-4">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">
            {{ copy.pageTitle }}
          </h1>
          <p class="mt-2 text-sm text-slate-600">
            {{ copy.pageDescription }}
          </p>
        </div>

        <nav aria-label="Categories" class="space-y-1 text-sm">
          <button
            v-for="parent in parents"
            :key="parent.handle"
            type="button"
            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition"
            :class="
              activeParent === parent.handle
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            "
            @click="scrollToSection(parent.handle)"
          >
            <span class="truncate">{{ parent.name }}</span>
            <span class="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
              {{ parent.children.length }}
            </span>
          </button>
        </nav>
      </aside>

      <!-- Main content -->
      <section class="space-y-10">
        <template v-for="(parent, index) in parentsWithAds" :key="parent.key">
          <!-- Ad block -->
          <AdPlaceholder
            v-if="parent.type === 'ad'"
            :label="copy.adLabel"
            size="banner"
          />

          <!-- Category section -->
          <section
            v-else
            :id="parent.parent.handle"
            :data-category-section="parent.parent.handle"
            class="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <header class="flex items-center justify-between gap-4">
              <div>
                <h2 class="text-lg font-semibold text-slate-900">
                  {{ parent.parent.name }}
                </h2>
                <p class="mt-1 text-sm text-slate-500">
                  {{ parent.parent.children.length }} subcategories
                </p>
              </div>
            </header>

            <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NuxtLink
                v-for="child in parent.parent.children"
                :key="child.handle"
                :to="`/category/${child.handle}`"
                class="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-white hover:shadow-sm"
              >
                <span class="truncate">
                  {{ child.name }}
                </span>
                <span class="ml-3 flex-shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                  {{ child.toolCount }}
                </span>
              </NuxtLink>
            </div>
          </section>
        </template>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import AdPlaceholder from '../components/AdPlaceholder.vue'

type ChildCategory = {
  id: number
  name: string
  handle: string
  priority: number
  toolCount: number
}

type ParentCategory = {
  id: number
  name: string
  handle: string
  priority: number
  children: ChildCategory[]
}

type ApiResult = ParentCategory[]

const copy = {
  pageTitle: 'AI Tools Directory - All Categories and Use Cases',
  pageDescription:
    'Browse all AI categories and use cases in one place. Discover writing, marketing, coding, design, and automation tools by topic.',
  adLabel: 'Sponsored Category Placement',
}

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://example.com'

const { data } = await useAsyncData<ApiResult>(
  'category-index',
  () => $fetch('/api/categories/all'),
  {
    default: () => [],
  },
)

const parents = computed(() => data.value || [])

const parentsWithAds = computed(() => {
  const result: Array<
    | { key: string; type: 'section'; parent: ParentCategory }
    | { key: string; type: 'ad' }
  > = []

  parents.value.forEach((parent, index) => {
    result.push({ key: `parent-${parent.id}`, type: 'section', parent })
    if ((index + 1) % 3 === 0) {
      result.push({ key: `ad-${index}`, type: 'ad' })
    }
  })

  return result
})

const activeParent = ref<string>('')

const scrollToSection = (handle: string) => {
  const el = document.getElementById(handle)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  const sections = document.querySelectorAll<HTMLElement>('[data-category-section]')

  if (!sections.length) return

  const observer = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

      const first = visible[0]
      if (!first) return

      const handle = first.target.getAttribute('data-category-section')
      if (handle) {
        activeParent.value = handle
      }
    },
    {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: [0.2, 0.4, 0.6],
    },
  )

  sections.forEach((section) => observer.observe(section))

  onBeforeUnmount(() => {
    observer.disconnect()
  })
})

useSeoMeta({
  title: copy.pageTitle,
  description: copy.pageDescription,
  ogTitle: copy.pageTitle,
  ogDescription: copy.pageDescription,
})

const navigationItems = computed(() => {
  const items: Array<{ '@type': 'SiteNavigationElement'; name: string; url: string }> = []

  parents.value.forEach((parent) => {
    parent.children.forEach((child) => {
      items.push({
        '@type': 'SiteNavigationElement',
        name: child.name,
        url: `${siteUrl}/category/${child.handle}`,
      })
    })
  })

  return items
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      textContent: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: navigationItems.value,
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

