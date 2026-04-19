<template>
  <footer class="relative mt-16 border-t border-ink-200 bg-white/60 dark:border-white/5 dark:bg-ink-950/60">
    <!-- Top accent line -->
    <div
      aria-hidden="true"
      class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
    ></div>

    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
      <!-- Left: brand + copyright -->
      <div class="flex items-start gap-3">
        <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-cta">
          <svg viewBox="0 0 24 24" class="h-4 w-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 12l4-8 4 14 4-10 4 6"/>
          </svg>
        </span>
        <div>
          <p class="text-sm font-semibold text-ink-900 dark:text-white">aiseekertools.com</p>
          <p class="mt-0.5 max-w-md text-xs text-ink-500 dark:text-ink-400">
            A curated directory helping 120K+ builders discover the best AI tools every day.
          </p>
          <p class="mt-2 text-[11px] text-ink-400 dark:text-ink-500">
            © 2026 aiseekertools.com · All rights reserved.
          </p>
        </div>
      </div>

      <!-- Right: compliance links -->
      <nav aria-label="Legal" class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <NuxtLink
          v-for="link in legalLinks"
          :key="link.href"
          :to="link.href"
          class="text-ink-500 transition hover:text-primary-600 dark:text-ink-400 dark:hover:text-white"
        >
          {{ link.label }}
        </NuxtLink>

        <a
          href="mailto:hello@aiseekertools.com"
          class="text-ink-500 transition hover:text-primary-600 dark:text-ink-400 dark:hover:text-white"
        >
          Contact
        </a>
      </nav>
    </div>

    <!-- SEO keyword-stuffing block (visually de-emphasized but crawlable) -->
    <div class="border-t border-ink-200 dark:border-white/5">
      <div class="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <p class="seo-stuff">
          AI Tools Directory · Best AI Tools 2026 · Free AI Tools · AI Tool Finder · Generative AI Directory ·
          AI Image Generator · AI Video Generator · AI Writing Assistant · AI Code Assistant · AI SEO Tools ·
          AI Chatbots · AI for Marketers · AI for Designers · AI for Developers · AI Productivity Tools ·
          Compare AI Products · Curated AI Apps · ChatGPT Alternatives · Midjourney Alternatives · Discover AI Tools.
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup>
const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Disclaimer', href: '/disclaimer' },
  { label: 'About', href: '/about' },
]
</script>
