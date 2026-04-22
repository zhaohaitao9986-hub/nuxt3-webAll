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

      // 1. 固定页面 (必须放在动态分类之前，防止被 /:parent 拦截)
      { pattern: '/ai-tools', view: 'aiToolsIndex' },
      { pattern: '/search', view: 'search' },
      { pattern: /^\/(privacy|terms|about)$/, view: 'protocol' },

      // 2. 工具详情页 (使用 /tools/ 前缀，语义化且独立)
      // 注意：这里用了之前商定的 "s"
      { pattern: /^\/tools\/([^/]+)$/, view: 'toolDetail' },

      // 3. 二级分类 (长尾词提款机)
      // 匹配格式: /video-ai/text-to-video
      { pattern: /^\/([^/]+)\/([^/]+)$/, view: 'subCategoryDetail' },

      // 4. 一级分类 (大类词承接)
      // 匹配格式: /video-ai
      // 注意：这个正则非常广，一定要放在最后！
      { pattern: /^\/([^/]+)$/, view: 'categoryDetail' }
    ]
  },
  'de.appswm.com': {
    domain: 'de.appswm.com',
    themeDir: 'de.appswm.com',
    apiBase: 'https://proxy-api-de.appswm.com/api',
    title: 'German Site',
    routes: [
      { pattern: '/', view: 'home' },

      // 1. 固定页面 (必须放在动态分类之前，防止被 /:parent 拦截)
      { pattern: '/ai-tools', view: 'aiToolsIndex' },
      { pattern: '/search', view: 'search' },
      { pattern: /^\/(privacy|terms|about)$/, view: 'protocol' },

      // 2. 工具详情页 (使用 /tools/ 前缀，语义化且独立)
      // 注意：这里用了之前商定的 "s"
      { pattern: /^\/tools\/([^/]+)$/, view: 'toolDetail' },

      // 3. 二级分类 (长尾词提款机)
      // 匹配格式: /video-ai/text-to-video
      { pattern: /^\/([^/]+)\/([^/]+)$/, view: 'subCategoryDetail' },

      // 4. 一级分类 (大类词承接)
      // 匹配格式: /video-ai
      // 注意：这个正则非常广，一定要放在最后！
      { pattern: /^\/([^/]+)$/, view: 'categoryDetail' }
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

      // 1. 固定页面 (必须放在动态分类之前，防止被 /:parent 拦截)
      { pattern: '/ai-tools', view: 'aiToolsIndex' },
      { pattern: '/search', view: 'search' },
      { pattern: /^\/(privacy|terms|about)$/, view: 'protocol' },

      // 2. 工具详情页 (使用 /tools/ 前缀，语义化且独立)
      // 注意：这里用了之前商定的 "s"
      { pattern: /^\/tools\/([^/]+)$/, view: 'toolDetail' },

      // 3. 二级分类 (长尾词提款机)
      // 匹配格式: /video-ai/text-to-video
      { pattern: /^\/([^/]+)\/([^/]+)$/, view: 'subCategoryDetail' },

      // 4. 一级分类 (大类词承接)
      // 匹配格式: /video-ai
      // 注意：这个正则非常广，一定要放在最后！
      { pattern: /^\/([^/]+)$/, view: 'categoryDetail' }
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

      // 1. 固定页面 (必须放在动态分类之前，防止被 /:parent 拦截)
      { pattern: '/ai-tools', view: 'aiToolsIndex' },
      { pattern: '/search', view: 'search' },
      { pattern: /^\/(privacy|terms|about)$/, view: 'protocol' },
      { pattern: '/collection', view: 'collectionIndex' },
      { pattern: /^\/collection\/([^/]+)$/, view: 'collectionDetail' },

      // 2. 工具详情页 (使用 /tools/ 前缀，语义化且独立)
      // 注意：这里用了之前商定的 "s"
      { pattern: /^\/tools\/([^/]+)$/, view: 'toolDetail' },

      // 3. 二级分类 (长尾词提款机)
      // 匹配格式: /video-ai/text-to-video
      { pattern: /^\/([^/]+)\/([^/]+)$/, view: 'categorySecond' },

      // 4. 一级分类 (大类词承接)
      // 匹配格式: /video-ai
      // 注意：这个正则非常广，一定要放在最后！
      { pattern: /^\/([^/]+)$/, view: 'categoryFirst' },
      
    ]
  }
};

export default sites;