<template>
  <div
    class="sticky top-16 z-20 -mx-4 border-y border-ink-100 bg-[rgb(var(--bg))]/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:border-white/5"
    role="toolbar"
    aria-label="Search filters"
  >
    <div class="mx-auto flex w-full max-w-7xl items-center gap-6 overflow-x-auto scrollbar-hide">
      <!-- Price group -->
      <div class="flex flex-shrink-0 items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Price</span>
        <div class="flex gap-1.5">
          <button
            v-for="opt in priceOptions"
            :key="opt.value"
            type="button"
            :class="pillClass(price === opt.value)"
            @click="$emit('update:price', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <span aria-hidden="true" class="hidden h-5 w-px bg-ink-200 dark:bg-white/10 sm:inline-block"></span>

      <!-- Sort group -->
      <div class="flex flex-shrink-0 items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Sort</span>
        <div class="flex gap-1.5">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            type="button"
            :class="pillClass(sort === opt.value)"
            @click="$emit('update:sort', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Reset -->
      <button
        v-if="price !== 'all' || sort !== 'relevance'"
        type="button"
        class="ml-auto flex flex-shrink-0 items-center gap-1 rounded-full border border-dashed border-ink-200 px-3 py-1.5 text-[11px] font-medium text-ink-500 transition hover:border-primary/50 hover:text-primary-600 dark:border-white/10 dark:text-ink-300 dark:hover:text-white"
        @click="reset"
      >
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
        Reset
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  price: { type: String, default: 'all' },
  sort: { type: String, default: 'relevance' },
})

const emit = defineEmits(['update:price', 'update:sort', 'reset'])

const priceOptions = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'pro', label: 'Pro' },
]

const sortOptions = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'rating', label: 'Top rated' },
  { value: 'new', label: 'Newest' },
]

const pillClass = (active) => [
  'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-smooth whitespace-nowrap',
  active
    ? 'bg-gradient-cta text-white shadow-glow'
    : 'border border-ink-200 bg-white text-ink-700 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white',
]

const reset = () => {
  emit('update:price', 'all')
  emit('update:sort', 'relevance')
  emit('reset')
}
</script>
