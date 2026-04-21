<template>
  <aside
    v-if="items && items.length"
    class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="related-heading"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
          Don't leave yet
        </p>
        <h2
          id="related-heading"
          class="mt-1 truncate text-base font-semibold text-ink-900 dark:text-white"
        >
          Related niches
          <span v-if="parent" class="text-ink-400 dark:text-ink-500">in {{ parent.name }}</span>
        </h2>
      </div>
      <NuxtLink
        v-if="parent"
        :to="`/${parent.handle}`"
        class="hidden flex-shrink-0 rounded-full border border-ink-200 px-3 py-1 text-[11px] font-medium text-ink-600 transition hover:border-primary/50 hover:text-primary-600 sm:inline-flex dark:border-white/10 dark:text-ink-300 dark:hover:text-white"
      >
        All in {{ parent.name }}
      </NuxtLink>
    </div>

    <ul class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <li v-for="item in items" :key="item.handle">
        <NuxtLink
          :to="l2UrlFor(item)"
          class="group flex items-center gap-3 rounded-xl border border-transparent bg-ink-50 px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white hover:shadow-sm dark:bg-white/5 dark:hover:border-primary/40 dark:hover:bg-white/10"
        >
          <span
            aria-hidden="true"
            class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white"
            :style="{ background: gradientByKey(item.handle) }"
            v-html="icon(item.handle)"
          ></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink-800 group-hover:text-primary-600 dark:text-ink-100 dark:group-hover:text-accent">
              {{ item.name }}
            </span>
            <span class="block text-[11px] text-ink-400 dark:text-ink-500">
              {{ item.toolCount || 0 }} tools
            </span>
          </span>
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 flex-shrink-0 text-ink-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary-500 dark:text-ink-600" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>
          </svg>
        </NuxtLink>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { useCategoryIcon } from '~/composables/useCategoryIcon'
import { useGradientPalette } from '~/composables/useGradientPalette'
import { useAppRoutes } from '~/composables/useAppRoutes'

const props = defineProps({
  items: { type: Array, default: () => [] },
  parent: { type: Object, default: null },
})

const { resolve } = useCategoryIcon()
const { gradientByKey } = useGradientPalette()
const { l2Url } = useAppRoutes()

// 优先使用 item.parentHandle（API 已下发），兜底使用上级 parent prop
const l2UrlFor = (item) =>
  l2Url(item?.parentHandle || props.parent?.handle || '', item?.handle)

const icon = (h) => {
  // 用更小尺寸 SVG 显示
  const raw = resolve(h)
  return raw.replace('<svg ', '<svg class="h-4 w-4" ')
}
</script>
