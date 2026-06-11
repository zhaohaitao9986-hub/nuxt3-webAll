# ToolFacts V1 Design

设计日期：2026-06-11

状态：Design only。本阶段不修改 Prompt、DeepSeek、前端页面或数据库结构。

## Design Goals

ToolFacts V1 解决四个问题：

1. DeepSeek 与 Validator 使用同一份事实对象。
2. 每条事实明确区分 verified、unsourced、marketing。
3. AI 是否允许引用由机器可执行字段决定，而不是由字段名称或 Prompt 猜测。
4. pricing、claims、platforms 保留 source、confidence 和 freshness，不再退化成 raw HTML。

非目标：

- V1 不改变现有内容输出 JSON。
- V1 不要求立即修改 Prisma schema。
- V1 不把旧 `feature/pros/cons/useCases` 自动升级为 verified facts。
- V1 不使用访问量、rank 或评分作为产品能力证据。

## 1. ToolFacts V1 Schema

### 1.1 Root Schema

```json
{
  "schemaVersion": "tool-facts-v1",
  "toolIdentity": {},
  "summaryFacts": [],
  "capabilityFacts": [],
  "limitationFacts": [],
  "useCaseFacts": [],
  "pricingFacts": {},
  "platformFacts": [],
  "companyFacts": [],
  "evidenceFacts": {},
  "qualityFacts": {}
}
```

### 1.2 Shared Fact Shape

除 identity 和 quality 外，单条事实统一使用：

```json
{
  "factId": "tool:1:capability:article-writer",
  "factType": "CAPABILITY",
  "label": "AI article writer",
  "value": "Generates article drafts from supplied topics and instructions.",
  "classification": "verifiedFact",
  "citationPolicy": "ALLOW",
  "sourceRefs": ["source:123"],
  "confidence": 0.9,
  "verifiedAt": "2026-06-01T00:00:00.000Z",
  "expiresAt": null,
  "freshness": "CURRENT",
  "origin": {
    "table": "tool_claims",
    "field": "claim_text",
    "recordId": 456
  },
  "warnings": []
}
```

枚举：

```text
classification: verifiedFact | unsourcedFact | marketingFact
citationPolicy: ALLOW | QUALIFY | FORBID
freshness: CURRENT | STALE | UNKNOWN | EXPIRED
```

### 1.3 toolIdentity

```json
{
  "toolId": 1,
  "handle": "writesonic",
  "name": "Writesonic",
  "officialUrl": "https://writesonic.com/",
  "status": "ONLINE",
  "categoryIds": [1, 52, 341]
}
```

Identity 可用于命名、链接和工具引用，不代表官网支持所有后续事实。

### 1.4 summaryFacts

保存中性定义和旧摘要。最多建议 2 条：

- sourced neutral summary：`ALLOW`。
- legacy description/whatIsSummary：默认 `QUALIFY` 或 `FORBID`。

禁止将一个长营销摘要拆成多个 verified capabilities，除非每个能力有独立证据。

### 1.5 capabilityFacts

描述工具能做什么。建议字段：

```json
{
  "factId": "tool:1:capability:paraphrasing",
  "factType": "CAPABILITY",
  "label": "Paraphrasing",
  "value": "Provides a paraphrasing workflow.",
  "classification": "unsourcedFact",
  "citationPolicy": "QUALIFY",
  "sourceRefs": [],
  "confidence": 0.45,
  "origin": { "table": "ai_tools", "field": "feature", "arrayIndex": 1 }
}
```

同义能力应规范化为稳定 capability key，避免 Validator 依赖字符串完全一致。

### 1.6 limitationFacts

保存已知限制、计划约束和人工审核建议。

- 来自 sourced ToolClaim 或 ToolPricingPlan 的限制可为 `verifiedFact`。
- 来自 `AiTool.cons` 的内容默认 `unsourcedFact / QUALIFY`。
- 推测性评价，如“输出质量可能较差”，没有来源时必须 `FORBID`。

### 1.7 useCaseFacts

```json
{
  "factId": "tool:1:use-case:blog-drafting",
  "factType": "USE_CASE",
  "label": "Long-form blog drafting",
  "value": "Can be evaluated for drafting long-form blog content.",
  "classification": "unsourcedFact",
  "citationPolicy": "QUALIFY",
  "supportsCapabilityFactIds": ["tool:1:capability:article-writer"],
  "sourceRefs": []
}
```

Use case 不得反向证明具体功能。只有存在 capability 支撑时，才允许写成明确适用场景。

### 1.8 pricingFacts

```json
{
  "pricingModel": "FREEMIUM",
  "hasFreeTier": true,
  "hasTrial": true,
  "currencyCoverage": ["USD"],
  "plans": [
    {
      "factId": "tool:1:pricing:basic-monthly",
      "planName": "Basic",
      "price": 16,
      "currency": "USD",
      "billingInterval": "MONTHLY",
      "isFree": false,
      "hasTrial": false,
      "seatLimit": 1,
      "usageLimit": "10 AI Agent generations/month",
      "features": [],
      "classification": "verifiedFact",
      "citationPolicy": "ALLOW",
      "sourceRefs": ["source:pricing:1"],
      "verifiedAt": "2026-06-01T00:00:00.000Z",
      "freshness": "CURRENT"
    }
  ],
  "warnings": ["Verify current pricing before publication"]
}
```

V1 禁止 `rawText` 和 HTML 进入 AI contract。解析失败的旧 pricing 进入 evidence diagnostics，不进入 plans。

### 1.9 platformFacts

```json
{
  "factId": "tool:1:platform:web",
  "factType": "PLATFORM",
  "label": "Web",
  "value": "Available as a web application.",
  "classification": "verifiedFact",
  "citationPolicy": "ALLOW",
  "sourceRefs": ["source:123"],
  "verifiedAt": "2026-06-01T00:00:00.000Z"
}
```

没有 ToolPlatform 记录时，不从 website 自动推断 Web、Chrome extension、mobile app 或 API。

### 1.10 companyFacts

```json
{
  "factId": "tool:1:company:vendor",
  "factType": "COMPANY",
  "label": "Vendor information",
  "value": "Vendor-provided company description.",
  "classification": "marketingFact",
  "citationPolicy": "FORBID",
  "sourceRefs": [],
  "origin": { "table": "ai_tools", "field": "company_info" }
}
```

当前 `companyInfo` 缺少逐项来源，只能作为后台辅助信息。公司成立年份、总部、客户数、融资、用户数等不得引用，除非迁移为 sourced ToolClaim。

### 1.11 evidenceFacts

`evidenceFacts` 是 source registry，不是可直接写入正文的事实：

```json
{
  "source:123": {
    "sourceId": 123,
    "url": "https://vendor.example/pricing",
    "domain": "vendor.example",
    "title": "Pricing",
    "sourceType": "OFFICIAL_PRICING",
    "status": "ACTIVE",
    "retrievedAt": "2026-06-01T00:00:00.000Z",
    "lastCheckedAt": "2026-06-10T00:00:00.000Z",
    "isOfficialDomain": true
  }
}
```

每个 `sourceRef` 必须能解析到 evidenceFacts 中的一条记录。

### 1.12 qualityFacts

```json
{
  "sourceCoverageScore": 0.42,
  "factCompletenessScore": 0.78,
  "verifiedFactCount": 4,
  "unsourcedFactCount": 22,
  "marketingFactCount": 5,
  "citableFactCount": 12,
  "staleFactCount": 0,
  "expiredFactCount": 0,
  "missingDomains": ["platformFacts", "companyFacts"],
  "warnings": [
    "Most capability facts are unsourced",
    "No sourced platform facts",
    "Pricing freshness is unknown"
  ],
  "aiUsagePolicy": "LIMITED"
}
```

`aiUsagePolicy`：

- `FULL`：coverage >= 0.75 且 completeness >= 0.75。
- `LIMITED`：coverage >= 0.35 且 completeness >= 0.5。
- `IDENTITY_ONLY`：低于 LIMITED；仅允许工具名称、链接和高度限定的摘要。

## 2. 当前数据库字段映射

| 数据库字段 | V1 目标 | 默认分类 | 默认引用策略 | 说明 |
|---|---|---|---|---|
| `AiTool.description` | `summaryFacts[]` | unsourcedFact | QUALIFY | 短描述，无 source |
| `AiTool.whatIsSummary` | `summaryFacts[]` | marketingFact | FORBID | 常含复合营销断言；仅在清洗后降为 unsourced |
| `AiTool.feature[]` | `capabilityFacts[]` | unsourcedFact | QUALIFY | 每个数组项生成独立 factId |
| `AiTool.pros[]` | capability/summary/quality candidate | marketingFact | FORBID | 不直接进入 capability；先分类和去效果承诺 |
| `AiTool.cons[]` | `limitationFacts[]` | unsourcedFact | QUALIFY | 仅允许“数据库记录称/可能”式限定表达 |
| `AiTool.useCases[]` | `useCaseFacts[]` | unsourcedFact | QUALIFY | 必须关联 capability fact 才可明确引用 |
| `ToolClaim` | 对应 summary/capability/limitation/company fact | verifiedFact | ALLOW | 需 ACTIVE、source、confidence、expiry 检查 |
| `ToolPricingPlan` | `pricingFacts.plans[]` | verifiedFact 或 unsourcedFact | ALLOW/QUALIFY | 有有效 source 且 freshness 合格才 verified |
| `ToolPlatform` | `platformFacts[]` | verifiedFact 或 unsourcedFact | ALLOW/QUALIFY | 有 source 才 verified |
| `Source` | `evidenceFacts` | evidence | 不直接引用 | source registry |

辅助映射：

| 数据库字段 | V1 目标 | 备注 |
|---|---|---|
| `AiTool.id/handle/name/website/toolStatus` | `toolIdentity` | identity |
| `AiTool.companyInfo` | `companyFacts` | 默认 marketing/FORBID |
| `AiTool.isFree` | pricing fallback warning | 不作为 verified pricing |
| `AiTool.lastVerifiedAt` | quality freshness | 工具级粗粒度 |
| `AiTool.pricingVerifiedAt` | pricing freshness fallback | plan verifiedAt 优先 |
| `AiTool.featuresDetails` | capability candidate details | 需要定义 JSON parser |
| `AiTool.expandedUsecases` | useCase candidates | 需要定义 JSON parser |
| `AiTool.builtForDetails/forJobs` | audience-fit candidates | 不属于本 V1 顶层必需域，可附加到 useCaseFacts |
| `AiTool.rank/monthVisitedCount/toolInfoReview` | selection metadata | 禁止进入 editorial fact contract |

## 3. Fact Classification

### verifiedFact

必须同时满足：

1. 有非空 `sourceRefs`。
2. 每个 sourceRef 可在 evidenceFacts 中解析。
3. Source 为 ACTIVE。
4. ToolClaim 必须 status=ACTIVE、confidence >= 0.7、未过期。
5. Pricing/Platform 必须关联 source；verifiedAt 不为空时不得过期。
6. 事实 value 不超出 source record 对应的数据库字段。

verified 不等于“永远正确”，只表示当前数据库中存在满足政策的证据链。

### unsourcedFact

满足以下任一条件：

- 来自 `description/feature/cons/useCases`，但没有 source。
- Pricing/Platform 有结构化记录但没有 source。
- ToolClaim confidence 不足或缺 verifiedAt，但未被判为 marketing。

允许以限定语言使用，不得写具体数字、绝对结论或第三方集成声明。

### marketingFact

以下内容默认归类为 marketing：

- `whatIsSummary` 中的“best、high-quality、plagiarism-free、boost rankings、10X faster”等效果承诺。
- `pros` 中的性能、质量、排名、速度、可信度和客户规模结论。
- “trusted by N users”“human-like”“guaranteed”“affordable”等主观或社会证明。
- 无 source 的具体数量、价格、语言数、模板数、客户数。

marketingFact 可以保留供人工审核、事实迁移和风险检测，但不允许 AI 引用。

## 4. 允许 AI 引用的字段

### ALLOW

- `toolIdentity.name/handle/officialUrl`。
- citationPolicy=ALLOW 的 verified summaryFacts。
- citationPolicy=ALLOW 的 capabilityFacts、limitationFacts、useCaseFacts。
- 有 source、freshness 合格的 pricing plans。
- 有 source 的 platformFacts。
- 有 source 的 companyFacts。

### QUALIFY

unsourcedFact 仅允许以下形式：

- “The database lists X among the tool's capabilities.”
- “It may fit workflows such as X.”
- “A stated limitation is X; verify current behavior with the vendor.”

QUALIFY 事实禁止：

- 具体价格、额度、席位、语言数、模板数。
- 明确第三方集成。
- 性能、排名、准确率、速度、原创性、安全性承诺。
- 将 use case 写成已验证 capability。

## 5. 禁止 AI 引用的字段

- citationPolicy=FORBID 的所有 facts。
- marketingFact。
- `AiTool.pricing` 原始 HTML/string。
- `ToolPricingPlan.rawText`。
- 过期 ToolClaim 或 Source status 非 ACTIVE 的证据。
- 没有 source 的数字断言。
- `rank/monthVisitedCount/toolInfoReview/collectedCount`。
- `socialEmail/socialLinks`。
- `companyInfo` 原文。
- `seoMetaTitle/seoMetaDescription/seoMetaKeywords`，避免循环生成。
- `faq/expandedFaqs` 中未经事实校验的答案。
- `pros` 原文，除非转换为 sourced verified fact。
- derived selection score、factScore、category rank。

## 6. Quality Scores

### 6.1 sourceCoverageScore

衡量“允许 AI 使用的事实中，有多少具备有效证据”，不是 Source 数量。

事实域权重：

```text
summaryFacts      10
capabilityFacts   30
limitationFacts   15
useCaseFacts      15
pricingFacts      20
platformFacts      5
companyFacts       5
total            100
```

单条事实 coverage：

```text
1.0 = verifiedFact + ACTIVE source + CURRENT freshness
0.8 = verifiedFact + ACTIVE source + UNKNOWN freshness
0.4 = unsourcedFact + QUALIFY
0.0 = marketingFact / FORBID / expired / broken sourceRef
```

域分数：

```text
domainCoverage = weightedAverage(factCoverage within domain)
```

总分：

```text
sourceCoverageScore =
  Σ(domainWeight × domainCoverage) / Σ(applicableDomainWeight)
```

若某域完全没有事实，该域不从 coverage 分母移除，而是记 0；否则可以通过删除低质量域虚增分数。

### 6.2 factCompletenessScore

衡量是否具备生成当前内容所需的事实域，与是否有来源分开。

基础域目标：

| 域 | 满分要求 |
|---|---|
| identity | name、handle、officialUrl |
| summary | 至少 1 条中性 summary |
| capabilities | 至少 5 条非重复 capability |
| limitations | 至少 2 条 limitation |
| use cases | 至少 3 条 use case，且至少 2 条有关联 capability |
| pricing | pricingModel + 至少 1 个结构化 plan，或明确 unavailable |
| platforms | 至少 1 条，或明确 unknown |
| company | 至少 1 条 sourced fact，或明确 unavailable |
| evidence | 所有 sourceRef 可解析 |

域完整度：

```text
identity       10%
summary        10%
capabilities   25%
limitations    10%
useCases       15%
pricing        15%
platforms       5%
company         3%
evidence        7%
```

```text
factCompletenessScore = Σ(domainWeight × domainCompletionRatio)
```

内容类型可增加 profile：

- BUYER_GUIDE：capability、limitation、use case、pricing 权重提高。
- CATEGORY_GUIDE：工具事实只作示例，可降低 pricing/company 权重。
- TUTORIAL：capability、platform、workflow-supporting facts 权重提高。
- COMPARISON：两个工具必须采用同一评分 profile；缺失域不得被错误解释为差异。
- ALTERNATIVE：use case、limitation、pricing 和 audience fit 权重提高。

## 7. Validator 与 DeepSeek 共用同一个 V1

### 7.1 Single Build

```text
Prisma rows
→ buildToolFactsV1(rawTool, profile)
→ validateToolFactsV1(v1)
→ freeze/serialize V1
→ AI input toolFacts
→ Validator allowed-fact index
```

禁止再次调用 `mapToolForValidation(rawTool)` 创建第二份事实对象。

### 7.2 Same Object, Different Views

可从同一个 V1 派生两个只读 view：

```text
aiView:
  toolIdentity
  ALLOW facts
  selected QUALIFY facts
  pricing without rawText
  evidenceFacts referenced by retained facts
  qualityFacts

validatorView:
  complete V1
  factId index
  normalized aliases
  citation policy
  sourceRef index
```

两个 view 必须保存相同 `toolFactsHash`：

```text
SHA-256(canonical JSON of ToolFacts V1)
```

validationJson 记录：

```json
{
  "toolFactsSchemaVersion": "tool-facts-v1",
  "toolFactsHashes": { "1": "sha256:..." },
  "sourceCoverageScores": { "1": 0.42 },
  "factCompletenessScores": { "1": 0.78 },
  "citedFactIds": [],
  "unsupportedClaims": []
}
```

### 7.3 Validation Strategy

V1 Validator 不再只检查少量正则短语。推荐顺序：

1. 验证输出工具 ID/handle 属于 contract。
2. 从工具相关段落抽取候选 claim。
3. 将 claim 匹配到 factId 或 capability alias。
4. fact citationPolicy=ALLOW：通过。
5. citationPolicy=QUALIFY：检查正文是否包含限定语。
6. citationPolicy=FORBID 或无匹配 fact：unsupported claim。
7. 数字、价格、集成、语言数、模板数必须精确匹配 verified fact。
8. 输出 sources 只保留 citedFactIds 对应 sourceRefs。

### 7.4 Migration Compatibility

V1 初期可以保留 legacy adapter：

```text
ToolFacts V1 → legacy compactToolFacts shape
```

但 adapter 只能从 ALLOW/QUALIFY facts 生成，不能再读取 raw AiTool。这样可在“不改 Prompt”的阶段先替换 Builder，同时保证 Validator 已使用同一事实源。

## 8. Five ToolFacts V1 Examples

以下示例基于 2026-06-11 数据库审计结果。五个工具当时均无可用 ToolClaim、无 ToolPlatform，因此 capability 大多只能归类为 unsourced，marketing 断言被禁止引用。示例省略未引用 evidence registry 的完整 URL 元数据。

### 8.1 Writesonic

```json
{
  "schemaVersion": "tool-facts-v1",
  "toolIdentity": { "toolId": 1, "handle": "writesonic", "name": "Writesonic", "officialUrl": "https://writesonic.com/", "status": "ONLINE", "categoryIds": [1, 5, 27, 30, 47, 52, 154, 248, 326, 331, 341, 365, 391] },
  "summaryFacts": [
    { "factId": "tool:1:summary:description", "value": "AI writer for SEO content, ads, blogs, paraphrasing, and AI chatbot/image generation.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [], "origin": { "table": "ai_tools", "field": "description" } }
  ],
  "capabilityFacts": [
    { "factId": "tool:1:capability:article-writer", "label": "AI article and blog writer", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] },
    { "factId": "tool:1:capability:paraphrasing", "label": "Paraphrasing", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] },
    { "factId": "tool:1:capability:chat-assistant", "label": "Chat assistant", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] },
    { "factId": "tool:1:capability:image-generation", "label": "Image generation", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] },
    { "factId": "tool:1:capability:seo-agents", "label": "SEO workflow agents", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] }
  ],
  "limitationFacts": [
    { "factId": "tool:1:limitation:fair-use", "value": "The database lists a fair-use policy for unlimited generations.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] },
    { "factId": "tool:1:limitation:paid-features", "value": "Some advanced features may require paid plans.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] }
  ],
  "useCaseFacts": [
    { "factId": "tool:1:use-case:blog-drafting", "label": "Long-form blog drafting", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:1:capability:article-writer"] },
    { "factId": "tool:1:use-case:ad-copy", "label": "Ad copy drafting", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": [] }
  ],
  "pricingFacts": { "pricingModel": "UNKNOWN", "hasFreeTier": null, "hasTrial": null, "plans": [], "warnings": ["Legacy HTML pricing exists but is not eligible for V1 citation until structured plans have valid sourceRefs"] },
  "platformFacts": [],
  "companyFacts": [],
  "evidenceFacts": {},
  "qualityFacts": { "sourceCoverageScore": 0.16, "factCompletenessScore": 0.61, "verifiedFactCount": 0, "aiUsagePolicy": "IDENTITY_ONLY", "warnings": ["No verified claims", "No platform evidence", "Marketing claims such as 10X speed, plagiarism-free, integrations, and 25+ languages are FORBID"] }
}
```

### 8.2 WordHero

```json
{
  "schemaVersion": "tool-facts-v1",
  "toolIdentity": { "toolId": 23, "handle": "wordhero", "name": "WordHero", "officialUrl": "https://wordhero.co/", "status": "ONLINE", "categoryIds": [1, 52, 348] },
  "summaryFacts": [
    { "factId": "tool:23:summary:description", "value": "AI content writing software for blogs, social media, emails, and more.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "sourceRefs": [] }
  ],
  "capabilityFacts": [
    { "factId": "tool:23:capability:content-generation", "label": "AI content generation", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:23:capability:seo-tools", "label": "SEO optimization tools", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:23:capability:templates", "label": "Pre-built templates", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:23:capability:image-generation", "label": "AI image generation", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "limitationFacts": [
    { "factId": "tool:23:limitation:human-edit", "value": "The database recommends human editing of generated output.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:23:limitation:fair-use", "value": "Unlimited features may be subject to a fair-use policy.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "useCaseFacts": [
    { "factId": "tool:23:use-case:blogs", "label": "Blog drafting", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:23:capability:content-generation"] },
    { "factId": "tool:23:use-case:marketing-copy", "label": "Marketing copy", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:23:capability:content-generation"] }
  ],
  "pricingFacts": { "pricingModel": "UNKNOWN", "plans": [], "warnings": ["Four legacy plans collapse to the same normalized Pro/Monthly shape and are excluded"] },
  "platformFacts": [],
  "companyFacts": [],
  "evidenceFacts": {},
  "qualityFacts": { "sourceCoverageScore": 0.15, "factCompletenessScore": 0.56, "verifiedFactCount": 0, "aiUsagePolicy": "IDENTITY_ONLY", "warnings": ["108 languages is an unsourced numeric marketing claim and is FORBID", "No verified pricing plans"] }
}
```

### 8.3 AIKTP

```json
{
  "schemaVersion": "tool-facts-v1",
  "toolIdentity": { "toolId": 6, "handle": "ai-keywords-to-posts", "name": "AIKTP", "officialUrl": "https://aiktp.com/", "status": "ONLINE", "categoryIds": [1, 47, 51, 348] },
  "summaryFacts": [
    { "factId": "tool:6:summary:description", "value": "AI-powered content writing and WordPress management system for SEO-optimized content.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "capabilityFacts": [
    { "factId": "tool:6:capability:content-writing", "label": "AI content writing", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:6:capability:wordpress-management", "label": "WordPress management", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:6:capability:keyword-suggestions", "label": "Keyword suggestions", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:6:capability:keyword-grouping", "label": "Keyword grouping", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:6:capability:scheduling", "label": "Post scheduling", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "limitationFacts": [
    { "factId": "tool:6:limitation:subscription", "value": "Full access may require a subscription.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:6:limitation:input-dependency", "value": "Output quality may depend on supplied keywords and outlines.", "classification": "marketingFact", "citationPolicy": "FORBID" }
  ],
  "useCaseFacts": [
    { "factId": "tool:6:use-case:seo-blogs", "label": "SEO blog drafting", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:6:capability:content-writing"] },
    { "factId": "tool:6:use-case:multi-site", "label": "Managing multiple WordPress sites", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:6:capability:wordpress-management"] }
  ],
  "pricingFacts": { "pricingModel": "UNKNOWN", "plans": [], "warnings": ["Legacy pricing cards contain amounts and limits but lack eligible V1 evidence"] },
  "platformFacts": [],
  "companyFacts": [],
  "evidenceFacts": {},
  "qualityFacts": { "sourceCoverageScore": 0.17, "factCompletenessScore": 0.64, "verifiedFactCount": 0, "aiUsagePolicy": "IDENTITY_ONLY", "warnings": ["WordPress integration language must remain qualified", "Unlimited websites and SEO ranking effects are FORBID"] }
}
```

### 8.4 Junia AI

```json
{
  "schemaVersion": "tool-facts-v1",
  "toolIdentity": { "toolId": 4, "handle": "junia-ai", "name": "Junia AI", "officialUrl": "https://www.junia.ai/", "status": "ONLINE", "categoryIds": [1, 51, 52, 70, 341, 391] },
  "summaryFacts": [
    { "factId": "tool:4:summary:description", "value": "AI content creation platform for blogs, emails, ads, and SEO-friendly articles.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "capabilityFacts": [
    { "factId": "tool:4:capability:content-generation", "label": "AI content generation", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:4:capability:image-generation", "label": "AI image generation", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:4:capability:seo-research", "label": "SEO research and optimization", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:4:capability:editor", "label": "Editor with summarization and paraphrasing", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:4:capability:brand-voice", "label": "Brand voice personalization", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "limitationFacts": [
    { "factId": "tool:4:limitation:no-rollover", "value": "Some monthly allowances may not roll over.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:4:limitation:plan-limits", "value": "Some plans may impose word limits.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "useCaseFacts": [
    { "factId": "tool:4:use-case:long-form", "label": "Long-form blog drafting", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:4:capability:content-generation"] },
    { "factId": "tool:4:use-case:sales-email", "label": "Sales email drafting", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:4:capability:content-generation"] }
  ],
  "pricingFacts": { "pricingModel": "UNKNOWN", "plans": [], "warnings": ["Legacy plan names are inconsistently normalized"] },
  "platformFacts": [],
  "companyFacts": [],
  "evidenceFacts": {},
  "qualityFacts": { "sourceCoverageScore": 0.16, "factCompletenessScore": 0.63, "verifiedFactCount": 0, "aiUsagePolicy": "IDENTITY_ONLY", "warnings": ["3000-word articles, 50+ templates, plagiarism-free, and free trial claims are FORBID until sourced"] }
}
```

### 8.5 Contrast

```json
{
  "schemaVersion": "tool-facts-v1",
  "toolIdentity": { "toolId": 5, "handle": "getcontrast-io", "name": "Contrast", "officialUrl": "https://getcontrast.io/", "status": "ONLINE", "categoryIds": [1, 23, 35, 266, 275] },
  "summaryFacts": [
    { "factId": "tool:5:summary:description", "value": "Contrast is a webinar platform with engaging features and content repurposing tools.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "capabilityFacts": [
    { "factId": "tool:5:capability:webinars", "label": "Webinar hosting", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:5:capability:qa", "label": "Webinar Q&A", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:5:capability:branding", "label": "Branded webinars", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:5:capability:repurposing", "label": "Content repurposing", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:5:capability:analytics", "label": "Viewer engagement analytics", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "limitationFacts": [
    { "factId": "tool:5:limitation:free-registrants", "value": "The free plan may limit registrants.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" },
    { "factId": "tool:5:limitation:storage", "value": "Some plans may limit video storage.", "classification": "unsourcedFact", "citationPolicy": "QUALIFY" }
  ],
  "useCaseFacts": [
    { "factId": "tool:5:use-case:webinar-marketing", "label": "Marketing webinars", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:5:capability:webinars"] },
    { "factId": "tool:5:use-case:repurpose", "label": "Repurposing webinar recordings", "classification": "unsourcedFact", "citationPolicy": "QUALIFY", "supportsCapabilityFactIds": ["tool:5:capability:repurposing"] }
  ],
  "pricingFacts": { "pricingModel": "UNKNOWN", "plans": [], "warnings": ["Legacy pricing must be remapped from structured ToolPricingPlan records with sourceRefs"] },
  "platformFacts": [],
  "companyFacts": [],
  "evidenceFacts": {},
  "qualityFacts": { "sourceCoverageScore": 0.17, "factCompletenessScore": 0.62, "verifiedFactCount": 0, "aiUsagePolicy": "IDENTITY_ONLY", "warnings": ["No verified claims", "Category fit must be checked before treating Contrast as a general AI writing tool", "CRM integration is QUALIFY until sourced"] }
}
```

示例中的评分是按当前审计可见事实进行的设计估算，用于说明预期政策结果，不是已经落地的运行时评分。

## Recommended Builder Boundary

建议后续实现分为四个纯函数边界：

```text
loadRawToolFactRows(toolIds)
→ classifyRawFacts(rawTool)
→ buildToolFactsV1(classifiedFacts, profile)
→ deriveToolFactsViews(v1)
```

其中：

- loader 只负责 Prisma 查询。
- classifier 负责 verified/unsourced/marketing。
- builder 负责规范化、factId、sourceRef、评分和 warnings。
- views 负责当前 contentType 的长度裁剪，但不得改变 classification 和 citationPolicy。

最终只有 ToolFacts V1 能进入 Source Builder；禁止 Source Builder、Prompt Builder 或 Validator 再直接读取原始 AiTool 营销字段。
