# Tool Facts Audit Report

审计日期：2026-06-11

审计范围：`sourceBuilder.js`、`sourceSelectors.js`、`prompts.js`、`validators.js`、`inputContracts.js`、Prisma schema，以及数据库中 Writesonic、WordHero、AIKTP、Junia AI、Contrast 的当前记录。

## Executive Summary

当前系统没有独立的 `buildToolFacts()`。实际链路是：

```text
AiTool + pricingPlans + claims + platforms
→ toolInclude()
→ fetchTool / fetchToolsByIds / fetchRankedTools
→ compactToolFacts()
→ aiInput.toolFacts / primaryTool / secondaryTool / alternativeTools
→ Prompt JSON
→ DeepSeek
```

总体判断：当前 Tool Facts 的**覆盖量较高，但证据质量偏低**。

- 五个抽查工具都有 description、summary、features、pros、cons、useCases 和 pricing。
- 五个工具都没有可用 `keyClaims`，也没有 platform facts。
- 大部分功能、优缺点和使用场景来自 `AiTool` 的旧数组字段，没有逐条 source、verifiedAt、confidence。
- pricing 主要是截断 HTML，而不是稳定、结构化、可引用的价格事实。
- DeepSeek 使用 compact Tool Facts；Validator 使用另一套更宽的 tool object，两者不是同一个事实契约。
- `featuresDetails`、`expandedUsecases`、`builtForDetails`、FAQ 等较丰富字段存在于数据库，但完全没有进入当前 Tool Facts。

因此，当前最主要的问题不是“字段不足”，而是：**事实缺少 provenance、事实粒度不一致、AI 输入与 Validator 语料不对称。**

## 1. 当前 buildToolFacts 流程

代码中没有名为 `buildToolFacts` 的函数。当前等价流程如下：

1. `toolInclude()` 查询工具关联数据：
   - `pricingPlans`：最多 6 条，包含 `source`。
   - `claims`：只查 ACTIVE、有 source、confidence >= 0.7、未过期的最多 12 条。
   - `platforms`：包含 `source`。
   - `toolCategories`：只取 categoryId。
2. `fetchToolsByIds()` 保持 brief 中工具 ID 的顺序。
3. `compactToolFacts()` 根据内容类型裁剪字段。
4. `buildSourceMap()` 独立生成来源列表。
5. `enforceInputContract()` 删除不属于当前内容类型的字段。
6. Prompt 只序列化 `sourceData.aiInput`。

BUYER_GUIDE 使用：

```js
compactToolFacts(tool, {
  relevanceTerms,
  maxClaims: 6,
  maxPlans: 4,
})
```

`relevanceTerms` 为 `targetKeyword + decisionCriteria.name`。这只影响 claims，不影响 features、pros、cons、useCases 或 pricing。

## 2. 当前 compactTool 流程

当前实际函数名为 `compactToolFacts()`。

裁剪规则：

| 字段 | 裁剪规则 |
|---|---|
| description | 最多 600 字符；Category/related tool 可降为 350 |
| whatIsSummary | 最多 600 字符 |
| features | 默认最多 10 条，每条 300 字符 |
| pros | 默认最多 6 条 |
| cons | 默认最多 6 条 |
| useCases | 默认最多 8 条 |
| platforms | 最多 8 条 |
| pricingSummary | 最多 5 条，每条 400 字符 |
| pricingPlans | 默认最多 4 个 |
| plan.features | 每个 plan 最多 6 条 |
| plan.rawText | 最多 400 字符 |
| keyClaims | 默认最多 6 条，每条 400 字符 |

不同类型的差异：

- BUYER_GUIDE：完整 pricing、claims、platforms。
- CATEGORY_GUIDE：无 pricing、无 claims，features 5、pros 3、cons 3、useCases 4。
- TUTORIAL：无 pricing；primary claims 最多 6，related claims 最多 3。
- COMPARISON：两个工具，各最多 4 plans、6 claims。
- ALTERNATIVE：每个工具最多 4 plans、5 claims。

## 3. 当前发送给 DeepSeek 的字段

BUYER_GUIDE 的每个 `toolFacts[]` 实际包含：

```json
{
  "id": 1,
  "handle": "tool-handle",
  "name": "Tool Name",
  "website": "https://official.example/",
  "description": "...",
  "whatIsSummary": "...",
  "features": [],
  "pros": [],
  "cons": [],
  "useCases": [],
  "platforms": [],
  "pricingSummary": [],
  "pricingPlans": [],
  "keyClaims": [],
  "isFree": false
}
```

Prompt 明确使用：

```js
JSON.stringify(sourceData.aiInput, null, 2)
```

PromptVersion 中的 `{{SOURCE_DATA_JSON}}` 和 `{{INPUT_CONTRACT_JSON}}` 也都替换为 `sourceData.aiInput`，不会注入完整 sourceData。

## 4. 当前用于 Validator 的字段

Validator 不直接使用上面的 compact `toolFacts`，而是使用 `sourceEnvelope.tools`。该对象由 `mapToolForValidation()` 创建：

```json
{
  "id": 1,
  "handle": "tool-handle",
  "name": "Tool Name",
  "description": "untruncated description",
  "website": "...",
  "pricing": [],
  "pricingPlans": [{
    "id": 1,
    "planName": "...",
    "price": 0,
    "currency": "USD",
    "billingInterval": "MONTHLY",
    "isFree": false,
    "hasTrial": false,
    "seatLimit": null,
    "usageLimit": null,
    "features": [],
    "rawText": "untruncated raw text",
    "verifiedAt": null
  }],
  "claims": [{
    "id": 1,
    "claimType": "...",
    "claimText": "...",
    "confidence": 0.9,
    "verifiedAt": null,
    "expiresAt": null,
    "status": "ACTIVE"
  }],
  "platforms": [],
  "pros": [],
  "cons": [],
  "features": [],
  "rating": 0,
  "monthlyVisits": 0,
  "whatIsSummary": "...",
  "tags": [],
  "useCases": [],
  "forJobs": [],
  "isFree": false
}
```

`buildToolCorpus()` 实际只使用：

- description
- whatIsSummary
- features
- pros
- cons
- claims.claimText
- pricingPlans.planName/rawText/features
- pricing

它不使用 rating、monthlyVisits、tags、useCases、forJobs、platforms。

关键缺陷：DeepSeek 看到的是截断 compact facts；Validator 对照的是更宽、未完全截断的数据。这不是同一个事实边界。

## 5. 当前 toolFacts 实际结构

当前结构的特点：

- `features/pros/cons/useCases` 是无 source 的自由文本数组。
- `keyClaims` 有 confidence，但没有 sourceId、sourceUrl、verifiedAt、expiresAt。
- `pricingPlans` 丢弃 price、currency、verifiedAt、source 信息，却保留 raw HTML。
- `pricingSummary` 与 `pricingPlans.rawText` 高度重复。
- `website` 被当作工具级官方来源，但不能证明每条 feature 或 pricing。
- `isFree` 是工具级布尔值，不能表达 free trial、free tier、限额或过期情况。

## 6. 字段数据库来源

| Tool Facts 字段 | 数据库来源 | 当前证据能力 |
|---|---|---|
| id | `AiTool.id` | 强 |
| handle | `AiTool.handle` | 强 |
| name | `AiTool.name` | 强 |
| website | `AiTool.website` | 官方 URL，但无验证时间 |
| description | `AiTool.description` | 无逐字段来源 |
| whatIsSummary | `AiTool.whatIsSummary` | 无逐字段来源 |
| features | `AiTool.feature` | 无逐条来源/时间/置信度 |
| pros | `AiTool.pros` | 编辑性判断，无来源 |
| cons | `AiTool.cons` | 编辑性判断，无来源 |
| useCases | `AiTool.useCases` | 无逐条来源 |
| platforms | `ToolPlatform.platform` | 表可关联 Source，但 compact 后丢失 source |
| pricingSummary | `AiTool.pricing` | 旧 HTML/string 数组，无来源 |
| pricingPlans | `ToolPricingPlan` | 有 Source/verifiedAt，但 compact 后丢失 |
| keyClaims | `ToolClaim` | 有 Source/verifiedAt/expiresAt/confidence，但 compact 后只保留 type/text/confidence |
| isFree | `AiTool.isFree` | 粗粒度，可能与 plan 状态不一致 |

## 7. 最容易导致 unsupported feature claim 的字段

### 7.1 features

最高风险。Validator 专门检测以下表达：语言数量、rank tracking、keyword research、Semrush、Surfer SEO、Zapier、WordPress、integrates with、plagiarism-free。

问题在于 AI 常做语义改写。例如原始事实是 “Easy posting to multiple WordPress websites”，AI 写成 “integrates with WordPress”。Validator 会检测到 `integrates with`，但 corpus 未必包含这个精确短语，于是产生误报。

### 7.2 pros

pros 混合了功能、效果和营销结论。例如：

- “Helps improve SEO rankings”
- “Creates plagiarism-free content”
- “Significantly increases content creation speed”

AI 很容易把软性优点改写为确定性能力或效果承诺。

### 7.3 whatIsSummary / description

两者通常是长段营销摘要，包含多个功能和效果。AI 会把摘要中的次要句子提升为主要 feature，Validator 又只做少量正则匹配，不是完整语义校验。

### 7.4 pricingPlans.rawText

含截断 HTML、套餐名、数量限制和金额。AI 可能从不完整 HTML 推断套餐边界，产生不受支持的 seat、credit 或 plan 断言。

## 8. 最容易导致 hallucination 的字段

风险排序：

1. `pricingSummary`：原始 HTML 被截断，包含具体金额，且可能过期。
2. `pricingPlans.rawText`：重复、截断、planName 归一化错误，例如多个不同套餐都映射为 `Pro` 或 `Vendor pricing`。
3. `pros`：主观结论容易被写成经过验证的产品事实。
4. `whatIsSummary`：长摘要会诱导模型合并、扩展未明确关联的能力。
5. `features`：没有 source 和 verifiedAt，无法区分当前功能与历史功能。
6. `isFree`：无法区分 free plan、free trial、曾经免费或部分免费。
7. `useCases`：AI 容易从 use case 反推不存在的具体 workflow 功能。
8. 空 `keyClaims`：缺少高质量事实锚点时，模型只能依赖旧描述和营销数组。

## 9. 推荐 ToolFacts V1 Schema

```json
{
  "tool": {
    "id": 1,
    "handle": "writesonic",
    "name": "Writesonic",
    "officialUrl": "https://writesonic.com/"
  },
  "summary": {
    "value": "Concise neutral description",
    "sourceRef": "source:123",
    "verifiedAt": "2026-06-01"
  },
  "capabilities": [
    {
      "id": "capability:article-writer",
      "label": "AI article writer",
      "value": "Generates article drafts",
      "sourceRefs": ["source:123"],
      "confidence": 0.9,
      "verifiedAt": "2026-06-01",
      "expiresAt": null
    }
  ],
  "limitations": [
    {
      "value": "Usage limits vary by plan",
      "sourceRefs": ["source:pricing"],
      "confidence": 0.8
    }
  ],
  "useCases": [
    {
      "label": "Long-form blog drafting",
      "evidenceCapabilityIds": ["capability:article-writer"]
    }
  ],
  "pricing": {
    "pricingModel": "FREEMIUM",
    "hasFreeTier": true,
    "hasTrial": true,
    "plans": [
      {
        "name": "Basic",
        "billingInterval": "MONTHLY",
        "price": 16,
        "currency": "USD",
        "usageLimit": "...",
        "sourceRef": "source:pricing",
        "verifiedAt": "2026-06-01"
      }
    ],
    "pricingDisclaimer": "Verify current pricing on the official site."
  },
  "platforms": [
    {
      "name": "Web",
      "sourceRef": "source:123",
      "verifiedAt": "2026-06-01"
    }
  ],
  "quality": {
    "completenessScore": 0.75,
    "sourceCoverage": 0.55,
    "warnings": ["No sourced limitation facts"]
  },
  "sourceMap": {
    "source:123": {
      "url": "https://...",
      "sourceType": "OFFICIAL_SITE",
      "retrievedAt": "2026-06-01"
    }
  }
}
```

V1 的原则：AI 输入和 Validator 必须使用同一个 V1 对象；每条可输出事实必须能关联 sourceRef。

## 10. 当前数据库能够支撑多少字段

对 V1 建议结构评估：

| 能力 | 当前可支撑程度 |
|---|---|
| tool identity | 完整 |
| official URL | 有 URL，缺稳定 verifiedAt 映射 |
| neutral summary | 有文本，缺 sourceRef |
| capabilities | 有 feature/claims/details，只有 claims 原生支持来源 |
| limitations | 有 cons，但无来源；可部分迁移到 claims |
| use cases | 有 useCases/expandedUsecases，但无逐条来源 |
| structured pricing | 表结构完整度较高，可支撑 |
| platforms | 表结构和来源关系可支撑 |
| confidence/expiry | ToolClaim 可支撑 |
| source map | Source 表可支撑 |
| quality score | 需要运行时计算，无需改表 |

按 V1 顶层约 10 个能力域计算：数据库可直接或部分支撑 9 个；真正达到“逐事实可追溯”的只有 identity、claims、pricing plans、platforms、source map 约 5 个域。

## 11. 需要新增的映射

不一定需要立即新增数据库字段，优先新增映射层：

1. `AiTool.feature` → capability candidates；只有匹配 ToolClaim 或官方 source 才标为 verified。
2. `AiTool.cons` → limitation candidates；不能直接作为硬事实。
3. `AiTool.useCases` / `expandedUsecases` → useCase，并关联支持该用例的 capability IDs。
4. `featuresDetails` → 结构化 capability details，目前完全未使用。
5. `builtForDetails` / `forJobs` → audienceFit，目前完全未进入 AI input。
6. `ToolPricingPlan.price/currency/verifiedAt/source` → V1 pricing；停止发送 raw HTML。
7. `ToolClaim.source/verifiedAt/expiresAt/valueJson` → V1 sourced facts；当前 compact 时信息丢失。
8. `ToolPlatform.source/verifiedAt` → V1 platforms。
9. `AiTool.lastVerifiedAt/pricingVerifiedAt` → freshness warnings。
10. `AiTool.faq/expandedFaqs` → 仅作为 FAQ 候选，不应当自动视为事实。
11. `toolInfoReview/monthVisitedCount/rank` → selection metadata，不应进入 editorial facts。
12. 生成 `factId` 和 `sourceRef`，使 Validator 验证引用事实而不是只做正则字符串匹配。

## 12. 五个工具实际发送给 DeepSeek 的 toolFacts

以下快照按当前 BUYER_GUIDE 参数生成：description 600 字符、features 10、pros 6、cons 6、useCases 8、pricingSummary 5、pricingPlans 4、claims 6。Claims 使用 AI writing/SEO/quality/integration/pricing 相关 relevance terms。数据库查询日期为 2026-06-11。

除 pricing 外，下面列出的字段和值就是 compact payload。为避免文档被数千字符的重复 HTML 淹没，`pricingSummary` 与 `pricingPlans` 在快照中以可读语义表示；**实际发送值是数据库 HTML 字符串经 400 字符截断后的原文**，并非这些可读标签。该差异本身是本报告指出的质量问题。

共同现状：五个工具的 `keyClaims=[]`、`platforms=[]`。

### Writesonic

```json
{
  "id": 1,
  "handle": "writesonic",
  "name": "Writesonic",
  "website": "https://writesonic.com/",
  "description": "AI writer for SEO content, ads, blogs, paraphrasing, and AI chatbot/image generation.",
  "whatIsSummary": "Writesonic is an AI writer and content generation platform designed to create SEO-friendly and plagiarism-free content for various marketing needs, including blogs, Facebook ads, Google ads, Shopify, emails, and websites. It aims to automate SEO and content workflows, reduce costs, and boost organic traffic. The platform offers a comprehensive suite of AI tools, including a paraphrasing tool, text expander, article summarizer, product description generator, and specialized AI Agents for SEO, content, and site audits. Writesonic also features Chatsonic, an AI chatbot with advanced capabilities ...",
  "features": ["AI Article & Blog Writer", "Paraphrasing Tool", "AI Chat Assistant (Chatsonic)", "AI Image Generator (Photosonic)", "SEO AI Agents (for research, content, site audits, GEO)", "Ad & Landing Page Copy Generation", "Chrome Extension", "Text Expander", "Article Summarizer", "Product Descriptions Generator"],
  "pros": ["Creates SEO-optimized and plagiarism-free content.", "Significantly increases content creation speed (up to 10X faster).", "Offers a wide range of content types and marketing tools.", "Includes advanced AI tools like Chatsonic (with Google Search, voice, image generation) and Photosonic.", "Integrates with popular SEO tools (Surfer SEO, Semrush) and publishing platforms (WordPress, Zapier).", "Supports 25+ languages."],
  "cons": ["A 'fair usage policy' applies to 'unlimited' generations, implying potential limits.", "Some advanced features are exclusive to paid plans.", "Article credits do not roll over to the next month."],
  "useCases": ["Creating long-form blogs and articles (1500+ words)", "Rephrasing entire articles or sentences instantly", "Crafting engaging product descriptions for e-commerce stores", "Generating high-performing Facebook and Google ad copy", "Developing high-converting landing pages", "Brainstorming catchy blog titles and new startup ideas", "Writing sales emails, essays, reports, and ebooks", "Improving Google ranking and boosting sales for e-commerce businesses"],
  "platforms": [],
  "pricingSummary": ["HTML pricing card: Free Trial", "HTML pricing card: Basic $16/month", "HTML pricing card: Lite $39/month", "HTML pricing card: Standard $79/month", "HTML pricing card: Professional $199/month"],
  "pricingPlans": ["Free or free tier / FREE", "Enterprise / MONTHLY", "Pro / MONTHLY", "Pro / MONTHLY"],
  "keyClaims": [],
  "isFree": true
}
```

主要风险：pros 同时命中 plagiarism-free、Surfer SEO、Semrush、WordPress、Zapier、25+ languages 等 Validator 高风险模式，但这些都没有 claim/source。

### WordHero

```json
{
  "id": 23,
  "handle": "wordhero",
  "name": "WordHero",
  "website": "https://wordhero.co/",
  "description": "AI content writing software for blogs, social media, emails, and more.",
  "whatIsSummary": "WordHero is an AI content writing software designed to help users create original blog posts, social media content, emails, and more in seconds. It is marketed as the best AI writer for blogs, offering high-quality content creation quickly and efficiently. WordHero utilizes AI technology to generate SEO-friendly, human-like content, adapting to the user's writing style to maintain authenticity and clarity. It is trusted by over 30,000 business owners, marketers, writers, and content creators.",
  "features": ["AI-powered content generation", "SEO optimization tools", "Adaptation to user's writing style", "Pre-built templates", "WordHero Art for AI image generation", "Long-Form Editor with Keyword Assistant", "WordHero Chat with Wizard Mode", "Access to Prompt Library", "Writes fluently in 108 languages"],
  "pros": ["Instantly creates full blog posts in one click", "Writes in a unique, consistent voice", "Offers built-in SEO tools for optimized content", "Adapts content based on context for better relevance", "Provides pre-built templates for various content types", "Automatically structures posts for readability and flow"],
  "cons": ["Requires a human to edit the outputs", "Fair use policy applies to unlimited features", "Enhanced Mode limits are governed by tokens", "Introductory prices will increase"],
  "useCases": ["Generating blog posts", "Creating social media content", "Writing marketing copy", "Drafting emails", "Generating ad copy", "Creating AI images for social media and blogs"],
  "platforms": [],
  "pricingSummary": ["HTML pricing card: Creator Monthly $49/month", "HTML pricing card: Infinity Monthly $99/month", "HTML pricing card: Creator Yearly $29/month", "HTML pricing card: Infinity Yearly $79/month"],
  "pricingPlans": ["Pro / MONTHLY", "Pro / MONTHLY", "Pro / MONTHLY", "Pro / MONTHLY"],
  "keyClaims": [],
  "isFree": false
}
```

主要风险：`108 languages` 是明确数字断言，但没有 sourced claim；四个不同套餐全部被归一化为 `Pro / MONTHLY`，丢失了 monthly/yearly 语义。

### AIKTP

```json
{
  "id": 6,
  "handle": "ai-keywords-to-posts",
  "name": "AIKTP",
  "website": "https://aiktp.com/",
  "description": "AI-powered content writing and WordPress management system for SEO-optimized content.",
  "whatIsSummary": "Aiktp.com is an AI-powered content writing and WordPress management system. It helps users create high-quality, SEO-optimized content quickly and easily based on keywords and outlines. With features like AI-powered editor, SEO optimization tools, and easy posting to multiple WordPress websites, AIKTP aims to save time, save money, and help users rank higher in search results.",
  "features": ["AI-powered content writing", "Bulk WordPress management", "SEO optimization tools", "AI-powered editor", "Easy posting to multiple WordPress websites", "Keyword Suggestions", "Keyword Grouper", "AI Image creation", "Multi Wordpress Post", "Schedule Post"],
  "pros": ["Saves time and money on content creation", "Helps improve SEO rankings", "Easy to use interface", "Supports multiple ways to write articles with AI", "Manages unlimited websites", "Integrates image and video search tools"],
  "cons": ["Requires a subscription for full access", "Content quality depends on the quality of input keywords/outlines", "Reliance on AI may reduce originality if not carefully reviewed"],
  "useCases": ["Creating SEO-optimized blog posts", "Managing multiple WordPress websites", "Generating product reviews and toplists", "Paraphrasing existing content", "Bulk writing articles based on keywords"],
  "platforms": [],
  "pricingSummary": ["HTML pricing card: Free $0/month", "HTML pricing card: Starter $9/month", "HTML pricing card: Grow $19/month", "HTML pricing card: Pro $29/month", "HTML pricing card: Corp $49/month"],
  "pricingPlans": ["Free or free tier / FREE", "Vendor pricing / MONTHLY", "Vendor pricing / MONTHLY", "Pro / MONTHLY"],
  "keyClaims": [],
  "isFree": true
}
```

主要风险：WordPress、integration、unlimited websites 和 SEO ranking 都来自无来源数组；pricing plan 名称大量退化为 `Vendor pricing`。

### Junia AI

```json
{
  "id": 4,
  "handle": "junia-ai",
  "name": "Junia AI",
  "website": "https://www.junia.ai/",
  "description": "AI content creation platform for blogs, emails, ads, and SEO-friendly articles.",
  "whatIsSummary": "Junia AI is an AI-powered content creation platform designed to help users generate high-quality, original content for blogs, emails, and ads quickly. It offers features like AI-generated images, SEO research, a smart AI editor with summarization, paraphrasing, translation, and citation tools. Junia AI stands out with its ability to generate conversational dialogue, short-form content, and SEO-friendly long-form content, including articles exceeding 3000 words. It also offers personalized AI with brand voice capabilities...",
  "features": ["AI-powered content generation", "AI-generated images", "SEO research and optimization", "Smart AI editor with summarization and paraphrasing", "Brand voice personalization", "AI Chatbot", "50+ AI Templates"],
  "pros": ["Comprehensive content creation solution", "Generates high-quality, plagiarism-free content", "Offers a wide range of AI templates", "Includes SEO optimization features", "Allows for brand voice personalization", "Affordable pricing with a free trial"],
  "cons": ["Unused Workflow Runs, AI images, and words don't carry over to the next month", "Word limits on some plans", "Some advanced features may require higher-tier plans"],
  "useCases": ["Generating long-form blog posts", "Creating persuasive ad copy", "Writing personalized sales emails", "Summarizing files", "Creating images for blog posts", "Rewriting content in different languages"],
  "platforms": [],
  "pricingSummary": ["HTML pricing card: Free", "HTML pricing card: Starter $27/month", "HTML pricing card: Advanced $47/month"],
  "pricingPlans": ["Free or free tier / FREE", "Vendor pricing / MONTHLY", "Team / MONTHLY"],
  "keyClaims": [],
  "isFree": true
}
```

主要风险：3000-word、50+ templates、plagiarism-free 和 free trial 都是具体可验证断言，但没有 claims/source；`Advanced` 被映射为 `Team`。

### Contrast

```json
{
  "id": 5,
  "handle": "getcontrast-io",
  "name": "Contrast",
  "website": "https://getcontrast.io/",
  "description": "Contrast is a webinar platform with engaging features and content repurposing tools.",
  "whatIsSummary": "Contrast is a webinar platform designed to host engaging webinars that people watch till the end. It offers features like engaging Q&A sessions, animations, branded webinars, modern chat experiences, and dynamic layouts. Contrast provides tools for repurposing webinar content, including summaries, blogs, clips, and newsletters. It offers a free plan and paid plans with features like CRM integrations, viewer engagement analytics, registration pages, and on-demand webinars.",
  "features": ["Engaging Q&A sessions", "Animations", "Branded webinars", "Modern chat experience", "Dynamic layouts", "Content repurposing with AI", "CRM integrations", "Viewer engagement analytics", "Registration pages", "On-demand webinars"],
  "pros": ["Engaging features to keep audience attention", "AI-powered content repurposing", "Easy to use and fast setup", "Branding options for a professional look", "CRM integrations for lead management"],
  "cons": ["Limited registrants on the free plan", "Video storage limits on some plans", "Premium features require a paid plan"],
  "useCases": ["Hosting engaging webinars for marketing and sales", "Repurposing webinar content for blog posts and social media", "Branding webinars for a consistent brand experience", "Integrating webinars with CRM systems for lead generation"],
  "platforms": [],
  "pricingSummary": ["HTML pricing card: Free $0/month", "HTML pricing card: Pro $159/month", "HTML pricing card: Premium custom pricing"],
  "pricingPlans": ["Free or free tier / FREE", "Pro / MONTHLY", "Team / CUSTOM"],
  "keyClaims": [],
  "isFree": true
}
```

主要风险：虽然 Contrast 数据完整，但它本质是 webinar/repurposing 工具。若仅按 `AI Blog Generator` 分类进入写作工具 Buyer Guide，容易造成推荐语义偏离。分类关系本身需要参与 tool fit 校验。

## Final Assessment

当前 Tool Facts 可用于生成“有结构的草稿”，但不足以稳定支撑“逐项可验证的产品事实”。建议优先级：

1. 停止向 AI 发送 raw HTML pricing。
2. 统一 AI 与 Validator 使用同一个 ToolFacts V1。
3. 为 feature/pro/con/useCase 增加 sourceRef 或降级为 unsourcedCandidate。
4. 将 ToolClaim 的 source、时间、expiry 保留到 compact contract。
5. 增加事实 completeness/source coverage 指标，低覆盖工具不得生成确定性 feature claim。
6. 将 category fit 纳入 selected tool validation，避免 Contrast 这类边缘分类工具被当作通用 AI writer 推荐。
