# Content Generation Input Rules Audit

> 审计范围：`sourceBuilder.js`、`prompts.js`、`editorialRules.js`、`validators.js`、`responseSchemas.js`、`promptVersion.js`。为确认真实入口，额外只读核对了 `generator.js`、`taskStore.js`、Prisma schema 和管理端任务表单。本文不包含代码修改建议的具体实现。

## 1. 当前真实输入流程

### Guide 输入流程

`Task -> Source Builder -> sourceData -> compactGuideSource -> Prompt -> DeepSeek`

#### 1. Task

管理端当前实际可创建的任务字段为：

- `title`
- `slug`
- `contentType`
- `targetType`
- `categoryId`
- `toolId`
- `limit`
- `status`

其中，Source Builder 真正消费的是 `contentType`、`slug`、`title`、`categoryId`、`toolId`、`limit`。`targetType` 不参与分流或输入构建。任务表虽有 `promptJson`，但管理端创建表单不提供 SEO brief、受众、搜索意图、教程目标、候选工具或内部链接字段。

#### 2. Source Builder

`buildContentSourceData()` 将 `BUYER_GUIDE`、`CATEGORY_GUIDE`、`TUTORIAL` 统一路由到 Guide family。它并行读取：

- 分类：按 `categoryId` 查 `CategoryLevel2`。
- 工具：按 `categoryId`、`toolId`、`limit` 调用 `fetchTools()`。
- 相关分类：同一级分类下按工具数、排序和 ID 取最多 8 个。

`fetchTools()` 的过滤条件是工具状态为 `ONLINE` 或 `ACTIVE`、名称和 handle 非空；排序为 `rank ASC`、`monthVisitedCount DESC`、`updatedAt DESC`。它不是按文章搜索意图、工具适用场景、证据完整度或编辑选择原因排序。

当同时存在 `categoryId` 和 `toolId` 时，两者是 AND 条件：指定工具若不属于指定分类，将返回空数组并导致任务失败。存在 `toolId` 时，通常只会返回该一个工具，而不是“主工具 + 同类工具”。

#### 3. sourceData

Guide family 统一生成以下字段：

| 字段 | 实际内容 |
| --- | --- |
| `task` | 固定为 `generate_guide` |
| `contentType` | `BUYER_GUIDE` / `CATEGORY_GUIDE` / `TUTORIAL` |
| `slug` | task slug、分类 handle、首个工具 handle 或标题推导 |
| `canonicalPath` | `/guides/{slug}` |
| `language` | 固定 `en` |
| `audience` | 固定 `buyers evaluating AI tools` |
| `intent` | Tutorial 为 `tutorial`，其他为 `choose_tools` |
| `category` | 仅 level1/level2 的 `id/name/handle` |
| `relatedCategories` | 最多 8 个分类的 `id/name/handle` |
| `primaryTool` | 只有 task 有 `toolId` 才设置，取返回工具第一项 |
| `topTools` | 完整 mapped tools，和 `tools` 重复 |
| `tools` | 工具基础事实、价格、claims、平台、社交链接等 |
| `sources` | 所有入选工具的官网、价格、claim、平台、社交来源并集 |
| `selectedToolStrategy` | `explicit-guide-tool` 或 `category-ranked-tools` |
| `siteRules` | 品牌和禁止 claims |

工具在 sourceData 中包含：`id/handle/name/description/website/pricing/pricingPlans/claims/platforms/socialLinks/pros/cons/features/rating/monthlyVisits/whatIsSummary/tags/useCases/forJobs/companyInfo/isFree`。

关键问题：`fetchCategory()` 已查询 `whatIsSummary`、`feature`、`whoIsUse`、`howDoWork`、`advantages`、`faq`，但 `buildGuideSourceData()` 只传递 map 后的 `id/name/handle`。最有价值的分类语义数据在 Source Builder 内被丢弃。

#### 4. compactGuideSource

默认 Prompt 不直接发送完整 sourceData，而发送压缩后的：

- 任务与路由字段：`task/contentType/slug/canonicalPath/language`。
- 固定用户语境：`audience/intent`。
- 分类：仅 `id/name/handle`。
- `relatedCategories`：仅 `id/name/handle`。
- `primaryTool`：压缩工具对象。
- `tools`：全部工具的压缩对象。
- `sources`：不裁剪，完整传入。
- `siteRules`、`fieldPolicy`。

压缩工具保留：`id/slug/handle/name/website`、截断后的 `description/whatIsSummary`、最多 6 条 pricing summary、6 个 pricing plans、10 条 claims、12 个 features、8 个 pros、8 个 cons、10 个 platforms/tags/useCases/forJobs、rating、monthlyVisits、isFree 和两个布尔状态。

以下 sourceData 字段默认没有进入 compact Prompt：`topTools`、`selectedToolStrategy`；`companyInfo`、`socialLinks`、claim 的 source/verifiedAt/expiresAt/valueJson、plan 的价格数值/币种/verifiedAt 等也被裁掉。裁掉社交链接本身合理，但它们对应的 source 仍可能保留在 `sources` 中。

#### 5. Prompt

Guide 三种类型共用 `buildGuideUserPrompt()` 和同一套 `contentRules.guides`。Prompt 的类型差异主要是：

- 第一行替换内容类型名称。
- `TUTORIAL` 要求输出 `tutorialPage`。
- `BUYER_GUIDE`、`CATEGORY_GUIDE` 要求输出 `categoryContentPage`。
- sourceData 中 Tutorial 的 `intent` 为 `tutorial`。

但统一规则仍强制所有 Guide：1,800-3,000 词、10-16 blocks、至少 5 个工具 callout、至少 6 个选择标准，并覆盖 recommended tools、how to choose、workflow、decision guidance 等主题。因此 Tutorial 和 Category Guide 都被 Buyer Guide 的任务定义主导。

#### 6. DeepSeek

`generator.js` 把 Prompt Version 解析后的 system/user prompt 发送给 DeepSeek。默认 Prompt Version 模板是 `{{SOURCE_PROMPT}}`，所以默认发送上述 compact 数据。

需要注意：`applyPromptTemplate()` 支持 `{{SOURCE_DATA_JSON}}`，该占位符会注入未 compact 的完整 sourceData。若数据库中的活跃 Prompt Version 使用该占位符，DeepSeek 可能同时收到 compact source 和完整 source，重新引入重复字段、`companyInfo/socialLinks`、`knownPricing/knownClaims` 等数据。仅凭代码无法确认数据库当前活跃模板是否被人工改写；默认自动创建模板不会触发该问题。

### Compare 输入流程

`Task -> Source Builder -> sourceData -> compactCompareSource -> Prompt -> DeepSeek`

#### 1. Task

管理端仍只提供一个 `toolId`，界面文案为“指定主工具”，没有 `secondaryToolId` 或 alternative candidate 多选入口。源码可读取 `task.primaryToolId`、`task.secondaryToolId` 或 `promptJson.primaryToolId/secondaryToolId`，但任务模型没有两个独立字段，当前 UI 也不会提交它们。

#### 2. Source Builder

`COMPARISON` 和 `ALTERNATIVE` 共用 `fetchCompareTools()`：

1. 显式读取 primary/secondary ID；正常 UI 路径中 `toolId` 充当 primary。
2. 若 primary 存在，用 task `categoryId`，否则用 primary 的第一个 `toolCategories.categoryId` 推断分类。
3. 按该分类调用通用 `fetchTools()`，默认取 5 个候选。
4. primary 缺失时取候选第一名。
5. secondary 缺失时取第一个不同于 primary 的候选。
6. 最终 `tools` 是 primary、secondary 和全部 candidates 的去重并集。

这能保证至少找出两个不同工具，但不能保证第二工具是用户真正要比较的对象，也不能保证 Alternative 候选符合“为什么切换”的意图。

#### 3. sourceData

Compare family 统一生成：

| 字段 | 实际内容 |
| --- | --- |
| `task` | 固定 `generate_compare` |
| `contentType` | `COMPARISON` 或 `ALTERNATIVE` |
| `comparisonType` | Comparison 通常为 `TOOL_VS_TOOL`；Alternative 为 `ALTERNATIVES` |
| `slug/canonicalPath/language` | 路由和语言 |
| `primaryTool` | 显式或排名推断的主工具 |
| `secondaryTool` | 显式或排名推断的第二工具 |
| `selectedToolStrategy` | 选择策略说明 |
| `tools` | primary、secondary 加候选工具列表 |
| `category` | level2 的 `id/name/handle` |
| `categoryTopTools` | 与 `tools` 重复 |
| `relatedCategories` | 最多 8 个相关分类 |
| `knownPricing` | 所有工具 pricing 文本与 plan rawText/planName 的扁平并集 |
| `knownClaims` | 所有工具 claims 的扁平并集 |
| `sources` | 所有工具的全部收集来源 |
| `requiredCriteria` | 固定 5 项：Ease of use、Output quality、Integrations、Pricing、Best fit |

#### 4. compactCompareSource

默认发给 DeepSeek 的字段为：

- `task/contentType/comparisonType/slug/canonicalPath/language`
- `primaryTool/secondaryTool`
- 全部 `tools`
- `category/relatedCategories`
- `requiredCriteria`
- 全量 `sources`
- `fieldPolicy`

`selectedToolStrategy`、`categoryTopTools`、`knownPricing`、`knownClaims` 没有进入默认 Prompt。因此 Source Builder 计算了这些字段，但默认 AI 输入并未使用。

#### 5. Prompt

Comparison 和 Alternative 共用 `buildCompareUserPrompt()` 与 `contentRules.compare`。二者差异主要是输出 schema 和一条验证目标：

- Comparison 要求 matrix rows、`comparisonPage` 和 `comparisonTools`。
- Alternative 要求至少一个替代工具、`alternativePage` 和 `alternativeTools`。

然而共享规则仍要求两种内容都覆盖“Feature comparison matrix”“buyer fit for each primary tool”“Pricing comparison”“Alternatives”等主题，并要求至少 6 criteria。Alternative 没有独立的 `reasonToSwitch` 输入，只要求 AI 在输出中生成该字段。

#### 6. DeepSeek

默认发送 compact Compare source。与 Guide 相同，自定义 Prompt Version 可以通过 `{{SOURCE_DATA_JSON}}` 注入完整 sourceData，导致默认未使用的扁平 `knownPricing/knownClaims` 再次进入上下文，并失去与具体工具的清晰归属。

## 2. 当前支持的内容类型

### Guide Family

#### BUYER_GUIDE

- 当前如何识别：`contentType === BUYER_GUIDE`，进入 `generate_guide`。
- 当前输入：分类 ID/name/handle、相关分类、按排名选出的工具及工具事实、全部来源、固定 audience 和 `choose_tools` intent。
- Prompt 如何区分：只在首行写 BUYER_GUIDE，并要求 `categoryContentPage`；其余使用共享 Guide 规则。
- Validator 如何区分：要求至少 5 个 source tools、必须有 `category.level2`；生成结果要求 `categoryContentPage`。
- 输出差异：Guide 通用结构 + `categoryContentPage`。
- 判断：这是五种类型中输入与任务最匹配的一种，但仍缺 targetKeyword、真实 searchIntent、decisionCriteria、工具选择理由和内部链接。

#### CATEGORY_GUIDE

- 当前如何识别：`contentType === CATEGORY_GUIDE`，进入 `generate_guide`。
- 当前输入：与 Buyer Guide 基本相同，仍是工具列表主导；分类只有名称和 handle。
- Prompt 如何区分：只替换类型名并要求 `categoryContentPage`。
- Validator 如何区分：没有 CATEGORY_GUIDE 专属 source 校验；输出只检查 `categoryContentPage`。
- 输出差异：与 Buyer Guide 相同。
- 判断：基本只是“换名字”。数据库已有分类定义、适用人群、工作方式、优势、FAQ，但全部未进入 Prompt；反而被强制推荐至少 5 个工具。

#### TUTORIAL

- 当前如何识别：`contentType === TUTORIAL`，进入 `generate_guide`，intent 改为 `tutorial`，slug 加 `tutorial` 后缀。
- 当前输入：一个显式 primary tool 或分类工具列表；没有 goal、prerequisite、steps、examples、mistakes、output checklist。
- Prompt 如何区分：要求 `tutorialPage`，但继续使用 Guide 的推荐工具和选择标准规则。
- Validator 如何区分：source 只要求 primaryTool 或 level2 category；输出要求 `tutorialPage`。没有验证步骤是否来自输入，也没有目标完成度校验。
- 输出差异：Guide 通用结构 + `tutorialPage`。
- 判断：输出名字和 typed child 不同，但输入规则没有真正 Tutorial 化，极易生成“工具推荐 + 泛化工作流”的 Buyer Guide。

### Compare Family

#### COMPARISON

- 当前如何识别：`contentType === COMPARISON`，进入 `generate_compare`，通常设置 `comparisonType=TOOL_VS_TOOL`。
- 当前输入：primary、secondary、另外最多约 3 个分类候选、所有工具事实、固定 criteria、全部来源。
- Prompt 如何区分：要求 matrix、comparisonPage、comparisonTools。
- Validator 如何区分：要求 primary/secondary；输出要求至少 2 个 comparisonTools、matrix、criteria、verdict 及 ID 一致性。
- 输出差异：有明确的双工具比较结构。
- 判断：输出契约真正不同，但输入并非严格双工具契约。额外候选工具会稀释注意力，并让“Alternatives”主题把二选一页面拉向列表文章。

#### ALTERNATIVE

- 当前如何识别：`contentType === ALTERNATIVE`，进入相同 Compare builder，设置 `comparisonType=ALTERNATIVES`。
- 当前输入：primary、一个被称为 secondary 的首个候选、其余候选工具；没有 reasonToSwitch、selectionCriteria 或候选入选原因。
- Prompt 如何区分：切换为 Alternative response schema，要求至少一个替代工具。
- Validator 如何区分：要求 primaryTool；输出要求 `alternativePage`、至少一个非 primary 的 `alternativeTools`。
- 输出差异：`reasonToSwitch`、`selectionCriteriaJson`、alternative tool 的 reason/bestFor/tradeoff。
- 判断：输出结构真正不同，但输入选择仍沿用二工具 Compare 逻辑。`secondaryTool` 这个概念对 Alternative 不自然，且 Validator 不要求 sourceData 中存在明确 alternativeTools 集合。

## 3. 每种内容类型的理想输入规则

### BUYER_GUIDE 理想输入

目标：帮助用户在一个明确类别和购买场景中选择一组工具。

应该输入：

- `targetKeyword`：页面主关键词，而不是从分类名或 slug 猜测。
- `searchIntent`：如 shortlist、budget choice、team choice、beginner choice。
- `audience`：角色、经验、团队规模、预算或工作场景。
- `category`：完整分类上下文。
- `selectedTools`：编辑确认的候选集合，建议 5-10 个。
- `toolFacts`：每个工具独立归属的事实。
- `pricingSummary/features/prosCons/useCases`：按工具组织。
- `decisionCriteria`：本分类真正有效的选择维度及权重。
- `officialSources`：只覆盖入选工具和实际使用事实。
- `internalLinkHints`：分类页、工具页、相关 Guide、Compare 页。

不应该输入：与正文无关的工具、未使用 sources、过长 companyInfo、无效 socialLinks、低置信度或过期 claims。

### CATEGORY_GUIDE 理想输入

目标：解释一个 AI 工具分类是什么、适合谁、如何选择。

应该以 `category` 为中心输入：`parentCategory/categoryDefinition/categoryUseCases/commonFeatures/representativeTools/relatedCategories/internalLinkHints`。代表工具只需 3-5 个简要样本，用来说明分类差异，不应要求深度推荐 5 个工具。

不应该输入：每个工具的完整 pricingPlans、过多单工具 claims、社交来源、与分类解释无关的详情。

### TUTORIAL 理想输入

目标：教用户完成一个具体操作或工作流。

应该输入：`tutorialGoal/prerequisiteKnowledge/primaryTool/workflowSteps/examples/commonMistakes/outputChecklist/relatedTools`。步骤应来自编辑输入、已验证工作流数据或可靠官方文档，不应要求模型仅凭工具描述自行发明操作步骤。

不应该输入：大量同类工具、泛化 category guide 数据、与步骤无关的 sources、强制五个工具推荐。

### COMPARISON 理想输入

目标：比较两个明确工具，帮助用户二选一。

应该输入：`primaryTool/secondaryTool/comparisonIntent/targetAudience/sharedUseCases/decisionCriteria`，以及严格按两个工具对齐的 `pricingSummary/featureDifferences/prosCons/officialSources`。输入中应明确“为什么比较这两个工具”和每个维度的可比事实与未知项。

不应该输入：5-10 个无关工具、没有明确 primary/secondary 的工具列表、与两个工具无关的 sources、过多 category 内容。

### ALTERNATIVE 理想输入

目标：围绕一个主工具推荐多种替代品。

应该输入：`primaryTool/alternativeTools/reasonToSwitch/selectionCriteria/comparisonDimensions/pricingSummary/officialSources`。每个 alternative 应附带入选原因、适合场景和相对主工具的 tradeoff。

不应该输入：没有主工具、没有明确候选集合、仅凭排名自动选出的工具、与候选无关的 sources。

## 4. 当前输入与理想输入差距

| 内容类型 | 当前输入 | 理想输入 | 缺失字段 | 冗余字段 | 风险 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| BUYER_GUIDE | 分类名称、排名工具列表、工具事实、全量 sources、固定 audience/intent | SEO brief + 编辑选择工具 + 分类化决策标准 + 精准来源和内链 | targetKeyword、真实 searchIntent、细分 audience、选择理由、criteria、internal links | relatedCategories 可能过多；所有工具平台/claims/plans；未使用 sources | AI 只能从通用事实拼装，推荐理由泛化；排名靠前不等于搜索意图匹配 | P0 |
| CATEGORY_GUIDE | 与 Buyer Guide 几乎相同，分类仅 id/name/handle | 分类定义、适用人群、工作方式、共同特征、代表工具 | categoryDefinition、whoIsUse、howDoWork、advantages、categoryUseCases、commonFeatures | 过多工具详情、pricingPlans、单工具 claims、强制 5 个 callout | 页面会变成“最佳工具列表”，分类解释浅薄；数据库已有优质字段却未使用 | P0 |
| TUTORIAL | primary tool 或分类工具列表，固定 tutorial intent | 明确目标、前置条件、步骤、示例、错误、验收清单 | tutorialGoal、prerequisites、workflowSteps、examples、commonMistakes、outputChecklist | 多工具列表、选择标准、推荐工具主题、无关 sources | AI 可能发明步骤；输出像 Buyer Guide，不能稳定完成用户任务 | P0 |
| COMPARISON | primary/自动 secondary + 额外候选列表 + 固定 5 criteria | 严格两个工具、比较意图、共同用例、差异事实、双边来源 | comparisonIntent、targetAudience、sharedUseCases、featureDifferences、选择这两个工具的原因 | 第三至第五个工具、相关分类、这些工具的所有 sources | Compare 变成普通列表文章；正文关注点稀释；来源与正文不一致 | P0 |
| ALTERNATIVE | primary + 自动 secondary + 其他排名候选 | primary + 编辑选择 alternatives + 切换原因 + 逐项 tradeoff | reasonToSwitch、selectionCriteria、alternative candidate rationale、comparisonDimensions | `secondaryTool` 概念、无关分类候选、全量 sources | 替代品不精准；AI 被迫自己发明“为什么切换”和候选入选逻辑 | P0 |

导致 AI 泛泛而谈的主要输入：固定 audience、粗粒度 intent、通用 requiredCriteria、只有名称的 category、缺少 pageGoal 和 editorial brief。

导致推荐不精准的主要输入：工具仅按 rank/流量/更新时间选择，没有内容意图匹配、证据完整度、价格区间、适用人群或编辑确认。

导致 sources 与正文不一致的主要输入：`collectSources()` 收集所有候选工具及其 pricing/claim/platform/social 来源，而 Prompt 又要求复制全部 sources；Validator 只把未使用来源记为 warning，并在生成后归一化为“被引用工具匹配到的所有来源”，仍不是“正文实际 claim 使用的来源”。

导致 Compare 变成列表文章的主要输入：`tools` 包含 primary、secondary 和额外 candidates，共享规则还强制 Alternatives 主题。

导致 Tutorial 像 Buyer Guide 的主要输入：Guide family 统一强制 5 个 tool callout、6 个 decision criteria、recommended tools、how to choose 和 final recommendation。

## 5. Source Builder 问题分析

### fetchTools 当前选择工具是否合理

作为“热门工具候选池”是合理的，作为“文章最终输入”不够合理。当前排序只反映数据库 rank、访问量和更新时间，不反映：

- 与 target keyword 的语义相关性。
- 与 audience/use case 的匹配度。
- 工具事实和官方来源的完整度。
- claims 是否新鲜、是否过期、是否有足够 confidence。
- 是否覆盖不同预算和用户类型。
- 编辑是否确认入选。

此外，claims 查询只过滤 `status=ACTIVE`，没有过滤 `expiresAt`；高 confidence 优先但 Prompt compact 后不保留 verifiedAt/expiresAt，模型无法判断时效。

### 有 categoryId 时如何选工具

只选属于该分类的 active/online 工具，再按通用排名取前 N 个。优点是基本相关，缺点是无法区分 Buyer Guide、Category Guide、Tutorial、Comparison、Alternative 对工具数量和角色的不同要求。

### 有 toolId 时如何选工具

Guide 路径会把 `toolId` 和 `categoryId` 同时作为过滤条件，并通常只返回一个工具。对 Tutorial 的单工具场景可接受；对 Buyer Guide 会直接违反至少 5 个工具的 source validator；对“以某工具为锚点的 Guide”也无法自动补充同类工具。

### Compare 是否能稳定选择两个工具

能稳定选择“两个不同的在线工具”，不能稳定选择“用户要比较的两个工具”。管理端没有 secondary tool 输入，因此默认第二工具只是同分类排序中的第一候选。若 primary 有多个分类，则取 `toolCategories` 按 categoryId 升序的第一个分类，不一定是本次比较最相关的分类。

### Alternative 是否能稳定选择主工具和替代工具

主工具可由 `toolId` 稳定指定；替代工具不稳定。系统没有 `alternativeToolIds`，候选只来自同分类排名，且没有排除“产品定位相似度不足”“同公司产品”“证据不足”等情况。Alternative 仍强制找到 `secondaryTool`，但真正需要的是一个经过筛选的 alternatives 数组。

### Guide 是否会传入不相关工具

有 categoryId 时通常是同分类工具，但同分类不等于同搜索意图；无 categoryId 时会直接从全站所有在线工具中取排名前 N 个，跨类别混入的风险很高。Tutorial 在无 toolId、仅 categoryId 时会收到多个同类工具；在二者都没有时会收到全站热门工具。

### sources 是否会包含正文不使用的工具

会。`collectSources(tools)` 在生成前对所有候选工具收集来源，而不是根据最终正文所用工具或 claim 生成 source map。Prompt 明确要求复制全部 sources。Validator 会对 unused source 发 warning，不会让生成失败。

### pricingPlans / claims / socialLinks 是否应该裁剪

- `pricingPlans`：应按内容类型裁剪。Buyer Guide/Compare/Alternative 保留定性摘要和关键差异即可；Category Guide 通常不需要；Tutorial 仅在步骤或门槛相关时需要。
- `claims`：只保留高置信度、未过期、与页面 criteria 或 workflow 相关且有来源的 claims。当前按 confidence 取 12 条仍可能包含无关 claim。
- `socialLinks`：不应作为内容生成事实输入，除非任务是联系渠道说明。当前 compactTool 已裁掉 socialLinks，但 `collectSources()` 仍收集其来源，属于明显冗余。
- `companyInfo`：默认 compact 已裁掉，合理；若未来需要，应限长并仅用于公司背景相关页面。
- `platforms`：需要保留平台名称，但平台来源只在正文确实声明兼容性时进入 sourceMap。

## 6. Prompt 输入问题分析

### Prompt 是否把所有规则混在一起

是。Guide Prompt 把 Buyer Guide 的推荐、筛选、decision framework 规则同时施加于 Category Guide 和 Tutorial；Compare Prompt 把双工具矩阵与 Alternatives 主题混在同一规则集中。共享 factuality/SEO/safety 合理，共享内容任务定义不合理。

### 是否没有根据 contentType 生成不同 input contract

是。当前只有 `compactGuideSource` 和 `compactCompareSource` 两个 contract，没有五个 contentType 级 contract 或 family contract 内的 subtype 字段要求。类型差异主要发生在输出 shape，不发生在输入完整性校验。

### 是否缺少 pageGoal / searchIntent / audience

缺少。Guide 只有固定 audience 和二值 intent；Compare 连固定 audience/intent 都没有。task title 虽存在，但没有进入 sourceData 或 Prompt，无法充当 pageGoal。`targetType` 也未使用。

### 是否缺少明确内容任务定义

缺少。`Generate a {contentType}` 只是标签，不是任务 brief。模型没有获得页面要解决的问题、读者决策、查询阶段、成功标准或禁止偏题范围。

### 是否缺少“为什么选这些工具”的输入

缺少。`selectedToolStrategy` 在 sourceData 中存在，但 compact 时被删除；即使保留，它也只说明技术选择路径，不是编辑入选理由。模型只能根据排名结果反向编造推荐逻辑。

### 是否缺少工具之间的差异信息

缺少结构化差异。当前只给每个工具独立事实，要求模型自己对齐字段。对于缺失值、不同粒度描述、不可比 features，模型容易生成表面矩阵或把“不知道”写成差异。

### 是否缺少内部链接建议

缺少。虽有 relatedCategories 和工具 handle，但没有明确 URL、anchor、link reason、placement 或已存在内容页，模型也没有输出内链契约。

### 其他 Prompt 风险

- `requiredCriteria` 只有 5 项，而规则要求至少 6 项，模型必须自行发明至少一项。
- Guide metadata 被禁止出现任何工具名，这对 CATEGORY_GUIDE 尚可，但对某些工具型 Tutorial 不合理。
- 价格输入很丰富，但全局政策禁止数字价格，增加 token 成本却限制使用价值。
- Prompt 要求复制全部 sources，鼓励来源清单与正文 claim 脱节。
- Prompt Version 的 `{{SOURCE_DATA_JSON}}` 可绕过 compact contract，导致输入契约不可控。

## 7. 推荐的新 Input Contract

建议把“数据库原始查询结果”“内容选择结果”“发给模型的 contract”分离。以下最大长度指送入模型前的建议上限，不等于数据库字段限制。

### guideInputContract

| 字段 | 来源表或函数 | 必填 | 最大长度/数量 | 为什么需要 | 对输出质量的影响 |
| --- | --- | --- | --- | --- | --- |
| `pageType` | builder 常量，建议 `GUIDE` | 是 | 16 chars | 稳定 family dispatch | 防止依赖模糊 task 字符串 |
| `contentType` | `ContentGenerationTask.contentType` | 是 | enum | 决定 subtype 任务 | 让 Prompt/Validator 使用同一类型 |
| `targetKeyword` | 新 task brief 字段或 `promptJson.brief` | 是 | 120 chars | 明确 SEO 主查询 | 降低标题和主题漂移 |
| `pageGoal` | task brief；可由编辑填写 | 是 | 300 chars | 定义用户完成目标 | 避免仅按类型名写模板文 |
| `searchIntent` | task brief enum + 说明 | 是 | 200 chars | 区分 learn/choose/do/compare | 决定内容结构和 CTA |
| `audience` | task brief | 是 | 300 chars | 明确角色、水平、约束 | 让建议更具体 |
| `categoryContext` | `CategoryLevel1/2`；`fetchCategory()` | Category/Buyer 必填，Tutorial 可选 | 定义 600；use cases/features 各 10 项 | 提供分类定义、适用人群、共同特征 | 修复 Category Guide 空心化 |
| `selectedTools` | 编辑选择 ID + selector 函数 | Buyer 必填 5-10；Category 3-5；Tutorial 0-2 | 最多 10 | 明确正文允许使用的工具 | 防止全站热门工具误入 |
| `toolFacts` | `AiTool`、PricingPlan、ToolClaim、Platform | 有 selectedTools 时必填 | 每工具约 2,000 chars；claims 最多 6 | 提供按工具归属的事实 | 降低串工具和幻觉 |
| `decisionCriteria` | task brief + 分类模板 | Buyer 必填；Category 可选；Tutorial 禁用或少量 | 4-10 项，每项 200 chars | 告诉模型如何选择 | 让推荐有可解释框架 |
| `workflowContext` | task brief、未来 workflow 表、官方文档摘要 | Tutorial 必填；其他可选 | 8-15 steps，每步 300 chars | 提供可验证操作步骤 | 防止 AI 发明教程步骤 |
| `sourceMap` | Source + tool facts selector | 是 | 每事实 1-2 source；总计建议 <= 30 | 将 fact/工具/source 显式绑定 | 使正文和来源一致 |
| `internalLinks` | ContentPage、category/tool route builder | 否，建议必填 | 5-12 条 | 提供 URL、anchor、reason | 提升 SEO 主题集群和可发布性 |

`categoryContext` 应至少包含：`id/name/handle/parentCategory/definition/whoIsUse/howItWorks/commonFeatures/advantages/useCases/faq`。当前数据库已有其中大部分字段，不需要先改 schema。

`workflowContext` 在非 Tutorial 中应为可选；Guide contract 可以统一字段名，但必须按 subtype 设 required/forbidden rules，不能把空字段交给 Prompt 自由解释。

### compareInputContract

| 字段 | 来源表或函数 | 必填 | 最大长度/数量 | 为什么需要 | 对输出质量的影响 |
| --- | --- | --- | --- | --- | --- |
| `pageType` | builder 常量，建议 `COMPARE` | 是 | 16 chars | family dispatch | 保证走 Compare builder |
| `contentType` | task contentType | 是 | enum | 区分 Comparison/Alternative | 控制字段 requiredness |
| `comparisonIntent` | task brief | 是 | 300 chars | 定义“为什么比较/替换” | 防止通用矩阵 |
| `primaryTool` | task `toolId` 或显式 primary ID | 是 | 单个 compact tool <= 2,500 chars | 建立比较锚点 | Alternative 尤其关键 |
| `secondaryTool` | 新显式字段或 brief | Comparison 必填；Alternative 禁用 | 单个 compact tool <= 2,500 chars | 固定二选一对象 | 避免自动挑错第二工具 |
| `alternativeTools` | 新候选 ID 数组 + selector | Alternative 必填 2-8；Comparison 可选 0-3 | 最多 8 | 建立真实替代集合 | 避免只输出一个随机候选 |
| `sharedUseCases` | task brief + 两工具 useCases 交集/编辑确认 | Comparison 必填 | 3-8 项 | 保证在共同任务上比较 | 避免苹果对橘子式比较 |
| `decisionCriteria` | task brief + category criteria template | 是 | 5-10 项 | 定义决策维度和权重 | 让 verdict 可解释 |
| `featureComparisonFacts` | 对齐两个/多个工具的事实函数 | 是 | 6-12 dimensions | 预先表达差异和 unknown | 降低模型自行推断错误 |
| `pricingComparisonFacts` | PricingPlan/qualitative normalizer | 有价格信息时必填 | 每工具 6 条摘要 | 按工具保留价格事实 | 防止扁平 knownPricing 串归属 |
| `sourceMap` | Source + fact selector | 是 | 总计建议 <= 30 | 绑定 tool/fact/source | 避免无关来源和来源漂移 |
| `internalLinks` | ContentPage/tool/category routes | 否，建议必填 | 5-12 条 | 链接工具详情和相关页面 | 改善 SEO 与用户路径 |

建议额外在 Alternative contract 中把 `reasonToSwitch` 作为 `comparisonIntent` 的结构化子字段，至少包含：`painPoints`、`mustImprove`、`acceptableTradeoffs`。虽然用户指定的顶层 contract 未列该字段，但没有这层语义，Alternative 仍会退化为“同分类工具列表”。

### Contract 级约束

- 每个 subtype 定义 required、optional、forbidden 字段，而不只是字段存在。
- `selectedTools`、`primaryTool`、`secondaryTool`、`alternativeTools` 互斥关系必须在 Source Validator 中校验。
- `sourceMap` 以 `toolId + factKey + sourceIds/urls` 组织，不再要求复制所有抓取来源。
- compact 函数应是 contract 的唯一出口；Prompt Version 不应能用完整 sourceData 绕过 contract。
- contract 中保留选择理由，例如 `selectionReason`，而不是只记录数据库查询策略。

## 8. 优化建议

### Phase 1：只优化 Source Builder 和 Input Contract，不改输出结构

1. 为五种 contentType 定义独立 source requirement，至少拆成五个 builder adapter。
2. 保持现有 response JSON 不变，只替换发给 Prompt 的 input contract。
3. BUYER_GUIDE 要求 category + 5-10 个明确 selected tools；没有足够工具时在请求 AI 前失败。
4. CATEGORY_GUIDE 传入已查询但目前丢失的分类定义、features、whoIsUse、howDoWork、advantages、faq，并把工具压缩为 3-5 个代表样本。
5. TUTORIAL 要求 tutorialGoal、primaryTool 或 workflow context；移除默认五工具输入。
6. COMPARISON 要求显式 secondaryTool；管理端/API 未提供前，不应静默用排名工具冒充用户目标。
7. ALTERNATIVE 使用明确 `alternativeTools[]`，不再以 secondaryTool 表示首个替代品。
8. 将 claims 过滤为 active、未过期、达到置信度门槛、有来源且与任务相关。
9. 移除 social source；按 subtype 裁剪 pricing/platform/company 数据。
10. 建立 `sourceMap`，只把选中工具和可能写入正文的事实来源送给 AI。
11. 禁止 Prompt Version 用完整 sourceData 绕过 compact contract，或至少对其执行同一 contract serializer。

Phase 1 的成功标准：不改输出 schema 的情况下，五类任务获得不同输入；无关工具和无关来源显著减少；任务在调用 DeepSeek 前即可发现缺少关键输入。

### Phase 2：优化 Prompt Builder，让不同 contentType 使用不同任务说明

1. 保留 shared factuality/SEO/safety rules。
2. 拆分 `buyerGuideRules/categoryGuideRules/tutorialRules/comparisonRules/alternativeRules`。
3. Buyer Guide 强调 shortlist、criteria、tool fit；Category Guide 强调定义和教育；Tutorial 强调可执行步骤和验收；Comparison 强调严格二选一；Alternative 强调 switching reasons 和候选 tradeoffs。
4. 取消 Category Guide/Tutorial 的强制 5 tool callout。
5. Comparison 不再默认要求额外 Alternatives 章节，除非 input contract 提供。
6. Prompt 明确使用 `pageGoal/searchIntent/audience/selectionReason`，并禁止超出 selected tool set。
7. 内部链接输出只使用 `internalLinks` 白名单。

### Phase 3：再优化输出 Schema 和 Validator

1. 将 Guide 通用 schema 拆为 Buyer Guide、Category Guide、Tutorial 三个响应 schema。
2. Tutorial 校验 goal、steps、prerequisites、examples、mistakes、outcome checklist 的完整性和步骤来源。
3. Category Guide 不再要求 tool callout 数量，改为分类定义、适用人群、共同特征、选择框架覆盖率。
4. Comparison Validator 强制输出只围绕 primary/secondary；额外工具只能出现在明确 alternatives 字段。
5. Alternative Validator 要求至少 2 个候选或由业务配置决定下限，并校验每个候选相对 primary 的 reason/tradeoff。
6. Source Validator 从“页面引用了允许工具”升级为“每个关键事实可映射到 sourceMap”。
7. 将 unused source 从 warning 前移为 builder 清理，不让无关来源进入模型。
8. 根据 subtype 设置不同字数、block types 和 topic coverage，而不是 Guide/Compare 两套统一阈值。

## 9. Codex 不要修改代码

本次审计仅新增本报告，未修改 Source Builder、Prompt、Validator、Response Schema、Prompt Version 或其他业务代码。

总体结论：当前系统已经有 Guide/Compare 两条真实管线和基础事实约束，但“内容类型”主要决定输出名字与 typed schema，没有决定输入选择规则。BUYER_GUIDE 勉强符合现状；CATEGORY_GUIDE、TUTORIAL、ALTERNATIVE 的输入契约明显失配；COMPARISON 虽有双工具输出结构，但缺少稳定的双工具任务入口。建议优先执行 Phase 1，把模型输入从“数据库热门工具快照”重构为“按页面目标编辑过的事实 contract”。
