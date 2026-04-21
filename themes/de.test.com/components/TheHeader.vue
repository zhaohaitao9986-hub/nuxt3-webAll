<template>
  <header
    :class="[
      'sticky top-0 z-50 w-full transition-all duration-300 ease-smooth',
      scrolled
        ? 'glass-strong border-b border-white/5 py-2'
        : 'bg-transparent py-4',
    ]"
  >
    <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <!-- Logo -->
      <NuxtLink to="/" class="group flex items-center gap-2.5" aria-label="aiseekertools home">
        <span
          class="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-cta shadow-glow"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 12l4-8 4 14 4-10 4 6"/>
          </svg>
          <span class="absolute inset-0 rounded-lg bg-gradient-cta opacity-60 blur-md transition group-hover:opacity-90"></span>
        </span>
        <span class="flex flex-col leading-none">
          <span class="text-sm font-semibold tracking-tight text-ink-900 dark:text-white">
            aiseekertools
          </span>
          <span class="text-[10px] uppercase tracking-[0.18em] text-ink-400 dark:text-ink-300">
            .com · AI Tools Directory
          </span>
        </span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-1 md:flex" aria-label="Primary">
        <!-- Categories hover dropdown (the mega-menu) -->
        <div
          class="relative"
          @mouseenter="openCategories"
          @mouseleave="scheduleClose"
          @focusin="openCategories"
          @focusout="scheduleClose"
        >
          <NuxtLink
            to="/ai-tools"
            :aria-expanded="catOpen"
            aria-haspopup="true"
            :class="[
              'inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
              catOpen
                ? 'bg-ink-100 text-ink-900 dark:bg-white/10 dark:text-white'
                : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/5 dark:hover:text-white',
            ]"
          >
            Categories
            <svg
              viewBox="0 0 24 24"
              :class="[
                'h-3.5 w-3.5 transition-transform duration-200',
                catOpen ? 'rotate-180' : '',
              ]"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
            </svg>
          </NuxtLink>

          <!-- Hover panel -->
          <Transition name="mega">
            <div
              v-show="catOpen"
              class="glass-strong absolute left-1/2 top-[calc(100%+6px)] z-50 w-[min(92vw,720px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 p-2 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.5)]"
              role="menu"
              @mouseenter="openCategories"
              @mouseleave="scheduleClose"
            >
              <!-- Loading / skeleton -->
              <div
                v-if="!navCats.length"
                class="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3"
                aria-hidden="true"
              >
                <div
                  v-for="i in 9"
                  :key="i"
                  class="h-10 animate-pulse rounded-xl bg-ink-100/60 dark:bg-white/5"
                ></div>
              </div>

              <!-- Grid of L1 categories -->
              <div v-else class="grid grid-cols-2 gap-1 sm:grid-cols-3">
                <NuxtLink
                  v-for="(l1, i) in navCats"
                  :key="l1.id"
                  :to="`/${l1.handle}`"
                  role="menuitem"
                  class="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-ink-100 dark:hover:bg-white/5"
                >
                  <span
                    aria-hidden="true"
                    class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                    :style="{ background: gradients[i % gradients.length] }"
                    v-html="icon(l1.handle)"
                  ></span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-ink-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-accent">
                      {{ l1.name }}
                    </span>
                    <span class="block truncate text-[11px] text-ink-400 dark:text-ink-500">
                      {{ l1.subCount }} sub-categories
                    </span>
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    class="h-3.5 w-3.5 flex-shrink-0 text-ink-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary-500 dark:text-ink-600"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>
                  </svg>
                </NuxtLink>
              </div>

              <!-- Footer CTA -->
              <div class="mt-2 flex items-center justify-between border-t border-white/10 px-3 py-2 text-[11px]">
                <span class="text-ink-400 dark:text-ink-500">
                  {{ navCats.length }} top categories · 400+ niches
                </span>
                <NuxtLink
                  to="/ai-tools"
                  class="inline-flex items-center gap-1 font-semibold text-primary-600 transition hover:text-primary-700 dark:text-accent dark:hover:text-white"
                >
                  Browse all
                  <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>
                  </svg>
                </NuxtLink>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Other nav links -->
        <NuxtLink
          v-for="item in staticNav"
          :key="item.href"
          :to="item.href"
          class="rounded-full px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/5 dark:hover:text-white"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Right -->
      <div class="flex items-center gap-2">
        <!-- Theme toggle -->
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 transition hover:text-ink-900 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
          :aria-label="mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggle"
        >
          <svg v-if="mode === 'dark'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="4" stroke-linecap="round"/>
            <path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </button>

        <!-- High-contrast CTA -->
        <NuxtLink
          to="/submit"
          class="btn-shine group relative hidden items-center gap-1.5 rounded-full bg-gradient-cta px-4 py-2 text-xs font-semibold text-white shadow-glow transition hover:shadow-[0_0_0_1px_rgba(34,211,238,0.5),0_12px_48px_-12px_rgba(34,211,238,0.6)] sm:inline-flex"
          @mousemove="onMouseMove"
        >
          <span class="relative z-10">Get Featured</span>
          <svg viewBox="0 0 24 24" class="relative z-10 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6"/>
          </svg>
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useColorMode } from '~/composables/useColorMode'
import { useCategoryIcon } from '~/composables/useCategoryIcon'

const staticNav = [
  { label: 'Submit Tool', href: '/submit' },
  { label: 'Blog', href: '/blog' },
]

const scrolled = ref(false)
const { mode, toggle, init } = useColorMode()
const { resolve } = useCategoryIcon()

// ------- Categories hover dropdown -------
const catOpen = ref(false)
let closeTimer = null

const openCategories = () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  catOpen.value = true
}

// 延迟关闭，给用户在主按钮和弹层之间移动的缓冲
const scheduleClose = () => {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    catOpen.value = false
  }, 120)
}

// Nav categories SSR-friendly fetch —— useAsyncData 命中全局缓存，payload 极小
const { data: navData } = await useAsyncData(
  'nav-categories',
  () => $fetch('/api/nav/categories'),
  { default: () => ({ categories: [] }) },
)
const navCats = computed(() => navData.value?.categories || [])

const icon = (handle) => {
  const raw = resolve(handle)
  return raw.replace('<svg ', '<svg class="h-4 w-4" ')
}

// 固定色板（与其他组件保持视觉一致）
const gradients = [
  'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F472B6 0%, #7C5CFF 100%)',
  'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
  'linear-gradient(135deg, #22C55E 0%, #22D3EE 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #F472B6 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
  'linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #F43F5E 0%, #F59E0B 100%)',
]

const onScroll = () => {
  scrolled.value = window.scrollY > 8
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

onMounted(() => {
  init()
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('scroll', onScroll)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<style scoped>
.mega-enter-active,
.mega-leave-active {
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.mega-enter-from,
.mega-leave-to {
  opacity: 0;
  transform: translate(-50%, -4px);
}
.mega-enter-to,
.mega-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>
