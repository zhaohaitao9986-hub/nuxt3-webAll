// ==================== 1. 严格的 CommonJS 导入 ====================
const { PrismaClient, Prisma } = require('@prisma/client'); 
const axios = require('axios');
const readline = require('readline'); 
const PQueue = require('p-queue');    

const prisma = new PrismaClient();

// ==================== 2. 配置区域 ====================
const API_KEY = 'sk-816a11590a0e40e1a95bbce24db013fa'; 
const BASE_URL = 'https://api.deepseek.com/v1'; 
const MODEL_NAME = 'deepseek-chat'; 
const CONCURRENCY = 5; 
const DEFAULT_BATCH_SIZE = 50; 

// ==================== 3. 深度定制的 System Prompt (究极 SEO 深度版) ====================
const SYSTEM_PROMPT = `
You are an elite Silicon Valley tech editor, senior software reviewer for Wired/TechCrunch, and a master of Google SEO & Conversion Rate Optimization (CRO). 
Analyze the input AI tool's comprehensive metadata (summary, description, all features, target jobs, use cases, original FAQs, and raw pricing HTML).
Output a JSON object strictly matching the schema below. 

CRITICAL CONTENT DEPTH & SEO RULES:
1. ELIMINATE AI BUZZWORDS & GENERATIVE TONE: Never use: revolutionize, essential tool, look no further, game-changer, ultimate guide, power of AI, seamlessly. Write in a grounded, authoritative, geeky, human-written editorial tone.
2. META TITLE PRICING ACCURACY: Look closely at the pricing data. If paid but has a free trial, use '(Free Trial)' or 'Pricing Plans'. Max 45-50 characters.
3. EXPANDED ABOUT (True Technical Teardown): Write a comprehensive 250-300 word multi-paragraph expert analysis. Do not just summarize features. Dive deep into:
   - The tool's Core Value Proposition and Unique Selling Proposition (USP) against legacy tools.
   - The underlying friction it eliminates in modern digital workflows.
   - An objective critique, including subtle limits or costs mentioned in raw data.
4. BUILT FOR DETAILS (Workflow Impact): For each profession, write a substantial 3-4 sentence analytical breakdown detailing exactly how the tool plugs into their daily tech stack and why generic LLMs can't replicate it.
5. FEATURES & USE CASES: Synthesize the technical mechanics. Ensure descriptions explain the 'How' and 'Why', not just 'What'.
6. EXPANDED FAQS (The Ultimate Merge): Generate EXACTLY 4 to 6 highly tactical, high-intent FAQs. You MUST consume and enhance the provided 'original_faqs', and mandatory inject 2 hardcore questions regarding pricing tiers, credit roll-overs, or strict hidden constraints parsed from the 'pricing' HTML. Keep answers direct, data-verified, and under 60 words.

Output JSON Schema:
{
  "seo_meta_title": "Max 45-50 chars. Format: [Name]: [Core Solution] [Pricing State].",
  "seo_meta_description": "Max 140 chars. Pack 2 high-intent long-tail keywords naturally. Ends with a high-CTR sharp CTA.",
  "seo_meta_keywords": ["keyword1", "keyword2", "keyword3"],
  "expanded_about": "A 250-300 word deep editorial review broken into structured logical flow (Value Prop, Tech Workflow Impact, and Strategic Limitation/Verdict). Highly scannable, natural tone.",
  "built_for_details": {
    "ProfessionA": "3-4 sentences detailing the exact daily friction eliminated and the distinct competitive workflow advantage.",
    "ProfessionB": "3-4 sentences detailing the exact daily friction eliminated and the distinct competitive workflow advantage."
  },
  "features_details": [
    {"title": "Feature Name (Specific, no generic names)", "desc": "3-sentence granular technical breakdown of how this specific feature operates and its practical output value."}
  ],
  "expanded_usecases": [
    {
      "title": "Granular Scenario Title (5-8 words)",
      "scenario": "The explicit professional bottleneck or real-world friction point.",
      "solution": "How this specific tool technically steps in to resolve the bottleneck.",
      "benefit": "Measurable, quantifiable, or highly logical operational payoff."
    }
  ],
  "expanded_faqs": [
    {"q": "Hardcore, high-intent query regarding feature, limitation, or exact pricing tier?", "a": "Direct, factual, crisp answer under 60 words. Numbers and constraints must strictly match input data."}
  ]
}
CRITICAL: Return ONLY raw valid JSON. Do not wrap the response in markdown blocks like \`\`\`json.
`;

// ==================== 4. 命令行输入交互封装 ====================
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

// ==================== 5. 调用 DeepSeek 大模型 ====================
async function processToolWithAI(tool) {
  // 🚀 【流量专家策略】：解除所有的 .slice() 限制，把最完整的上下文喂给大模型以生成深度内容
  const coreJobs = tool.for_jobs || [];
  
  const userInput = {
    name: tool.name,
    summary: tool.what_is_summary || tool.description,
    features: tool.feature || [], 
    pricing: tool.pricing || [], 
    original_faqs: tool.faq || [], // 融合老数据，防止长尾内容丢失
    jobs: coreJobs,
    use_cases: tool.use_cases || []
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.post(`${BASE_URL}/chat/completions`, {
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userInput) }
        ],
        response_format: { type: 'json_object' }, 
        temperature: 0.3 // 低随机性，确保数据和价格的绝对精准真实
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 深度内容生成耗时稍长，放宽到 60 秒超时控制
      });

      const resultText = response.data.choices[0].message.content;
      return JSON.parse(resultText);
    } catch (error) {
      console.warn(`[⚠️ 警告] 工具 ID ${tool.id} [${tool.name}] 处理遇到抖动 (第 ${attempt}/3 次尝试): ${error.message}`);
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
}

// ==================== 6. 核心调度引擎 ====================
async function main() {
  console.log('🤖 DeepSeek SEO 自动化洗稿洗数引擎就绪（CJS兼容架构）。');
  const input = await askQuestion('请输入需要运行的测试数量 (输入数字如 1 或 10 进行测试，直接回车则进入【全量自动跑批】): ');

  let mode = 'FULL'; 
  let limitCount = 0;

  if (input !== '') {
    limitCount = parseInt(input, 10);
    if (isNaN(limitCount) || limitCount <= 0) {
      console.error('❌ 输入非法，请输入正整数！');
      process.exit(1);
    }
    mode = 'TEST';
    console.log(`\n👨‍🔬 已进入【测试模式】，本次将按 ID 顺序连续调取 ${limitCount} 条【未处理】的数据进行洗稿。`);
  } else {
    console.log('\n🚀 已进入【全量跑批模式】，将自动并发清洗库中所有未处理数据...');
  }

  // ==================== ✨ 修复 PQueue CJS 构造函数漏洞 ====================
  let queue;
  const targetConcurrency = mode === 'TEST' ? 1 : CONCURRENCY;
  
  if (typeof PQueue === 'function') {
    queue = new PQueue({ concurrency: targetConcurrency });
  } else if (PQueue && typeof PQueue.default === 'function') {
    queue = new PQueue.default({ concurrency: targetConcurrency });
  } else {
    const RawPQueue = require('p-queue');
    const ActualConstructor = RawPQueue.default || RawPQueue;
    queue = new ActualConstructor({ concurrency: targetConcurrency });
  }
  // =======================================================================

  let processedCount = 0;

  while (true) {
    let takeCount = mode === 'TEST' ? limitCount : DEFAULT_BATCH_SIZE;
    
    const tools = await prisma.aiTool.findMany({
      where: { seo_version: 0 },
      take: takeCount,
      orderBy: { id: 'asc' }
    });

    if (tools.length === 0) {
      console.log('🎉 库中已没有符合 seo_version = 0 的数据，清洗流程顺利结束！');
      break;
    }

    console.log(`\n📦 成功捞取 ${tools.length} 条未处理的元数据进行加工...`);

    const promises = tools.map(tool => {
      return queue.add(async () => {
        try {
          // 1. 扔给大模型进行深度重写
          const aiData = await processToolWithAI(tool);
          
          // 2. 将深度洗稿的数据回写到 Postgres 数据库
          await prisma.aiTool.update({
            where: { id: tool.id },
            data: {
              seo_meta_title: aiData.seo_meta_title,
              seo_meta_description: aiData.seo_meta_description,
              seo_meta_keywords: aiData.seo_meta_keywords,
              expanded_about: aiData.expanded_about,
              built_for_details: aiData.built_for_details ?? Prisma.JsonNull,
              features_details: aiData.features_details ?? Prisma.JsonNull,
              expanded_usecases: aiData.expanded_usecases ?? Prisma.JsonNull,
              expanded_faqs: aiData.expanded_faqs ?? Prisma.JsonNull,
              seo_version: 1 
            }
          });

          processedCount++;
          console.log(`[✅ 成功] ID: ${tool.id} | Name: [${tool.name}] 深度改写成功并同步数据库。本轮累计: ${processedCount}`);
        } catch (error) {
          console.error(`[❌ 失败] ID: ${tool.id} | Name: [${tool.name}] 无法完成清洗。错误: ${error.message}`);
          await prisma.aiTool.update({
            where: { id: tool.id },
            data: { seo_version: -1 }
          });
        }
      });
    });

    await Promise.all(promises);

    if (mode === 'TEST') {
      console.log(`\n🎯 测试模式运行结束。已为您深度测试完 ${processedCount} 条记录。请去 pgAdmin 验货！`);
      break;
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('🚨 脚本异常中断：', e);
  await prisma.$disconnect();
  process.exit(1);
});