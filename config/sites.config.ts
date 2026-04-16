// config/sites.config.ts
export interface RouteRule {
  pattern: string | RegExp; // 支持字符串或正则表达式
  view: string;            // 对应 themes/xxx/view/ 下的文件名
}

export interface SiteConfig {
  domain: string;
  themeDir: string;
  apiBase: string;
  title: string;
  routes: RouteRule[]; // 改为数组形式以支持正则匹配优先级
}

const sites: Record<string, SiteConfig> = {
  'de.test.com': {
    domain: 'de.appswm.com',
    themeDir: 'de.appswm.com',
    apiBase: '/api',
    title: 'German Site',
    routes: [
      { pattern: '/', view: 'home' },
      { pattern: '/search', view: 'search' },
      { pattern: /^\/app-([^/]+)$/, view: 'appDetail' },
      { pattern: '/about', view: 'about' },
      { pattern: /^\/(apps|games)$/, view: 'categoryFirst' },
      { pattern: /^\/(apps|games)\/([^/]+)$/, view: 'categorySecond' },
      { pattern: /^\/app-([^/]+)\/download$/, view: 'appDownload' },
      {
        pattern: /^\/(disclaimer|about-us|cookies-privacy-policy|terms-of-service)$/, view: 'protocol'
      }
    ]
  },
  'de.appswm.com': {
    domain: 'de.appswm.com',
    themeDir: 'de.appswm.com',
    apiBase: 'https://proxy-api-de.appswm.com/api',
    title: 'German Site',
    routes: [
      { pattern: '/', view: 'home' },
      { pattern: '/search', view: 'search' },
      { pattern: /^\/app-([^/]+)$/, view: 'appDetail' },
      { pattern: '/about', view: 'about' },
      { pattern: /^\/(apps|games)$/, view: 'categoryFirst' },
      { pattern: /^\/(apps|games)\/([^/]+)$/, view: 'categorySecond' },
      { pattern: /^\/app-([^/]+)\/download$/, view: 'appDownload' },
      {
        pattern: /^\/(disclaimer|about-us|cookies-privacy-policy|terms-of-service)$/, view: 'protocol'
      }
    ]
  },
  // 测试域名配置，测试环境使用
  'test.appswm.com': {
    domain: 'test.appswm.com',
    themeDir: 'de.appswm.com',
    apiBase: 'https://proxy-api-de.appswm.com/api',
    title: 'German Site',
    routes: [
      { pattern: '/', view: 'home' },
      { pattern: '/search', view: 'search' },
      { pattern: /^\/app-([^/]+)$/, view: 'appDetail' },
      { pattern: '/about', view: 'about' },
      { pattern: /^\/(apps|games)$/, view: 'categoryFirst' },
      { pattern: /^\/(apps|games)\/([^/]+)$/, view: 'categorySecond' },
      { pattern: /^\/app-([^/]+)\/download$/, view: 'appDownload' },
      {
        pattern: /^\/(disclaimer|about-us|cookies-privacy-policy|terms-of-service)$/, view: 'protocol'
      }
    ]
  },
  // 本地开发默认配置，域名为 localhost
  'default': {
    domain: 'localhost',
    themeDir: 'de.test.com',
    apiBase: '/api',
    title: 'Dev Site',
    routes: [
      { pattern: '/', view: 'home' },
      
      // 一级分类集合页 (所有分类的入口)
      { pattern: '/category', view: 'categoryIndex' },
      
      // 二级分类落地页 (例如: /category/ai-blog-generator)
      // 注意：这种设计下，一级和二级都匹配这个正则，你需要在 view 层根据 slug 类型判断渲染
      { pattern: /^\/category\/([^/]+)$/, view: 'categoryDetail' },
      
      // 工具详情页
      { pattern: /^\/tool\/([^/]+)$/, view: 'toolDetail' },
      
      // 搜索与协议
      { pattern: '/search', view: 'search' },
      { pattern: /^\/(privacy|terms|about)$/, view: 'protocol' }
    ]
  }
};

export default sites;