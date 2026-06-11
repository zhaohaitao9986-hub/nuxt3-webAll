# Tool Claims Coverage Report

## Executive Summary

截至 2026-06-11，数据库中的 `ToolClaim` 记录数为 **0**。因此 ACTIVE、高置信度、有来源、有验证时间的 Claim 数量也全部为 0。

按当前内容生成系统的工具排序规则抽取 Top 100 后：每个工具平均有 0 个 Claim、0 个关联事实来源、2.27 个 PricingPlan、0 个 Platform。基于《ToolFacts V1 Design》的覆盖率算法进行模拟，Top 100 的 `sourceCoverageScore` P90 仅为 **29.38%**，没有工具达到 LIMITED 的 35% 门槛。

如果现在启用 ToolFacts V1 的严格输出策略，Top 100 和全部 27,036 个可用工具都会被判定为 `IDENTITY_ONLY`。当前瓶颈不是 ToolFacts Builder 的结构，而是可追溯事实和来源数据尚未进入数据库。

## 1. 统计范围与口径

- 数据快照时间：`2026-06-11T10:58:42.340Z`
- 数据来源：当前 PostgreSQL 数据库，通过 Prisma 只读查询
- 可用工具范围：`toolStatus` 为 `ONLINE` 或 `ACTIVE`，且 `name`、`handle` 非空
- 可用工具总数：**27,036**
- Top 100 排序：`rank ASC`、`monthVisitedCount DESC`、`updatedAt DESC`
- Source 数：每个工具经 `ToolClaim`、`ToolPricingPlan`、`ToolPlatform` 关联的不同 `sourceId` 数量；不把 `AiTool.website` 当作事实证据来源
- 本次没有修改代码、数据库或现有 ToolFacts 逻辑

## 2. ToolClaim 覆盖情况

| 指标 | 数量 | 占 ToolClaim 总数 |
| --- | ---: | ---: |
| 1. ToolClaim 总数 | 0 | - |
| 2. ACTIVE Claim 数量 | 0 | - |
| 3. `confidence >= 0.7` 数量 | 0 | - |
| 4. 有 `sourceId` 的数量 | 0 | - |
| 5. 有 `verifiedAt` 的数量 | 0 | - |
| 同时满足 ACTIVE、未过期、高置信度、有来源 | 0 | - |

结论：当前不存在可供 ToolFacts V1 消费的结构化 Claim，也不存在经过来源与时效校验的 Claim。

## 3. Top 100 工具数据密度

| 指标 | Top 100 总量 | 每工具平均数 |
| --- | ---: | ---: |
| 6. ToolClaim | 0 | **0.00** |
| 可用 ToolClaim | 0 | **0.00** |
| 7. 关联 Source | 0 | **0.00** |
| 8. PricingPlan | 227 | **2.27** |
| 9. Platform | 0 | **0.00** |

PricingPlan 是 Top 100 中唯一具有一定密度的结构化事实域，但当前这些计划没有通过 `sourceId` 形成证据链。价格数据可以提高 `factCompletenessScore`，却只能按 unsourced fact 计入较低的来源覆盖权重。

作为全量参照，27,036 个可用工具的平均值如下：

| 指标 | 全量平均数 |
| --- | ---: |
| ToolClaim | 0.00 |
| 关联 Source | 0.00 |
| PricingPlan | 1.43 |
| Platform | 0.00 |

## 4. sourceCoverageScore 模拟方法

`sourceCoverageScore` 尚未由生产代码生成。本报告按照 `docs/architecture/tool-facts-v1-design.md` 的设计进行离线模拟，因此它是启用 V1 后的预计值，不是当前数据库字段。

事实域权重：

| 事实域 | 权重 | 当前映射 |
| --- | ---: | --- |
| Summary | 10% | `description`；无来源时按 unsourced fact 计分 |
| Capability | 30% | `feature` 和 capability 类型的有效 ToolClaim |
| Limitation | 15% | `cons` 和 limitation 类型的有效 ToolClaim |
| Use Case | 15% | `useCases` 和 use-case 类型的有效 ToolClaim |
| Pricing | 20% | `ToolPricingPlan` |
| Platform | 5% | `ToolPlatform` |
| Company | 5% | 当前 `companyInfo` 视为 marketing fact，不计来源覆盖分 |

单个事实的覆盖系数：

| 事实状态 | 系数 |
| --- | ---: |
| 有有效来源、已验证且仍在时效期内 | 1.0 |
| 有有效来源，但验证时效未知 | 0.8 |
| 无来源，但属于允许限定引用的数据库事实 | 0.4 |
| marketing、禁止引用或事实域缺失 | 0.0 |

`whatIsSummary`、`pros`、`companyInfo` 等营销或编辑性文本不作为 verified fact 提高覆盖率。由于当前 ToolClaim 为 0、关联 Source 为 0，现有得分主要来自 `description`、`feature`、`cons`、`useCases` 和无来源 PricingPlan 的 0.4 系数。

## 5. sourceCoverageScore 分布

### Top 100

| 分位数 | Score |
| --- | ---: |
| 10. P50 | **28.00%** |
| P75 | **28.62%** |
| P90 | **29.38%** |

| 补充指标 | Score |
| --- | ---: |
| 平均值 | 25.43% |
| 最小值 | 16.00% |
| 最大值 | 30.57% |

### 全部可用工具

| 分位数 | Score |
| --- | ---: |
| P50 | **21.14%** |
| P75 | **28.00%** |
| P90 | **28.67%** |

| 补充指标 | Score |
| --- | ---: |
| 平均值 | 23.18% |
| 最小值 | 4.00% |
| 最大值 | 33.00% |

全量最高分仍低于 LIMITED 的 35% 门槛。这说明当前结果不是少数长尾工具拖低平均值，而是整个工具库普遍缺少来源化事实。

## 6. ToolFacts V1 启用后的预计等级

模拟采用设计文档中的等级门槛：

- `FULL`：`sourceCoverageScore >= 0.75` 且 `factCompletenessScore >= 0.75`
- `LIMITED`：`sourceCoverageScore >= 0.35` 且 `factCompletenessScore >= 0.50`
- `IDENTITY_ONLY`：不满足以上条件

### Top 100 预计结果

| 等级 | 工具数 | 占比 |
| --- | ---: | ---: |
| FULL | **0** | 0% |
| LIMITED | **0** | 0% |
| IDENTITY_ONLY | **100** | 100% |

### 全部可用工具预计结果

| 等级 | 工具数 | 占比 |
| --- | ---: | ---: |
| FULL | **0** | 0% |
| LIMITED | **0** | 0% |
| IDENTITY_ONLY | **27,036** | 100% |

部分 Top 100 工具的字段完整度已经可以达到或超过 75%，但其来源覆盖率仍约为 28%-31%，因此不能成为 FULL 或 LIMITED。这验证了完整字段不等于可信事实：增加更多无来源文本不会解决当前问题。

## 7. 风险分析

1. **启用 V1 会使内容事实输入大幅收缩。** 严格执行引用策略时，所有工具只能安全输出 identity 信息，现有 Buyer Guide 和 Comparison 无法获得足够的可引用能力、限制和价格事实。
2. **unsupported feature claim 风险仍然很高。** `feature`、`description`、`useCases` 等文本有内容，但没有 Source 或 ToolClaim 证据链；把它们直接当成 verified fact 会制造虚假的可信度。
3. **PricingPlan 数量不能代表价格可信度。** Top 100 平均有 2.27 条计划，但缺少来源和验证时间，无法确认价格是否仍有效。
4. **Validator 无法进行事实级核验。** 当前没有 Claim ID、Source ID 和 verifiedAt 可用于将 AI 陈述反查到证据。
5. **Top 100 也没有明显的数据质量优势。** 其 P90 仅比全量 P90 高 0.71 个百分点，访问量和排名没有带来对应的事实来源覆盖。

## 8. 结论与前置条件

目前不适合直接启用严格的 ToolFacts V1 输出策略。建议先完成数据层覆盖，再实施 Builder 重构：

1. 为高价值工具建立结构化 ToolClaim，并明确 `claimType`、`status`、`confidence`、`verifiedAt` 和 `expiresAt`。
2. 为 Claim、PricingPlan 和 Platform 绑定可用 Source，优先覆盖官网功能页、定价页和平台支持页。
3. 先使 Top 100 达到 LIMITED：每个工具至少覆盖 summary、capability、use case、pricing 中的核心事实，并让 `sourceCoverageScore >= 0.35`。
4. 再推进 FULL：补齐 limitation、platform、company 等事实域，并使来源覆盖和字段完整度同时达到 75%。

在 ToolClaim 总数仍为 0 的情况下，开发 ToolFacts V1 Builder 只能改变数据包装形式，不能提高事实可信度或降低幻觉风险。
