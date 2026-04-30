// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [
 ],
  modules: ['@nuxtjs/tailwindcss', '@element-plus/nuxt'],

  routeRules: {
    '/admin/**': { ssr: false },
  },
  components: [
  ],
})