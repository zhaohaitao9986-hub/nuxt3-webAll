<template>
  <section
    v-if="pricing && pricing.length"
    class="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 dark:border-white/5 dark:bg-ink-800/60"
    aria-labelledby="pricing-heading"
  >
    <header class="flex items-center gap-3">
      <span class="inline-flex h-6 w-1 rounded-full bg-gradient-cta"></span>
      <h2 id="pricing-heading" class="text-lg font-semibold text-ink-900 dark:text-white">
        Pricing
      </h2>
    </header>

    <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="(plan, i) in parsedPlans"
        :key="i"
        :class="[
          'group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 ease-smooth',
          plan.highlighted
            ? 'border-primary/50 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 shadow-glow dark:border-primary/50'
            : 'border-ink-200 bg-gradient-to-br from-ink-50/60 to-white hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm dark:border-white/5 dark:from-white/[0.03] dark:to-white/[0.01] dark:hover:border-primary/30',
        ]"
      >
        <div
          v-if="plan.highlighted"
          aria-hidden="true"
          class="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-3xl"
          style="background: radial-gradient(circle, rgba(124,92,255,0.5), transparent 70%)"
        ></div>

        <div class="relative">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em]" :class="plan.highlighted ? 'text-accent' : 'text-ink-400'">
            {{ plan.tierLabel }}
          </p>

          <p class="mt-2 flex items-baseline gap-1">
            <span
              v-if="plan.price"
              :class="[
                'text-2xl font-semibold',
                plan.highlighted ? 'text-gradient' : 'text-ink-900 dark:text-white',
              ]"
            >
              {{ plan.price }}
            </span>
            <span v-if="plan.period" class="text-xs text-ink-400">/ {{ plan.period }}</span>
          </p>

          <p
            v-if="plan.rawText"
            class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300"
          >
            {{ plan.rawText }}
          </p>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  pricing: { type: Array, default: () => [] },
})

// 从 HTML 节点文本中抓取内容（SSR 安全，纯正则 —— 避免 XSS，全部走文本提取不下发 HTML）
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const parsePrice = (s) => {
  const text = String(s || '')
  const isHtml = /<\w+/.test(text)

  let tierLabel = ''
  let price = ''
  let period = ''
  let description = ''

  if (isHtml) {
    // 优先从 class 含 font-bold 的 div 中抓取 tier name
    const tierM =
      text.match(/<div[^>]*class="[^"]*font-bold[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
    if (tierM) tierLabel = stripHtml(tierM[1])

    // 价格优先从 <strong> 抓；兜底用纯文本里的第一个货币符号
    const strongM = text.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)
    if (strongM) {
      const raw = stripHtml(strongM[1])
      if (/\bfree\b/i.test(raw)) price = '$0'
      else if (/(\$|¥|€|£)\s?\d/.test(raw)) price = raw.replace(/\s/g, '')
      else if (/^\d/.test(raw)) price = raw.replace(/\s/g, '')
    }

    const plainAll = stripHtml(text)
    if (!price) {
      const m = plainAll.match(/(\$|¥|€|£)\s?\d[\d.,]*/)
      if (m) price = m[0].replace(/\s/g, '')
      else if (/\bfree\b/i.test(plainAll)) price = '$0'
    }
    const periodM = plainAll.match(/\/\s?(month|mo|year|yr|user|seat|credit)/i)
    if (periodM) period = periodM[1].toLowerCase()

    // description: 最后一个 div 通常是说明文字
    const descDivs = Array.from(text.matchAll(/<div[^>]*class="[^"]*(?:text-base|text-gray-700|text-sm)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi))
    if (descDivs.length) description = stripHtml(descDivs[descDivs.length - 1][1])
  } else {
    const firstLine = text.split(/\n/)[0].trim()
    const priceMatch = firstLine.match(/(\$|¥|€|£)\s?\d[\d.,]*/)
    const periodMatch = firstLine.match(/\/\s?(month|mo|year|yr|user|seat|credit)/i)
    const tierMatch = firstLine.match(/^([A-Za-z][A-Za-z0-9 +-]{1,30})(?=[:：\-—$])/)
    const freeMatch = /\bfree\b/i.test(firstLine)

    if (tierMatch) tierLabel = tierMatch[1].trim()
    price = priceMatch ? priceMatch[0].replace(/\s/g, '') : freeMatch ? '$0' : ''
    period = periodMatch ? periodMatch[1].toLowerCase() : ''
    description = text.split('\n').slice(1).join('\n').trim() || (tierLabel ? '' : text)
  }

  // tier label 兜底
  if (!tierLabel) {
    if (price === '$0') tierLabel = 'Free'
    else if (/enterprise|business/i.test(text)) tierLabel = 'Enterprise'
    else if (/pro\b|plus|premium/i.test(text)) tierLabel = 'Pro'
    else tierLabel = 'Plan'
  }

  // 限制过长描述
  if (description.length > 280) description = description.slice(0, 277) + '…'

  return { tierLabel, price, period, bodyHtml: '', rawText: description }
}

const parsedPlans = computed(() => {
  const plans = (props.pricing || [])
    .filter((p) => typeof p === 'string' && p.trim())
    .map(parsePrice)

  // 高亮中间档位（通常最推荐），如果只有 1 档高亮它，3 档高亮第 2 档
  if (plans.length === 3) plans[1].highlighted = true
  else if (plans.length === 2) plans[1].highlighted = true
  else if (plans.length === 1) plans[0].highlighted = true
  else if (plans.length >= 4) plans[1].highlighted = true

  return plans
})
</script>

