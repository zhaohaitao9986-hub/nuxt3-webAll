<template>
  <section class="relative isolate overflow-hidden">
    <!-- Mesh backdrop -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 opacity-70"
      :style="{
        background:
          `radial-gradient(60% 60% at 20% 20%, ${accent[0]}33 0%, transparent 60%),` +
          `radial-gradient(50% 50% at 85% 15%, ${accent[1]}2E 0%, transparent 60%)`,
      }"
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.1]"
      style="
        background-image:
          linear-gradient(rgba(124,92,255,0.6) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,92,255,0.6) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(ellipse 60% 60% at 30% 30%, #000 50%, transparent 100%);
        -webkit-mask-image: radial-gradient(ellipse 60% 60% at 30% 30%, #000 50%, transparent 100%);
      "
    ></div>

    <div class="mx-auto w-full max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-12 lg:px-8">
      <CategoryBreadcrumb :parent="parent" :current="category.name" />

      <div class="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div class="min-w-0 flex-1">
          <!-- Eyebrow chips -->
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span
              class="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-600 dark:text-ink-200"
            >
              <span class="relative flex h-1.5 w-1.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
                <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent"></span>
              </span>
              Updated {{ updatedLabel }}
            </span>
            <NuxtLink
              v-if="parent"
              :to="`/category/${parent.handle}`"
              class="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 transition hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-300 dark:hover:text-white"
            >
              in {{ parent.name }}
            </NuxtLink>
          </div>

          <h1
            class="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl lg:text-5xl dark:text-white"
          >
            2026 Best
            <span class="text-gradient animate-gradient-pan">{{ category.name }}</span>
            AI Tools
          </h1>

          <p
            v-if="description"
            class="mt-3 max-w-2xl text-pretty text-sm text-ink-500 sm:text-base dark:text-ink-300"
          >
            {{ description }}
          </p>

          <!-- Stats strip -->
          <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-500 dark:text-ink-400">
            <span class="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-accent" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 17V9m4 8V5m4 12v-6M3 21h18"/>
              </svg>
              <span class="font-semibold text-ink-700 dark:text-ink-100">{{ category.toolCount || 0 }}</span>
              tools in this niche
            </span>
            <span class="h-3 w-px bg-ink-200 dark:bg-white/10"></span>
            <span class="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-signal" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12a9 9 0 1018 0 9 9 0 00-18 0zm9-4v4l3 2"/>
              </svg>
              Editorially curated
            </span>
            <span class="h-3 w-px bg-ink-200 dark:bg-white/10"></span>
            <span class="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-primary-500" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Zero-fluff picks
            </span>
          </div>
        </div>

        <!-- Quick filters (right side on desktop) -->
        <div class="flex flex-shrink-0 flex-wrap gap-2">
          <button
            v-for="f in filters"
            :key="f.id"
            type="button"
            :class="[
              'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-smooth',
              activeFilter === f.id
                ? 'border-transparent bg-gradient-cta text-white shadow-glow'
                : 'border-ink-200 bg-white text-ink-700 hover:border-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white',
            ]"
            @click="$emit('update:filter', f.id)"
          >
            {{ f.label }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import CategoryBreadcrumb from './CategoryBreadcrumb.vue'
import { useGradientPalette } from '~/composables/useGradientPalette'

const props = defineProps({
  category: { type: Object, required: true },
  parent: { type: Object, default: null },
  activeFilter: { type: String, default: 'popular' },
})
defineEmits(['update:filter'])

const { pickByKey } = useGradientPalette()
const accent = computed(() => pickByKey(props.category?.handle || 'default'))

const filters = [
  { id: 'popular', label: 'Popular' },
  { id: 'new', label: 'New' },
  { id: 'free', label: 'Free' },
]

const updatedLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

const description = computed(() => {
  const c = props.category
  if (!c) return ''
  if (c.what_is_summary) {
    // 压缩到单行、去段落换行
    return String(c.what_is_summary).replace(/\s+/g, ' ').slice(0, 180).trim() + '…'
  }
  return `The best ${c.name} AI tools — ranked by monthly traffic, editorial quality, and pricing transparency.`
})
</script>
