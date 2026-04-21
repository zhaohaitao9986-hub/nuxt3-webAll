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
        <NuxtLink
          v-for="item in nav"
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

const nav = [
  { label: 'Categories', href: '/ai-tools' },
  { label: 'Submit Tool', href: '/submit' },
  { label: 'Blog', href: '/blog' },
]

const scrolled = ref(false)
const { mode, toggle, init } = useColorMode()

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
})
</script>
