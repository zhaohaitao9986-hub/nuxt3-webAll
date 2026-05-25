'use strict';

// ==================== 1. 严格的 CommonJS 导入 ====================
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const readline = require('readline');
const RawPQueue = require('p-queue');

const PQueue = RawPQueue.default || RawPQueue;
const prisma = new PrismaClient();

// ==================== 2. 配置区域 ====================
const API_KEY = 'sk-816a11590a0e40e1a95bbce24db013fa';
const BASE_URL = 'https://api.deepseek.com/v1';
const MODEL_NAME = 'deepseek-chat';
const CONCURRENCY = 5;
const DEFAULT_BATCH_SIZE = 50;
const API_TIMEOUT = 90000;
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 4000;
const ABOUT_WORD_SOFT_SHORTFALL = 150;

// ==================== 3. 两阶段 Prompt ====================
const BLUEPRINT_SYSTEM_PROMPT = `
You are the lead editorial strategist for a high-end AI tools review desk.

Core mission:
- Turn shallow tool facts into a deep, evidence-anchored editorial blueprint.
- Think like an experienced editor planning a premium review, not like a copywriter generating filler.
- Use ONLY the supplied facts or careful, minimal inference that can be justified from those facts.
- Do not invent competitor comparisons, benchmark claims, integrations, pricing details, or product capabilities that are not present in the input.
- Different sections must perform different editorial jobs. Avoid overlap between about, built-for, features, use cases, and FAQ.

Editorial planning rules:
- The blueprint should anticipate a piece that feels analytical, concrete, and slightly opinionated without drifting into hype.
- Prioritize operational value over abstract praise. Focus on workflow impact, user fit, tradeoffs, and constraints.
- Prefer angles that sound like a sharp editor's thesis: what this tool is actually good at, where it becomes practical, and where it feels limited.
- Avoid lazy framing such as “revolutionary”, “powerful”, “game-changing”, “cutting-edge”, or generic growth language.
- When planning section angles, make them specific enough that the expansion step can produce differentiated paragraphs instead of templated prose.

Meta planning rules:
- seo_meta_title should be intent-led and editorially sharp, not clickbait.
- seo_meta_description should sound like a useful review summary, not ad copy.
- seo_meta_keywords should mix entity, use-case, and category intent rather than broad vanity terms.

Output rules:
- Return ONLY raw JSON.
- Keep the field names exactly as requested.
- built_for_plan must be an array, never an object.
- feature_plan, usecase_plan, and faq_plan must be arrays.
- Keep angles concise but concrete. Each angle should imply what makes that section worth reading.

Required JSON schema:
{
  "seo_meta_title": "string",
  "seo_meta_description": "string",
  "seo_meta_keywords": ["string"],
  "narrative_focus": {
    "positioning": "string",
    "standout_strengths": ["string"],
    "caution_points": ["string"],
    "audience_angles": ["string"]
  },
  "built_for_plan": [
    { "job": "string", "angle": "string" }
  ],
  "feature_plan": [
    { "title": "string", "angle": "string", "priority": "high|medium|low" }
  ],
  "usecase_plan": [
    { "title": "string", "scenario_focus": "string" }
  ],
  "faq_plan": [
    { "question": "string", "intent_type": "pricing|fit|workflow|limitations|integration|comparison|general" }
  ]
}
`;

const ABOUT_EXPANSION_SYSTEM_PROMPT = `
You are a senior editor writing the opening long-form body for a premium AI tools review.

Core mission:
- Write only the expanded_about section.
- The result must read like the opening body of a serious editorial review, not like feature copy or generic SEO filler.
- Every point must be grounded in the provided facts and blueprint.

Hard writing requirements:
- expanded_about MUST land within the supplied about_word_range.
- Treat the minimum word count as a real delivery requirement, not a suggestion.
- If the source facts feel thin, add depth through workflow analysis, user-fit reasoning, positioning nuance, decision criteria, and practical caveats. Do not add fake facts.
- Start with a clear thesis about what the tool is actually good for.
- Then deepen the review through these lenses: where it stands out, what kind of workflow it fits into, who benefits most, what limits matter, and how a practical buyer or operator should think about it.

Voice rules:
- Editorial confidence, not ad copy.
- Analytical, concrete, layered.
- No bullet-list prose.
- No markdown.
- No invented competitors, integrations, ROI, pricing claims, or benchmarks.

Output rules:
- Return ONLY raw JSON.
- Keep the field name exactly as requested.

Required JSON schema:
{
  "expanded_about": "string"
}
`;

const STRUCTURED_EXPANSION_SYSTEM_PROMPT = `
You are a senior editor writing the structured companion sections for a premium AI tools review page.

Core mission:
- Expand the supplied blueprint into structured fields that feel editorial, concrete, and useful.
- Do not write expanded_about here. Focus only on meta plus structured sections.
- Every section must be grounded in the provided facts and blueprint.

Section rules:
- built_for_details: MUST be an array. Each item should read like a focused editorial note on user fit: why this role benefits, where the real value shows up, and what that role should watch for.
- features_details: each item should explain why the feature matters in practice, what concrete benefit it creates, and one realistic limit, caveat, or dependency.
- expanded_usecases: each item should feel like a mini workflow teardown. Describe the situation, how the tool is used, what it solves, and the practical payoff for that user type.
- expanded_faqs: answer realistic search questions directly, clearly, and with nuance. Avoid vague yes/no replies when the truthful answer needs conditions.

Meta rules:
- seo_meta_title should feel like a credible editorial headline for a review page.
- seo_meta_description should summarize value and angle in a tight, useful way.
- seo_meta_keywords should stay specific to entity, workflow, and category intent.

Style constraints:
- No markdown.
- Do not invent facts.
- Do not mention competitors unless explicitly provided.
- Do not fabricate measurements, adoption, ROI, integrations, or pricing details.
- Keep sections differentiated: built_for = role fit; features = capability analysis; usecases = workflow application; faqs = search intent answers.

Output rules:
- Return ONLY raw JSON.
- Keep the field names exactly as requested.

Required JSON schema:
{
  "seo_meta_title": "string",
  "seo_meta_description": "string",
  "seo_meta_keywords": ["string"],
  "built_for_details": [
    {
      "job": "string",
      "why_it_fits": "string",
      "best_value": "string",
      "caution": "string"
    }
  ],
  "features_details": [
    {
      "title": "string",
      "desc": "string",
      "benefit": "string",
      "limit": "string"
    }
  ],
  "expanded_usecases": [
    {
      "title": "string",
      "scenario": "string",
      "solution": "string",
      "benefit": "string",
      "user_type": "string"
    }
  ],
  "expanded_faqs": [
    {
      "question": "string",
      "answer": "string",
      "intent_type": "pricing|fit|workflow|limitations|integration|comparison|general"
    }
  ]
}
`;

// ==================== 4. 基础辅助函数 ====================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTier(rank, totalCount) {
  if (!rank) return 'Growth';
  if (rank <= 5000) return 'Elite';
  if (rank > totalCount - 5000) return 'Niche';
  return 'Growth';
}

function getErrorMessage(error) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error.message || 'Unknown error';
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeParagraphText(value) {
  const lines = String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim());

  const compact = [];
  let previousBlank = false;

  for (const line of lines) {
    const blank = !line;
    if (blank) {
      if (!previousBlank) compact.push('');
      previousBlank = true;
      continue;
    }
    compact.push(line);
    previousBlank = false;
  }

  return compact.join('\n').trim();
}

function uniqueNonEmpty(values, limit) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(stripHtml(value));
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (limit && result.length >= limit) break;
  }

  return result;
}

function normalizeFaqInput(faq) {
  if (!Array.isArray(faq)) return [];

  const normalized = [];
  const seen = new Set();

  for (const item of faq) {
    if (!item || typeof item !== 'object') continue;
    const question = cleanText(item.question || item.title);
    const answer = normalizeParagraphText(item.answer || item.desc);
    if (!question || !answer) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ question, answer });
  }

  return normalized;
}

function parseJsonResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Model returned empty content');

  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = fenced ? fenced[1].trim() : raw;

  return JSON.parse(payload);
}

class DraftValidationError extends Error {
  constructor(message, draft, validationErrors) {
    super(message);
    this.name = 'DraftValidationError';
    this.draft = draft;
    this.validationErrors = validationErrors || [message];
  }
}

class DraftStageError extends Error {
  constructor(message, draft, cause) {
    super(message);
    this.name = 'DraftStageError';
    this.draft = draft;
    this.cause = cause;
  }
}

function countWords(text) {
  return cleanText(String(text || '')).split(/\s+/).filter(Boolean).length;
}

function choosePrimaryCategory(tool) {
  const categoryData = tool.toolCategories?.[0]?.category;
  return {
    categoryL2: categoryData?.name || 'General',
    categoryL1: categoryData?.level1?.name || 'General',
  };
}

function buildSummary(tool, normalized) {
  const summaryParts = [
    normalizeParagraphText(tool.what_is_summary),
    normalizeParagraphText(tool.description),
  ].filter(Boolean);

  if (summaryParts.length) {
    return summaryParts.join('\n\n').slice(0, 2200);
  }

  const featureSnippet = normalized.features.slice(0, 4).join(', ');
  const useCaseSnippet = normalized.useCases.slice(0, 3).join(', ');
  return cleanText(`${tool.name} ${featureSnippet} ${useCaseSnippet}`).slice(0, 1200);
}

function getAboutWordRange(trafficTier, contentDepth) {
  const matrix = {
    Elite: {
      Deep: { min: 900, max: 1300 },
      Standard: { min: 700, max: 1000 },
      Light: { min: 450, max: 700 },
    },
    Growth: {
      Deep: { min: 650, max: 950 },
      Standard: { min: 450, max: 700 },
      Light: { min: 280, max: 450 },
    },
    Niche: {
      Deep: { min: 400, max: 600 },
      Standard: { min: 250, max: 420 },
      Light: { min: 180, max: 300 },
    },
  };

  return matrix[trafficTier]?.[contentDepth] || matrix.Growth.Standard;
}

function decideContentDepth(normalized, trafficTier) {
  let evidenceScore = 0;
  evidenceScore += normalized.summary ? 2 : 0;
  evidenceScore += normalized.features.length >= 4 ? 2 : normalized.features.length ? 1 : 0;
  evidenceScore += normalized.useCases.length >= 3 ? 2 : normalized.useCases.length ? 1 : 0;
  evidenceScore += normalized.forJobs.length >= 3 ? 2 : normalized.forJobs.length ? 1 : 0;
  evidenceScore += normalized.faq.length >= 3 ? 2 : normalized.faq.length ? 1 : 0;
  evidenceScore += normalized.tags.length >= 4 ? 1 : 0;
  evidenceScore += normalized.websiteTypes.length ? 1 : 0;

  if (trafficTier === 'Elite' && evidenceScore >= 5) return 'Deep';
  if (trafficTier === 'Growth' && evidenceScore >= 7) return 'Deep';
  if (evidenceScore >= 4) return 'Standard';
  return 'Light';
}

function getTargetCounts(contentDepth) {
  if (contentDepth === 'Deep') {
    return { builtFor: 4, features: 5, useCases: 4, faq: 6 };
  }
  if (contentDepth === 'Standard') {
    return { builtFor: 3, features: 4, useCases: 3, faq: 5 };
  }
  return { builtFor: 2, features: 3, useCases: 2, faq: 3 };
}

function normalizeToolInput(tool, totalCount) {
  const { categoryL1, categoryL2 } = choosePrimaryCategory(tool);

  const normalized = {
    id: tool.id,
    name: cleanText(tool.name),
    handle: cleanText(tool.handle),
    rank: Number(tool.rank || 0),
    categoryL1,
    categoryL2,
    features: uniqueNonEmpty(tool.feature, 8),
    pricing: uniqueNonEmpty((tool.pricing || []).map(stripHtml), 4),
    useCases: uniqueNonEmpty(tool.use_cases, 6),
    forJobs: uniqueNonEmpty(tool.for_jobs, 6),
    tags: uniqueNonEmpty(tool.tags, 8),
    websiteTypes: uniqueNonEmpty(tool.website_type, 4),
    recommendLearn: uniqueNonEmpty(tool.recommend_learn, 6),
    faq: normalizeFaqInput(tool.faq).slice(0, 5),
    companyInfo: stripHtml(tool.company_info).slice(0, 1200),
  };

  normalized.summary = buildSummary(tool, normalized);
  normalized.trafficTier = getTier(normalized.rank, totalCount);
  normalized.contentDepth = decideContentDepth(normalized, normalized.trafficTier);
  normalized.wordRange = getAboutWordRange(normalized.trafficTier, normalized.contentDepth);
  normalized.targetCounts = getTargetCounts(normalized.contentDepth);

  return normalized;
}

// ==================== 5. 两阶段生成与校验 ====================
async function callJsonModel({ systemPrompt, payload, temperature, label, tool }) {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const response = await axios.post(
        `${BASE_URL}/chat/completions`,
        {
          model: MODEL_NAME,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(payload) },
          ],
          response_format: { type: 'json_object' },
          temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: API_TIMEOUT,
        },
      );

      const resultText = response?.data?.choices?.[0]?.message?.content;
      return parseJsonResponse(resultText);
    } catch (error) {
      const reason = getErrorMessage(error);
      console.warn(`[⚠️ ${label}] ID ${tool.id} [${tool.name}] 第 ${attempt}/${RETRY_LIMIT} 次失败: ${reason}`);
      if (attempt === RETRY_LIMIT) throw new Error(`${label} failed: ${reason}`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

function ensureString(value, fieldName) {
  const text = normalizeParagraphText(value);
  if (!text) throw new Error(`${fieldName} is empty`);
  return text;
}

function normalizeIntentType(value) {
  const allowed = new Set(['pricing', 'fit', 'workflow', 'limitations', 'integration', 'comparison', 'general']);
  const text = cleanText(value).toLowerCase();
  return allowed.has(text) ? text : 'general';
}

function buildFallbackBlueprint(input) {
  const builtForSeed = input.forJobs.length
    ? input.forJobs
    : [`${input.categoryL2} teams`, `${input.categoryL1} practitioners`];

  const featureSeed = input.features.length
    ? input.features
    : [`${input.name} workflow support`, `${input.categoryL2} task coverage`];

  const useCaseSeed = input.useCases.length
    ? input.useCases
    : [`${input.categoryL2} workflow evaluation`, `${input.name} day-to-day execution`];

  const faqSeed = input.faq.length
    ? input.faq.map((item) => item.question)
    : [
        `Who gets the most value from ${input.name}?`,
        `What is the main limitation of ${input.name}?`,
        `How does ${input.name} fit into a ${input.categoryL2} workflow?`,
      ];

  return {
    seo_meta_title: `${input.name}: ${input.categoryL2} analysis`.slice(0, 255),
    seo_meta_description: `Analysis of ${input.name}, its key strengths, practical fit, and workflow value for ${input.categoryL2} users.`.slice(0, 500),
    seo_meta_keywords: uniqueNonEmpty([
      input.name,
      `${input.name} review`,
      input.categoryL2,
      ...input.tags,
      ...input.websiteTypes,
    ], 6),
    narrative_focus: {
      positioning: input.summary.slice(0, 320),
      standout_strengths: (input.features.length ? input.features : featureSeed).slice(0, 3),
      caution_points: faqSeed.slice(0, 2),
      audience_angles: builtForSeed.slice(0, 3),
    },
    built_for_plan: builtForSeed.slice(0, input.targetCounts.builtFor).map((job) => ({
      job,
      angle: `Explain why ${job} can extract practical value from ${input.name}.`,
    })),
    feature_plan: featureSeed.slice(0, input.targetCounts.features).map((title) => ({
      title,
      angle: `Explain how ${title} changes the workflow and what tradeoff may appear.`,
      priority: 'medium',
    })),
    usecase_plan: useCaseSeed.slice(0, input.targetCounts.useCases).map((title) => ({
      title,
      scenario_focus: `Show where ${title} becomes a real workflow advantage.`,
    })),
    faq_plan: faqSeed.slice(0, input.targetCounts.faq).map((question) => ({
      question,
      intent_type: 'general',
    })),
  };
}

function normalizePlanItems(items, mapper, limit) {
  const result = [];
  const seen = new Set();

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = mapper(item);
    if (!normalized) continue;
    const key = JSON.stringify(normalized).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (limit && result.length >= limit) break;
  }

  return result;
}

function validateBlueprint(rawBlueprint, input) {
  const fallback = buildFallbackBlueprint(input);
  const blueprint = rawBlueprint && typeof rawBlueprint === 'object' ? rawBlueprint : {};

  const seo_meta_title = cleanText(blueprint.seo_meta_title || fallback.seo_meta_title).slice(0, 255);
  const seo_meta_description = cleanText(blueprint.seo_meta_description || fallback.seo_meta_description).slice(0, 500);
  const seo_meta_keywords = uniqueNonEmpty(blueprint.seo_meta_keywords || fallback.seo_meta_keywords, 8);

  const narrative_focus = blueprint.narrative_focus && typeof blueprint.narrative_focus === 'object'
    ? blueprint.narrative_focus
    : fallback.narrative_focus;

  const built_for_plan = normalizePlanItems(
    blueprint.built_for_plan,
    (item) => {
      const job = cleanText(item?.job);
      const angle = cleanText(item?.angle);
      if (!job || !angle) return null;
      return { job, angle };
    },
    input.targetCounts.builtFor,
  );

  const feature_plan = normalizePlanItems(
    blueprint.feature_plan,
    (item) => {
      const title = cleanText(item?.title);
      const angle = cleanText(item?.angle);
      const priority = ['high', 'medium', 'low'].includes(cleanText(item?.priority).toLowerCase())
        ? cleanText(item?.priority).toLowerCase()
        : 'medium';
      if (!title || !angle) return null;
      return { title, angle, priority };
    },
    input.targetCounts.features,
  );

  const usecase_plan = normalizePlanItems(
    blueprint.usecase_plan,
    (item) => {
      const title = cleanText(item?.title);
      const scenario_focus = cleanText(item?.scenario_focus);
      if (!title || !scenario_focus) return null;
      return { title, scenario_focus };
    },
    input.targetCounts.useCases,
  );

  const faq_plan = normalizePlanItems(
    blueprint.faq_plan,
    (item) => {
      const question = cleanText(item?.question);
      if (!question) return null;
      return { question, intent_type: normalizeIntentType(item?.intent_type) };
    },
    input.targetCounts.faq,
  );

  return {
    seo_meta_title: seo_meta_title || fallback.seo_meta_title,
    seo_meta_description: seo_meta_description || fallback.seo_meta_description,
    seo_meta_keywords: seo_meta_keywords.length ? seo_meta_keywords : fallback.seo_meta_keywords,
    narrative_focus: {
      positioning: cleanText(narrative_focus.positioning || fallback.narrative_focus.positioning).slice(0, 320),
      standout_strengths: uniqueNonEmpty(narrative_focus.standout_strengths || fallback.narrative_focus.standout_strengths, 4),
      caution_points: uniqueNonEmpty(narrative_focus.caution_points || fallback.narrative_focus.caution_points, 4),
      audience_angles: uniqueNonEmpty(narrative_focus.audience_angles || fallback.narrative_focus.audience_angles, 4),
    },
    built_for_plan: built_for_plan.length ? built_for_plan : fallback.built_for_plan,
    feature_plan: feature_plan.length ? feature_plan : fallback.feature_plan,
    usecase_plan: usecase_plan.length ? usecase_plan : fallback.usecase_plan,
    faq_plan: faq_plan.length ? faq_plan : fallback.faq_plan,
  };
}

function normalizeBuiltForDetails(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([job, why_it_fits]) => ({
      job,
      why_it_fits,
      best_value: '',
      caution: '',
    }));
  }
  return [];
}

function buildAboutDraft(rawPayload) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  return {
    expanded_about: normalizeParagraphText(payload.expanded_about),
  };
}

function buildStructuredDraft(rawPayload, blueprint) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};

  return {
    seo_meta_title: cleanText(payload.seo_meta_title || blueprint.seo_meta_title).slice(0, 255),
    seo_meta_description: cleanText(payload.seo_meta_description || blueprint.seo_meta_description).slice(0, 500),
    seo_meta_keywords: uniqueNonEmpty(payload.seo_meta_keywords || blueprint.seo_meta_keywords, 8),
    built_for_details: normalizePlanItems(
      normalizeBuiltForDetails(payload.built_for_details),
      (item) => {
        const job = cleanText(item?.job);
        const why_it_fits = normalizeParagraphText(item?.why_it_fits);
        const best_value = normalizeParagraphText(item?.best_value);
        const caution = normalizeParagraphText(item?.caution);
        if (!job || !why_it_fits || !best_value || !caution) return null;
        return { job, why_it_fits, best_value, caution };
      },
      blueprint.built_for_plan.length,
    ),
    features_details: normalizePlanItems(
      payload.features_details,
      (item) => {
        const title = cleanText(item?.title);
        const desc = normalizeParagraphText(item?.desc);
        const benefit = normalizeParagraphText(item?.benefit);
        const limit = normalizeParagraphText(item?.limit);
        if (!title || !desc || !benefit || !limit) return null;
        return { title, desc, benefit, limit };
      },
      blueprint.feature_plan.length,
    ),
    expanded_usecases: normalizePlanItems(
      payload.expanded_usecases,
      (item) => {
        const title = cleanText(item?.title);
        const scenario = normalizeParagraphText(item?.scenario);
        const solution = normalizeParagraphText(item?.solution);
        const benefit = normalizeParagraphText(item?.benefit);
        const user_type = cleanText(item?.user_type);
        if (!title || !scenario || !solution || !benefit || !user_type) return null;
        return { title, scenario, solution, benefit, user_type };
      },
      blueprint.usecase_plan.length,
    ),
    expanded_faqs: normalizePlanItems(
      payload.expanded_faqs,
      (item) => {
        const question = cleanText(item?.question);
        const answer = normalizeParagraphText(item?.answer);
        if (!question || !answer) return null;
        return { question, answer, intent_type: normalizeIntentType(item?.intent_type) };
      },
      blueprint.faq_plan.length,
    ),
  };
}

function mergeDraftParts(aboutDraft, structuredDraft) {
  return {
    seo_meta_title: structuredDraft.seo_meta_title,
    seo_meta_description: structuredDraft.seo_meta_description,
    seo_meta_keywords: structuredDraft.seo_meta_keywords,
    expanded_about: aboutDraft.expanded_about,
    built_for_details: structuredDraft.built_for_details,
    features_details: structuredDraft.features_details,
    expanded_usecases: structuredDraft.expanded_usecases,
    expanded_faqs: structuredDraft.expanded_faqs,
  };
}

function buildDraftPayload(rawPayload, blueprint) {
  const aboutDraft = buildAboutDraft(rawPayload);
  const structuredDraft = buildStructuredDraft(rawPayload, blueprint);
  return mergeDraftParts(aboutDraft, structuredDraft);
}

function validateDraftPayload(draft, blueprint, input) {
  const validationErrors = [];
  const aboutWordCount = countWords(draft.expanded_about);
  const wordShortfall = Math.max(0, input.wordRange.min - aboutWordCount);

  if (!draft.expanded_about) {
    validationErrors.push('expanded_about is empty');
  } else if (wordShortfall > ABOUT_WORD_SOFT_SHORTFALL) {
    validationErrors.push(`expanded_about too short: ${aboutWordCount} words, expected >= ${input.wordRange.min}`);
  } else if (wordShortfall > 0) {
    console.warn(`[⚠️ about-soft-warning] ${draft.seo_meta_title || 'Untitled draft'} short by ${wordShortfall} words; allowing pass for manual review.`);
  }

  if (!draft.seo_meta_title || !draft.seo_meta_description || !draft.seo_meta_keywords.length) {
    validationErrors.push('SEO meta fields are incomplete');
  }
  if (draft.built_for_details.length < Math.max(1, blueprint.built_for_plan.length)) {
    validationErrors.push('built_for_details did not reach blueprint depth');
  }
  if (draft.features_details.length < Math.max(1, blueprint.feature_plan.length)) {
    validationErrors.push('features_details did not reach blueprint depth');
  }
  if (draft.expanded_usecases.length < Math.max(1, blueprint.usecase_plan.length)) {
    validationErrors.push('expanded_usecases did not reach blueprint depth');
  }
  if (draft.expanded_faqs.length < Math.max(1, blueprint.faq_plan.length)) {
    validationErrors.push('expanded_faqs did not reach blueprint depth');
  }

  return validationErrors;
}

function normalizeFinalPayload(rawPayload, blueprint, input) {
  const draft = buildDraftPayload(rawPayload, blueprint);
  const validationErrors = validateDraftPayload(draft, blueprint, input);

  if (validationErrors.length) {
    throw new DraftValidationError(validationErrors[0], draft, validationErrors);
  }

  return draft;
}

async function generateBlueprint(input) {
  const blueprintPayload = {
    stage: 'blueprint',
    content_goal: 'turn shallow tool facts into a deep structured content plan',
    constraints: {
      traffic_tier: input.trafficTier,
      content_depth: input.contentDepth,
      about_word_range: input.wordRange,
      target_counts: input.targetCounts,
      built_for_must_be_array: true,
    },
    tool: {
      name: input.name,
      handle: input.handle,
      rank: input.rank,
      category_l1: input.categoryL1,
      category_l2: input.categoryL2,
      summary: input.summary,
      features: input.features,
      pricing: input.pricing,
      use_cases: input.useCases,
      for_jobs: input.forJobs,
      tags: input.tags,
      website_types: input.websiteTypes,
      faq: input.faq,
      company_info: input.companyInfo,
      recommend_learn: input.recommendLearn,
    },
  };

  const rawBlueprint = await callJsonModel({
    systemPrompt: BLUEPRINT_SYSTEM_PROMPT,
    payload: blueprintPayload,
    temperature: 0.35,
    label: 'stage1-blueprint',
    tool: input,
  });

  return validateBlueprint(rawBlueprint, input);
}

async function generateExpandedContent(input, blueprint) {
  const aboutPayload = {
    stage: 'expansion',
    section: 'about',
    constraints: {
      traffic_tier: input.trafficTier,
      content_depth: input.contentDepth,
      about_word_range: input.wordRange,
    },
    tool: {
      name: input.name,
      handle: input.handle,
      rank: input.rank,
      category_l1: input.categoryL1,
      category_l2: input.categoryL2,
      summary: input.summary,
      features: input.features,
      pricing: input.pricing,
      use_cases: input.useCases,
      for_jobs: input.forJobs,
      tags: input.tags,
      website_types: input.websiteTypes,
      faq: input.faq,
      company_info: input.companyInfo,
      recommend_learn: input.recommendLearn,
    },
    blueprint,
  };

  const aboutRawPayload = await callJsonModel({
    systemPrompt: ABOUT_EXPANSION_SYSTEM_PROMPT,
    payload: aboutPayload,
    temperature: 0.65,
    label: 'stage2-about',
    tool: input,
  });

  const aboutDraft = buildAboutDraft(aboutRawPayload);

  const structuredPayload = {
    stage: 'expansion',
    section: 'structured',
    constraints: {
      traffic_tier: input.trafficTier,
      content_depth: input.contentDepth,
      target_counts: input.targetCounts,
      built_for_must_be_array: true,
    },
    tool: {
      name: input.name,
      handle: input.handle,
      rank: input.rank,
      category_l1: input.categoryL1,
      category_l2: input.categoryL2,
      summary: input.summary,
      features: input.features,
      pricing: input.pricing,
      use_cases: input.useCases,
      for_jobs: input.forJobs,
      tags: input.tags,
      website_types: input.websiteTypes,
      faq: input.faq,
      company_info: input.companyInfo,
      recommend_learn: input.recommendLearn,
    },
    blueprint,
  };

  let structuredDraft;

  try {
    const structuredRawPayload = await callJsonModel({
      systemPrompt: STRUCTURED_EXPANSION_SYSTEM_PROMPT,
      payload: structuredPayload,
      temperature: 0.55,
      label: 'stage2-structured',
      tool: input,
    });

    structuredDraft = buildStructuredDraft(structuredRawPayload, blueprint);
  } catch (error) {
    throw new DraftStageError(error.message, mergeDraftParts(aboutDraft, buildStructuredDraft({}, blueprint)), error);
  }

  return normalizeFinalPayload(mergeDraftParts(aboutDraft, structuredDraft), blueprint, input);
}

async function processToolWithAI(tool, totalCount) {
  const input = normalizeToolInput(tool, totalCount);
  const blueprint = await generateBlueprint(input);
  return generateExpandedContent(input, blueprint);
}

function buildFailureUpdateData(error) {
  const draft = error?.draft;
  if (!draft) {
    return { seo_version: -1 };
  }

  return {
    seo_meta_title: draft.seo_meta_title || null,
    seo_meta_description: draft.seo_meta_description || null,
    seo_meta_keywords: Array.isArray(draft.seo_meta_keywords) ? draft.seo_meta_keywords : [],
    expanded_about: draft.expanded_about || null,
    built_for_details: Array.isArray(draft.built_for_details) ? draft.built_for_details : [],
    features_details: Array.isArray(draft.features_details) ? draft.features_details : [],
    expanded_usecases: Array.isArray(draft.expanded_usecases) ? draft.expanded_usecases : [],
    expanded_faqs: Array.isArray(draft.expanded_faqs) ? draft.expanded_faqs : [],
    seo_version: -1,
  };
}

// ==================== 6. 核心调度引擎 ====================
function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function main() {
  console.log('🤖 Programmatic SEO 深度内容双阶段引擎就绪...');

  const totalCount = await prisma.aiTool.count({
    where: { tool_status: 'ONLINE' },
  });
  console.log(`📊 符合条件的 ONLINE 工具共有 ${totalCount} 条。Rank 分层与深度生成已激活。`);

  const input = await askQuestion('请输入运行测试数量 (回车进入全量模式): ');
  let mode = 'FULL';
  let limitCount = DEFAULT_BATCH_SIZE;

  if (input !== '') {
    const parsed = Number.parseInt(input, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error('测试数量必须是大于 0 的整数');
    }
    mode = 'TEST';
    limitCount = parsed;
  }

  const testConcurrency = mode === 'TEST' && limitCount > 1000 ? CONCURRENCY : 1;
  const queue = new PQueue({ concurrency: mode === 'TEST' ? testConcurrency : CONCURRENCY });
  let processedCount = 0;

  while (true) {
    const tools = await prisma.aiTool.findMany({
      where: {
        seo_version: 0,
        tool_status: 'ONLINE',
      },
      take: mode === 'TEST' ? limitCount : DEFAULT_BATCH_SIZE,
      orderBy: [
        { rank: 'asc' },
        { id: 'asc' },
      ],
      include: {
        toolCategories: {
          include: {
            category: {
              include: { level1: true },
            },
          },
        },
      },
    });

    if (tools.length === 0) {
      console.log('🎉 所有符合条件的 ONLINE 工具都已处理完毕！');
      break;
    }

    console.log(`\n📦 准备处理 ${tools.length} 条数据...`);

    const promises = tools.map((tool) => queue.add(async () => {
      try {
        const aiData = await processToolWithAI(tool, totalCount);

        await prisma.aiTool.update({
          where: { id: tool.id },
          data: {
            seo_meta_title: aiData.seo_meta_title,
            seo_meta_description: aiData.seo_meta_description,
            seo_meta_keywords: aiData.seo_meta_keywords,
            expanded_about: aiData.expanded_about,
            built_for_details: aiData.built_for_details,
            features_details: aiData.features_details,
            expanded_usecases: aiData.expanded_usecases,
            expanded_faqs: aiData.expanded_faqs,
            seo_version: 1,
          },
        });

        processedCount += 1;
        console.log(`[✅ 成功] ${tool.name} (Rank: ${tool.rank} | Category: ${tool.toolCategories[0]?.category?.name || '无分类'} | 已完成 ${processedCount} 条)`);
      } catch (error) {
        console.error(`[❌ 失败] ${tool.name}: ${error.message}`);
        await prisma.aiTool.update({
          where: { id: tool.id },
          data: buildFailureUpdateData(error),
        });

        if (error instanceof DraftValidationError) {
          console.warn(`[📝 草稿已保留] ${tool.name}: ${error.validationErrors.join(' | ')}`);
        }
      }
    }));

    await Promise.all(promises);
    if (mode === 'TEST') break;
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('🚨 脚本异常中断：', error);
  await prisma.$disconnect();
  process.exit(1);
});