// plugins/site-resolver.ts
import sitesConfig from '../config/sites.config';

export default defineNuxtPlugin(() => {
  const url = useRequestURL();
  let host = url.host.split(':')[0] || 'localhost'; // 移除端口号

  // 匹配配置，匹配不到则回退到 default
  const config = sitesConfig[host] || sitesConfig['default'];

  // 使用 useState 确保在 SSR 和客户端之间同步状态
  const siteConfig = useState('siteConfig', () => config);

  return {
    provide: {
      siteConfig: siteConfig.value
    }
  };
});