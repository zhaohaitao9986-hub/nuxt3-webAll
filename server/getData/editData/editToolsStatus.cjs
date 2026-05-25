const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ======================
// 1. 硬核黑产/违禁词库 (重点清理对象)
// ======================
const forbiddenWords = [
    // --- 博彩/赌博 (东南亚及中文黑产重灾区) ---
    'slot', 'gacor', 'judi', 'togel', 'casino', 'poker', 'betting', 'sbobet', 'jackpot', 
    'maxwin', 'bet88', 'xlslot88', 'slot88', 'daftat', 'alternatif', 'login',
    '博彩', '赌博', '老虎机', '娱乐城', '棋牌', '百家乐', '彩票', '六合彩', '网赚', '资金盘',

    // --- 成人/违禁类 ---
    'porn', 'sex', 'nude', 'adult', 'xvideo', 'hentai', 'escort', 'massage',
    '色情', '成人', '裸聊', '修车', '上门', '外围',

    // --- 诈骗/黑客/处方药 ---
    'viagra', 'cialis', 'hack', 'crack', 'carding', 'scam', 'crypto hack',
    '伟哥', '迷药', '代孕', '催情', '代写', '办证', '刻章', '刷单', '高仿', '复刻'
];

// 将关键词转为正则表达式，\b 用于匹配完整单词（针对英文），防止误杀 hackathon 等
const forbiddenRegex = new RegExp(
    forbiddenWords.map(word => /[a-z]/i.test(word) ? `\\b${word}\\b` : word).join('|'), 
    'i'
);

// ======================
// 2. 检查逻辑
// ======================
function isViolated(tool) {
    // A. 检查 Handle (URL 别名) 是否合法：只允许小写字母、数字、中划线
    const handleRegex = /^[a-z0-9-]+$/;
    if (!tool.handle || !handleRegex.test(tool.handle)) return true;

    // B. 检查描述和摘要是否包含黑产词
    const textToScan = `${tool.description || ''} ${tool.what_is_summary || ''}`;
    if (forbiddenRegex.test(textToScan)) return true;

    return false;
}

// ======================
// 3. 执行主逻辑
// ======================
async function scanAndClean() {
    console.time('CleaningTask');
    console.log('🚀 开始全量扫描 2.8 万条数据...');

    try {
        // 1. 一次性获取所有需要校验的字段 (内存占用约 20-30MB，完全可行)
        const allTools = await prisma.aiTool.findMany({
            select: {
                id: true,
                handle: true,
                description: true,
                what_is_summary: true,
            }
        });

        const offlineIds = [];
        const onlineIds = [];

        // 2. 内存中快速分类
        for (const tool of allTools) {
            if (isViolated(tool)) {
                offlineIds.push(tool.id);
            } else {
                onlineIds.push(tool.id);
            }
        }

        console.log(`📊 扫描完成：违规 ${offlineIds.length} 条，合规 ${onlineIds.length} 条`);

        // 3. 批量更新下线状态
        if (offlineIds.length > 0) {
            await prisma.aiTool.updateMany({
                where: { id: { in: offlineIds } },
                data: { tool_status: 'OFFLINE' }
            });
            console.log('❌ 违规数据已标记为 OFFLINE');
        }

        // 4. 批量更新上线状态 (确保之前修复的数据能重新上线)
        if (onlineIds.length > 0) {
            await prisma.aiTool.updateMany({
                where: { id: { in: onlineIds } },
                data: { tool_status: 'ONLINE' }
            });
            console.log('✅ 合规数据已标记为 ONLINE');
        }

    } catch (error) {
        console.error('⚠️ 清理过程中出错:', error);
    } finally {
        console.timeEnd('CleaningTask');
        await prisma.$disconnect();
    }
}

scanAndClean();