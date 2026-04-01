// app/plugins/lazy.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        const img = entry.target as HTMLImageElement
        const src = img.dataset.src
        if (!src) return

        // 预加载
        const temp = new Image()
        temp.onload = () => {
          img.src = src
          img.removeAttribute('data-src')
        }
        temp.src = src

        observer.unobserve(img)
      })
    },
    {
      root: null,
      rootMargin: '0px 0px 100% 0px', // 预加载下一屏
      threshold: 0,
    }
  )

  nuxtApp.vueApp.directive('lazy', {
    mounted(el: HTMLImageElement) {
      if (!el.dataset.src) return
      observer.observe(el)
    },
    unmounted(el: HTMLImageElement) {
      observer.unobserve(el)
    },
  })
})
