<template>
  <div class="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] antialiased">
    <!-- ======================================================= -->
    <!-- 1. Global Header (sticky, glass, 复用)                    -->
    <!-- ======================================================= -->
    <TheHeader />

    <!-- ======================================================= -->
    <!-- 2. Breadcrumb：Home / AI Tools / 当前一级                 -->
    <!-- ======================================================= -->
    <div class="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        class="flex flex-wrap items-center gap-1 text-xs text-ink-500 dark:text-ink-400"
      >
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1 transition hover:text-primary-600 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-3v-6H10v6H7a2 2 0 01-2-2V10z"/>
          </svg>
          Home
        </NuxtLink>

        <svg viewBox="0 0 24 24" class="h-3 w-3 flex-shrink-0 text-ink-300 dark:text-ink-600" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>
        </svg>
        <NuxtLink
          to="/ai-tools"
          class="transition hover:text-primary-600 dark:hover:text-white"
        >
          AI Tools
        </NuxtLink>

        <svg viewBox="0 0 24 24" class="h-3 w-3 flex-shrink-0 text-ink-300 dark:text-ink-600" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>
        </svg>
        <span
          class="truncate max-w-[240px] font-medium text-ink-800 dark:text-white"
          aria-current="page"
        >
          {{ category?.name || parentSlug }}
        </span>
      </nav>
    </div>

    <!-- ======================================================= -->
    <!-- 3. Hero：渐变 H1 + 描述 + 搜索 + 3 个快捷按钮              -->
    <!-- ======================================================= -->
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
            linear-gradient(rgba(124,92,255,0.55) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,92,255,0.55) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, #000 50%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, #000 50%, transparent 100%);
        "
      ></div>

      <div class="mx-auto w-full max-w-5xl px-4 pt-8 pb-10 text-center sm:px-6 sm:pt-14">
        <!-- 徽标：带 L2 数量 + 工具数量 -->
        <div class="mb-5 flex justify-center">
          <span class="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-600 dark:text-ink-200">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent"></span>
            </span>
            {{ category?.subCount || 0 }} sub-categories · {{ formatCount(category?.totalTools || 0) }} tools
          </span>
        </div>

        <h1
          class="animate-fade-up text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl dark:text-white"
        >
          Best
          <span class="text-gradient animate-gradient-pan">{{ category?.name || titleFallback }}</span>
          <br class="hidden sm:block" />
          AI tools for {{ updatedLabel }}
        </h1>
        <p class="mx-auto mt-5 max-w-2xl text-pretty text-base text-ink-500 sm:text-lg dark:text-ink-300">
          Curated {{ category?.subCount || 0 }}+ sub-niches and {{ formatCount(category?.totalTools || 0) }}
          hand-vetted {{ category?.name || 'AI' }} tools — compared by traffic, rating, and pricing.
          Save hours of research, find your edge in seconds.
        </p>

        <!-- 搜索框：客户端过滤本分类 subCategories + topTools 统一列表 -->
        <div class="mt-8">
          <div class="relative mx-auto max-w-2xl">
            <div
              aria-hidden="true"
              class="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-cta blur-[6px] transition-opacity duration-500"
              :class="searchFocused ? 'opacity-90' : 'opacity-55'"
            ></div>
            <div class="relative flex items-center gap-2 rounded-2xl border border-white/10 bg-white/95 p-2 shadow-glow ring-1 ring-black/5 dark:bg-ink-800/80 dark:ring-white/5">
              <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center text-ink-400">
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="7"/>
                  <path stroke-linecap="round" d="M21 21l-4.3-4.3"/>
                </svg>
              </div>
              <input
                v-model="searchKeyword"
                type="search"
                :placeholder="`Search ${category?.name || 'AI'} niches & tools…`"
                autocomplete="off"
                spellcheck="false"
                class="h-11 min-w-0 flex-1 bg-transparent text-base text-ink-900 placeholder-ink-400 outline-none dark:text-white dark:placeholder-ink-400"
                :aria-label="`Search ${category?.name || ''} categories and tools`"
                @focus="searchFocused = true"
                @blur="searchFocused = false"
                @keydown.enter.prevent="onSearchEnter"
              />
              <button
                v-if="searchKeyword"
                type="button"
                class="mr-1 hidden h-7 rounded-md border border-ink-200 bg-ink-50 px-2 text-[10px] font-medium text-ink-500 transition hover:bg-ink-100 sm:inline-flex sm:items-center dark:border-white/10 dark:bg-white/5 dark:text-ink-300"
                aria-label="Clear search"
                @click="searchKeyword = ''"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <!-- 3 个快捷按钮：All / Free / Top Rated -->
        <div
          role="tablist"
          aria-label="Quick filters"
          class="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-ink-200 bg-white/70 p-1 backdrop-blur dark:border-white/10 dark:bg-white/5"
        >
          <button
            v-for="f in quickFilters"
            :key="f.id"
            role="tab"
            :aria-selected="activeFilter === f.id"
            :class="[
              'group inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200',
              activeFilter === f.id
                ? 'bg-gradient-cta text-white shadow-glow'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/10 dark:hover:text-white',
            ]"
            @click="activeFilter = f.id"
          >
            <span v-html="f.icon"></span>
            {{ f.label }}
            <span
              v-if="activeFilter === f.id"
              class="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold"
            >
              {{ filteredToolCount }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- ======================================================= -->
    <!-- Main                                                    -->
    <!-- ======================================================= -->
    <main class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <!-- =================================================== -->
      <!-- 4. 二级分类网格（分页 28/页，卡片等高，图标 64x64 不拉伸） -->
      <!-- =================================================== -->
      <section aria-labelledby="subs-heading" class="mt-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="subs-heading"
              class="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl dark:text-white"
            >
              Explore {{ category?.name || '' }} sub-niches
            </h2>
            <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">
              {{ pagination.total }} sub-categories · page {{ pagination.page }} / {{ pagination.totalPages }}
            </p>
          </div>
          <NuxtLink
            to="/ai-tools"
            class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
          >
            Browse all categories
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
            </svg>
          </NuxtLink>
        </div>

        <!-- 等高网格。min-h 固定防 CLS，64x64 图标容器 overflow-hidden + object-contain -->
        <ul
          v-if="displayedSubs.length"
          class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <li
            v-for="(sub, idx) in displayedSubs"
            :key="sub.id"
            class="h-full"
          >
            <NuxtLink
              :to="`/${category?.handle || parentSlug}/${sub.handle}`"
              @mousemove="onCardMouseMove"
              :class="[
                'group relative flex h-full min-h-[132px] flex-col overflow-hidden rounded-2xl border p-4 transition-all duration-300 ease-smooth',
                'border-ink-200 bg-white hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card-hover',
                'dark:border-white/5 dark:bg-ink-800/60 dark:hover:border-primary/40',
              ]"
            >
              <!-- hover spotlight -->
              <div
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style="
                  background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), rgba(124,92,255,0.14), transparent 42%);
                "
              ></div>

              <div class="relative z-10 flex items-start gap-3">
                <!-- 64x64 fixed container, icon won't stretch -->
                <span
                  aria-hidden="true"
                  class="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm transition-transform duration-300 group-hover:scale-[1.04]"
                  :style="{ background: gradientFor(idx) }"
                >
                  <span class="flex h-7 w-7 items-center justify-center" v-html="subIcon(sub.handle)"></span>
                </span>

                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-1 text-sm font-semibold text-ink-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-accent">
                    {{ sub.name }}
                  </h3>
                  <p class="mt-0.5 text-[11px] font-medium text-ink-400 dark:text-ink-500">
                    {{ formatCount(sub.toolCount) }} tools
                  </p>
                  <p class="mt-1.5 line-clamp-2 min-h-[2.25rem] text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                    {{ sub.summary || `Discover the top ${sub.name} AI tools and compare features, pricing, and reviews.` }}
                  </p>
                </div>
              </div>

              <span
                class="relative z-10 mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 transition-all duration-200 group-hover:gap-2 dark:text-accent"
              >
                View tools
                <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
                </svg>
              </span>
            </NuxtLink>
          </li>
        </ul>

        <!-- Empty state when client filter has no match but SSR page has data -->
        <div
          v-else-if="subCategories.length && !displayedSubs.length"
          class="mt-5 flex min-h-[132px] items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center text-xs text-ink-500 dark:border-white/10 dark:bg-ink-800/40"
        >
          No sub-categories match "<span class="font-semibold text-ink-700 dark:text-ink-200">{{ searchKeyword }}</span>" on this page.
        </div>

        <!-- Pagination（SSR 直出，SEO 友好） -->
        <nav
          v-if="pagination.totalPages > 1"
          aria-label="Sub-categories pagination"
          class="mt-8 flex items-center justify-center gap-1.5"
        >
          <NuxtLink
            :to="pageHref(pagination.page - 1)"
            :aria-disabled="pagination.page <= 1"
            :tabindex="pagination.page <= 1 ? -1 : 0"
            :class="[
              'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition',
              pagination.page <= 1
                ? 'pointer-events-none border-ink-200 text-ink-300 opacity-50 dark:border-white/10 dark:text-ink-600'
                : 'border-ink-200 bg-white text-ink-700 hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white',
            ]"
          >
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"/>
            </svg>
            Prev
          </NuxtLink>

          <NuxtLink
            v-for="p in pageList"
            :key="p.key"
            :to="p.page ? pageHref(p.page) : ''"
            :aria-current="p.page === pagination.page ? 'page' : null"
            :class="[
              'inline-flex h-9 min-w-[36px] items-center justify-center rounded-full px-2 text-xs font-semibold transition',
              p.isDots
                ? 'pointer-events-none text-ink-400'
                : p.page === pagination.page
                ? 'bg-gradient-cta text-white shadow-glow'
                : 'border border-ink-200 bg-white text-ink-700 hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white',
            ]"
          >
            {{ p.label }}
          </NuxtLink>

          <NuxtLink
            :to="pageHref(pagination.page + 1)"
            :aria-disabled="!pagination.hasMore"
            :tabindex="!pagination.hasMore ? -1 : 0"
            :class="[
              'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition',
              !pagination.hasMore
                ? 'pointer-events-none border-ink-200 text-ink-300 opacity-50 dark:border-white/10 dark:text-ink-600'
                : 'border-ink-200 bg-white text-ink-700 hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white',
            ]"
          >
            Next
            <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>
            </svg>
          </NuxtLink>
        </nav>
      </section>

      <!-- =================================================== -->
      <!-- 5. 本分类热门工具 12 个 · 三列 · 第 3 位插原生广告        -->
      <!-- =================================================== -->
      <section aria-labelledby="tools-heading" class="mt-14">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="tools-heading"
              class="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl dark:text-white"
            >
              Top {{ category?.name || '' }} tools right now
            </h2>
            <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Ranked by traffic · updated {{ updatedLabel }}
            </p>
          </div>
          <span
            class="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-medium text-ink-500 dark:border-white/10 dark:bg-white/5 dark:text-ink-300"
          >
            <span class="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Live {{ filteredToolCount }} / {{ topToolsReal.length }} tools
          </span>
        </div>

        <!-- 三列网格，卡片固定最小高度 (min-h 保 CLS=0) -->
        <ul
          v-if="displayedTools.length"
          class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <li
            v-for="(item, index) in displayedTools"
            :key="item.id"
            class="h-full min-h-[360px]"
          >
            <!-- 原生广告位（第 3 位）。aspect 与 ToolCard 一致，CLS=0 -->
            <AdSlot
              v-if="item.isAd"
              variant="native-card"
              :slot-id="item.slotId"
              label="Sponsored · Tool"
              class="h-full min-h-[360px]"
            />
            <!-- 工具卡片（全局复用） -->
            <ToolCard
              v-else
              :tool="item"
              :priority="index < 3"
              :sponsored="item.is_ad"
            />
          </li>
        </ul>

        <div
          v-else
          class="mt-5 flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center text-xs text-ink-500 dark:border-white/10 dark:bg-ink-800/40"
        >
          No tools match this filter yet.
          <button
            type="button"
            class="ml-2 font-semibold text-primary-600 underline-offset-2 hover:underline dark:text-accent"
            @click="activeFilter = 'all'"
          >
            Reset filter
          </button>
        </div>
      </section>
    </main>

    <!-- ======================================================= -->
    <!-- 6. Global Footer (复用)                                  -->
    <!-- ======================================================= -->
    <TheFooter />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TheHeader from '../components/TheHeader.vue'
import TheFooter from '../components/TheFooter.vue'
import ToolCard from '../components/ToolCard.vue'
import AdSlot from '../components/AdSlot.vue'
import { useCategoryIcon } from '~/composables/useCategoryIcon'
import { useGradientPalette } from '~/composables/useGradientPalette'

// ---------- 路由参数 ----------
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const siteUrl = runtimeConfig.public?.siteUrl || 'https://aiseekertools.com'

// route.params.slug 是数组 ['video-ai']（catch-all 路由）
const parentSlug = computed(() => {
  const raw = route.params.slug
  if (Array.isArray(raw)) return String(raw[0] || '')
  return String(raw || '')
})

const currentPage = computed(() => {
  const p = Number(route.query.page) || 1
  return Math.max(1, p)
})

// ---------- SSR 直出数据（LCP < 1s 关键）----------
const { data } = await useAsyncData(
  () => `category-l1-${parentSlug.value}-p${currentPage.value}`,
  () =>
    $fetch(`/api/category/${parentSlug.value}`, {
      query: { page: currentPage.value },
    }),
  { watch: [parentSlug, currentPage] },
)

const category = computed(() => data.value?.category || null)
const subCategories = computed(() => data.value?.subCategories || [])
const pagination = computed(
  () =>
    data.value?.pagination || {
      page: 1,
      pageSize: 28,
      total: 0,
      totalPages: 1,
      hasMore: false,
    },
)
const topTools = computed(() => data.value?.topTools || [])
const topToolsReal = computed(() => topTools.value.filter((t) => !t.isAd))

// ---------- Hero 快捷按钮 ----------
const activeFilter = ref('all')
const quickFilters = [
  {
    id: 'all',
    label: 'All',
    icon:
      '<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h10M4 18h16"/></svg>',
  },
  {
    id: 'free',
    label: 'Free',
    icon:
      '<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2m0-8v1m0 8v1m8-5a8 8 0 11-16 0 8 8 0 0116 0z"/></svg>',
  },
  {
    id: 'top',
    label: 'Top Rated',
    icon:
      '<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-current" stroke="none"><path d="M12 2l2.39 4.84L20 8l-4 3.9L17 18l-5-2.6L7 18l1-6.1L4 8l5.61-1.16L12 2z"/></svg>',
  },
]

// ---------- 搜索框（客户端过滤，零网络延迟）----------
const searchKeyword = ref('')
const searchFocused = ref(false)

const onSearchEnter = () => {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  navigateTo(`/search?q=${encodeURIComponent(kw)}`)
}

// 切换路由时重置交互状态
watch(parentSlug, () => {
  activeFilter.value = 'all'
  searchKeyword.value = ''
})

// ---------- Sub-categories filter（hero 搜索框生效） ----------
const displayedSubs = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return subCategories.value
  return subCategories.value.filter(
    (s) =>
      s.name.toLowerCase().includes(kw) ||
      s.handle.toLowerCase().includes(kw) ||
      (s.summary || '').toLowerCase().includes(kw),
  )
})

// ---------- Tools filter（hero 快捷按钮 + 搜索框同时生效）----------
const displayedTools = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()

  return topTools.value.filter((t) => {
    if (t.isAd) return true // 广告位始终保留
    if (kw) {
      const match =
        t.name?.toLowerCase().includes(kw) ||
        t.description?.toLowerCase().includes(kw) ||
        (t.tags || []).some((tag) => String(tag).toLowerCase().includes(kw))
      if (!match) return false
    }
    if (activeFilter.value === 'free') return t.is_free
    if (activeFilter.value === 'top') return (t.rating || 0) >= 4.5
    return true
  })
})

const filteredToolCount = computed(() => displayedTools.value.filter((t) => !t.isAd).length)

// ---------- 分页器：显示 1 … 3 4 [5] 6 7 … 20 形式 ----------
const pageList = computed(() => {
  const cur = pagination.value.page
  const total = pagination.value.totalPages
  if (total <= 1) return []

  const out = []
  const push = (page, label = String(page), isDots = false, keyExtra = '') =>
    out.push({
      page: isDots ? 0 : page,
      label,
      isDots,
      key: isDots ? `d-${keyExtra}` : `p-${page}`,
    })

  // 所有页都显示
  if (total <= 7) {
    for (let i = 1; i <= total; i++) push(i)
    return out
  }

  // 省略号模式
  push(1)
  if (cur > 3) push(0, '…', true, 'l')
  const start = Math.max(2, cur - 1)
  const end = Math.min(total - 1, cur + 1)
  for (let i = start; i <= end; i++) push(i)
  if (cur < total - 2) push(0, '…', true, 'r')
  push(total)
  return out
})

const pageHref = (page) => {
  const p = Math.max(1, Math.min(pagination.value.totalPages, page))
  const base = `/${parentSlug.value}`
  return p === 1 ? base : `${base}?page=${p}`
}

// ---------- 图标 + 渐变色板 ----------
const { resolve } = useCategoryIcon()
const { gradientByKey } = useGradientPalette()
const subIcon = (handle) => {
  const raw = resolve(handle)
  return raw.replace('<svg ', '<svg class="h-full w-full" ')
}
const gradientFor = (idx) => {
  // 以 idx 分布色板，保证同一页视觉多样；跨页用 handle 哈希也可
  return gradientByKey(
    `${parentSlug.value}-${idx}-${subCategories.value[idx]?.handle || ''}`,
  )
}

// ---------- 工具函数 ----------
const formatCount = (n) => {
  const v = Number(n || 0)
  if (v < 1000) return String(v)
  if (v < 1_000_000) return (v / 1000).toFixed(1) + 'k'
  return (v / 1_000_000).toFixed(1) + 'M'
}

const onCardMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

const updatedLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const titleFallback = computed(() =>
  String(parentSlug.value || 'AI tools')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()),
)

// ---------- SEO: meta + JSON-LD（SSR 直出）----------
const seoTitle = computed(() => {
  const name = category.value?.name || titleFallback.value
  const count = category.value?.totalTools || 0
  if (count > 0) {
    return `Top ${formatCount(count)} Best ${name} AI Tools (${updatedLabel.value}) · aiseekertools`
  }
  return `${name} AI Tools · aiseekertools`
})

const seoDescription = computed(() => {
  const c = category.value
  if (!c) return 'Curated AI tools directory — find the best AI for any workflow.'
  const topNames = topToolsReal.value.slice(0, 3).map((t) => t.name).filter(Boolean)
  if (topNames.length) {
    return `Discover the best ${c.name} AI tools in ${updatedLabel.value}. Including ${topNames.join(', ')} and ${formatCount(c.totalTools)} more — compared by traffic, rating, and pricing across ${c.subCount} sub-niches.`
  }
  return `Explore ${c.subCount} ${c.name} AI sub-niches and ${formatCount(c.totalTools)} tools — hand-curated and updated ${updatedLabel.value}.`
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

// canonical / rel=prev/next / JSON-LD
useHead(() => {
  const path = `/${parentSlug.value}`
  const canonical =
    currentPage.value === 1
      ? `${siteUrl}${path}`
      : `${siteUrl}${path}?page=${currentPage.value}`

  const linkTags = [{ rel: 'canonical', href: canonical }]
  if (currentPage.value > 1) {
    linkTags.push({
      rel: 'prev',
      href:
        currentPage.value === 2
          ? `${siteUrl}${path}`
          : `${siteUrl}${path}?page=${currentPage.value - 1}`,
    })
  }
  if (pagination.value.hasMore) {
    linkTags.push({
      rel: 'next',
      href: `${siteUrl}${path}?page=${currentPage.value + 1}`,
    })
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'AI Tools', item: `${siteUrl}/ai-tools` },
      {
        '@type': 'ListItem',
        position: 3,
        name: category.value?.name || titleFallback.value,
        item: `${siteUrl}${path}`,
      },
    ],
  }

  // ItemList of top tools —— SERP rich result
  const itemListLd = topToolsReal.value.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Top ${category.value?.name || ''} AI tools`,
        itemListElement: topToolsReal.value.slice(0, 10).map((t, i) => ({
          '@type': 'SoftwareApplication',
          position: i + 1,
          name: t.name,
          url: `${siteUrl}/tools/${t.handle}`,
          applicationCategory: category.value?.name,
          aggregateRating: t.rating
            ? {
                '@type': 'AggregateRating',
                ratingValue: t.rating,
                bestRating: 5,
                reviewCount: 1,
              }
            : undefined,
          offers: t.is_free
            ? { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            : undefined,
        })),
      }
    : null

  const scripts = [
    { type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumbLd) },
  ]
  if (itemListLd) {
    scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(itemListLd) })
  }

  return { link: linkTags, script: scripts }
})
</script>
