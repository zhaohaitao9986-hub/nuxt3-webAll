<template>
  <div class="min-h-screen bg-[#f7f8fc] flex text-gray-800 font-sans">
    <aside class="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 fixed h-full z-10">
      <div class="p-4 font-bold text-xl flex items-center gap-2">
        <span class="w-8 h-8 bg-blue-600 rounded-lg"></span> AI 工具导航
      </div>
      <nav class="flex-1 px-4 py-6 space-y-2 text-sm text-gray-600">
        <a href="#" class="block px-3 py-2 rounded-md bg-blue-50 text-blue-600 font-medium">AI 聊天</a>
        <a href="#" class="block px-3 py-2 rounded-md hover:bg-gray-50">AI 绘画</a>
        <a href="#" class="block px-3 py-2 rounded-md hover:bg-gray-50">AI 视频</a>
      </nav>
    </aside>

    <main class="flex-1 lg:ml-64 flex flex-col w-full max-w-[1200px] mx-auto bg-white min-h-screen shadow-sm">
      <header class="h-14 border-b border-gray-100 flex items-center px-6 text-sm text-gray-500">
        <nav aria-label="Breadcrumb">
          <ol class="flex items-center space-x-2">
            <li><NuxtLink href="/" class="hover:text-blue-600">首页</NuxtLink></li>
            <li><span class="text-gray-400">/</span></li>
            <li><NuxtLink href="/category/chat" class="hover:text-blue-600">AI 对话</NuxtLink></li>
            <li><span class="text-gray-400">/</span></li>
            <li class="text-gray-800 font-medium" aria-current="page">{{ toolData.name }}</li>
          </ol>
        </nav>
      </header>

      <article class="p-6 md:p-8">
        
        <section class="flex flex-col md:flex-row gap-6 items-start mb-8">
          <img 
            :src="toolData.logo" 
            :alt="`${toolData.name} Logo`" 
            class="w-24 h-24 rounded-2xl shadow-sm border border-gray-100 object-cover"
          />
          <div class="flex-1">
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{{ toolData.name }}</h1>
            <p class="text-sm text-gray-500 mb-3">{{ toolData.shortDescription }}</p>
            <div class="flex items-center gap-4 text-sm mb-4">
              <div class="flex items-center text-yellow-400">
                <svg v-for="i in 5" :key="i" class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <span class="text-gray-600 ml-1 font-medium">{{ toolData.rating }} ({{ toolData.reviews }} 评价)</span>
              </div>
              <span class="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">免费增值</span>
            </div>
            <div class="flex gap-3">
              <a :href="toolData.websiteUrl" target="_blank" rel="nofollow noopener" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm shadow-blue-200">
                直达网站
              </a>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10" aria-label="Tool Actions">
          <button class="flex flex-col items-center justify-center py-3 bg-[#e8f5e9] text-green-700 rounded-lg hover:opacity-90 transition">
            <span class="font-medium text-sm">收藏</span>
          </button>
          <button class="flex flex-col items-center justify-center py-3 bg-[#e3f2fd] text-blue-700 rounded-lg hover:opacity-90 transition">
            <span class="font-medium text-sm">分享</span>
          </button>
          <button class="flex flex-col items-center justify-center py-3 bg-[#e0f2f1] text-teal-700 rounded-lg hover:opacity-90 transition">
            <span class="font-medium text-sm">提交评价</span>
          </button>
          <button class="flex flex-col items-center justify-center py-3 bg-[#fff3e0] text-orange-700 rounded-lg hover:opacity-90 transition">
            <span class="font-medium text-sm">纠错反馈</span>
          </button>
          <button class="flex flex-col items-center justify-center py-3 bg-[#f3e5f5] text-purple-700 rounded-lg hover:opacity-90 transition col-span-2 md:col-span-1">
            <span class="font-medium text-sm">认领工具</span>
          </button>
        </section>

        <section class="mb-12">
          <h2 class="text-xl font-bold text-gray-900 mb-4 border-b pb-2">工具介绍</h2>
          <div class="prose prose-blue max-w-none text-gray-600 leading-relaxed text-sm md:text-base">
            <p v-html="toolData.fullDescription"></p>
            
            <h3 class="text-lg font-semibold text-gray-800 mt-6 mb-3">核心功能截图</h3>
            <div class="space-y-4">
              <img 
                v-for="(img, idx) in toolData.screenshots" 
                :key="idx" 
                :src="img" 
                :alt="`${toolData.name} 功能截图 ${idx + 1}`"
                class="w-full rounded-lg border border-gray-100 shadow-sm loading-lazy"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section class="mb-12 bg-gray-50 p-6 rounded-xl border border-gray-100">
          <h2 class="text-lg font-bold text-gray-900 mb-4">技术与参数信息</h2>
          <ul class="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm text-gray-600">
            <li class="flex justify-between border-b border-gray-200 pb-2">
              <span class="text-gray-500">支持语言</span>
              <span class="font-medium text-gray-800">{{ toolData.languages.join(', ') }}</span>
            </li>
            <li class="flex justify-between border-b border-gray-200 pb-2">
              <span class="text-gray-500">平台支持</span>
              <span class="font-medium text-gray-800">{{ toolData.platforms.join(', ') }}</span>
            </li>
            <li class="flex justify-between border-b border-gray-200 pb-2">
              <span class="text-gray-500">定价模式</span>
              <span class="font-medium text-gray-800">{{ toolData.pricingModel }}</span>
            </li>
          </ul>
        </section>

        <section class="mb-12 rounded-xl overflow-hidden shadow-sm bg-gray-100 flex items-center justify-center h-24 w-full">
           <span class="text-gray-400 text-sm">Google AdSense / Banner 占位区</span>
        </section>

        <section id="comments">
          <h2 class="text-xl font-bold text-gray-900 mb-6">用户评价 ({{ comments.length }})</h2>
          
          <div class="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <textarea 
              rows="3" 
              class="w-full bg-white border border-gray-200 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="分享你对这个工具的使用体验..."
            ></textarea>
            <div class="flex justify-end mt-3">
              <button class="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition">发布评论</button>
            </div>
          </div>

          <div class="space-y-6">
            <div v-for="comment in comments" :key="comment.id" class="flex gap-4">
              <img :src="comment.avatar" :alt="comment.author" class="w-10 h-10 rounded-full bg-gray-200 object-cover" loading="lazy" />
              <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-sm text-gray-900">{{ comment.author }}</span>
                  <span class="text-xs text-gray-400">{{ comment.date }}</span>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed">{{ comment.content }}</p>
                <div class="flex gap-4 mt-2 text-xs text-gray-400">
                  <button class="hover:text-blue-600">回复</button>
                  <button class="hover:text-blue-600">有用 ({{ comment.likes }})</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </article>

      <footer class="mt-auto border-t border-gray-200 bg-gray-50 p-6 md:p-8 text-center text-sm text-gray-500">
        <p>© 2026 AI Tools Directory. All rights reserved.</p>
        <div class="mt-2 flex justify-center gap-4">
          <a href="#" class="hover:text-gray-800">关于我们</a>
          <a href="#" class="hover:text-gray-800">隐私政策</a>
          <a href="#" class="hover:text-gray-800">提交收录</a>
        </div>
      </footer>
    </main>
  </div>
</template>

<script setup>
// 1. 模拟数据 (实际应用中通过 useAsyncData / useFetch 获取)
const toolData = ref({
  name: '智能 AI 助手 Pro',
  shortDescription: '这是一款强大的生成式 AI 对话模型，支持多语言处理、代码生成与复杂逻辑推理。',
  fullDescription: '这里是详细描述... 包含了它如何提升生产力，支持哪些插件，以及具体的使用场景。<br/><br/>它采用最新的神经网络架构，能够理解上下文并给出极具深度的回答。非常适合程序员、写作者和研究人员使用。',
  logo: 'https://via.placeholder.com/150',
  screenshots: [
    'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=Screenshot+1',
    'https://via.placeholder.com/800x400/f3f4f6/9ca3af?text=Screenshot+2'
  ],
  rating: 4.8,
  reviews: 1256,
  websiteUrl: 'https://example.com',
  languages: ['中文', 'English', 'Deutsch'], // 注意到了你最近负责带德语界面的网站
  platforms: ['Web', 'Windows', 'macOS', 'iOS', 'Android'],
  pricingModel: 'Free / $20 per month'
})

const comments = ref([
  { id: 1, author: '前端老鸟', avatar: 'https://via.placeholder.com/40', date: '2小时前', content: '这个工具写 Nuxt 3 代码非常精准，特别是对 Composition API 的理解很深！', likes: 12 },
  { id: 2, author: '独立开发者', avatar: 'https://via.placeholder.com/40', date: '1天前', content: '部署在我的项目中效果很好，省去了很多查文档的时间。', likes: 5 }
])

// 2. 完美的 SEO 设置 (Nuxt 3 核心)
const route = useRoute()
const siteUrl = 'https://yourdomain.com'

useSeoMeta({
  title: () => `${toolData.value.name} - 最佳 AI 对话工具推荐及评测`,
  description: () => toolData.value.shortDescription,
  ogTitle: () => `${toolData.value.name} - AI 工具导航`,
  ogDescription: () => toolData.value.shortDescription,
  ogImage: () => toolData.value.logo,
  twitterCard: 'summary_large_image',
  // 避免内容重复惩罚
  canonical: `${siteUrl}${route.path}`
})

// 3. 注入 JSON-LD 结构化数据 (对 Google 极其重要)
useHead({
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": toolData.value.name,
        "operatingSystem": toolData.value.platforms.join(', '),
        "applicationCategory": "UtilitiesApplication",
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": toolData.value.rating,
          "ratingCount": toolData.value.reviews
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      })
    }
  ]
})
</script>

<style scoped>
/* 隐藏原生滚动条但保持可滚动，针对侧边栏等局部区域 */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>