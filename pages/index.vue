<template>
   <div :data-domain="domain">
      <component :is="activeView" v-if="activeView" />
      <div class="mobile:grid-cols-1 mobile:gap-4"></div>
   </div>
</template>

<script setup>
import { defineAsyncComponent, shallowRef, watchEffect } from 'vue';

const siteConfig = useState('siteConfig');
const route = useRoute();
const activeView = shallowRef(null);
const domain = siteConfig?.value?.domain
const modules = import.meta.glob('~/themes/*/view/**/*.vue');

watchEffect(async () => {
   const theme = siteConfig.value.themeDir;
   const path = route.path;
   const rules = siteConfig.value.routes;

   const matchedRule = rules.find(rule => {
      if (rule.pattern instanceof RegExp) {
         return rule.pattern.test(path);
      }
      return rule.pattern === path;
   });

   if (matchedRule) {
      const targetPath = `/themes/${theme}/view/${matchedRule.view}.vue`;
      const matchKey = Object.keys(modules).find(key => key.includes(targetPath));

      if (matchKey) {
         activeView.value = defineAsyncComponent(modules[matchKey]);
      } else {
         activeView.value = null;
         showError({
            statusCode: 404,
            statusMessage: 'Seite nicht gefunden',
         });
      }
   } else {
      activeView.value = null;
      showError({
         statusCode: 404,
         statusMessage: 'Seite nicht gefunden',
      });
   }
});
</script>
