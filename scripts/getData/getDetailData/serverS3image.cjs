const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');
const http = require('http');
const https = require('https');

const prisma = new PrismaClient();

// ================= [ 配置区 ] =================
const VULTR_CONFIG = {
    endpoint: "https://sjc1.vultrobjects.com",
    region: "us-east-1",
    bucket: "aiseekertools-bucket",
    accessKey: "K2IK93AW42ELPI8WVZL1",
    secretKey: "G70qWAVLW0CjlX4tuymQ4nxregQMfAr6tA16tzda"
};

const CUSTOM_DOMAIN = "https://img.aiseekertools.com";

// 代理配置：请确保你的代理软件（如 Clash/V2Ray）已开启并监听此端口
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7897');
// ===============================================

const s3Client = new S3Client({
    region: VULTR_CONFIG.region,
    endpoint: VULTR_CONFIG.endpoint,
    credentials: {
        accessKeyId: VULTR_CONFIG.accessKey,
        secretAccessKey: VULTR_CONFIG.secretKey,
    },
});

function getTimeStr() {
    return new Date().toLocaleString('zh-CN');
}

/**
 * 上传图片 (增强版，支持代理和 Google 链接修复)
 */
async function uploadImageToVultr(imageUrl, handle) {
    if (!imageUrl || !imageUrl.startsWith('http')) return null;
    if (imageUrl.includes('img.aiseekertools.com')) return null;

    // 1. 尝试修复不安全的 Google 链接
    let fetchUrl = imageUrl;
    if (fetchUrl.includes('googleusercontent.com') && fetchUrl.startsWith('http://')) {
        fetchUrl = fetchUrl.replace('http://', 'https://');
    }

    try {
        const response = await axios({
            url: fetchUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 20000, 
            maxRedirects: 5,
            // 关键：同时为 http 和 https 配置代理 Agent
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Referer': 'https://www.google.com/',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
            }
        });

        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const fileExt = contentType.split('/')[1] || 'png';
        const safeHandle = handle.replace(/[^a-z0-9-_]/gi, '');
        const fileName = `images/${safeHandle}-${Date.now()}.${fileExt}`;

        const command = new PutObjectCommand({
            Bucket: VULTR_CONFIG.bucket,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read',
        });

        await s3Client.send(command);
        return `${CUSTOM_DOMAIN}/${fileName}`;
        
    } catch (error) {
        let errorMsg = error.message;
        if (error.code === 'ECONNABORTED') errorMsg = '请求超时 (Timeout)';
        console.log(`   ❌ 下载失败 [${handle}]: ${errorMsg} (Status: ${error.response?.status || 'N/A'})`);
        return null;
    }
}

/**
 * 执行任务的主函数
 */
async function runJob() {
    console.log(`\n=========================================`);
    console.log(`🚀 [${getTimeStr()}] 开始任务`);
    console.log(`=========================================`);

    const allTools = await prisma.aiTool.findMany({
        select: { id: true, handle: true, image: true },
        orderBy: { id: 'asc' }
    });

    const totalCount = allTools.length;
    const completedCount = allTools.filter(tool => tool.image && tool.image.includes('img.aiseekertools.com')).length;
    const toolsToMigrate = allTools.filter(tool => tool.handle && tool.image && !tool.image.includes('img.aiseekertools.com'));
    const pendingCount = toolsToMigrate.length;

    console.log(`📊 数据统计：`);
    console.log(`   • 数据库总量：${totalCount}`);
    console.log(`   • 已完成迁移：${completedCount}`);
    console.log(`   • 待处理数量：${pendingCount}`);
    console.log(`-----------------------------------------`);

    if (pendingCount === 0) {
        console.log(`✅ 所有图片都已处理完毕！`);
        return;
    }

    console.log(`🔨 开始处理...`);
    let processedCount = 0;

    for (const tool of toolsToMigrate) {
        const progress = ((processedCount + 1) / pendingCount * 100).toFixed(1);
        const newUrl = await uploadImageToVultr(tool.image, tool.handle);
        
        if (newUrl) {
            try {
                await prisma.aiTool.update({
                    where: { id: tool.id },
                    data: { image: newUrl, website_logo: newUrl }
                });
                processedCount++;
                console.log(`✅ [${processedCount}/${pendingCount}] ${tool.handle} (${progress}%)`);
            } catch (e) {
                console.log(`❌ [${processedCount+1}/${pendingCount}] ${tool.handle} (DB更新失败)`);
            }
        } else {
            console.log(`⏭️ [${processedCount+1}/${pendingCount}] ${tool.handle} (跳过/下载失败)`);
        }
        
        // 稍微停顿一下，避免请求过快
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n=========================================`);
    console.log(`🎉 任务结束！`);
    console.log(`   • 本次成功处理：${processedCount}`);
    console.log(`=========================================`);
}

// ================= [ 启动逻辑 ] =================

async function main() {
    try {
        await runJob();
        process.exit(0);
    } catch (e) {
        console.error("🔥 致命错误:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();