<template>
  <nav aria-label="Breadcrumb" class="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
    <NuxtLink
      to="/"
      class="inline-flex items-center gap-1 transition hover:text-primary-600 dark:hover:text-white"
    >
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-3v-6H10v6H7a2 2 0 01-2-2V10z"/>
      </svg>
      Home
    </NuxtLink>

    <Divider />

    <NuxtLink
      v-if="parent"
      :to="`/category/${parent.handle}`"
      class="truncate max-w-[180px] transition hover:text-primary-600 dark:hover:text-white"
    >
      {{ parent.name }}
    </NuxtLink>
    <NuxtLink
      v-else
      to="/category"
      class="transition hover:text-primary-600 dark:hover:text-white"
    >
      Categories
    </NuxtLink>

    <Divider />

    <span
      class="truncate max-w-[220px] font-medium text-ink-800 dark:text-white"
      aria-current="page"
    >
      {{ current }}
    </span>
  </nav>
</template>

<script setup>
import { h } from 'vue'

defineProps({
  parent: { type: Object, default: null },
  current: { type: String, required: true },
})

// Inline separator
const Divider = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      class: 'h-3 w-3 flex-shrink-0 text-ink-300 dark:text-ink-600',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
    },
    [h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9 6l6 6-6 6' })],
  )
</script>
