<template>
  <section
    v-if="items.length || fallbackText"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="company-info-heading"
  >
    <header class="flex items-center gap-3">
      <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
      <h2 id="company-info-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
        Company information
      </h2>
    </header>

    <!-- Structured key/value: 2-col definition list -->
    <dl
      v-if="structuredItems.length"
      class="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2"
    >
      <div
        v-for="(entry, i) in structuredItems"
        :key="i"
        class="group flex items-start gap-3 rounded-xl border border-ink-100 bg-gradient-to-br from-ink-50/60 to-white p-3 transition hover:border-primary/30 dark:border-white/5 dark:from-white/[0.03] dark:to-white/[0.01] dark:hover:border-primary/30"
      >
        <span
          aria-hidden="true"
          class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
          :style="{ background: gradientByKey(`company-${entry.key}-${i}`) }"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5">
            <path v-if="iconForKey(entry.key) === 'calendar'" stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/>
            <path v-else-if="iconForKey(entry.key) === 'location'" stroke-linecap="round" stroke-linejoin="round" d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle v-if="iconForKey(entry.key) === 'location'" cx="12" cy="10" r="3"/>
            <path v-else-if="iconForKey(entry.key) === 'people'" stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            <path v-else-if="iconForKey(entry.key) === 'link'" stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            <path v-else-if="iconForKey(entry.key) === 'mail'" stroke-linecap="round" stroke-linejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6"/>
            <path v-else-if="iconForKey(entry.key) === 'money'" stroke-linecap="round" stroke-linejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <dt class="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
            {{ entry.key }}
          </dt>
          <dd class="mt-0.5 break-words text-sm font-medium text-ink-800 dark:text-ink-100">
            <a
              v-if="entry.href"
              :href="entry.href"
              target="_blank"
              rel="noopener nofollow"
              class="inline-flex items-center gap-1 text-primary-600 transition hover:text-primary-700 dark:text-accent dark:hover:text-white"
            >
              {{ entry.value }}
              <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M7 7h10v10"/>
              </svg>
            </a>
            <span v-else>{{ entry.value }}</span>
          </dd>
        </div>
      </div>
    </dl>

    <!-- Plain bullet list (when items exist but no key:value pattern) -->
    <ul
      v-else-if="items.length"
      class="mt-5 space-y-2"
    >
      <li
        v-for="(item, i) in items"
        :key="i"
        class="flex items-start gap-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300"
      >
        <span class="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gradient-cta"></span>
        <span>{{ item }}</span>
      </li>
    </ul>

    <!-- Fallback: raw cleaned text -->
    <p
      v-else
      class="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300"
    >
      {{ fallbackText }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useGradientPalette } from '~/composables/useGradientPalette'

const props = defineProps({
  companyInfo: { type: String, default: '' },
})

const { gradientByKey } = useGradientPalette()

const stripHtml = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

// 从 company_info 中提取 <li> 项；若没有 <li> 就按换行拆
const items = computed(() => {
  const raw = props.companyInfo || ''
  if (!raw) return []
  if (/<li\b/i.test(raw)) {
    return Array.from(raw.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
      .map((m) => stripHtml(m[1]))
      .filter(Boolean)
  }
  // 兜底：按 <br> / 换行拆
  return stripHtml(raw.replace(/<br\s*\/?>/gi, '\n'))
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
})

const fallbackText = computed(() => {
  if (items.value.length) return ''
  return stripHtml(props.companyInfo || '')
})

// 尝试把每个 item 解析为 key: value
const URL_RE = /(https?:\/\/[^\s,]+)/i
const EMAIL_RE = /([\w.+-]+@[\w-]+\.[\w.-]+)/i

const structuredItems = computed(() => {
  const parsed = items.value
    .map((raw) => {
      // key: value
      const m = raw.match(/^([A-Za-z][\w\s/&+-]{0,40}?)\s*[:：-]\s*(.+)$/)
      if (m) {
        const key = m[1].trim()
        const value = m[2].trim()
        if (!key || !value) return null
        const urlM = value.match(URL_RE)
        const emailM = value.match(EMAIL_RE)
        return {
          key,
          value,
          href: urlM ? urlM[1] : emailM ? `mailto:${emailM[1]}` : '',
        }
      }
      return null
    })
    .filter(Boolean)

  // 只有当 ≥ 50% 的 item 能解析出 key:value 才走结构化布局，
  // 否则回退到普通 bullet list 避免看起来怪异
  if (items.value.length && parsed.length / items.value.length >= 0.5) {
    return parsed
  }
  return []
})

const iconForKey = (key) => {
  const k = String(key || '').toLowerCase()
  if (/founded|year|date|since|established|launch/.test(k)) return 'calendar'
  if (/location|headquarter|hq|address|country|based|city/.test(k)) return 'location'
  if (/employee|team|staff|size|people/.test(k)) return 'people'
  if (/website|url|link|site/.test(k)) return 'link'
  if (/mail|email|contact/.test(k)) return 'mail'
  if (/revenue|funding|valuation|investor|raised|price/.test(k)) return 'money'
  return 'default'
}
</script>
