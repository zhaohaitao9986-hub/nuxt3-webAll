<template>
  <article class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div class="flex items-start gap-3">
      <img
        :src="tool.website_logo || fallbackLogo"
        :alt="`${tool.name} logo`"
        loading="lazy"
        class="h-12 w-12 rounded-md border border-slate-200 object-cover"
      >
      <div class="min-w-0 flex-1">
        <h3 class="line-clamp-1 text-base font-semibold text-slate-900">
          {{ tool.name }}
        </h3>
        <p class="mt-1 line-clamp-2 text-sm text-slate-600">
          {{ tool.description || copy.noDescription }}
        </p>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="category in tool.categories"
        :key="category.handle"
        class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
      >
        {{ category.name }}
      </span>
      <span
        v-if="tool.is_free"
        class="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-600"
      >
        {{ copy.freeBadge }}
      </span>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <p class="text-xs text-slate-500">
        {{ copy.monthVisits }}: {{ formatVisits(tool.month_visited_count) }}
      </p>
      <a
        :href="tool.website || '#'"
        target="_blank"
        rel="noopener nofollow sponsored"
        class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
      >
        {{ copy.visitNow }}
      </a>
    </div>
  </article>
</template>

<script setup lang="ts">
type ToolCategory = {
  name: string
  handle: string
}

type ToolItem = {
  handle: string
  name: string
  description: string | null
  website: string | null
  website_logo: string | null
  month_visited_count: number
  is_free: boolean
  categories: ToolCategory[]
}

defineProps<{
  tool: ToolItem
}>()

const fallbackLogo = '/favicon.ico'
const copy = {
  noDescription: 'No description provided yet.',
  freeBadge: 'Free',
  monthVisits: 'Monthly visits',
  visitNow: 'Visit',
}

const formatVisits = (value: number) =>
  new Intl.NumberFormat().format(value || 0)
</script>
