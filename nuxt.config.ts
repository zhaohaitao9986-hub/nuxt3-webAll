// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [
 ],
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@element-plus/nuxt'],

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || '',
    aiApiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    aiBaseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com/v1',
    aiModel: process.env.AI_MODEL || 'deepseek-chat',
    aiTimeoutMs: process.env.AI_TIMEOUT_MS || '300000',
  },

  routeRules: {
    '/admin/**': { ssr: false },
  },
  components: [
  ],
})
