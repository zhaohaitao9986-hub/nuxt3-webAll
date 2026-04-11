const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

/**
 * 爬取并更新单个 Tool 数据
 * @param {string} handle - Tool 的唯一标识 (例如: 'writesonic')
 */
async function scrapeAndUpdateTool(handle) {
    // 1. 启动浏览器
    const browser = await puppeteer.launch({
        headless: false, // 设为 false 可以看到浏览器动作，方便调试
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    // 【优化1】拦截不必要的资源，极速加载页面
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const resourceType = request.resourceType();
        // 屏蔽图片、样式、字体和媒体，只放行文档、脚本和 API 请求
        if (['image', 'font', 'media'].includes(resourceType)) {
            request.abort();
        } else {
            request.continue();
        }
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    try {
        // 2. 访问目标页面
        const url = `https://www.toolify.ai/tool/${handle}`;
        console.log(`正在访问: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // 3. 模拟滚动，确保动态内容加载
        await autoScroll(page);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. 开始提取数据
        const scrapedData = await extractData(page);

        // 5. 打印提取结果供检查
        console.log('\n✅ 数据提取完成:', JSON.stringify(scrapedData, null, 2));

        // 6. 更新到数据库
        console.log('\n正在更新数据库...');
        // 只更新，不插入
        const dbTool = await prisma.aiTool.update({
            where: { handle: handle }, // 必须是唯一键
            data: scrapedData,          // 要更新的数据
        });

        console.log(`\n🎉 数据库更新成功! Tool ID: ${dbTool.id}`);
        // console.log(`\n🎉 数据库更新成功! Tool ID:`);

    } catch (error) {
        console.error('\n❌ 发生错误:', error);
    } finally {
        // 7. 关闭浏览器
        await browser.close();
        // await prisma.$disconnect();
    }
}


/**
 * 辅助函数：将 "565.6K", "1.2M" 等字符串转换为整数
 */
function parseVisitorsNumber(text) {
    if (!text) return null;

    // 移除逗号、空格等
    const clean = text.replace(/,/g, '').trim();

    let multiplier = 1;
    let numStr = clean;

    if (clean.toUpperCase().includes('K')) {
        multiplier = 1000;
        numStr = clean.replace(/K/gi, '');
    } else if (clean.toUpperCase().includes('M')) {
        multiplier = 1000000;
        numStr = clean.replace(/M/gi, '');
    } else if (clean.toUpperCase().includes('B')) {
        multiplier = 1000000000;
        numStr = clean.replace(/B/gi, '');
    }

    const num = parseFloat(numStr);
    if (isNaN(num)) return null;

    // 四舍五入取整
    return Math.round(num * multiplier);
}
/**
 * 具体的数据提取逻辑
 */
async function extractData(page) {
    const result = {
        add_time: null,
        website_type: [],
        social_email: [],
        faq: [],
        use_cases: [],
        company_info: null,
        tags: [],
        recommend_learn: [],
        for_jobs: [],
        // 👇 新增
        month_visited_count: 0
    };

    // --- 1. 处理顶部区域: add_time, website_type, social_email ---
    const topSection = await page.$('.tool-detail-info.mt-2');
    if (topSection) {
        // 1.1 提取 add_time (Added on)
        // 寻找第二个 table-row
        const allRows = await topSection.$$('.table-row.text-base.text-gray-1000');
        if (allRows.length >= 2) {
            const targetRow = allRows[1]; // 第二个
            // 旧的
            // const labelEl = await targetRow.$('.table-cell.py-1.5.pr-4.whitespace-nowrap.font-semibold');
            // 新的
            const labelEl = await targetRow.$('.table-cell.py-1\\.5.pr-4.whitespace-nowrap.font-semibold');
            if (labelEl) {
                const labelText = await page.evaluate(el => el.textContent.trim(), labelEl);
                if (labelText === 'Added on:') {
                    // 获取同级的下一个元素
                    const valueEl = await targetRow.$('.table-cell:not(.font-semibold)');
                    if (valueEl) {
                        const dateStr = await page.evaluate(el => el.textContent.trim(), valueEl);
                        result.add_time = dateStr; // 转换为 Date 对象
                    }
                }
            }
        }

        // 1.2 提取 website_type (标签数组)
        const typeTags = await topSection.$$('div.text-sm.text-gray-1000.border.border-gray-1300.max-w-max.truncate.rounded-2xl.t-label');
        result.website_type = await Promise.all(
            typeTags.map(tag => page.evaluate(el => el.textContent.trim(), tag))
        );

        // 1.3 提取 social_email (Social & Email 链接)
        const socialRows = await topSection.$$('.table-row');
        for (const row of socialRows) {
            // 旧的
            // const labelCell = await row.$('.table-cell.py-1.5.pr-4.whitespace-nowrap.font-semibold.align-middle');
            // 新的
            const labelCell = await row.$('.table-cell.py-1\\.5.pr-4.whitespace-nowrap.font-semibold.align-middle');
            if (labelCell) {
                const text = await page.evaluate(el => el.textContent.trim(), labelCell);
                if (text === 'Social & Email:') {
                    const links = await row.$$('a');
                    result.social_email = await Promise.all(
                        links.map(a => page.evaluate(el => el.href, a))
                    );
                    break;
                }
            }
        }

        // 1.4 提取 month_visited_count (月度访问量)
        // 寻找第三个 table-row (索引为 2)
        if (allRows.length >= 3) {
            const targetRow = allRows[2]; // 第三个
            const labelEl = await targetRow.$('.table-cell.py-1\\.5.pr-4.whitespace-nowrap.font-semibold');
            if (labelEl) {
                const labelText = await page.evaluate(el => el.textContent.trim(), labelEl);
                if (labelText === 'Monthly Visitors:') {
                    // 获取同级的下一个元素里的 span
                    const valueCell = await targetRow.$('.table-cell:not(.font-semibold)');
                    if (valueCell) {
                        const spanEl = await valueCell.$('span');
                        if (spanEl) {
                            const rawText = await page.evaluate(el => el.textContent.trim(), spanEl);
                            // 调用辅助函数转换为数字
                            result.month_visited_count = parseVisitorsNumber(rawText);
                            console.log(`📊 提取到访问量: ${rawText} -> ${result.month_visited_count}`);
                        }
                    }
                }
            }
        }
    }

    // --- 2. 处理中间区域: FAQ, Use Cases, Company Info ---
    const productInfo = await page.$('#productInformation');
    if (productInfo) {
        const detailContainer = await productInfo.$('.tool-detail-information');
        if (detailContainer) {
            // 获取所有第一级子元素
            const sections = await detailContainer.$$(':scope > *');

            for (const section of sections) {
                const h2 = await section.$('h2');
                if (!h2) continue;

                const h2Text = await page.evaluate(el => el.textContent.trim(), h2);
                const contentDiv = await section.$('div'); // h2 同级的 div

                if (!contentDiv) continue;

                // 2.1 提取 FAQ
                if (h2Text.includes('FAQ')) {
                    const dtList = await contentDiv.$$('dt');
                    for (const dt of dtList) {
                        try {
                            // 模拟点击展开
                            await dt.click();
                            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待动画

                            // 获取标题 (h3)
                            const titleEl = await dt.$('h3');
                            const title = titleEl ? await page.evaluate(el => el.textContent.trim(), titleEl) : '';

                            // 获取描述 (dt 后面的 div)
                            const descHandle = await dt.evaluateHandle(el => el.nextElementSibling);
                            const descEl = await descHandle.asElement();

                            if (descEl) {
                                // 尝试找到具体的内容容器
                                const targetDescEl = await descEl.$('.mt-2.text-base.text-gray-1000');
                                const desc = targetDescEl
                                    ? await page.evaluate(el => el.textContent.trim(), targetDescEl)
                                    : await page.evaluate(el => el.textContent.trim(), descEl);

                                if (title) {
                                    result.faq.push({ title, desc });
                                }
                            }
                        } catch (e) {
                            console.log('跳过一个 FAQ 项');
                        }
                    }
                }

                // 2.2 提取 Use Cases
                else if (h2Text.includes('Use Cases')) {
                    const h3List = await contentDiv.$$('h3');
                    result.use_cases = await Promise.all(
                        h3List.map(h3 => page.evaluate(el => el.textContent.trim(), h3))
                    );
                }

                // 2.3 提取 Company Info (新逻辑)
                // 不管有没有 h2，只要 section HTML 里包含 Company 就提取 ul
                const sectionHtml = await page.evaluate(el => el.innerHTML, section);
                if (sectionHtml.includes('Company')) {
                    const ulElement = await section.$('ul');
                    if (ulElement) {
                        result.company_info = await page.evaluate(el => el.innerHTML, ulElement);
                    }
                }
            }
        }
    }

    // --- 3. 处理底部区域: Tags, Recommend, Jobs ---
    const bottomSections = await page.$$('.content-visibility-auto');
    for (const section of bottomSections) {
        const headerSpan = await section.$('h2 span');
        if (!headerSpan) continue;

        const headerText = await page.evaluate(el => el.textContent.trim(), headerSpan);
        const contentDiv = await section.$('div');

        if (!contentDiv) continue;

        // 3.1 提取 Tags
        if (headerText.includes('Tags')) {
            const tagSpans = await contentDiv.$$('a span');
            result.tags = await Promise.all(
                tagSpans.map(span => page.evaluate(el => el.textContent.trim(), span))
            );
        }

        // 3.2 提取 Recommend Learn
        else if (headerText.includes('Recommend')) {
            const links = await contentDiv.$$('a');
            result.recommend_learn = await Promise.all(
                links.map(a => page.evaluate(el => el.textContent.trim(), a))
            );
        }

        // 3.3 提取 For Jobs
        else if (headerText.includes('Jobs')) {
            const jobSpans = await contentDiv.$$('a span:first-child');
            result.for_jobs = await Promise.all(
                jobSpans.map(span => page.evaluate(el => el.textContent.trim(), span))
            );
        }
    }

    return result;
}

/**
 * 辅助函数：自动滚动页面
 */
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

// --- 执行 ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function batchScrapeAll() {
    console.log('🚀 开始批量爬取任务...');

    try {
        // 1. 先从数据库查出所有的 handle
        const allTools = await prisma.aiTool.findMany({
            select: { id: true, handle: true },
            orderBy: { id: 'asc' } // 按 ID 顺序排列
        });

        console.log(`📋 共找到 ${allTools.length} 个工具待更新`);

        // 2. 循环遍历，逐个爬取
        for (let i = 0; i < allTools.length; i++) {
            const tool = allTools[i];
            const index = i + 1;

            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`[${index}/${allTools.length}] 正在处理: ${tool.handle} (ID: ${tool.id})`);

            try {
                // 调用你的爬取更新函数
                await scrapeAndUpdateTool(tool.handle);
                console.log(`✅ [${index}/${allTools.length}] ${tool.handle} 处理完成`);
            } catch (err) {
                console.error(`❌ [${index}/${allTools.length}] ${tool.handle} 处理失败:`, err.message);
                // 失败了不中断，继续下一个
            }

            // 3. 重要：每个请求之间加延时，防止被封 (建议 3-5 秒)
            if (i < allTools.length - 1) {
                console.log(`⏳ 等待 3 秒后继续...`);
                await sleep(3000);
            }
        }

        console.log('\n🎉🎉🎉 全部任务完成！');

    } catch (error) {
        console.error('❌ 批量任务启动失败:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// 注意：你的 scrapeAndUpdateTool 函数里原本有关闭 browser 和 prisma 的逻辑，
// 建议稍微修改一下 scrapeAndUpdateTool，把 finally 里的 prisma.$disconnect() 去掉，
// 因为现在是批量循环，由 batchScrapeAll 统一管理数据库连接。

// 启动批量任务
batchScrapeAll();