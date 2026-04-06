const express = require('express');
const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const {data} = require('./data.js')
const app = express();
const prisma = new PrismaClient();
app.use(express.json());
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// 修复滚动：固定次数，不卡死
async function autoScroll(page) {
  try {
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(300);
    }
  } catch (e) {}
}

// 去重
function uniqueData(arr) {
  const seen = new Set();
  return arr.filter(item => {
    if (!item.handle) return false;
    if (seen.has(item.handle)) return false;
    seen.add(item.handle);
    return true;
  });
}

// 爬虫主逻辑
async function startScrape() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('打开页面...');
  await page.goto('https://www.toolify.ai/most-used', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await delay(3000);

  let allData = data;
  let currentIndex = 0;
  // 默认一级分类
  const defaultL1 = await prisma.categoryLevel1.upsert({
    where: { handle: 'default-all-tools' },
    create: { name: 'All AI Tools', handle: 'default-all-tools' },
    update: {},
  });


  // 监听接口
  page.on('response', (res) => {
    if (res.url().includes('/list-search-v1')) {
      res.json().then(json => {
        const list = json.data?.data || [];
        if (list.length) {
          console.log('✅ 获取数据:', list.length, ' 序号:', currentIndex++);
          allData.push(...list);
        }
      }).catch(() => {});
    }
  });

  // 滚动 8 次
  console.log('开始滚动抓取...');
  for (let i = 0; i < 8; i++) {
    await autoScroll(page);
    console.log('已滚动次数:', i + 1);
    await delay(2000);
  }

  console.log('==================================');
  console.log('✅ 滚动结束！等待最后数据...');
  console.log('==================================');

  await delay(8000);

  // 强制关闭监听
  page.removeAllListeners('response');
  await page.close();

  // 去重
  const finalData = uniqueData(allData);
  console.log('==================================');
  console.log('抓取完成！总数据：', allData.length);
  console.log('去重后：', finalData.length);
  console.log('==================================');




  

  // ==========================
  // 🔥 循环入库 + 分类关联
  // ==========================
  for (const item of finalData) {
    try {
      // 1. 保存 AI 工具
      const aiTool = await prisma.aiTool.upsert({
        where: { handle: item.handle },
        update: {
          website: item.website,
          collected_count: item.collected_count || 0,
          description: item.description,
          image: item.image,
          month_visited_count: BigInt(item.month_visited_count || 0),
          name: item.name,
          what_is_summary: item.what_is_summary,
          is_ad: item.is_ad || false,
          website_name: item.website_name,
          is_free: item.is_free || false,
          website_logo: item.website_logo,
        },
        create: {
          website: item.website,
          collected_count: item.collected_count || 0,
          description: item.description,
          handle: item.handle,
          image: item.image,
          month_visited_count: BigInt(item.month_visited_count || 0),
          name: item.name,
          what_is_summary: item.what_is_summary,
          is_ad: item.is_ad || false,
          website_name: item.website_name,
          is_free: item.is_free || false,
          website_logo: item.website_logo,
        },
      });

      // ==============================================
      // ✅ ✅ ✅ 这里已补全：分类保存 + 中间表关联
      // ==============================================
      if (item.categories && Array.isArray(item.categories)) {
        for (const cat of item.categories) {
          if (!cat?.handle) continue;

          // 创建/更新二级分类
          const l2Category = await prisma.categoryLevel2.upsert({
            where: { handle: cat.handle },
            update: {
              name: cat.name,
              tool_count: cat.tool_count || 0,
            },
            create: {
              name: cat.name || '未命名分类',
              handle: cat.handle,
              tool_count: cat.tool_count || 0,
              level1Id: defaultL1.id,
            },
          });

          // 工具 <-> 二级分类 关联
          await prisma.aiToolCategory.upsert({
            where: {
              aiToolId_categoryId: {
                aiToolId: aiTool.id,
                categoryId: l2Category.id,
              },
            },
            update: {},
            create: {
              aiToolId: aiTool.id,
              categoryId: l2Category.id,
            },
          });
        }
      }
    } catch (err) {
      // 错误不中断
      // console.error('单条数据失败', err)
    }
  }

  console.log('✅ ✅ ✅ 全部保存成功！工具 + 分类 + 关联都已入库！');
  await browser.close();
}



app.get('/start', (req, res) => {
  res.json({ msg: '✅ 爬取已启动' });
  startScrape();
});

app.listen(3000, () => {
  console.log('✅ 服务运行：http://localhost:3000/start');
});