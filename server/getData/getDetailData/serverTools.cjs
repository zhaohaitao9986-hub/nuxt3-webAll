const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

// ==================== 配置 ====================
const CONCURRENCY = 2; // 多并发，2/3/5都可以
const PAGE_TIMEOUT = 90000;
const DELAY_AFTER_SCROLL = 300;
const START_FROM_HANDLE = 'deepseek';

// 全局统计
let successCount = 0;
let emptyAddTimeCount = 0;
let totalTasks = 0;

// ==================== 单个爬虫任务（独立浏览器+独立伪装）====================
async function scrapeAndUpdateTool(handle, workerId) {
    // ✅ 关键：每个任务独立浏览器，完全隔离，点击互不干扰
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(PAGE_TIMEOUT);
    await page.setDefaultTimeout(10000);

    // 独立请求拦截
    await page.setRequestInterception(true);
    page.on('request', req => {
        const type = req.resourceType();
        if (['image', 'font', 'media'].includes(type)) req.abort();
        else req.continue();
    });

    // 独立UA伪装
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    try {
        const url = `https://www.toolify.ai/tool/${handle}`;
        console.log(`[W${workerId}] 🌐 访问: ${handle}`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT }).catch(err => {
             console.log(`[W${workerId}] ⏳ ${handle} 页面加载超时`);
             throw new Error('PAGE_TIMEOUT');
         });
        await autoScroll(page);
        await new Promise(r => setTimeout(r, DELAY_AFTER_SCROLL));

        // 执行数据提取（保留完整点击FAQ逻辑）
        const scrapedData = await extractData(page);
        const safeData = { ...scrapedData, month_visited_count: scrapedData.month_visited_count ?? 0 };

        await prisma.aiTool.update({ where: { handle }, data: safeData });
        console.log(`[W${workerId}] ✅ 完成: ${handle} | FAQ数量: ${scrapedData.faq.length}`);

        return { success: true, handle, isAddTimeEmpty: !scrapedData.add_time };
    } catch (e) {
        console.log(`[W${workerId}] ❌ 失败: ${handle} | ${e.message}`);
        return { success: false, handle, isAddTimeEmpty: false };
    } finally {
        await page.close().catch(() => {});
        await browser.close().catch(() => {}); // 独立浏览器自己关闭
    }
}

// ==================== 访问量解析（原逻辑不变）====================
function parseVisitorsNumber(text) {
    if (!text) return 0;
    const clean = text.replace(/,/g, '').trim();
    let multiplier = 1, numStr = clean;
    if (clean.toUpperCase().includes('K')) multiplier = 1000, numStr = clean.replace(/K/gi, '');
    else if (clean.toUpperCase().includes('M')) multiplier = 1e6, numStr = clean.replace(/M/gi, '');
    else if (clean.toUpperCase().includes('B')) multiplier = 1e9, numStr = clean.replace(/B/gi, '');
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : Math.round(num * multiplier);
}

// ==================== 数据提取（保留完整FAQ点击逻辑，原逻辑几乎不动）====================
async function extractData(page) {
    const result = {
        add_time: '', website_type: [], social_email: [], faq: [], use_cases: [],
        company_info: '', tags: [], recommend_learn: [], for_jobs: [], month_visited_count: 0
    };

    const topSection = await page.$('.tool-detail-info.mt-2');
    if (topSection) {
        const allRows = await topSection.$$('.table-row.text-base.text-gray-1000');
        if (allRows.length >= 2) {
            const targetRow = allRows[1];
            const labelEl = await targetRow.$('.table-cell.py-1\\.5.pr-4.whitespace-nowrap.font-semibold');
            if (labelEl) {
                const labelText = await page.evaluate(el => el.textContent.trim(), labelEl);
                if (labelText === 'Added on:') {
                    const valueEl = await targetRow.$('.table-cell:not(.font-semibold)');
                    if (valueEl) result.add_time = await page.evaluate(el => el.textContent.trim(), valueEl);
                }
            }
        }

        const typeTags = await topSection.$$('div.text-sm.text-gray-1000.border.border-gray-1300.max-w-max.truncate.rounded-2xl.t-label');
        result.website_type = await Promise.all(typeTags.map(tag => page.evaluate(el => el.textContent.trim(), tag)));

        const socialRows = await topSection.$$('.table-row');
        for (const row of socialRows) {
            const labelCell = await row.$('.table-cell.py-1\\.5.pr-4.whitespace-nowrap.font-semibold.align-middle');
            if (labelCell) {
                const text = await page.evaluate(el => el.textContent.trim(), labelCell);
                if (text === 'Social & Email:') {
                    const links = await row.$$('a');
                    result.social_email = await Promise.all(links.map(a => page.evaluate(el => el.href, a)));
                    break;
                }
            }
        }

        if (allRows.length >= 3) {
            const targetRow = allRows[2];
            const labelEl = await targetRow.$('.table-cell.py-1\\.5.pr-4.whitespace-nowrap.font-semibold');
            if (labelEl) {
                const labelText = await page.evaluate(el => el.textContent.trim(), labelEl);
                if (labelText === 'Monthly Visitors:') {
                    const valueCell = await targetRow.$('.table-cell:not(.font-semibold)');
                    if (valueCell) {
                        const spanEl = await valueCell.$('span');
                        if (spanEl) {
                            const rawText = await page.evaluate(el => el.textContent.trim(), spanEl);
                            result.month_visited_count = parseVisitorsNumber(rawText);
                        }
                    }
                }
            }
        }
    }

    const productInfo = await page.$('#productInformation');
    if (productInfo) {
        const detailContainer = await productInfo.$('.tool-detail-information');
        if (detailContainer) {
            const sections = await detailContainer.$$(':scope > *');
            for (const section of sections) {
                const h2 = await section.$('h2');
                if (!h2) continue;
                const h2Text = await page.evaluate(el => el.textContent.trim(), h2);
                const contentDiv = await section.$('div');
                if (!contentDiv) continue;

                // ==================== 保留原点击FAQ逻辑，仅优化等待时间 ====================
                if (h2Text.includes('FAQ')) {
                    const dtList = await contentDiv.$$('dt');
                    for (const dt of dtList) {
                        try {
                            // 必须点击才能展开，原逻辑保留
                            await dt.click();
                            // 优化等待：最多等1000ms，保证面板展开
                            await dt.waitForSelector('+ div', { timeout: 1000 }).catch(() => {});
                            
                            const titleEl = await dt.$('h3');
                            const title = titleEl ? await page.evaluate(el => el.textContent.trim(), titleEl) : '';
                            const descHandle = await dt.evaluateHandle(el => el.nextElementSibling);
                            const descEl = await descHandle.asElement();

                            if (descEl) {
                                const targetDescEl = await descEl.$('.mt-2.text-base.text-gray-1000');
                                const desc = targetDescEl
                                    ? await page.evaluate(el => el.textContent.trim(), targetDescEl)
                                    : await page.evaluate(el => el.textContent.trim(), descEl);
                                if (title) result.faq.push({ title, desc });
                            }
                        } catch (e) {
                            // 单个FAQ失败不影响整体
                            continue;
                        }
                    }
                } else if (h2Text.includes('Use Cases')) {
                    const h3List = await contentDiv.$$('h3');
                    result.use_cases = await Promise.all(h3List.map(h3 => page.evaluate(el => el.textContent.trim(), h3)));
                }

                const sectionHtml = await page.evaluate(el => el.innerHTML, section);
                if (sectionHtml.includes('contact ') || sectionHtml.includes('Login ')) {
                    const ulElement = await section.$('ul');
                    if (ulElement) result.company_info = await page.evaluate(el => el.innerHTML, ulElement);
                }
            }
        }
    }

    const bottomSections = await page.$$('.content-visibility-auto');
    for (const section of bottomSections) {
        const headerSpan = await section.$('h2 span');
        if (!headerSpan) continue;
        const headerText = await page.evaluate(el => el.textContent.trim(), headerSpan);
        const contentDiv = await section.$('div');
        if (!contentDiv) continue;

        if (headerText.includes('Tags')) {
            const tagSpans = await contentDiv.$$('a span');
            result.tags = await Promise.all(tagSpans.map(span => page.evaluate(el => el.textContent.trim(), span)));
        } else if (headerText.includes('Recommend')) {
            const links = await contentDiv.$$('a');
            result.recommend_learn = await Promise.all(links.map(a => page.evaluate(el => el.textContent.trim(), a)));
        } else if (headerText.includes('Jobs')) {
            const jobSpans = await contentDiv.$$('a span:first-child');
            result.for_jobs = await Promise.all(jobSpans.map(span => page.evaluate(el => el.textContent.trim(), span)));
        }
    }
    return result;
}

// ==================== 滚动逻辑（原逻辑不变）====================
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise(resolve => {
            let totalHeight = 0, distance = 100;
            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
                    clearInterval(timer); resolve();
                }
            }, 50);
        });
    });
}

// ==================== 多并发任务调度 ====================
async function batchScrapeAll() {
    console.log(`🚀 启动多并发爬取 | 并发数: ${CONCURRENCY} | 独立浏览器隔离`);

    let allTools = await prisma.aiTool.findMany({
        select: { id: true, handle: true },
        orderBy: { id: 'asc' }
    });

    // 从指定handle开始
    if (START_FROM_HANDLE) {
        const idx = allTools.findIndex(t => t.handle === START_FROM_HANDLE);
        if (idx > -1) {
            successCount = idx;
            allTools = allTools.slice(idx);
        }
    }

    totalTasks = allTools.length + successCount;
    console.log(`📦 待处理: ${allTools.length} 条 | 总进度起点: ${successCount}`);
    const taskQueue = [...allTools];

    // 独立Worker函数
    async function worker(workerId) {
        console.log(`[W${workerId}] 独立Worker启动`);
        while (taskQueue.length > 0) {
            const tool = taskQueue.shift();
            if (!tool) break;

            const res = await scrapeAndUpdateTool(tool.handle, workerId);
            if (res.success) {
                successCount++;
                if (res.isAddTimeEmpty) emptyAddTimeCount++;
            }

            console.log(`📊 进度: ${successCount}/${totalTasks} | 空add_time: ${emptyAddTimeCount}`);
            // 轻微间隔，防封IP
            await new Promise(r => setTimeout(r, 500));
        }
        console.log(`[W${workerId}] Worker任务完成`);
    }

    // 启动多并发
    const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
    await Promise.all(workers);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 全部完成 | 成功:${successCount} | 空add_time:${emptyAddTimeCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');

    await prisma.$disconnect();
}

batchScrapeAll();