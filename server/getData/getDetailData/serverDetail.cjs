const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');

const prisma = new PrismaClient();

// 生成 Handle 的工具函数
function generateHandle(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/ & /g, '-')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .trim();
}

// 清理数字字符串 (例如 "1.2k Saved" -> 1200)
function parseCount(str) {
    if (!str) return 0;
    const match = str.match(/[\d.]+/);
    if (!match) return 0;
    let num = parseFloat(match[0]);
    if (str.toLowerCase().includes('k')) num *= 1000;
    return Math.floor(num);
}

// 主爬取函数
async function crawlCategoryDetail(categoryHandle) {
    console.log(`🚀 开始爬取分类: ${categoryHandle}`);

    const browser = await puppeteer.launch({
        headless: false, // 建议先设为 false 看一下过程，稳定后改为 'new'
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await browser.newPage();
    // 【新增】把浏览器的 console 输出转发到 Node.js 终端
    //   page.on('console', msg => {
    //     for (let i = 0; i < msg.args().length; ++i)
    //       console.log(`🌐 [浏览器控制台]: ${msg.args()[i]}`);
    //   });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 1. 先获取数据库中的 Category ID，用于后续关联
    const category = await prisma.categoryLevel2.findUnique({
        where: { handle: categoryHandle },
        select: {
            id: true,
            handle: true,
            tool_count: true, // 🔥 确保选中了这个字段
            name: true
        }
    });

    if (!category) {
        console.error(`❌ 数据库中未找到 handle 为 ${categoryHandle} 的分类`);
        await browser.close();
        return;
    }
    // 🔥 新增：动态计算最大页数
    // 如果 tool_count 不存在，默认给个 1 页防止死循环
    const totalTools = category?.tool_count || 0;
    const maxPages = Math.ceil(totalTools / 20); // 向上取整
    console.log(`📊 该分类共有 ${totalTools} 个工具，预计需爬取 ${maxPages} 页`);

    let currentPage = 1;
    let hasNextPage = true;

    // 定义变量存储分类公共信息（只在第一页获取一次）
    let categoryMetaSaved = false;

    while (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        const url = currentPage === 1
            ? `https://www.toolify.ai/category/${categoryHandle}`
            : `https://www.toolify.ai/category/${categoryHandle}?page=${currentPage}`;

        console.log(`📄 正在访问: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

            // 模拟滚动，触发懒加载
            await autoScroll(page);
            await new Promise(resolve => setTimeout(resolve, 5000));

            // --- 阶段 1: 提取分类公共信息 (仅第一页) ---
            if (!categoryMetaSaved) {
                // console.log(111)
                await extractAndSaveCategoryMeta(page, category.id);
                categoryMetaSaved = true;
            }
            //    console.log(222)
            // --- 阶段 2: 提取当前页的 AI Tools ---
            const toolsData = await extractToolsFromPage(page);
            //    console.log(333,toolsData.length)
            // --- 阶段 3: 存入数据库 ---
            await saveToolsToDB(toolsData, category.id);

            console.log(`✅ 第 ${currentPage} 页处理完成，获取 ${toolsData.length} 个工具`);

            // --- 阶段 4: 判断是否有下一页 ---
            // 这里需要根据实际页面选择器判断“下一页”按钮是否可点击
            // 假设选择器是 '.next-page-btn'，你需要根据实际 DOM 修改
            // 为了演示，这里简单通过 tool_count 估算或者你可以手动指定爬取几页测试
            // 这里我先写死逻辑，你需要根据页面调整
            currentPage++;
            // 简单的终止条件防止死循环，实际应检测按钮
            // 🔥 修改这里：使用动态的 maxPages
            if (currentPage > maxPages) {
                hasNextPage = false;
                console.log(`✅ 已达到计算的最大页数 (${maxPages})，停止爬取`);
            }

            // 安全起见，加一个硬编码的最大上限防止死循环 (比如 100 页)
            if (currentPage > 100) {
                hasNextPage = false;
                console.log("⚠️ 触发安全上限 100 页，强制停止");
            }
            // 如果你要爬全量，把上面的 if 删掉，改为检测页面元素

        } catch (error) {
            console.error(`❌ 第 ${currentPage} 页爬取出错:`, error.message);
            hasNextPage = false;
        }
    }

    await browser.close();
    console.log("🎉 所有页面爬取完成");
}

// 辅助：自动滚动
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

// 辅助：提取分类 Meta 信息 (What is, Features, FAQ 等)
async function extractAndSaveCategoryMeta(page, categoryId) {
    console.log("📝 提取分类简介信息...");

    const meta = await page.evaluate(() => {
        // 1. 找到根容器
        const container = document.querySelector('.category-container');
        if (!container) return { error: 'Container not found' };

        // 2. 找到 xl:col-span-4 (注意冒号转义)
        // 假设这是目标侧边栏/详情区域
        const mainCol = container.querySelector('.xl\\:col-span-4');
        if (!mainCol) return { error: 'Main column not found' };

        // 3. 找到核心区域：你描述的“第五个 div” (索引为 4)
        // 先获取所有直接子 div
        const colChildren = [...mainCol.children].filter(c => c.tagName === 'DIV');
        if (colChildren.length < 5) return { error: 'Core section not enough children' };

        const coreSection = colChildren[4]; // 第五个 div

        // 安全获取文本的辅助函数
        const safeGetText = (parent, childIndex) => {
            try {
                const div = parent.children[childIndex];
                const p = div.querySelector('p');
                return p ? p.innerText.trim() : '';
            } catch (e) { return ''; }
        };

        // 安全获取数组的辅助函数
        const safeGetList = (parent, childIndex) => {
            try {
                const div = parent.children[childIndex];
                const lis = div.querySelectorAll('li');
                return [...lis].map(li => {
                    const span = li.querySelector('span');
                    return span ? span.innerText.trim() : li.innerText.trim();
                }).filter(Boolean);
            } catch (e) { return []; }
        };

        // --- 开始提取数据 ---

        // 1. what_is_summary: 第1个div下的p
        const what_is_summary = safeGetText(coreSection, 0);

        // 2. feature: 第2个div下的所有li下的span
        const feature = safeGetList(coreSection, 1);

        // 3. who_is_use: 第3个div下的p
        const who_is_use = safeGetText(coreSection, 2);

        // 4. how_do_work: 第4个div下的p
        const how_do_work = safeGetText(coreSection, 3);

        // 5. advantages: 第5个div下的p
        const advantages = safeGetText(coreSection, 4);

        // 6. faq: 第6个div下的所有 el-collapse-item
        const faq = [];
        try {
            const faqSection = coreSection.children[5];
            const collapseItems = faqSection.querySelectorAll('.el-collapse-item');

            collapseItems.forEach(item => {
                try {
                    const titleEl = item.querySelector('.el-collapse-item__header span');
                    const descEl = item.querySelector('.el-collapse-item__content div');

                    if (titleEl) {
                        faq.push({
                            title: titleEl.innerText.trim(),
                            desc: descEl ? descEl.innerText.trim() : ''
                        });
                    }
                } catch (e) { /* 忽略单个 FAQ 解析错误 */ }
            });
        } catch (e) { console.log("FAQ section not found"); }
        return {
            what_is_summary,
            feature, // 注意：这是数组，如果数据库是 String 类型，需要 join(',')
            who_is_use,
            how_do_work,
            advantages,
            faq // 这是对象数组，建议数据库存 Json 类型
        };
    });

    if (meta.error) {
        console.log("⚠️ 未能提取到分类 Meta 信息，可能是页面结构变化或未滚动到位", meta.error);
        return;
    }

    console.log("✅ 提取到分类信息:", meta.what_is_summary?.substring(0, 50) + "...");

    // 更新数据库中的 CategoryLevel2
    await prisma.categoryLevel2.update({
        where: { id: categoryId },
        data: {
            what_is_summary: meta.what_is_summary,
            who_is_use: meta.who_is_use,
            how_do_work: meta.how_do_work,
            advantages: meta.advantages,
            // 注意：如果 feature 在数据库是 String 类型，用 meta.feature?.join(', ')
            // 如果是 String[] 类型，直接赋值
            feature: meta.feature,
            // 注意：faq 字段在 Schema 中需要是 Json 类型
            faq: meta.faq,
        }
    });
}

// 辅助：提取当前页所有工具
async function extractToolsFromPage(page) {
    // 关键步骤：点击所有的折叠面板，让详情加载出来
    console.log("🔓 展开所有工具详情...");
    try {
        // 假设点击卡片或者点击展开按钮，这里需要根据实际情况写
        // 例如：等待所有展开按钮出现并点击
        // await page.click('.tool-card .expand-button'); 
        // 这里比较复杂，通常需要 evaluate 内部去触发 click
    } catch (e) {
        console.log("可能没有展开按钮或已展开");
    }

    return page.evaluate((parseCountFn, generateHandleFn) => {
        const tools = [];

        // ================= 1. 定位根容器 =================
        const container = document.querySelector('.category-container');
        if (!container) {
            console.error('❌ 没找到 .category-container');
            return [];
        }

        const mainCol = container.querySelector('.xl\\:col-span-4');
        if (!mainCol) {
            console.error('❌ 没找到 .xl:col-span-4');
            return [];
        }

        // 关键：找到 .tools 容器
        const toolsContainer = mainCol.querySelector('.tools');
        if (!toolsContainer) {
            console.error('❌ 没找到 .tools 容器');
            return [];
        }

        // 找到所有卡片
        const cards = toolsContainer.querySelectorAll('.mb-12');
        console.log(`✅ 找到 ${cards.length} 个工具卡片 (.mb-12)`);

        // ================= 2. 解析单个卡片 =================

        cards.forEach((card, index) => {
            try {
                // 辅助函数：基于当前 card 查找
                const $ = (selector, root = card) => root.querySelector(selector);
                const $$ = (selector, root = card) => [...root.querySelectorAll(selector)];
                const text = (selector, root) => {
                    const el = $(selector, root);
                    return el ? el.innerText.trim() : '';
                };

                // ==========================================
                // 严格按照你给的路径开始提取
                // ==========================================

                // 1. Website (mb-12 下的 .try-btn 按钮)
                const website = $('.try-btn')?.href || '';

                // --- 进入 tool-item 层级 ---
                const toolItem = $('.tool-item', card);
                if (!toolItem) {
                    console.log(`Card ${index} 跳过：缺少 .tool-item`);
                    return;
                }

                // --- 进入 tool-card 层级 ---
                const toolCard = $('.tool-card', toolItem);
                if (!toolCard) {
                    console.log(`Card ${index} 跳过：缺少 .tool-card`);
                    return;
                }

                // 2. Image (tool-card 下的 a 标签下的 img)
                const imgEl = $('a img', toolCard);
                const image = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';
                // console.log('1-111111')
                // --- 进入 card-text-content 层级 ---
                const cardTextContent = $('.card-text-content', toolCard);
                if (!cardTextContent) {
                    console.log(`Card ${index} 跳过：缺少 .card-text-content`);
                    return;
                }
                // console.log('1-22222')
                // 3. Name (card-text-content 下的 a 下的 h2)
                const name = text('a h2', cardTextContent);
                // console.log(name,'121212')
                if (!name) return;

                // 4. Description (card-text-content 下的 p)
                const description = text('p', cardTextContent);

                // --- 进入 card-tool-info 层级 ---
                const cardToolInfo = $('.card-tool-info', cardTextContent);

                // 5. Collected Count (去掉 Saved)
                let collected_count = 0;
                if (cardToolInfo) {
                    const collectedRaw = text('.tool-info-collected', cardToolInfo);
                    if (collectedRaw) {
                        // 提取数字，兼容 "1.2k Saved"
                        const match = collectedRaw.match(/[\d.]+/);
                        if (match) {
                            let num = parseFloat(match[0]);
                            if (collectedRaw.toLowerCase().includes('k')) num *= 1000;
                            collected_count = Math.floor(num);
                        }
                    }
                }

                // console.log('1-33333')
                // 6. Tool Info Review (评分)
                let tool_info_review = null;
                if (cardToolInfo) {
                    const reviewRaw = text('.el-rate__text', cardToolInfo);
                    if (reviewRaw) tool_info_review = parseFloat(reviewRaw);
                }
                // console.log('1-44444')
                // ==========================================
                // 处理折叠面板 category-collapse (在 tool-item 下，和 tool-card 平级)
                // ==========================================
                const categoryCollapse = $('.category-collapse', toolItem);

                let pricing = [];
                let what_is_summary = '';
                let feature = [];
                let pros = [];
                let cons = [];

                if (categoryCollapse) {
                    const collapseItems = $$('.el-collapse-item', categoryCollapse);

                    // 注意：NodeList 转数组后通过索引获取
                    // 1. Pricing: 第 1 个 (索引 0)
                    if (collapseItems[0]) {
                        const content = $('.el-collapse-item__content', collapseItems[0]);
                        if (content) {
                            pricing = $$('.rounded', content).map(el => el.outerHTML || el.innerText);
                        }
                    }
                    // console.log(pricing,'1-55555')
                    // 2. What is Summary: 第 2 个 (索引 1)
                    if (collapseItems[1]) {
                        // 路径: el-collapse-item__wrap 下的 text-lg
                        const wrap = $('.el-collapse-item__wrap', collapseItems[1]);
                        what_is_summary = text('.text-lg', wrap);
                    }
                    // console.log('1-66666')
                    // 3. Feature: 第 3 个 (索引 2)
                    if (collapseItems[2]) {
                        const content = $('.el-collapse-item__content', collapseItems[2]);
                        if (content) {
                            feature = $$('li', content).map(li => li.innerText.trim());
                        }
                    }
                    // console.log('1-7777777')
                    // 4. Pros/Cons: 第 4 个 (索引 3)
                    if (collapseItems[3]) {
                        const content = $('.el-collapse-item__content', collapseItems[3]);
                        if (content) {
                            const uls = $$('ul', content);
                            if (uls[0]) pros = $$('li', uls[0]).map(li => li.innerText.trim());
                            if (uls[1]) cons = $$('li', uls[1]).map(li => li.innerText.trim());
                        }
                    }
                }
                // ================= 修复点 1：安全计算 is_free =================
                let isFree = false;
                try {
                    const checkStr = (description || '') + (name || '') + (Array.isArray(pricing) ? pricing.join(' ') : '');
                    isFree = checkStr.toLowerCase().includes('free');
                } catch (e) {
                    isFree = false;
                }

                // ================= 修复点 2：直接在这里写 handle 生成逻辑，不调用外部函数 =================
                let localHandle = '';
                if (name) {
                    localHandle = name
                        .toLowerCase()
                        .replace(/ & /g, '-')
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9-]/g, '')
                        .replace(/-+/g, '-')
                        .trim();
                }

                // 构建最终对象
                tools.push({
                    name,
                    handle: localHandle,
                    website,
                    description,
                    image,
                    website_logo: image,
                    website_name: name,
                    what_is_summary,
                    tool_info_review,
                    collected_count,
                    is_free: isFree,
                    is_ad: false,
                    month_visited_count: 0,

                    // 数组类型字段
                    pricing,
                    feature,
                    pros,
                    cons,
                });
            } catch (err) {
                console.error("❌ 解析单个卡片出错:", index, err);
            }
        });

        console.log(`📦 解析完成，有效工具数: ${tools.length}`);
        return tools;
    }, parseCount, generateHandle);
}

// 辅助：存入数据库
async function saveToolsToDB(tools, categoryId) {
    console.log(`💾 正在入库 ${tools.length} 个工具...`);

    for (const tool of tools) {
        try {
            // 1. Upsert Tool (存在则更新，不存在则创建)
            const dbTool = await prisma.aiTool.upsert({
                where: { handle: tool.handle }, // 假设 handle 是唯一键
                update: {
                    ...tool,
                    // 这里可以放只想更新不想创建的字段
                },
                create: tool,
            });

            // 2. 绑定关联关系 (AiToolCategory)
            // 检查关联是否已存在，避免唯一键冲突
            await prisma.aiToolCategory.upsert({
                where: {
                    aiToolId_categoryId: {
                        aiToolId: dbTool.id,
                        categoryId: categoryId
                    }
                },
                create: {
                    aiToolId: dbTool.id,
                    categoryId: categoryId
                },
                update: {} // 如果已存在，什么都不做
            });

        } catch (e) {
            console.error(`❌ 保存工具 ${tool.name} 失败:`, e.message);
        }
    }
}

// --- 启动 ---
async function main() {
    console.log("🚀 开始批量爬取任务...");

    // 1. 从数据库读取所有二级分类
    const allCategories = await prisma.categoryLevel2.findMany({
        select: { id: true, handle: true, name: true },
        // 如果你只想爬取部分，可以在这里加 where 条件
        // where: { id: { gt: 10 } } 
    });

    console.log(`📋 共找到 ${allCategories.length} 个分类，准备开始...`);

    // 2. 🔥 找到起始位置：寻找 handle 为 'ai-title-generator' 的索引
    const startHandle = 'ai-title-generator';
    let startIndex = allCategories.findIndex(c => c.handle === startHandle);

    // 如果没找到，从头开始 (索引 0)
    if (startIndex === -1) {
        console.log(`⚠️ 未找到 handle 为 [${startHandle}] 的分类，将从头开始`);
        startIndex = 0;
    } else {
        console.log(`✅ 找到起始点，将从 [${allCategories[startIndex].name}] 开始`);
    }

    // 3. 🔥 循环：从 startIndex 开始
    for (let i = startIndex; i < allCategories.length; i++) {
        const category = allCategories[i];
        
        console.log(`\n=====================================`);
        console.log(`🔛 [进度 ${i + 1}/${allCategories.length}] 正在处理: [${category.name}] (${category.handle})`);

        try {
            // 执行爬取
            await crawlCategoryDetail(category.handle);

        } catch (error) {
            console.error(`❌ 分类 [${category.name}] 爬取失败:`, error.message);
            // 这里不抛出错误，让循环继续执行下一个
        }

        // 4. 重要：两个分类之间休息一下
        // 只有不是最后一个的时候才休息，节省时间
        if (i < allCategories.length - 1) {
            console.log(`⏳ 等待 15 秒后继续...`);
            await new Promise(resolve => setTimeout(resolve, 15000));
        }
    }

    console.log("\n🎉 所有分类爬取任务结束！");
}

// 辅助：延迟函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行主函数
main()
    .catch((e) => {
        console.error("🔥 致命错误:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });