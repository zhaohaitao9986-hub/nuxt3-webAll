const { PrismaClient } = require('@prisma/client');
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require("@aws-sdk/client-s3");

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
 * 主函数
 */
async function main() {
    console.log("=========================================");
    console.log("🤖 开始清理 S3 冗余图片");
    console.log("=========================================\n");

    // 1. 获取数据库中所有正在使用的图片 Key
    console.log("📊 第一步：读取数据库...");
    const allTools = await prisma.aiTool.findMany({
        where: { image: { not: null } },
        select: { image: true }
    });

    // 提取 Key (把 URL 转换成 S3 文件名)
    const activeKeys = new Set();
    for (const tool of allTools) {
        if (!tool.image) continue;
        
        // 把 https://img...com/images/xxx.webp 转换成 images/xxx.webp
        // 或者把 https://...bucket/images/xxx.webp 也转换成 images/xxx.webp
        try {
            const url = new URL(tool.image);
            // pathname 开头有个 /，去掉它
            let key = url.pathname.substring(1); 
            
            // 如果路径里包含桶名 (比如 /bucket/images/xxx)，把桶名也去掉
            if (key.startsWith(VULTR_CONFIG.bucket + '/')) {
                key = key.substring(VULTR_CONFIG.bucket.length + 1);
            }

            activeKeys.add(key);
        } catch (e) {
            // 忽略解析失败的 URL
        }
    }

    console.log(`✅ 数据库中共有 ${activeKeys.size} 张图片在使用中\n`);

    // 2. 列出 S3 上的所有文件
    console.log("📊 第二步：扫描 S3 桶...");
    
    let allS3Files = [];
    let continuationToken = null;
    
    do {
        const listParams = {
            Bucket: VULTR_CONFIG.bucket,
            ContinuationToken: continuationToken,
            Prefix: 'images/' // 只看 images 文件夹下的
        };

        const response = await s3Client.send(new ListObjectsV2Command(listParams));
        if (response.Contents) {
            allS3Files = allS3Files.concat(response.Contents);
        }
        continuationToken = response.NextContinuationToken;
        
    } while (continuationToken);

    console.log(`✅ S3 中共有 ${allS3Files.length} 个文件\n`);

    // 3. 对比并找出需要删除的文件
    console.log("🔍 第三步：对比差异...");
    
    const filesToDelete = allS3Files.filter(file => {
        // 如果 S3 里的这个 Key 不在数据库白名单里，标记为删除
        return !activeKeys.has(file.Key);
    });

    if (filesToDelete.length === 0) {
        console.log("✅ 没有发现冗余图片，S3 很干净！");
        return;
    }

    console.log(`⚠️  发现 ${filesToDelete.length} 个冗余文件准备删除\n`);

    // 4. 执行删除 (为了安全，先打印前5个确认一下)
    console.log("🗑️  前5个将被删除的文件示例:");
    filesToDelete.slice(0, 5).forEach(f => console.log(`   - ${f.Key}`));
    
    // 这里可以加个确认，如果你想直接跑，注释掉下面这行
    // console.log("\n脚本暂停，确认无误后请去掉代码里的注释继续...");
    // return; 

    console.log(`\n🚀 开始删除...`);
    
    let deletedCount = 0;
    for (const file of filesToDelete) {
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: VULTR_CONFIG.bucket,
                Key: file.Key
            }));
            deletedCount++;
            if (deletedCount % 100 === 0) {
                console.log(`   已删除: ${deletedCount}/${filesToDelete.length}`);
            }
        } catch (e) {
            console.error(`删除失败: ${file.Key}`, e.message);
        }
    }

    console.log("\n=========================================");
    console.log(`🎉 清理完成！共删除 ${deletedCount} 个冗余文件`);
    console.log("=========================================");
}

main()
    .catch((e) => { console.error("🔥 错误:", e); })
    .finally(async () => { await prisma.$disconnect(); });