const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

// ==================== 配置 ====================
const CONCURRENCY = 5;
const PAGE_TIMEOUT = 30000;
const DELAY_AFTER_SCROLL = 800;

// 🔥 新增配置：在这里设置你想从哪个 handle 开始
// 如果填 null 或 ''，则从第一条开始
const START_FROM_HANDLE = 'clusterly-ai'; // 例如: 'writesonic'

// ==================== 爬虫函数（完全保留你的逻辑，只增加返回值）====================
async function scrapeAndUpdateTool(handle, browser) {
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        ['image', 'font', 'media'].includes(req.resourceType()) ? req.abort() : req.continue();
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36');

    try {
        const url = `https://www.toolify.ai/tool/${handle}`;
        console.log(`🌐 访问: ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
        await autoScroll(page);
        await new Promise(r => setTimeout(r, DELAY_AFTER_SCROLL));

        // 🔥 完全保留你原生抓取逻辑
        const scrapedData = await extractData(page);

        // 🔥 数据清洗（防止 null 报错）
        const safeData = {
            ...scrapedData,
            month_visited_count: scrapedData.month_visited_count ?? 0
        };

        await prisma.aiTool.update({
            where: { handle },
            data: safeData
        });

        console.log(`✅ 成功: ${handle}`);
        
        // 🔥 新增返回：是否成功 + add_time 是否为空
        return { 
            success: true, 
            handle,
            isAddTimeEmpty: !scrapedData.add_time || scrapedData.add_time === ''
        };
    } catch (e) {
        console.log(`❌ 失败: ${handle} | ${e.message}`);
        return { success: false, handle, isAddTimeEmpty: false };
    } finally {
        await page.close();
    }
}

// ==================== 你原生的抓取逻辑（一字未改，完全保留）====================
function parseVisitorsNumber(text) {
    if (!text) return 0;
    const clean = text.replace(/,/g, '').trim();
    let multiplier = 1, numStr = clean;
    if (clean.toUpperCase().includes('K')) { multiplier = 1000; numStr = clean.replace(/K/gi, ''); }
    else if (clean.toUpperCase().includes('M')) { multiplier = 1000000; numStr = clean.replace(/M/gi, ''); }
    else if (clean.toUpperCase().includes('B')) { multiplier = 1000000000; numStr = clean.replace(/B/gi, ''); }
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

                if (h2Text.includes('FAQ')) {
                    const dtList = await contentDiv.$$('dt');
                    for (const dt of dtList) {
                        try {
                            await dt.click();
                            await new Promise(r => setTimeout(r, 2000));
                            const titleEl = await dt.$('h3');
                            const title = titleEl ? await page.evaluate(el => el.textContent.trim(), titleEl) : '';
                            const descHandle = await dt.evaluateHandle(el => el.nextElementSibling);
                            const descEl = await descHandle.asElement();
                            if (descEl) {
                                const targetDescEl = await descEl.$('.mt-2.text-base.text-gray-1000');
                                const desc = targetDescEl ? await page.evaluate(el => el.textContent.trim(), targetDescEl) : await page.evaluate(el => el.textContent.trim(), descEl);
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
            }, 100);
        });
    });
}

// ==================== 【增强版调度器】增加断点续传、进度打印、空值统计 ====================
async function batchScrapeAll() {
    console.log(`🚀 启动稳定并发 | 并发数: ${CONCURRENCY}`);
    
    // 🔥 新增统计变量
    let successCount = 0;
    let emptyAddTimeCount = 0;
    let processedCount = 0;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // 1. 查出所有数据
        let allTools = await prisma.aiTool.findMany({
            select: { id: true, handle: true },
            orderBy: { id: 'asc' }
        });

        // 🔥 新增逻辑：如果设置了 START_FROM_HANDLE，则从该 handle 开始截取
        if (START_FROM_HANDLE && START_FROM_HANDLE.trim() !== '') {
            const startIndex = allTools.findIndex(t => t.handle === START_FROM_HANDLE);
            if (startIndex !== -1) {
                allTools = allTools.slice(startIndex);
                successCount = startIndex
                console.log(`📍 从指定位置开始: ${START_FROM_HANDLE} (跳过前 ${startIndex} 条)`);
            } else {
                console.log(`⚠️ 未找到 handle: ${START_FROM_HANDLE}，将从头开始`);
            }
        }

        const totalCount = allTools.length;
        console.log(`📦 待处理任务数: ${totalCount}`);

        // 2. 构建任务队列
        const tasks = allTools.map(tool => () => scrapeAndUpdateTool(tool.handle, browser));
        const results = [];

        async function runWorker() {
            while (tasks.length) {
                const task = tasks.shift();
                const result = await task();
                results.push(result);
                
                // 🔥 新增：实时统计与打印
                processedCount++;
                if (result.success) {
                    successCount++;
                    if (result.isAddTimeEmpty) {
                        emptyAddTimeCount++;
                    }
                    // 打印进度：成功数/总数
                    console.log(`\n📊 进度: [${successCount}/${totalCount}] 成功 | add_time 为空: ${emptyAddTimeCount}\n`);
                }
            }
        }

        // 启动并发
        await Promise.all(Array(CONCURRENCY).fill(0).map(runWorker));

        // 3. 最终统计
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 全部完成');
        console.log(`✅ 总成功: ${successCount}/${totalCount}`);
        console.log(`❌ 总失败: ${totalCount - successCount}`);
        console.log(`⚠️ add_time 为空的数量: ${emptyAddTimeCount}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (e) {
        console.error('批量错误:', e);
    } finally {
        await browser.close();
        await prisma.$disconnect();
    }
}

// 启动
batchScrapeAll();