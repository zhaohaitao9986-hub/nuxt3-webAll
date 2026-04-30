// 引入依赖
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

// 初始化
const prisma = new PrismaClient();
const TARGET_URL = 'https://www.toolify.ai/category';

// 生成 handle 规则：小写 + 空格/& 替换为 -
function generateHandle(text) {
  return text
    .toLowerCase()
    .replace(/ & /g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

async function crawlToolify() {
  console.log('🚀 启动浏览器爬取分类数据...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--start-maximized', // 窗口最大化，保证元素加载
      '--disable-blink-features=AutomationControlled' // 绕过反爬
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  // 设置请求头，模拟真实浏览器
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // 访问页面
  await page.goto(TARGET_URL, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('✅ 页面加载完成，等待分类元素出现...');

  // ==============================================
  // 关键修复：等待元素加载出来，再获取（解决 length=0）
  // ==============================================
  await page.waitForSelector('.category-item span', {
    timeout: 10000 // 最多等10秒
  }).catch(err => {
    console.log('⚠️ 等待元素超时，但继续尝试爬取');
  });

  // 获取一级分类名称
  const level1Names = await page.$$eval('.category-item span', els =>
    els.map(el => el.textContent.trim()).filter(Boolean)
  );

  console.log('✅ 成功获取一级分类数量：', level1Names?.length);
  console.log('一级分类列表：', level1Names);

  if(level1Names.length === 0) {
    throw new Error('❌ 未获取到任何一级分类，请检查页面结构');
  }

  // 匹配分组ID
  const level1List = level1Names.map(name => ({
    name,
    groupId: `group-${generateHandle(name)}`
  }));

  // 获取二级分类
  const result = [];
  for (const cat1 of level1List) {
    console.log(`正在爬取：${cat1.name}`);

    // 等二级分类容器出现
    await page.waitForSelector(`#${cat1.groupId}`, { timeout: 5000 }).catch(() => {});

    const level2Items = await page.$$eval(
      `#${cat1.groupId} > div:first-of-type a`,
      links => links.map(link => {
        const name = link.querySelector('span:first-child')?.textContent.trim() || '';
        const numText = link.querySelector('div:last-child')?.textContent.trim() || '0';
        const tool_count = parseInt(numText) || 0;
        return { name, tool_count };
      }).filter(item => item.name)
    );

    result.push({
      name: cat1.name,
      level2Categories: level2Items
    });
  }

  await browser.close();
  console.log('🎉 数据爬取完成！');
  return result;
}
// ======================================
// 数据库保存（核心修复版）
// ======================================
async function saveToDatabase(data) {
  console.log('\n🗄️ 开始保存一级分类 + 关联二级分类...');

  // ============== 1. 先保存所有一级分类 ==============
  console.log('\n📌 开始保存一级分类（ID从1开始）...');
  const savedLevel1Map = new Map(); // key: 分类名, value: 数据库ID

  for (const item of data) {
    const handle = generateHandle(item.name);
    
    const level1 = await prisma.categoryLevel1.upsert({
      where: { handle },
      update: { name: item.name },
      create: {
        name: item.name,
        handle,
        sort: 0,
        is_active: true
      }
    });

    savedLevel1Map.set(item.name, level1.id);
    console.log(`一级分类保存成功：${level1.id} - ${level1.name}`);
  }

  // ============== 2. 保存/更新二级分类 ==============
  console.log('\n🔗 开始更新二级分类的正确 level1Id...');

  for (const categoryData of data) {
    const parentId = savedLevel1Map.get(categoryData.name); // 正确的一级分类ID
    const level2List = categoryData.level2Categories;

    for (const cat2 of level2List) {
      const handle = generateHandle(cat2.name);

      try {
        // 存在 → 更新 level1Id + tool_count
        // 不存在 → 插入
        await prisma.categoryLevel2.upsert({
          where: { handle },
          update: {
            name: cat2.name,
            tool_count: cat2.tool_count,
            level1Id: parentId, // 关键：绑定正确的父ID
            is_active: true
          },
          create: {
            name: cat2.name,
            handle,
            tool_count: cat2.tool_count,
            level1Id: parentId,
            sort: 0,
            is_active: true
          }
        });

        console.log(`✅ 二级分类处理完成：${cat2.name} → 父ID：${parentId}`);
      } catch (err) {
        console.log(`❌ 处理失败：${cat2.name}`, err.message);
      }
    }
  }

  console.log('\n🎉 所有数据保存完成！一级、二级分类已正确关联！');
}

// ======================================
// 主函数
// ======================================
async function main() {
  try {
    const crawledData = await crawlToolify();
    await saveToDatabase(crawledData);
  } catch (error) {
    console.error('💥 程序异常：', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();