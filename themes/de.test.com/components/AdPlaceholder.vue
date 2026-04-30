<template>
  <aside
    class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center"
    :class="sizeClass"
    :aria-label="label"
  >
    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
      {{ label }}
    </p>
    <p class="mt-2 text-sm text-slate-400">
      Google AdSense Slot
    </p>
  </aside>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label?: string
    size?: 'feed' | 'sidebar' | 'banner'
  }>(),
  {
    label: 'Sponsored',
    size: 'feed',
  },
)

const sizeClass = computed(() => {
  if (props.size === 'sidebar') return 'min-h-[280px]'
  if (props.size === 'banner') return 'min-h-[120px]'
  return 'min-h-[180px]'
})
</script>
