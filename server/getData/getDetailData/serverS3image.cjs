const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const axios = require('axios');

const prisma = new PrismaClient();

// ================= [ 配置区 ] =================
const VULTR_CONFIG = {
    endpoint: "https://sjc1.vultrobjects.com",
    region: "us-east-1",
    bucket: "aiseekertools-bucket",
    accessKey: "K2IK93AW42ELPI8WVZL1",
    secretKey: "G70qWAVLW0CjlX4tuymQ4nxregQMfAr6tA16tzda"
};

// 🔥 新增：你的自定义域名配置
const CUSTOM_DOMAIN = "https://img.aiseekertools.com";

// 填写具体 handle 则只迁移这一个工具的图片，留空 '' 则迁移所有
const TARGET_HANDLE = 'writesonic'; // 例如: 'chatgpt'
// ===============================================

const s3Client = new S3Client({
    region: VULTR_CONFIG.region,
    endpoint: VULTR_CONFIG.endpoint,
    credentials: {
        accessKeyId: VULTR_CONFIG.accessKey,
        secretAccessKey: VULTR_CONFIG.secretKey,
    },
});

/**
 * 上传单个图片
 */
async function uploadImageToVultr(imageUrl, handle) {
    if (!imageUrl || !imageUrl.startsWith('http')) return null;
    
    // 🔥 修改去重判断：如果已经是你的自定义域名链接，则跳过
    if (imageUrl.includes('img.aiseekertools.com')) return null;

    try {
        console.log(`🖼️  正在处理: ${handle}`);
        
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const fileExt = contentType.split('/')[1] || 'png';
        const safeHandle = handle.replace(/[^a-z0-9-_]/gi, '');
        const fileName = `images/${safeHandle}-${Date.now()}.${fileExt}`;

        // 上传到 Vultr (这步不变，文件依然要传到 Vultr 桶里)
        const command = new PutObjectCommand({
            Bucket: VULTR_CONFIG.bucket,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read',
        });

        await s3Client.send(command);
        
        // 🔥 核心修改：返回你的自定义域名链接 (不带桶名)
        return `${CUSTOM_DOMAIN}/${fileName}`;
        
    } catch (error) {
        console.error(`❌ 失败 [${handle}]:`, error.message);
        return null;
    }
}

/**
 * 辅助：更新单个工具的数据库记录
 */
async function updateSingleTool(tool) {
    const newUrl = await uploadImageToVultr(tool.image, tool.handle);
    
    if (newUrl) {
        try {
            await prisma.aiTool.update({
                where: { id: tool.id },
                data: {
                    image: newUrl,
                    website_logo: newUrl
                }
            });
            console.log(`✅ 迁移成功! 新链接: ${newUrl}`);
            return true;
        } catch (dbErr) {
            console.error(`❌ 数据库更新失败: ${dbErr.message}`);
            return false;
        }
    } else {
        console.log(`⏭️ 跳过 (无需迁移或上传失败)`);
        return false;
    }
}

async function main() {
    console.log("🚀 开始图片迁移任务...");

    // ==========================================
    // 逻辑 1：如果指定了 TARGET_HANDLE，只迁移这一个
    // ==========================================
    if (TARGET_HANDLE) {
        console.log(`🎯 【单工具模式】正在查找 handle: ${TARGET_HANDLE}`);
        
        const targetTool = await prisma.aiTool.findUnique({
            where: { handle: TARGET_HANDLE },
            select: { id: true, handle: true, image: true }
        });

        if (!targetTool) {
            return console.error(`❌ 数据库中未找到 handle 为 "${TARGET_HANDLE}" 的工具`);
        }

        if (!targetTool.image) {
            return console.error(`❌ 该工具没有图片链接`);
        }

        console.log(`✅ 找到工具: ${targetTool.handle}, 当前图片: ${targetTool.image}`);
        
        await updateSingleTool(targetTool);
        
        console.log("🎉 单工具任务结束");
        return;
    }

    // ==========================================
    // 逻辑 2：如果没有指定，批量迁移所有
    // ==========================================
    console.log(`🎯 【批量模式】正在扫描数据库...`);

    // 1. 找出所有需要迁移图片的工具
    const toolsToMigrate = await prisma.aiTool.findMany({
        where: {
            AND: [
                { handle: { not: null } },
                { image: { not: null } },
                // 🔥 修改过滤条件：排除已经是自定义域名的链接
                { image: { notContains: 'img.aiseekertools.com' } }
            ]
        },
        select: { id: true, handle: true, image: true },
        orderBy: { id: 'asc' } // 按 ID 顺序处理
    });

    console.log(`📋 共找到 ${toolsToMigrate.length} 张图片待迁移`);

    let successCount = 0;

    for (const tool of toolsToMigrate) {
        const newUrl = await uploadImageToVultr(tool.image, tool.handle);
        
        if (newUrl) {
            try {
                await prisma.aiTool.update({
                    where: { id: tool.id },
                    data: {
                        image: newUrl,
                        website_logo: newUrl
                    }
                });
                successCount++;
                console.log(`✅ [${successCount}/${toolsToMigrate.length}] 更新成功: ${tool.handle}`);
            } catch (dbErr) {
                console.error(`❌ 数据库更新失败 [${tool.handle}]: ${dbErr.message}`);
            }
        }
        
        // 简单的节流，防止请求过快
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n🎉 迁移结束。成功: ${successCount}/${toolsToMigrate.length}`);
}

main()
    .catch((e) => { console.error("🔥 致命错误:", e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });