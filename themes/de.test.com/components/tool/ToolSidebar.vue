<template>
  <div class="space-y-6">
    <!-- Quick facts -->
    <section class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-white/5 dark:bg-ink-800/60">
      <h3 class="text-sm font-semibold text-ink-900 dark:text-white">
        Tool snapshot
      </h3>
      <dl class="mt-4 space-y-3 text-sm">
        <div v-if="tool.parentCategory" class="flex items-center justify-between gap-2">
          <dt class="text-ink-500 dark:text-ink-400">Category</dt>
          <dd class="font-medium text-ink-800 dark:text-white">
            <NuxtLink
              :to="`/category/${tool.parentCategory.handle}`"
              class="truncate transition hover:text-primary-600 dark:hover:text-accent"
            >
              {{ tool.parentCategory.name }}
            </NuxtLink>
          </dd>
        </div>
        <div v-if="tool.rating" class="flex items-center justify-between gap-2">
          <dt class="text-ink-500 dark:text-ink-400">Rating</dt>
          <dd class="inline-flex items-center gap-1 font-semibold text-ink-800 dark:text-white">
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-signal text-signal">
              <path d="M12 2l2.39 4.84L20 8l-4 3.9L17 18l-5-2.6L7 18l1-6.1L4 8l5.61-1.16L12 2z"/>
            </svg>
            {{ tool.rating.toFixed(1) }} / 5
          </dd>
        </div>
        <div v-if="tool.monthlyVisits" class="flex items-center justify-between gap-2">
          <dt class="text-ink-500 dark:text-ink-400">Monthly visits</dt>
          <dd class="font-semibold text-ink-800 dark:text-white">
            {{ formatVisits(tool.monthlyVisits) }}
          </dd>
        </div>
        <div v-if="tool.websiteType && tool.websiteType.length" class="flex items-start justify-between gap-2">
          <dt class="text-ink-500 dark:text-ink-400">Platform</dt>
          <dd class="text-right font-medium text-ink-800 dark:text-white">
            {{ tool.websiteType.join(', ') }}
          </dd>
        </div>
        <div v-if="tool.addTime" class="flex items-center justify-between gap-2">
          <dt class="text-ink-500 dark:text-ink-400">Added</dt>
          <dd class="font-medium text-ink-800 dark:text-white">
            {{ tool.addTime }}
          </dd>
        </div>
        <div v-if="updatedLabel" class="flex items-center justify-between gap-2">
          <dt class="text-ink-500 dark:text-ink-400">Updated</dt>
          <dd class="font-medium text-ink-800 dark:text-white">
            {{ updatedLabel }}
          </dd>
        </div>
      </dl>

      <a
        v-if="tool.website"
        :href="tool.website"
        target="_blank"
        rel="noopener nofollow sponsored"
        class="btn-shine mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-cta px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:scale-[1.02]"
        @mousemove="onMouseMove"
      >
        Visit website
        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M7 7h10v10"/>
        </svg>
      </a>
    </section>

    <!-- Tag cloud -->
    <section
      v-if="tool.tags && tool.tags.length"
      class="rounded-2xl border border-ink-200 bg-white p-5 dark:border-white/5 dark:bg-ink-800/60"
    >
      <h3 class="text-sm font-semibold text-ink-900 dark:text-white">
        Tags
      </h3>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <NuxtLink
          v-for="(tag, i) in tool.tags"
          :key="i"
          :to="`/?tag=${encodeURIComponent(tag)}`"
          class="inline-flex items-center rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-700 transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white"
        >
          #{{ tag }}
        </NuxtLink>
      </div>
    </section>

    <!-- Sidebar ad -->
    <AdSlot
      variant="sidebar"
      label="Sponsored"
      slot-id="tool-detail-sidebar"
      class="min-h-[480px]"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdSlot from '../AdSlot.vue'

const props = defineProps({
  tool: { type: Object, required: true },
})

const updatedLabel = computed(() => {
  const d = props.tool?.updatedAt
  if (!d) return null
  const then = new Date(d)
  if (Number.isNaN(then.getTime())) return null
  return then.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
})

const formatVisits = (value) => {
  const n = Number(value || 0)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
</script>
