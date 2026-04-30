const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

// ================= [ 配置区 ] =================
// 填写具体 handle 则只爬这一个，留空 '' 则按顺序爬取所有分类
const TARGET_HANDLE = ''; // 例如: 'ai-chat-generator'
// ===============================================

// 随机延迟函数：模拟人类操作
const randomDelay = (min = 1500, max = 3500) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
};

// 主爬取函数
async function crawlCategoryDetail(categoryHandle) {
    console.log(`🚀 开始爬取分类: ${categoryHandle}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await browser.newPage();
    
    // 拦截不必要的资源 (注意：不拦截 image 也能拿到 src，拦截是为了更快)
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
        } else {
            request.continue();
        }
    });

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 获取分类基础信息
    const category = await prisma.categoryLevel2.findUnique({
        where: { handle: categoryHandle },
        select: { id: true, handle: true, tool_count: true, name: true }
    });

    if (!category) {
        console.error(`❌ 数据库中未找到 handle 为 ${categoryHandle} 的分类`);
        await browser.close();
        return;
    }

    const totalTools = category?.tool_count || 0;
    const maxPages = Math.ceil(totalTools / 20); 
    console.log(`📊 该分类共有约 ${totalTools} 个工具，预计需爬取 ${maxPages} 页`);

    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        await randomDelay(2000, 4000);
        const url = currentPage === 1
            ? `https://www.toolify.ai/category/${categoryHandle}`
            : `https://www.toolify.ai/category/${categoryHandle}?page=${currentPage}`;

        console.log(`📄 正在访问: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForSelector('.category-container', { timeout: 15000 });
            await autoScroll(page);
            await randomDelay(1000, 2000);

            const toolsData = await extractToolsFromPage(page);
            
            // 🔥 只有拿到数据才更新
            if (toolsData.length > 0) {
                await updateToolsImage(toolsData);
            }

            console.log(`✅ 第 ${currentPage} 页处理完成，获取 ${toolsData.length} 个工具`);

            currentPage++;
            if (currentPage > maxPages) {
                hasNextPage = false;
                console.log(`✅ 已达到估算页数，停止爬取`);
            }
            if (currentPage > 1000) hasNextPage = false;

        } catch (error) {
            console.error(`❌ 第 ${currentPage} 页爬取出错:`, error.message);
            hasNextPage = false;
        }
    }

    await browser.close();
    console.log("🎉 分类爬取完成");
}

// 滚动函数
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const scrollDistance = () => Math.floor(Math.random() * 200) + 300;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                const distance = scrollDistance();
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight - 200) {
                    clearInterval(timer);
                    resolve();
                }
            }, 150);
        });
    });
}

// 核心：仅提取 Image 和 Handle
async function extractToolsFromPage(page) {
    return page.evaluate(() => {
        const tools = [];
        const container = document.querySelector('.category-container');
        if (!container) return [];
        const mainCol = container.querySelector('.xl\\:col-span-4');
        if (!mainCol) return [];
        const toolsContainer = mainCol.querySelector('.tools');
        if (!toolsContainer) return [];
        const cards = toolsContainer.querySelectorAll('.mb-12');

        cards.forEach((card) => {
            try {
                const $ = (selector, root = card) => root.querySelector(selector);
                
                const toolItem = $('.tool-item', card);
                if (!toolItem) return;
                const toolCard = $('.tool-card', toolItem);
                if (!toolCard) return;
                const cardTextContent = $('.card-text-content', toolCard);
                if (!cardTextContent) return;

                // 获取 Image
                const imgEl = $('a img', toolCard);
                const image = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';

                // 获取 Handle
                const handleEl = $('a', cardTextContent);
                let localHandle = '';
                if (handleEl) {
                    const rawHref = handleEl.href || '';
                    const parts = rawHref.split('/').filter(Boolean);
                    localHandle = parts[parts.length - 1] || '';
                }

                if (localHandle && image) {
                    tools.push({ handle: localHandle, image });
                }
            } catch (err) {
                // 忽略单个错误
            }
        });
        return tools;
    });
}

// 核心：仅更新数据库的 image 和 website_logo 字段
async function updateToolsImage(tools) {
    console.log(`💾 正在更新 ${tools.length} 个工具的图片...`);

    for (const tool of tools) {
        if (!tool.handle || !tool.image) continue;

        try {
            // 使用 upsert 逻辑，或者直接 update (因为我们假设 handle 已存在)
            // 这里直接 update 更快，如果报错则忽略
            await prisma.aiTool.update({
                where: { handle: tool.handle },
                data: { 
                    image: tool.image, 
                    website_logo: tool.image 
                }
            });
        } catch (e) {
            // 如果不存在，或者更新失败，静默处理
            // console.error(`⏭️ 跳过 ${tool.handle}`);
        }
    }
}

// --- 启动：核心逻辑在这里 ---
async function main() {
    console.log("🚀 开始图片更新任务...");

    // ==========================================
    // 逻辑 1：如果指定了 TARGET_HANDLE，只爬这一个
    // ==========================================
    if (TARGET_HANDLE) {
        const targetCat = await prisma.categoryLevel2.findUnique({ 
            where: { handle: TARGET_HANDLE } 
        });
        
        if (!targetCat) {
            return console.error(`❌ 未找到指定的 handle: ${TARGET_HANDLE}`);
        }
        
        console.log(`🎯 【单分类模式】正在处理: [${targetCat.name}]`);
        try {
            await crawlCategoryDetail(targetCat.handle);
            console.log(`✅ 单分类任务完成！`);
        } catch (error) {
            console.error(`❌ 失败:`, error.message);
        }
        return;
    }

    // ==========================================
    // 逻辑 2：如果没有指定 TARGET_HANDLE，按顺序爬取所有
    // ==========================================
    console.log(`🎯 【全量模式】准备按 ID 顺序爬取所有分类...`);

    // 🔥 这里确保了按数据库 ID 正序排列
    const allCategories = await prisma.categoryLevel2.findMany({
        select: { id: true, handle: true, name: true },
        orderBy: { id: 'asc' }
    });

    console.log(`📋 共读取到 ${allCategories.length} 个分类`);

    // 支持断点续传：如果不想从头开始，可以在这里设置 startId
    const startId = 0; 
    let startIndex = allCategories.findIndex(c => c.id >= startId);
    if (startIndex === -1) startIndex = 0;

    // 循环处理
    for (let i = startIndex; i < allCategories.length; i++) {
        const category = allCategories[i];

        console.log(`\n=====================================`);
        console.log(`🔛 [进度 ${i + 1}/${allCategories.length}] ID:${category.id} - ${category.name}`);

        try {
            await crawlCategoryDetail(category.handle);
        } catch (error) {
            console.error(`❌ 分类 [${category.name}] 严重错误:`, error.message);
        }

        // 分类间的延迟，防止被封
        if (i < allCategories.length - 1) {
            console.log(`⏳ 等待 10 秒后进入下一个分类...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    console.log("\n🎉 所有任务全部结束！");
}

main()
    .catch((e) => { console.error("🔥 致命错误:", e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });