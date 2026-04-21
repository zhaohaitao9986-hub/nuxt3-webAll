<template>
  <section class="relative isolate overflow-hidden">
    <!-- Mesh gradient backdrop (purely decorative,固定高度避免 CLS) -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 bg-mesh-hero opacity-80 animate-gradient-pan"
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
      style="
        background:
          radial-gradient(60% 60% at 50% 0%, rgba(124,92,255,0.18) 0%, rgba(124,92,255,0) 70%);
      "
    ></div>
    <!-- Grid-pattern overlay -->
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

    <div class="mx-auto w-full max-w-5xl px-4 pb-12 pt-12 text-center sm:px-6 sm:pb-16 sm:pt-20 lg:pt-24">
      <!-- Eyebrow badge -->
      <div class="mb-6 flex justify-center">
        <span
          class="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-ink-600 dark:text-ink-200"
        >
          <span class="relative flex h-1.5 w-1.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent"></span>
          </span>
          <span>{{ eyebrow }}</span>
        </span>
      </div>

      <!-- H1 with gradient -->
      <h1
        class="animate-fade-up text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl dark:text-white"
      >
        {{ titlePrefix }}
        <span class="text-gradient animate-gradient-pan">{{ titleAccent }}</span>
        <br class="hidden sm:block" />
        {{ titleSuffix }}
      </h1>

      <!-- Sub -->
      <p
        class="mx-auto mt-5 max-w-2xl text-pretty text-base text-ink-500 sm:text-lg dark:text-ink-300"
        style="animation: fadeUp 0.7s 0.08s cubic-bezier(0.22,1,0.36,1) both"
      >
        {{ subtitle }}
      </p>

      <!-- Giant search -->
      <form
        class="relative mx-auto mt-9 max-w-2xl"
        role="search"
        @submit.prevent="onSubmit"
        style="animation: fadeUp 0.7s 0.16s cubic-bezier(0.22,1,0.36,1) both"
      >
        <!-- Glow ring -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-cta opacity-70 blur-[6px] transition duration-500"
          :class="[focused ? 'opacity-90' : 'opacity-60']"
        ></div>

        <div class="relative flex items-center gap-2 rounded-2xl border border-white/10 bg-white/90 p-2 shadow-glow ring-1 ring-black/5 dark:bg-ink-800/80 dark:ring-white/5">
          <!-- Search icon -->
          <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center text-ink-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7" stroke-linecap="round"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.3-4.3"/>
            </svg>
          </div>

          <input
            ref="inputRef"
            v-model="keyword"
            type="search"
            :placeholder="placeholder"
            autocomplete="off"
            spellcheck="false"
            class="h-11 min-w-0 flex-1 bg-transparent text-base text-ink-900 placeholder-ink-400 outline-none dark:text-white dark:placeholder-ink-400"
            aria-label="Search AI tools"
            @focus="focused = true"
            @blur="focused = false"
            @input="onInput"
          />

          <button
            type="submit"
            class="btn-shine inline-flex h-11 items-center gap-1.5 rounded-xl bg-gradient-cta px-5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98]"
            @mousemove="onMouseMove"
          >
            Search
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
            </svg>
          </button>
        </div>

        <!-- Autocomplete dropdown (structure预留；避免 CLS 使用 absolute) -->
        <ClientOnly>
          <div
            v-if="showSuggest && suggestions.length"
            class="glass-strong absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-white/10 p-1 shadow-xl"
          >
            <NuxtLink
              v-for="s in suggestions"
              :key="s.handle"
              :to="`/tools/${s.handle}`"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink-700 transition hover:bg-ink-100 dark:text-ink-100 dark:hover:bg-white/5"
              @mousedown.prevent
            >
              <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-cta/20 text-accent">
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="7"/>
                  <path stroke-linecap="round" d="M21 21l-4.3-4.3"/>
                </svg>
              </span>
              <span class="flex-1 truncate">{{ s.name }}</span>
              <span v-if="s.is_free" class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-500">Free</span>
            </NuxtLink>
          </div>
        </ClientOnly>
      </form>

      <!-- Trending tags -->
      <div
        class="mt-6 flex flex-wrap items-center justify-center gap-2"
        style="animation: fadeUp 0.7s 0.24s cubic-bezier(0.22,1,0.36,1) both"
      >
        <span class="text-xs font-medium uppercase tracking-[0.16em] text-ink-400 dark:text-ink-400">
          Trending
        </span>
        <NuxtLink
          v-for="tag in tags"
          :key="tag.handle"
          :to="l2UrlFor(tag)"
          class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700 transition hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:border-primary/60 dark:hover:text-white"
        >
          <span class="text-accent">#</span>
          {{ tag.name }}
        </NuxtLink>
      </div>

      <!-- Trust line -->
      <p class="mt-6 text-xs text-ink-400 dark:text-ink-400">
        {{ trustLine }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useAppRoutes } from '~/composables/useAppRoutes'

const props = defineProps({
  tags: {
    type: Array,
    default: () => [
      { name: 'AI Video', handle: 'ai-video' },
      { name: 'SEO Writing', handle: 'seo-writing' },
      { name: 'Image Generator', handle: 'image-generator' },
      { name: 'Chatbot', handle: 'chatbot' },
      { name: 'Code Assistant', handle: 'code-assistant' },
    ],
  },
})

// 热搜 tag 无 parentHandle 时，降级到 /search?q=xxx（避免 404）
const { l2Url } = useAppRoutes()
const l2UrlFor = (tag) => l2Url(tag?.parentHandle || '', tag?.handle)

const emit = defineEmits(['search', 'suggest'])

const eyebrow = '7,200+ AI tools · Updated daily'
const titlePrefix = 'Find the right'
const titleAccent = 'AI tool'
const titleSuffix = 'for any workflow — in seconds.'
const subtitle =
  'Hand-curated, battle-tested AI products for creators, marketers, and developers. Compare, filter, and ship with confidence.'
const placeholder = 'Try "AI video editor", "SEO writer", "coding copilot"…'
const trustLine = 'Trusted by 120K+ builders · Zero fluff, only shipping-ready tools.'

const keyword = ref('')
const focused = ref(false)
const suggestions = ref([])
const showSuggest = ref(false)
const inputRef = ref(null)
let debounceTimer = null

const onSubmit = () => {
  const q = keyword.value.trim()
  if (!q) return
  emit('search', q)
  navigateTo({ path: '/search', query: { q } })
}

const onInput = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const q = keyword.value.trim()
  if (!q) {
    suggestions.value = []
    showSuggest.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    try {
      const res = await $fetch('/api/tools', {
        query: { q, page: 1, pageSize: 6, sort: 'hot' },
      })
      suggestions.value = (res?.tools || []).slice(0, 6)
      showSuggest.value = suggestions.value.length > 0
      emit('suggest', suggestions.value)
    } catch (e) {
      suggestions.value = []
      showSuggest.value = false
    }
  }, 220)
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
</script>
