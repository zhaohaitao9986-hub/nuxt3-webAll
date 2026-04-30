const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 智能清洗 website 字段
 * 1. 填写 limit = 100 → 清洗前100条
 * 2. 留空 limit = '' / 不写 → 清洗全部数据
 * 3. Google Play 链接：只保留 id= 参数
 */
async function cleanWebsiteUrls() {
  console.log('🚀 开始清洗 ai_tools 表的 website 字段...\n');

  try {
    // ============== 【这里设置条数】 ==============
    const limit = ''; // 填写100=改100条，留空=改全部
    // ============================================

    // 1. 查询所有有 website 的数据
    const allTools = await prisma.aiTool.findMany({
      where: {
        website: {
          not: null,
          not: '',
        },
      },
      select: {
        id: true,
        website: true,
      },
    });

    console.log(`✅ 总数据量：${allTools.length} 条`);

    let targetList = allTools;
    if (limit && !isNaN(limit) && limit > 0) {
      targetList = allTools.slice(0, Number(limit));
      console.log(JSON.stringify(targetList),'🔢 实际将处理的条数');
      console.log(`🔢 已设置：仅处理前 ${limit} 条\n`);
    } else {
      console.log(`🔢 未设置条数：将处理全部数据\n`);
    }

    let updatedCount = 0;

    // 2. 循环处理
    for (const tool of targetList) {
      const originalUrl = tool.website.trim();
      let cleanUrl = originalUrl;

      try {
        // ==================== 核心清洗逻辑 ====================
        const urlObj = new URL(originalUrl);

        // 如果是 Google Play 链接，只保留 id 参数
        if (urlObj.hostname.includes('play.google.com')) {
          const idValue = urlObj.searchParams.get('id');
          // 清空所有参数
          urlObj.search = '';
          // 只加回 id
          if (idValue) {
            urlObj.searchParams.set('id', idValue);
          }
          cleanUrl = urlObj.toString();
        } 
        // 其他链接：直接去掉所有参数
        else {
          cleanUrl = originalUrl.split('?')[0];
        }
        // ======================================================

        // 没变化就跳过
        if (cleanUrl === originalUrl) continue;

        // 更新
        await prisma.aiTool.update({
          where: { id: tool.id },
          data: { website: cleanUrl },
        });

        console.log(`[ID: ${tool.id}] 清洗成功`);
        console.log('  原：', originalUrl);
        console.log('  新：', cleanUrl);
        console.log('----------------------------------');
        updatedCount++;

      } catch (e) {
        // 无效 URL 跳过，不中断
        continue;
      }
    }

    console.log('\n🎉 清洗完成！');
    console.log(`📊 实际更新：${updatedCount} 条`);

  } catch (err) {
    console.error('❌ 清洗出错：', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanWebsiteUrls();