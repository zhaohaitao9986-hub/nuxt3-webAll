export default defineNuxtPlugin(() => {
  useUserStore().hydrateFromStorage()
})
