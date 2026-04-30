<template>
   <div :data-domain="domain">
      <component :is="activeView" v-if="activeView" />
      <div class="mobile:grid-cols-1 mobile:gap-4"></div>
   </div>
</template>

<script setup>
import { defineAsyncComponent, shallowRef, watchEffect, ref } from 'vue';

const siteConfig = useState('siteConfig');
const route = useRoute();
const activeView = shallowRef(null);
const url = useRequestURL();
const domain = siteConfig?.value?.domain
// 扫描所有站点的 view 文件夹
const modules = import.meta.glob('~/themes/*/view/**/*.vue');

watchEffect(async () => {
   const theme = siteConfig.value.themeDir;
   const path = route.path;
   const rules = siteConfig.value.routes;

   // 1. 在配置中寻找匹配的路由规则
   const matchedRule = rules.find(rule => {
      if (rule.pattern instanceof RegExp) {
         return rule.pattern.test(path);
      }
      return rule.pattern === path;
   });

   if (matchedRule) {
      // 2. 拼接目标文件路径
      const targetPath = `/themes/${theme}/view/${matchedRule.view}.vue`;

      // 3. 从 glob 模块中查找
      const matchKey = Object.keys(modules).find(key => key.includes(targetPath));

      if (matchKey) {
         activeView.value = defineAsyncComponent(modules[matchKey]);

      } else {
         activeView.value = null;
         showError({
            statusCode: 404,
            statusMessage: "Seite nicht gefunden",
         });
      }
   } else {
      activeView.value = null;
      showError({
         statusCode: 404,
         statusMessage: "Seite nicht gefunden",
      });
   }
});


// 页面公共数据
// import { getHomeData } from '~/api/api'
// import { provide, computed, onMounted } from 'vue'
// 通过inject注入到全局
// const { data: homeData, error, loading, fetchData } = getHomeData()
// await fetchData()
// provide('homeData', homeData)

// const seo = homeData.value.site_config.config.seo.find(item => item.type === 'home') || {}
// useSeoMeta({
//   title: seo.title_template,
//   description: seo.description_template,
//   keywords: seo.keywords_template,
// })
// useHead({
//   htmlAttrs: {
//     lang: homeData.value?.site_config?.config?.meta_lang
//   },
//   link: [
//     {
//       rel: 'icon',
//       href: homeData.value?.site_config?.config?.site_icon?.url || ''
//     },
//     { rel: 'canonical', href: url.origin + url.pathname },
//   ],
// })
// 动态添加 head_codes 脚本 (Google Analytics, Google Adsense 等第三方脚本)
// head_codes 数组格式: [{ code: '...', status: true, ad_type: 'GA代码', position: 'head' }]
// const headCodes = computed(() => homeData.value.site_config?.config?.head_codes || [])

// 客户端动态注入脚本
// const adsInit = () => {
//   headCodes.value.forEach(item => {
//     if (!item.status || !item.code) return

//     // head 位置脚本注入
//     if (item.position === 'head') {
//       const div = document.createElement('div')
//       div.innerHTML = item.code
//       const scriptElements = div.querySelectorAll('script')
//       scriptElements.forEach(scriptElement => {
//         const newScriptElement = document.createElement('script')
//         Array.from(scriptElement.attributes).forEach(attr => {
//           newScriptElement.setAttribute(attr.name, attr.value)
//         })
//         newScriptElement.textContent = scriptElement.textContent
//         document.head.appendChild(newScriptElement)
//       })
//     }

//     // body 位置脚本注入
//     if (item.position === 'body') {
//       const adsHeaderHide = document.getElementById('ads-header-hide')
//       if (adsHeaderHide) {
//         const range = document.createRange()
//         range.selectNodeContents(adsHeaderHide)
//         range.collapse(false)
//         const fragment = range.createContextualFragment(item.code)
//         adsHeaderHide.appendChild(fragment)
//       }
//     }
//   })
// }

// onMounted(() => {
//   if (import.meta.client) {
//     adsInit()
//   }
// })
</script>