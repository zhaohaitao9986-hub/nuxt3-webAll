<template>
  <div class="relative">
    <!-- Left/right fade hints for horizontal scroll -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[rgb(var(--bg))] to-transparent"
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[rgb(var(--bg))] to-transparent"
    ></div>

    <div
      ref="scrollerRef"
      class="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 py-1"
      role="tablist"
      aria-label="AI tool categories"
    >
      <button
        v-for="item in items"
        :key="item.handle"
        type="button"
        role="tab"
        :aria-selected="modelValue === item.handle"
        :class="[
          'group flex-shrink-0 snap-start',
          'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium',
          'transition-all duration-200 ease-smooth',
          modelValue === item.handle
            ? 'border-transparent bg-gradient-cta text-white shadow-glow'
            : 'border-ink-200 bg-white text-ink-700 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:border-primary/60 dark:hover:text-white',
        ]"
        @click="$emit('update:modelValue', item.handle)"
      >
        <span
          aria-hidden="true"
          class="flex h-5 w-5 items-center justify-center"
          v-html="resolveIcon(item)"
        ></span>
        <span class="whitespace-nowrap">{{ item.name }}</span>
        <span
          v-if="item.tool_count != null"
          :class="[
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            modelValue === item.handle
              ? 'bg-white/20 text-white'
              : 'bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-300',
          ]"
        >
          {{ formatCount(item.tool_count) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: 'all' },
  items: { type: Array, default: () => [] },
})
defineEmits(['update:modelValue'])

const scrollerRef = ref(null)

// Tiny inline SVG set keyed by handle prefix / fallback by index
const iconMap = {
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18" stroke-linecap="round"/></svg>',
  write:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L20 8l-4-4L4 16v4z"/></svg>',
  video:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path stroke-linecap="round" d="M16 10l5-3v10l-5-3"/></svg>',
  image:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 9l-4 3 4 3m8-6l4 3-4 3M14 5l-4 14"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a8 8 0 11-3.2-6.4L21 4l-1 4.8A8 8 0 0121 12z"/></svg>',
  seo:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.3-4.3"/></svg>',
  audio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9v6m3-9v12m3-8v4m-9-1h2m10 0h2"/></svg>',
  design:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="8" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="12" cy="16" r="1.5"/></svg>',
  bot:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 12v2m6-2v2M12 3v4" stroke-linecap="round"/></svg>',
}

const resolveIcon = (item) => {
  if (item.icon) return item.icon
  if (item.handle === 'all') return iconMap.all
  const h = item.handle.toLowerCase()
  if (h.includes('video')) return iconMap.video
  if (h.includes('image') || h.includes('photo')) return iconMap.image
  if (h.includes('code') || h.includes('dev')) return iconMap.code
  if (h.includes('chat') || h.includes('bot')) return iconMap.chat
  if (h.includes('seo') || h.includes('search')) return iconMap.seo
  if (h.includes('audio') || h.includes('music') || h.includes('voice')) return iconMap.audio
  if (h.includes('design') || h.includes('art')) return iconMap.design
  if (h.includes('write') || h.includes('content')) return iconMap.write
  return iconMap.bot
}

const formatCount = (n) => {
  if (!n && n !== 0) return ''
  if (n < 1000) return String(n)
  if (n < 10000) return (n / 1000).toFixed(1) + 'k'
  return Math.round(n / 1000) + 'k'
}
</script>
