const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();
// ==================== 配置 ====================
const CONCURRENCY = 5;          // 稳定5并发
const PAGE_TIMEOUT = 30000;
const DELAY_AFTER_SCROLL = 300; // 滚动等待压缩到300ms
const START_FROM_HANDLE = 'video-to-tweet';    // 从指定handle开始

// ==================== 爬虫函数 ====================
async function scrapeAndUpdateTool(handle, browser, workerId) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req => 
        ['image','font','media'].includes(req.resourceType()) ? req.abort() : req.continue()
    );
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));

    try {
        const url = `https://www.toolify.ai/tool/${handle}`;
        console.log(`[W${workerId}] 🌐 ${handle}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
        await autoScroll(page);
        await new Promise(r => setTimeout(r, DELAY_AFTER_SCROLL));

        const scrapedData = await extractData(page);
        const safeData = { ...scrapedData, month_visited_count: scrapedData.month_visited_count ?? 0 };
        await prisma.aiTool.update({ where: { handle }, data: safeData });

        console.log(`[W${workerId}] ✅ ${handle}`);
        return { success: true, handle, isAddTimeEmpty: !scrapedData.add_time };
    } catch (e) {
        console.log(`[W${workerId}] ❌ ${handle} | ${e.message}`);
        return { success: false, handle, isAddTimeEmpty: false };
    } finally {
        await page.close();
    }
}

// ==================== 你的原生抓取逻辑（仅优化FAQ等待，其余不动）====================
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

                // ==================== 核心优化：FAQ 不再死等2秒！====================
                if (h2Text.includes('FAQ')) {
                    const dtList = await contentDiv.$$('dt');
                    for (const dt of dtList) {
                        try {
                            await dt.click();
                            // 🔥 智能等待：内容出现就立刻走，最多等300ms
                            await dt.waitForSelector('+ div', { timeout: 300 }).catch(() => {});
                            
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
                        } catch (e) { console.log('跳过FAQ'); }
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
            }, 50); // 滚动加速
        });
    });
}

// ==================== 修复版 5并发调度器（绝对公平，无饥饿）====================
async function batchScrapeAll() {
    console.log(`🚀 启动极速爬取 | 并发数: ${CONCURRENCY}`);
    let successCount = 0, emptyAddTimeCount = 0;
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        let allTools = await prisma.aiTool.findMany({ select: { id: true, handle: true }, orderBy: { id: 'asc' } });
        if (START_FROM_HANDLE) {
            const idx = allTools.findIndex(t => t.handle === START_FROM_HANDLE);
            successCount = idx
            if (idx > -1) allTools = allTools.slice(idx);
        }
        const total = allTools.length;
        console.log(`📦 待处理: ${total} 条`);

        const tasks = allTools.map(tool => (wid) => scrapeAndUpdateTool(tool.handle, browser, wid));
        
        // 🔥 核心修复：每个任务后让出1ms，强制5个Worker公平抢任务
        async function worker(wid) {
            console.log(`[W${wid}] 启动成功，准备执行任务`);
            while (tasks.length) {
                const task = tasks.shift();
                if (!task) break;
                const res = await task(wid);
                if (res.success) {
                    successCount++;
                    if (res.isAddTimeEmpty) emptyAddTimeCount++;
                    console.log(`📊 进度: ${successCount}/${total} | 空add_time: ${emptyAddTimeCount}`);
                }
                // 关键：强制让出事件循环，让其他Worker有机会执行
                await new Promise(resolve => setTimeout(resolve, 1));
            }
            console.log(`[W${wid}] 任务完成，退出`);
        }

        await Promise.all(Array.from({ length: CONCURRENCY }, (_,i) => worker(i+1)));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🎉 全部完成 | 成功:${successCount} | 空时间:${emptyAddTimeCount}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (e) {
        console.error('批量错误:', e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }
}

batchScrapeAll();