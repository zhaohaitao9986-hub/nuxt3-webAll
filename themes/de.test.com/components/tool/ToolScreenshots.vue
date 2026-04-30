<template>
  <section
    v-if="items.length"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="preview-heading"
  >
    <header class="flex items-center gap-3">
      <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
      <h2 id="preview-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
        Preview
      </h2>
    </header>

    <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      <button
        v-for="(item, i) in items"
        :key="i"
        type="button"
        class="group relative aspect-square overflow-hidden rounded-xl border border-ink-200 bg-gradient-to-br from-white to-ink-50 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card-hover dark:border-white/10 dark:from-white/[0.04] dark:to-white/[0.01]"
        :style="{ '--g': gradientByKey(`${seed}-${i}`) }"
        @click="openLightbox(i)"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          :style="{ background: `${gradientByKey(`${seed}-${i}`)}`, mixBlendMode: 'overlay' }"
        ></span>

        <img
          v-if="item.src && !item.errored"
          :src="item.src"
          :alt="`${toolName} preview ${i + 1}`"
          width="160"
          height="160"
          loading="lazy"
          decoding="async"
          class="relative z-10 h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          @error="item.errored = true"
        />
        <div
          v-else
          class="relative z-10 flex h-full w-full items-center justify-center text-3xl font-bold text-white"
          :style="{ background: gradientByKey(`${seed}-${i}`) }"
        >
          {{ initial }}
        </div>

        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-white/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          Click to preview
        </span>
      </button>
    </div>

    <!-- Lightbox -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="lightbox.open"
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
            @click.self="closeLightbox"
            @keydown.esc="closeLightbox"
          >
            <button
              type="button"
              class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close preview"
              @click="closeLightbox"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <img
              v-if="items[lightbox.index] && items[lightbox.index].src"
              :src="items[lightbox.index].src"
              :alt="`${toolName} large preview`"
              class="max-h-[80vh] max-w-[80vw] rounded-xl border border-white/10 bg-white/5 object-contain shadow-2xl"
            />
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </section>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useGradientPalette } from '~/composables/useGradientPalette'

const props = defineProps({
  images: { type: Array, default: () => [] },
  toolName: { type: String, default: '' },
  seed: { type: String, default: 'preview' },
})

const { gradientByKey } = useGradientPalette()

const items = computed(() =>
  (props.images || [])
    .filter((src) => typeof src === 'string' && src)
    .map((src) => reactive({ src, errored: false })),
)

const initial = computed(() => String(props.toolName || 'A').trim().charAt(0).toUpperCase())

const lightbox = reactive({ open: false, index: 0 })
const openLightbox = (i) => {
  if (!import.meta.client) return
  lightbox.index = i
  lightbox.open = true
}
const closeLightbox = () => {
  lightbox.open = false
}
</script>
