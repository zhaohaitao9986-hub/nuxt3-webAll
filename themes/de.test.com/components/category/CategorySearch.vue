<template>
  <div class="relative mx-auto max-w-2xl">
    <!-- Animated glow ring -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-cta blur-[6px] transition-opacity duration-500"
      :class="focused ? 'opacity-90' : 'opacity-55'"
    ></div>

    <div class="relative flex items-center gap-2 rounded-2xl border border-white/10 bg-white/95 p-2 shadow-glow ring-1 ring-black/5 dark:bg-ink-800/80 dark:ring-white/5">
      <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center text-ink-400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/>
          <path stroke-linecap="round" d="M21 21l-4.3-4.3"/>
        </svg>
      </div>

      <input
        v-model="keyword"
        type="search"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
        class="h-11 min-w-0 flex-1 bg-transparent text-base text-ink-900 placeholder-ink-400 outline-none dark:text-white dark:placeholder-ink-400"
        aria-label="Search AI categories"
        @focus="focused = true"
        @blur="onBlur"
        @input="onInput"
        @keydown.enter.prevent="onEnter"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.esc="open = false"
      />

      <kbd
        class="hidden rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[10px] font-medium text-ink-500 sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-ink-300"
      >
        {{ kbdLabel }}
      </kbd>
    </div>

    <!-- Suggestion dropdown (client-only, no SSR impact) -->
    <ClientOnly>
      <transition name="sg">
        <div
          v-show="open && filtered.length"
          class="glass-strong absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-white/10 p-1.5 shadow-xl"
          @mousedown.prevent
        >
          <p class="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400">
            {{ filtered.length }} categories match
          </p>
          <NuxtLink
            v-for="(item, i) in filtered"
            :key="item.handle"
            :to="l2UrlFor(item)"
            :class="[
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
              i === activeIndex
                ? 'bg-primary/10 text-primary-600 dark:text-white'
                : 'text-ink-700 hover:bg-ink-100 dark:text-ink-100 dark:hover:bg-white/5',
            ]"
            @mouseenter="activeIndex = i"
          >
            <span
              aria-hidden="true"
              class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-cta/10 text-accent"
              v-html="icon(item.handle)"
            ></span>
            <span class="min-w-0 flex-1 truncate" v-html="highlight(item.name)"></span>
            <span
              v-if="item.toolCount != null"
              class="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-white/10 dark:text-ink-300"
            >
              {{ formatCount(item.toolCount) }}
            </span>
          </NuxtLink>
        </div>
      </transition>
    </ClientOnly>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useCategoryIcon } from '~/composables/useCategoryIcon'
import { useAppRoutes } from '~/composables/useAppRoutes'

const { l2Url } = useAppRoutes()
const l2UrlFor = (item) => l2Url(item?.parentHandle || '', item?.handle)

const props = defineProps({
  // [{ id, name, handle, toolCount }] — 全量二级分类索引
  // 若父组件想走客户端搜索（强烈推荐，因为本地已有数据），直接传入
  source: { type: Array, default: () => [] },
  placeholder: {
    type: String,
    default: 'Search 400+ AI categories — "video", "seo", "voice"…',
  },
  maxSuggest: { type: Number, default: 8 },
})

const keyword = ref('')
const focused = ref(false)
const open = ref(false)
const activeIndex = ref(0)
const kbdLabel = ref('⌘ K')
let debounceTimer = null

const { resolve } = useCategoryIcon()
const icon = (h) => resolve(h)

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return []
  const result = []
  for (const item of props.source) {
    if (!item || !item.name) continue
    const name = item.name.toLowerCase()
    const handle = (item.handle || '').toLowerCase()
    if (name.includes(q) || handle.includes(q)) {
      result.push(item)
      if (result.length >= props.maxSuggest) break
    }
  }
  return result
})

const onInput = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    activeIndex.value = 0
    open.value = Boolean(filtered.value.length)
  }, 120)
}

const onBlur = () => {
  focused.value = false
  setTimeout(() => (open.value = false), 120)
}

watch(keyword, (v) => {
  if (!v) open.value = false
})

const move = (delta) => {
  if (!filtered.value.length) return
  const len = filtered.value.length
  activeIndex.value = (activeIndex.value + delta + len) % len
  open.value = true
}

const onEnter = () => {
  const target = filtered.value[activeIndex.value]
  if (target) {
    open.value = false
    navigateTo(l2UrlFor(target))
  } else if (keyword.value.trim()) {
    navigateTo({ path: '/search', query: { q: keyword.value.trim() } })
  }
}

const highlight = (name) => {
  const q = keyword.value.trim()
  if (!q) return name
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${safe})`, 'gi')
  return name.replace(re, '<mark class="bg-transparent text-primary-600 dark:text-accent font-semibold">$1</mark>')
}

const formatCount = (n) => {
  if (n < 1000) return String(n)
  if (n < 10000) return (n / 1000).toFixed(1) + 'k'
  return Math.round(n / 1000) + 'k'
}

onMounted(() => {
  const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform)
  kbdLabel.value = isMac ? '⌘ K' : 'Ctrl K'
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      const el = document.querySelector('input[aria-label="Search AI categories"]')
      if (el) el.focus()
    }
  }
  window.addEventListener('keydown', onKey)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
})
</script>

<style scoped>
.sg-enter-active,
.sg-leave-active {
  transition: opacity 0.18s ease, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.sg-enter-from,
.sg-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
