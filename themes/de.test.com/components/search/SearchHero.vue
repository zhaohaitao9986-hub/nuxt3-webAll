<template>
  <section class="relative isolate overflow-hidden">
    <!-- Mesh backdrop 与其他 Hero 保持一致的 AI 高级感 -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10"
      style="
        background:
          radial-gradient(60% 60% at 20% 0%, rgba(124,92,255,0.18) 0%, transparent 60%),
          radial-gradient(50% 50% at 90% 10%, rgba(34,211,238,0.14) 0%, transparent 60%);
      "
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] dark:opacity-[0.08]"
      style="
        background-image:
          linear-gradient(rgba(124,92,255,0.6) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,92,255,0.6) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(ellipse 70% 60% at 30% 0%, #000 40%, transparent 100%);
        -webkit-mask-image: radial-gradient(ellipse 70% 60% at 30% 0%, #000 40%, transparent 100%);
      "
    ></div>

    <div class="mx-auto w-full max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-10 lg:px-8">
      <!-- Breadcrumb -->
      <nav aria-label="breadcrumb" class="flex items-center gap-1.5 text-[11px] font-medium text-ink-500 dark:text-ink-400">
        <NuxtLink to="/" class="transition hover:text-primary-600 dark:hover:text-accent">Home</NuxtLink>
        <svg viewBox="0 0 24 24" class="h-3 w-3 text-ink-300 dark:text-ink-500" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/>
        </svg>
        <span class="text-ink-800 dark:text-white">Search results</span>
      </nav>

      <!-- H1 -->
      <h1
        class="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl dark:text-white"
      >
        <template v-if="query">
          <span class="text-gradient">{{ query }}</span>
          <span class="text-ink-900 dark:text-white"> — AI tools</span>
        </template>
        <template v-else>
          Search <span class="text-gradient">20,000+</span> AI tools
        </template>
      </h1>
      <p class="mt-2 max-w-xl text-sm text-ink-500 dark:text-ink-400">
        {{ subtitle }}
      </p>

      <!-- Search input (big, glowing) -->
      <form class="relative mt-6 max-w-3xl" role="search" @submit.prevent="submit">
        <div
          :class="[
            'group relative overflow-hidden rounded-2xl border bg-white transition-all duration-300 ease-smooth dark:bg-ink-800/80',
            focused
              ? 'border-primary/50 shadow-glow'
              : 'border-ink-200 shadow-sm dark:border-white/10',
          ]"
        >
          <!-- Glow wash -->
          <span
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300"
            :class="focused ? 'opacity-100' : ''"
            style="background: radial-gradient(600px circle at var(--mx,50%) var(--my,50%), rgba(124,92,255,0.12), transparent 40%);"
          ></span>

          <label class="sr-only" for="search-input">Search AI tools</label>
          <div class="relative flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <svg viewBox="0 0 24 24" class="h-5 w-5 flex-shrink-0 text-ink-400 dark:text-ink-400" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7"/>
              <path stroke-linecap="round" d="M21 21l-4.3-4.3"/>
            </svg>
            <input
              id="search-input"
              ref="inputRef"
              v-model="draft"
              type="search"
              autocomplete="off"
              spellcheck="false"
              :placeholder="placeholder"
              class="min-w-0 flex-1 bg-transparent text-base text-ink-900 placeholder:text-ink-400 focus:outline-none dark:text-white"
              @focus="focused = true"
              @blur="focused = false"
              @mousemove="onMouseMove"
            />
            <button
              v-if="draft"
              type="button"
              aria-label="Clear"
              class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-white/5 dark:hover:text-white"
              @click="clear"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <button
              type="submit"
              class="btn-shine relative hidden flex-shrink-0 overflow-hidden rounded-xl bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow transition-transform duration-200 hover:scale-[1.03] sm:inline-flex"
              @mousemove="onMouseMove"
            >
              <span class="relative z-10">Search</span>
            </button>
          </div>
        </div>
      </form>

      <!-- Result count + trending tags -->
      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          v-if="query"
          class="inline-flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-300"
        >
          <svg
            v-if="total > 0"
            viewBox="0 0 24 24"
            class="h-4 w-4 text-emerald-500"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/>
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            class="h-4 w-4 text-rose-500"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"/>
            <path stroke-linecap="round" d="M4.9 4.9l14.2 14.2"/>
          </svg>
          <strong class="font-semibold text-ink-900 dark:text-white">{{ total }}</strong>
          <span>{{ total === 1 ? 'result' : 'results' }} for</span>
          <span class="rounded-md bg-primary/10 px-1.5 py-0.5 text-[12px] font-semibold text-primary-600 dark:text-accent">"{{ query }}"</span>
        </p>
        <p v-else class="text-sm text-ink-500 dark:text-ink-400">
          Start by picking a popular topic below ↓
        </p>
      </div>

      <!-- Trending tags -->
      <div v-if="trendingTags && trendingTags.length" class="mt-4 -mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0">
        <div class="flex gap-2 whitespace-nowrap pb-1">
          <span class="self-center text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Trending:</span>
          <button
            v-for="tag in trendingTags"
            :key="tag"
            type="button"
            :class="[
              'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-smooth',
              draft.toLowerCase() === tag.toLowerCase()
                ? 'border-primary/50 bg-primary/10 text-primary-600 shadow-glow dark:text-accent'
                : 'border-ink-200 bg-white text-ink-700 hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary-600 dark:border-white/10 dark:bg-white/5 dark:text-ink-200 dark:hover:text-white',
            ]"
            @click="pickTag(tag)"
          >
            #{{ tag }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  query: { type: String, default: '' },
  total: { type: Number, default: 0 },
  trendingTags: { type: Array, default: () => [] },
})

const emit = defineEmits(['submit'])

const draft = ref(props.query)
const focused = ref(false)
const inputRef = ref(null)

watch(
  () => props.query,
  (v) => {
    draft.value = v
  },
)

const subtitle = computed(() => {
  if (props.query && props.total > 0) {
    return `Filter by pricing or sort to find the exact ${props.query} tool you need.`
  }
  if (props.query && props.total === 0) {
    return `No exact matches — try a broader keyword or browse popular tools below.`
  }
  return 'Find the perfect AI tool for your workflow — 20,000+ curated entries.'
})

const placeholder = computed(() => props.query || 'Try "AI Video", "Chatbot", "Image upscaler"…')

const submit = () => {
  emit('submit', draft.value.trim())
}

const clear = () => {
  draft.value = ''
  if (inputRef.value) inputRef.value.focus()
  emit('submit', '')
}

const pickTag = (tag) => {
  draft.value = tag
  emit('submit', tag)
}

const onMouseMove = (e) => {
  const target = e.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  target.style.setProperty('--my', `${e.clientY - rect.top}px`)
}
</script>
