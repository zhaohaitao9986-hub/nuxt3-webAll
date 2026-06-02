'use strict';

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const readline = require('readline');
const RawPQueue = require('p-queue');
const { DEFAULT_EVALUATION_PROFILE, resolveEvaluationProfile } = require('./categoryEvaluationRegistry.cjs');

const PQueue = RawPQueue.default || RawPQueue;
const prisma = new PrismaClient();

const API_KEY = 'sk-816a11590a0e40e1a95bbce24db013fa';
const BASE_URL = 'https://api.deepseek.com/v1';
const MODEL_NAME = 'deepseek-chat';
const CONCURRENCY = 5;
const DEFAULT_BATCH_SIZE = 50;
const API_TIMEOUT = 90000;
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 4000;

const MARKETING_HYPE_PATTERN = /\b(revolutionary|powerful|game-changing|cutting-edge|best-in-class|seamless|innovative|ultimate|world-class)\b/i;
const GENERIC_AUDIENCE_PATTERN = /\b(everyone|all users|anyone|every team|all teams)\b/i;
const POSITIVE_FIT_PATTERN = /\b(best for|best suited for|ideal for|well-suited for|suited to|works best for|most useful for|valuable for|strong fit for)\b/i;
const MISFIT_PATTERN = /\b(not ideal|less useful|weaker fit|not the best fit|overkill|less suitable|poor fit|harder for|limited value for)\b/i;
const BOUNDARY_PATTERN = /\b(unlike|rather than|instead of|within|narrower|more specific|focus(?:es|ed)? on|does not focus on|compared with|versus|vs)\b/i;
const CONDITION_PATTERN = /\b(however|but|depends(?:\s+on)?|depending on|based on|if|when|provided|as long as|trade-?off|caveat|constraint|review|unless|typically|usually|may|can|often|varies by|in many cases|in practice|not always|for some teams|for some workflows|works best when)\b/i;
const FAQ_PLACEHOLDER_PATTERN = /\ba practical answer about\b/i;
const BEST_FOR_LABEL_PATTERN = /\bbest for\s*:/i;
const NOT_IDEAL_FOR_LABEL_PATTERN = /\bnot ideal for\s*:/i;
const SUMMARY_LABEL_PATTERN = /\bsummary\s*:/i;
const SELECTION_DIMENSION_PATTERN = /\b(quality|control|fit|burden|trade-?off|oversight|consistency|accuracy|flexibility|collaboration|customization|integration|workflow|originality|scalability|coverage|review|cost|speed|depth|support|compliance|brand voice|editorial)\b/i;
const PRODUCT_RECOMMENDATION_PATTERN = /\b(recommend|recommended|worth using|best tool|best option|top tool|top pick|try\b|choose|consider)\b/i;
const FAQ_ABSOLUTE_PATTERN = /\b(always|never|guaranteed|everyone|all users|all teams|without review)\b/i;
const FAQ_YES_NO_START_PATTERN = /^(yes|no)[,!.]?\s*/i;
const EXAMPLE_BRAND_PATTERN = /\b(for example|for instance|such as|including|like)\b.{0,80}\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}|[A-Z]{2,}[A-Za-z0-9]*)\b/;
const NAMED_RECOMMENDATION_PATTERN = /\b(recommend|recommended|try|choose|consider|pick)\b.{0,40}\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}|[A-Z]{2,}[A-Za-z0-9]*)\b/;
const COMMON_NON_PRODUCT_TOKENS = new Set(['it', 'this', 'that', 'these', 'those', 'however', 'many', 'some', 'most', 'general', 'full', 'human', 'quality', 'cost', 'costs', 'editing', 'review', 'support', 'coverage', 'check', 'beginners', 'professionals', 'users', 'buyers', 'output', 'outputs', 'free', 'selection', 'english', 'spanish', 'french', 'german', 'chinese', 'japanese', 'korean', 'arabic', 'portuguese', 'italian', 'hindi', 'dutch', 'russian', 'turkish', 'polish', 'srt', 'vtt', 'jpeg', 'jpg', 'png', 'mp4', 'pdf', 'docx', 'epub']);
const GENERIC_FEATURE_PATTERN = /\b(content creation|seo optimization|customizable styles|content ideas|editing tools|integration and workflow support|editing and refinement tools|content generation quality)\b/i;
const FEATURE_CAPABILITY_WORD_PATTERN = /\b(generator|generation|tool|tools|feature|features|assistant|assistants)\b/i;
const FEATURE_CAPABILITY_NOUN_PATTERN = /\b(creation|generation|ideas|tools|features|platforms|options|templates|automation|capabilities)\b/i;
const FEATURE_BAD_ENDING_PATTERN = /\b(features|tools|platforms|options|templates|automation|capabilities)\b$/i;
const WORKFLOW_STAGE_PATTERNS = [
  /\b(input|prompt|brief|source|data|request|materials)\b/i,
  /\b(generate|process|transform|analyze|classify|draft|produce)\b/i,
  /\b(review|refine|approve|publish|handoff|output|deliver)\b/i,
];
const DEFAULT_FEATURE_DIMENSIONS = [
  'editorial control and rewrite flexibility',
  'output quality consistency under repeat use',
  'search-intent optimization depth and workflow fit',
  'review burden for accuracy and originality',
  'publishing handoff and CMS workflow fit',
  'cost scalability for recurring content volume',
];
const DEFAULT_FAQ_SEEDS = [
  { question: 'What defines this category?', intent_type: 'definition' },
  { question: 'How should buyers compare tools in this category?', intent_type: 'selection' },
  { question: 'How does this category fit into a workflow?', intent_type: 'workflow' },
  { question: 'Where are the main limitations of this category?', intent_type: 'limitations' },
  { question: 'Are free or entry-level options common in this category?', intent_type: 'pricing' },
];
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'among', 'and', 'are', 'because', 'been', 'being', 'between', 'both',
  'but', 'can', 'does', 'each', 'from', 'have', 'into', 'more', 'most', 'much', 'only', 'over', 'same', 'some',
  'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'very', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your', 'within', 'rather', 'instead',
]);
const TOP_TOOLS_LIMIT = 8;
const SUMMARY_WORD_SOFT_SHORTFALL = 40;
const CATEGORY_BLUEPRINT_SYSTEM_PROMPT = `
You are the lead editorial strategist for a premium AI tools directory.

Core mission:
- Turn shallow category facts into a defensible editorial blueprint for a secondary category page.
- Think like an experienced category editor planning a useful buyer guide, not like a copywriter generating filler.
- Use ONLY the supplied facts or careful, minimal inference that can be justified from those facts.
- Treat existing_content as a legacy draft to audit, compress, correct, or replace. Do not inherit its wording by default.
- Treat tool_signals.top_tools as representative examples, not as exhaustive truth about the category.
- Treat evaluation_profile as the approved comparison lens for feature dimensions and workflow expectations.
- Do not invent market size, adoption, benchmark claims, ROI, integrations, pricing ranges, or product capabilities not present in the input.

Editorial planning goals:
- Define what this category is actually for.
- Clarify how this secondary category differs from its parent category.
- Identify what buyers should compare across tools in this category.
- Surface where this category is genuinely useful, where it is overkill, and where buyers should stay cautious.
- Keep sections clearly differentiated: summary = category definition and boundary; feature = evaluation dimensions; who_is_use = role fit; how_do_work = workflow pattern; advantages = realistic outcomes plus caveat; faq = search intent.
- Plan the page as a category-level buyer guide, not as a product roundup and not as a hidden tool recommendation page.

Hard planning rules:
- Do not write final prose paragraphs.
- Do not write product marketing slogans.
- Do not let feature become a list of generic capabilities; feature plans must read like buyer selection criteria.
- When evaluation_profile provides feature dimensions, use them as the default comparison frame unless the evidence clearly justifies a narrower angle.
- Do not let summary, who_is_use, how_do_work, and advantages repeat the same idea with different phrasing.
- If evidence is thin, explicitly narrow the angle rather than hallucinating depth.
- Do not plan to mention specific tool or product names in the final content.
- Do not plan FAQ answers that recommend or compare named products.

Boundary rules:
- The blueprint must state what makes this secondary category distinct from the parent category.
- The blueprint must avoid describing the entire parent category unless the distinction is necessary for clarity.
- If the supplied signals suggest the category is noisy, overlapping, or fuzzy, say so.

Output rules:
- Return ONLY raw JSON.
- Keep field names exactly as requested.
- feature_plan and faq_plan must be arrays, never objects.

Required JSON schema:
{
  "category_thesis": "string",
  "category_boundary": {
    "parent_category": "string",
    "what_this_category_includes": ["string"],
    "what_this_category_does_not_focus_on": ["string"],
    "difference_from_parent": "string"
  },
  "evidence_assessment": {
    "level": "rich|moderate|thin",
    "strengths": ["string"],
    "gaps": ["string"],
    "risk_notes": ["string"]
  },
  "editorial_focus": {
    "why_it_matters": "string",
    "best_fit_buyers": ["string"],
    "overuse_or_misfit_cases": ["string"],
    "buyer_cautions": ["string"]
  },
  "section_plans": {
    "what_is_summary": {
      "thesis": "string",
      "must_cover": ["string"],
      "must_avoid": ["string"]
    },
    "feature_plan": [
      { "title": "string", "angle": "string", "priority": "high|medium|low" }
    ],
    "who_is_use": {
      "audiences": ["string"],
      "angle": "string",
      "misfit_cases": ["string"]
    },
    "how_do_work": {
      "workflow_steps": ["string"],
      "angle": "string"
    },
    "advantages": {
      "benefit_themes": ["string"],
      "caution": "string"
    },
    "faq_plan": [
      { "question": "string", "intent_type": "definition|selection|workflow|pricing|limitations|comparison|general" }
    ]
  },
  "anti_overlap_notes": ["string"]
}
`;

const CATEGORY_OPENING_SYSTEM_PROMPT = `
You are a senior editor writing the opening section for a premium AI tools category page.

Core mission:
- Write ONLY the what_is_summary field.
- The result must read like the opening section of a serious category guide, not like generic SEO filler.
- Ground every claim in the provided blueprint and evidence.
- Treat existing_content as low-trust legacy material. You may improve, narrow, or replace it. Do not echo its wording unless it is clearly useful.

What the opening must accomplish:
- Define what this category is.
- Explain why it matters to a practical buyer or operator.
- Clarify how it differs from the parent category.
- State where this category is genuinely useful in real workflows.
- Include one grounded caution or limitation theme if relevant.

Hard writing requirements:
- what_is_summary MUST land within word_ranges.what_is_summary.
- Treat the minimum word count as a real requirement.
- The first 160 characters must be information-dense and editorially sharp.
- The exact parent category name must appear within the first two sentences.
- No markdown.
- No HTML.
- No bullet-list prose.
- No hype language such as revolutionary, game-changing, cutting-edge, powerful, or best-in-class.
- Do not invent adoption, pricing, ROI, integration coverage, or benchmark claims.
- Do not turn this into a list of tools or brands.
- Do not mention specific tool or product names.
- Keep the category name and parent category names exactly as provided.

Style rules:
- Clear editorial thesis first.
- Then add category boundary, workflow relevance, and buyer significance.
- Sound analytical, concrete, and slightly selective.
- If evidence is thin, write a narrower and more careful opening rather than padding with generic claims.

Output rules:
- Return ONLY raw JSON.
- Keep the field name exactly as requested.

Required JSON schema:
{
  "what_is_summary": "string"
}
`;

const CATEGORY_STRUCTURED_SYSTEM_PROMPT = `
You are a senior editor writing the structured companion sections for a premium AI tools category page.

Core mission:
- Expand the supplied blueprint into the structured content fields.
- Do NOT write what_is_summary here.
- Each section must do a different editorial job.
- Every point must stay grounded in the provided facts, blueprint, and tool signals.
- Treat top tools as evidence signals, not as endorsements and not as a complete map of the category.
- Treat evaluation_profile as the approved lens for buyer-comparison dimensions and workflow structure.

Section roles:
- feature: buyer evaluation dimensions for comparing tools in this category.
- who_is_use: who gets the most practical value, and who is a weaker fit.
- how_do_work: the common workflow pattern from input to review or output.
- advantages: realistic benefits of adopting tools in this category, plus one practical caveat.
- faq: search-intent answers that help users understand fit, limitations, selection logic, and workflow relevance.

Hard writing requirements:
- who_is_use, how_do_work, and advantages must each land within their supplied word_ranges.
- feature must be an array of strings with the requested item count.
- Each feature item should be 8-18 words and describe a buyer selection criterion, not a slogan, not a capability inventory item, and not a product feature ad.
- who_is_use must be an object with best_for, not_ideal_for, and summary fields.
- faq must be an array of objects with title and desc only.
- Each faq desc should be 2-4 sentences, direct, useful, and nuanced.
- Do not repeat the summary thesis word-for-word.
- Do not restate the same claim across multiple sections.
- Do not invent concrete pricing, benchmark, adoption, or integration claims.
- Do not mention specific tool or product names anywhere.
- FAQ must never recommend, compare, or list concrete products.

Specific rules by field:
- feature: write short buyer comparison dimensions, not capability labels. Good examples: "Editorial control and rewrite flexibility", "Search-intent optimization depth and workflow fit", "Review burden for accuracy and originality", "Cost scalability for recurring content volume". Bad examples: "SEO optimization features", "SEO evaluation capabilities", "Topic and outline generation", "Editing tools", "Integration with CMS platforms".
- feature: each item should read like a noun-phrase selection standard a buyer would compare across tools, not like a sentence about what the product can do.
- feature: prefer comparison-language such as control, fit, burden, depth, consistency, scalability, oversight, or handoff quality.
- feature: avoid ending items with feature nouns such as features, tools, platforms, options, templates, automation, or capabilities.
- who_is_use: use explicit buyer-fit structure with labeled best_for and not_ideal_for lists, then add a short summary.
- how_do_work: describe the common workflow pattern of this category, not one specific tool's UX.
- advantages: focus on realistic outcomes, not abstract praise; include one caveat, dependency, or operational condition.
- faq: answer real buyer questions with conditional language such as may, can, often, depends on, varies by, typically, in practice, or in many cases.
- faq: avoid absolute claims such as always, never, guaranteed, or automatic outcomes without review.
- faq: if an answer starts with yes or no, qualify it immediately with a condition or limitation.
- faq: pricing answers must stay at category level, using patterns like usage-based, seat-based, volume-based, or review-driven costs rather than specific plans, vendors, or free-trial examples.
- faq: for media, caption, or subtitle workflows, qualify quality claims by source quality, language, platform norms, and human review needs.

Output rules:
- Return ONLY raw JSON.
- Keep field names exactly as requested.

Required JSON schema:
{
  "feature": ["string"],
  "who_is_use": {
    "best_for": ["string"],
    "not_ideal_for": ["string"],
    "summary": "string"
  },
  "how_do_work": "string",
  "advantages": "string",
  "faq": [
    {
      "title": "string",
      "desc": "string"
    }
  ]
}
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const title = cleanText(item.title || item.question);
    const desc = normalizeParagraphText(item.desc || item.answer);
    if (!title || !desc) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ title, desc });
  }

  return normalized;
}

function tokenizeForSimilarity(text) {
  return new Set(
    cleanText(stripHtml(text))
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3 && !STOP_WORDS.has(token)),
  );
}

function getTextSimilarity(left, right) {
  const a = tokenizeForSimilarity(left);
  const b = tokenizeForSimilarity(right);
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function matchesKeywordGroup(text, keywords) {
  const haystack = cleanText(text).toLowerCase();
  return (Array.isArray(keywords) ? keywords : []).some((keyword) => haystack.includes(cleanText(keyword).toLowerCase()));
}

function hasWorkflowProgression(text, evaluationProfile = DEFAULT_EVALUATION_PROFILE) {
  const stageGroups = evaluationProfile?.workflow_stage_groups?.length
    ? evaluationProfile.workflow_stage_groups
    : DEFAULT_EVALUATION_PROFILE.workflow_stage_groups;

  return stageGroups.filter((group) => matchesKeywordGroup(text, group)).length >= 2;
}

function hasBoundaryLanguage(text) {
  return BOUNDARY_PATTERN.test(text);
}

function hasConditionLanguage(text) {
  return CONDITION_PATTERN.test(text);
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getFirstTwoSentencesText(text) {
  const sentences = cleanText(text)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return sentences.join(' ');
}

function looksLikeSelectionCriterion(text, evaluationProfile = DEFAULT_EVALUATION_PROFILE) {
  const keywords = evaluationProfile?.selection_keywords?.length
    ? evaluationProfile.selection_keywords
    : DEFAULT_EVALUATION_PROFILE.selection_keywords;

  return (SELECTION_DIMENSION_PATTERN.test(text) || matchesKeywordGroup(text, keywords))
    && !MARKETING_HYPE_PATTERN.test(text);
}

function formatWhoIsUseSection({ best_for, not_ideal_for, summary }) {
  const parts = [];

  if (best_for.length) {
    parts.push(`Best For: ${best_for.join('; ')}`);
  }
  if (not_ideal_for.length) {
    parts.push(`Not Ideal For: ${not_ideal_for.join('; ')}`);
  }
  if (summary) {
    parts.push(`Summary: ${summary}`);
  }

  return parts.join('\n');
}

function parseLabeledSegment(text, label) {
  const match = text.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i'));
  if (!match) return [];
  return uniqueNonEmpty(match[1].split(/[;,]|\sand\s/), 6);
}

function normalizeWhoIsUsePayload(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const best_for = uniqueNonEmpty(value.best_for || value.bestFor, 6);
    const not_ideal_for = uniqueNonEmpty(value.not_ideal_for || value.notIdealFor || value.misfit_cases, 6);
    const summary = normalizeParagraphText(value.summary || value.angle);

    return {
      best_for,
      not_ideal_for,
      summary,
      text: formatWhoIsUseSection({ best_for, not_ideal_for, summary }),
    };
  }

  const text = normalizeParagraphText(value);
  const best_for = parseLabeledSegment(text, 'Best For');
  const not_ideal_for = parseLabeledSegment(text, 'Not Ideal For');
  const summaryMatch = text.match(/Summary\s*:\s*([\s\S]+)/i);
  const summary = normalizeParagraphText(summaryMatch ? summaryMatch[1] : text);

  return {
    best_for,
    not_ideal_for,
    summary,
    text: formatWhoIsUseSection({ best_for, not_ideal_for, summary }),
  };
}

function findMentionedToolNames(text, input) {
  const haystack = String(text || '');
  const toolNames = input?.toolSignals?.top_tools?.map((item) => cleanText(item.name)).filter(Boolean) || [];

  return toolNames.filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(haystack));
}

function isLikelyNamedProductReference(candidate, input) {
  const value = cleanText(candidate);
  if (!value) return false;

  const normalized = value.toLowerCase();
  const blockedValues = new Set(
    [
      input?.name,
      input?.parent_name,
      'ai',
      'ai tool',
      'ai tools',
      'blog',
      'blog generator',
      'caption',
      'caption generator',
      'subtitle',
      'subtitle generator',
      'chat',
      'chat generator',
      'content',
      'workflow',
      'platform',
      'tool',
      'tools',
    ]
      .map((item) => cleanText(item).toLowerCase())
      .filter(Boolean)
  );

  if (blockedValues.has(normalized)) return false;
  if (findMentionedToolNames(value, input).length) return true;

  const words = value.split(/\s+/).filter(Boolean);
  const normalizedWords = words
    .map((word) => word.toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .map((word) => (word.endsWith('s') ? word.slice(0, -1) : word))
    .filter(Boolean);
  const genericWords = new Set([
    'ai', 'blog', 'caption', 'subtitle', 'chat', 'generator', 'tool', 'platform', 'workflow', 'content',
    'writing', 'editing', 'assistant', 'post', 'article', 'image', 'video', 'media', 'social', 'post',
  ]);

  if (normalizedWords.length && normalizedWords.every((word) => genericWords.has(word))) {
    return false;
  }

  if (words.length === 1) {
    if (!normalizedWords[0] || STOP_WORDS.has(normalizedWords[0]) || COMMON_NON_PRODUCT_TOKENS.has(normalizedWords[0])) {
      return false;
    }
    return /^[A-Z][A-Za-z0-9._-]{2,}$/.test(value);
  }

  return words.some((word, index) => {
    if (/\d/.test(word) || /[._-]/.test(word)) return true;
    if (!/^[A-Z][A-Za-z0-9]+$/.test(word)) return false;

    const normalizedWord = normalizedWords[index];
    return normalizedWord && !genericWords.has(normalizedWord) && !COMMON_NON_PRODUCT_TOKENS.has(normalizedWord) && !STOP_WORDS.has(normalizedWord);
  });
}

function getExampleProductCandidates(text, input) {
  const match = String(text || '').match(EXAMPLE_BRAND_PATTERN);
  if (!match) return [];

  const candidates = match[0].match(/\b[A-Z][A-Za-z0-9._-]{2,}\b/g) || [];

  return [...new Set(candidates.filter((candidate) => isLikelyNamedProductReference(candidate, input)))];
}

function containsProductRecommendation(text, input) {
  const content = String(text || '');
  if (findMentionedToolNames(content, input).length) return true;

  const exampleProductCandidates = getExampleProductCandidates(content, input);
  if (exampleProductCandidates.length >= 2 && PRODUCT_RECOMMENDATION_PATTERN.test(content)) {
    return true;
  }

  const namedRecommendationMatch = content.match(NAMED_RECOMMENDATION_PATTERN);
  if (namedRecommendationMatch && PRODUCT_RECOMMENDATION_PATTERN.test(namedRecommendationMatch[1])) {
    return isLikelyNamedProductReference(namedRecommendationMatch[2], input);
  }

  return false;
}

function hasQualifiedYesNoStart(text) {
  const content = cleanText(text);
  const match = content.match(FAQ_YES_NO_START_PATTERN);
  if (!match) return true;
  const remainder = content.slice(match[0].length);
  return hasConditionLanguage(remainder);
}

function getFeatureSeed(input) {
  const existing = input.existingContent.feature.filter((item) => looksLikeSelectionCriterion(item, input.evaluationProfile));
  const fallbackSeed = input.evaluationProfile?.feature_dimensions?.length
    ? input.evaluationProfile.feature_dimensions
    : DEFAULT_FEATURE_DIMENSIONS;

  return existing.length >= Math.max(2, Math.ceil(input.targetCounts.feature / 2))
    ? input.existingContent.feature
    : fallbackSeed;
}

function normalizeFeatureDimension(text, evaluationProfile = DEFAULT_EVALUATION_PROFILE) {
  const content = cleanText(text)
    .replace(/[.:;]+$/g, '');

  if (!content) return '';

  const exactRules = evaluationProfile?.normalization_rules?.length
    ? evaluationProfile.normalization_rules
    : DEFAULT_EVALUATION_PROFILE.normalization_rules;

  for (const rule of exactRules) {
    if (rule.pattern.test(content)) {
      return rule.replacement;
    }
  }

  let normalized = content
    .replace(/\bseo optimization\b/i, 'search-intent optimization')
    .replace(/\bidea generation\b/i, 'topic relevance and idea quality')
    .replace(/\bcustomization depth\b/i, 'brand-voice control depth')
    .replace(/\bkeyword handling\b/i, 'keyword-planning workflow fit')
    .replace(/\bediting and revision workflow handoff\b/i, 'revision workflow handoff and approval fit')
    .replace(/\bcontent originality\b/i, 'originality risk');

  normalized = normalized
    .replace(/\bintegration\b/i, 'workflow fit')
    .replace(/\bcapabilities\b/i, 'fit')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

function hasSelectionCriterionStyle(text, evaluationProfile = DEFAULT_EVALUATION_PROFILE) {
  const content = cleanText(text);
  if (!content) return false;
  if (content.includes(':')) return false;
  if (GENERIC_FEATURE_PATTERN.test(content)) return false;
  if (FEATURE_CAPABILITY_WORD_PATTERN.test(content)) return false;
  if (FEATURE_BAD_ENDING_PATTERN.test(content)) return false;
  const words = countWords(content);
  return words >= 3 && words <= 12 && looksLikeSelectionCriterion(content, evaluationProfile);
}

function isWeakFeatureDimension(text, evaluationProfile = DEFAULT_EVALUATION_PROFILE) {
  const wordCount = countWords(text);
  return !text || MARKETING_HYPE_PATTERN.test(text) || wordCount < 3 || wordCount > 12 || !hasSelectionCriterionStyle(text, evaluationProfile);
}

function validateFeatureList(features, evaluationProfile = DEFAULT_EVALUATION_PROFILE) {
  const errors = [];

  if (!features.length) {
    errors.push('feature is empty');
    return errors;
  }

  const weakFeatureCount = features.filter((item) => isWeakFeatureDimension(item, evaluationProfile)).length;
  if (weakFeatureCount > Math.max(1, Math.floor(features.length / 3))) {
    errors.push('feature must use buyer selection criteria rather than feature descriptions');
  }

  const selectionCriteriaCount = features.filter((item) => looksLikeSelectionCriterion(item, evaluationProfile)).length;
  if (selectionCriteriaCount < Math.max(3, Math.ceil(features.length * 0.5))) {
    errors.push('feature should emphasize selection criteria rather than capability inventory');
  }

  const capabilityLedCount = features.filter((item) => FEATURE_BAD_ENDING_PATTERN.test(cleanText(item)) || FEATURE_CAPABILITY_NOUN_PATTERN.test(cleanText(item))).length;
  if (capabilityLedCount > Math.max(1, Math.floor(features.length / 3))) {
    errors.push('feature contains capability-led phrasing instead of buyer selection standards');
  }

  return errors;
}

function assessInputEvidence(input) {
  const strengths = [];
  const gaps = [];
  const risk_notes = [];
  let status = 'pass';

  if (input.toolSignals.top_tools.length >= 5) strengths.push('enough representative top tools');
  else gaps.push('top tool evidence is limited');

  if (input.existingContent.what_is_summary) strengths.push('existing summary exists');
  else gaps.push('existing summary is empty');

  if (input.existingContent.feature.length >= 3) strengths.push('existing feature list provides some comparison hints');
  else gaps.push('existing feature list is thin');

  if (input.toolSignals.common_themes.tags.length >= 3) strengths.push('common themes are detectable');
  else risk_notes.push('common theme clustering is weak, so category boundaries may be fuzzy');

  if (!input.name || !input.parent_name) {
    status = 'reject';
    gaps.push('category identity is incomplete');
  } else if (
    input.toolSignals.top_tools.length < 3 &&
    !input.existingContent.what_is_summary &&
    input.existingContent.feature.length < 2 &&
    input.existingContent.faq.length < 2
  ) {
    status = 'reject';
    gaps.push('evidence is too thin for a reliable rewrite');
  } else if (input.toolSignals.top_tools.length < 3 || input.toolSignals.common_themes.tags.length < 2) {
    status = 'limited';
  }

  return { status, strengths, gaps, risk_notes };
}

function parseJsonResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Model returned empty content');

  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const payload = fenced ? fenced[1].trim() : raw;

   try {
    return JSON.parse(payload);
  } catch (error) {
    const objectStart = payload.indexOf('{');
    const objectEnd = payload.lastIndexOf('}');

    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(payload.slice(objectStart, objectEnd + 1));
    }

    throw error;
  }
}

class DraftValidationError extends Error {
  constructor(message, draft, validationErrors) {
    super(message);
    this.name = 'DraftValidationError';
    this.draft = draft;
    this.validationErrors = validationErrors || [message];
  }
}

function countWords(text) {
  return cleanText(String(text || '')).split(/\s+/).filter(Boolean).length;
}

function getCategoryTier(toolCount) {
  if (toolCount >= 80) return 'Elite';
  if (toolCount >= 15) return 'Growth';
  return 'Niche';
}

function getWordRanges(categoryTier, contentDepth) {
  const matrix = {
    Elite: {
      Deep: {
        what_is_summary: { min: 120, max: 220 },
        who_is_use: { min: 80, max: 160 },
        how_do_work: { min: 100, max: 180 },
        advantages: { min: 80, max: 150 },
      },
      Standard: {
        what_is_summary: { min: 90, max: 180 },
        who_is_use: { min: 70, max: 140 },
        how_do_work: { min: 80, max: 150 },
        advantages: { min: 70, max: 130 },
      },
      Light: {
        what_is_summary: { min: 70, max: 140 },
        who_is_use: { min: 55, max: 110 },
        how_do_work: { min: 65, max: 120 },
        advantages: { min: 55, max: 100 },
      },
    },
    Growth: {
      Deep: {
        what_is_summary: { min: 100, max: 190 },
        who_is_use: { min: 70, max: 140 },
        how_do_work: { min: 90, max: 160 },
        advantages: { min: 70, max: 130 },
      },
      Standard: {
        what_is_summary: { min: 80, max: 160 },
        who_is_use: { min: 60, max: 120 },
        how_do_work: { min: 75, max: 140 },
        advantages: { min: 60, max: 110 },
      },
      Light: {
        what_is_summary: { min: 60, max: 120 },
        who_is_use: { min: 50, max: 100 },
        how_do_work: { min: 55, max: 100 },
        advantages: { min: 50, max: 90 },
      },
    },
    Niche: {
      Deep: {
        what_is_summary: { min: 80, max: 150 },
        who_is_use: { min: 60, max: 120 },
        how_do_work: { min: 70, max: 130 },
        advantages: { min: 60, max: 110 },
      },
      Standard: {
        what_is_summary: { min: 65, max: 130 },
        who_is_use: { min: 50, max: 100 },
        how_do_work: { min: 60, max: 110 },
        advantages: { min: 50, max: 95 },
      },
      Light: {
        what_is_summary: { min: 50, max: 100 },
        who_is_use: { min: 45, max: 90 },
        how_do_work: { min: 50, max: 90 },
        advantages: { min: 45, max: 80 },
      },
    },
  };

  return matrix[categoryTier]?.[contentDepth] || matrix.Growth.Standard;
}

function getTargetCounts(contentDepth) {
  if (contentDepth === 'Deep') {
    return { feature: 6, faq: 6 };
  }
  if (contentDepth === 'Standard') {
    return { feature: 5, faq: 5 };
  }
  return { feature: 4, faq: 4 };
}

function decideContentDepth(input) {
  let evidenceScore = 0;
  evidenceScore += input.existingContent.what_is_summary ? 1 : 0;
  evidenceScore += input.existingContent.feature.length >= 3 ? 1 : 0;
  evidenceScore += input.existingContent.faq.length >= 3 ? 1 : 0;
  evidenceScore += input.toolSignals.top_tools.length >= 5 ? 2 : input.toolSignals.top_tools.length ? 1 : 0;
  evidenceScore += input.toolSignals.common_themes.tags.length >= 3 ? 1 : 0;

  if (input.categoryTier === 'Elite' && evidenceScore >= 5) return 'Deep';
  if (input.categoryTier === 'Growth' && evidenceScore >= 6) return 'Deep';
  if (evidenceScore >= 3) return 'Standard';
  return 'Light';
}

function aggregateCommonThemes(topTools) {
  const tagCounter = new Map();
  const featureCounter = new Map();
  const pricingPatterns = new Set();

  for (const tool of topTools) {
    for (const tag of tool.tags || []) {
      const key = cleanText(tag).toLowerCase();
      if (!key) continue;
      tagCounter.set(key, (tagCounter.get(key) || 0) + 1);
    }
    for (const feature of tool.feature || []) {
      const key = cleanText(feature).toLowerCase();
      if (!key) continue;
      featureCounter.set(key, (featureCounter.get(key) || 0) + 1);
    }
    if (tool.is_free) pricingPatterns.add('free tier available');
    for (const price of tool.pricing_summary || []) {
      const lower = cleanText(price).toLowerCase();
      if (lower.includes('month')) pricingPatterns.add('monthly subscription');
      if (lower.includes('year')) pricingPatterns.add('yearly subscription');
      if (lower.includes('free')) pricingPatterns.add('free tier available');
    }
  }

  const topTags = [...tagCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);

  const topFeatures = [...featureCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([feature]) => feature);

  return {
    tags: topTags,
    feature_patterns: topFeatures,
    pricing_patterns: [...pricingPatterns].slice(0, 4),
  };
}

async function fetchTopTools(categoryId) {
  return prisma.aiTool.findMany({
    where: {
      toolCategories: {
        some: { categoryId },
      },
    },
    orderBy: [
      { monthVisitedCount: 'desc' },
      { collectedCount: 'desc' },
    ],
    take: TOP_TOOLS_LIMIT,
    select: {
      name: true,
      description: true,
      feature: true,
      tags: true,
      pricing: true,
      isFree: true,
      monthVisitedCount: true,
      toolInfoReview: true,
    },
  });
}

function normalizeToolSignals(toolsRaw) {
  return toolsRaw.map((tool) => ({
    name: cleanText(tool.name),
    short_desc: cleanText(tool.description).slice(0, 220),
    feature: uniqueNonEmpty(tool.feature, 5),
    tags: uniqueNonEmpty(tool.tags, 3),
    pricing_summary: uniqueNonEmpty((tool.pricing || []).map(stripHtml), 2),
    is_free: Boolean(tool.isFree),
    monthly_visits: Number(tool.monthVisitedCount || 0),
    rating: tool.toolInfoReview ? Number(tool.toolInfoReview) : null,
  }));
}

function buildExistingContent(category) {
  return {
    what_is_summary: normalizeParagraphText(category.whatIsSummary),
    feature: uniqueNonEmpty(category.feature, 8),
    who_is_use: normalizeParagraphText(category.whoIsUse),
    how_do_work: normalizeParagraphText(category.howDoWork),
    advantages: normalizeParagraphText(category.advantages),
    faq: normalizeFaqInput(category.faq),
  };
}

async function normalizeCategoryInput(category) {
  const topToolsRaw = await fetchTopTools(category.id);
  const topTools = normalizeToolSignals(topToolsRaw);
  const existingContent = buildExistingContent(category);
  const categoryTier = getCategoryTier(Number(category.toolCount || 0));
  const evaluationProfile = resolveEvaluationProfile({
    name: category.name,
    handle: category.handle,
    parent_name: category.level1?.name || 'General',
  });

  const input = {
    id: category.id,
    name: cleanText(category.name),
    handle: cleanText(category.handle),
    tool_count: Number(category.toolCount || 0),
    parent_name: cleanText(category.level1?.name || 'General'),
    parent_handle: cleanText(category.level1?.handle || ''),
    existingContent,
    evaluationProfile,
    toolSignals: {
      top_tools: topTools,
      common_themes: aggregateCommonThemes(topTools),
    },
  };

  input.evidenceSummary = assessInputEvidence(input);

  input.categoryTier = categoryTier;
  input.contentDepth = decideContentDepth(input);
  if (input.evidenceSummary.status === 'limited' && input.contentDepth === 'Deep') {
    input.contentDepth = 'Standard';
  }
  input.wordRanges = getWordRanges(categoryTier, input.contentDepth);
  input.targetCounts = getTargetCounts(input.contentDepth);

  return input;
}

function normalizeIntentType(value) {
  const allowed = new Set(['definition', 'selection', 'workflow', 'pricing', 'limitations', 'comparison', 'general']);
  const text = cleanText(value).toLowerCase();
  return allowed.has(text) ? text : 'general';
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

function buildFallbackBlueprint(input) {
  const featureSeed = getFeatureSeed(input);

  const faqSeed = input.existingContent.faq.length
    ? input.existingContent.faq.slice(0, input.targetCounts.faq).map((item) => ({
        question: item.title,
        intent_type: 'general',
      }))
    : (input.evaluationProfile?.faq_seeds?.length ? input.evaluationProfile.faq_seeds : DEFAULT_FAQ_SEEDS);

  return {
    category_thesis: `Explain what ${input.name} covers inside ${input.parent_name}, where it is useful, and how buyers should evaluate it.`,
    category_boundary: {
      parent_category: input.parent_name,
      what_this_category_includes: uniqueNonEmpty([
        `${input.name} specific workflows`,
        ...input.toolSignals.common_themes.feature_patterns,
        ...input.toolSignals.common_themes.tags,
      ], 4),
      what_this_category_does_not_focus_on: uniqueNonEmpty([
        `broader ${input.parent_name} tasks outside ${input.name}`,
        `generic ${input.parent_name} use cases without ${input.name} specialization`,
      ], 3),
      difference_from_parent: `${input.name} is a narrower category within ${input.parent_name}, focused on more specific workflows rather than the full parent-category scope.`,
    },
    evidence_assessment: {
      level: input.evidenceSummary.status === 'limited' ? 'thin' : input.toolSignals.top_tools.length >= 5 ? 'moderate' : 'thin',
      strengths: input.evidenceSummary.strengths,
      gaps: input.evidenceSummary.gaps,
      risk_notes: input.evidenceSummary.risk_notes,
    },
    editorial_focus: {
      why_it_matters: `${input.name} matters when buyers need a narrower, workflow-specific slice of ${input.parent_name} rather than a broad parent-category tool set.`,
      best_fit_buyers: uniqueNonEmpty([
        `${input.name} practitioners`,
        `${input.parent_name} operators with repeatable workflows`,
      ], 4),
      overuse_or_misfit_cases: uniqueNonEmpty([
        `buyers who only need broad ${input.parent_name} coverage`,
        'teams without a defined review workflow',
      ], 3),
      buyer_cautions: uniqueNonEmpty([
        'fit depends on workflow maturity and review expectations',
        'headline feature lists can hide real review burden',
      ], 3),
    },
    section_plans: {
      what_is_summary: {
        thesis: input.existingContent.what_is_summary || `${input.name} is a narrower layer within ${input.parent_name}, used when buyers need more specific workflow fit.`,
        must_cover: [input.name, input.parent_name, 'difference from parent category', 'practical buyer value'],
        must_avoid: ['generic parent-category description', 'product marketing slogans', 'invented benchmarks', 'specific product recommendations'],
      },
      feature_plan: featureSeed.slice(0, input.targetCounts.feature).map((title) => ({
        title,
        angle: `Explain why ${title} matters when comparing tools in ${input.name}.`,
        priority: 'medium',
      })),
      who_is_use: {
        audiences: uniqueNonEmpty([
          `${input.name} practitioners`,
          `${input.parent_name} teams with repeatable workflows`,
        ], 4),
        angle: `Describe who gets the clearest operational value from ${input.name}.`,
        misfit_cases: uniqueNonEmpty([
          `buyers needing broader ${input.parent_name} coverage`,
          'teams without a review or approval step',
        ], 3),
      },
      how_do_work: {
        workflow_steps: input.evaluationProfile?.workflow_steps?.length
          ? input.evaluationProfile.workflow_steps
          : ['input preparation', 'generation or processing', 'review and publish'],
        angle: `Show the common workflow pattern for ${input.name} from input to reviewed output.`,
      },
      advantages: {
        benefit_themes: ['time savings', 'workflow consistency', 'faster iteration'],
        caution: 'Benefits depend on clear process design and human review rather than feature volume alone.',
      },
      faq_plan: faqSeed.slice(0, input.targetCounts.faq),
    },
    anti_overlap_notes: [
      'Keep summary focused on category definition, buyer value, and boundary from the parent category.',
      'Keep feature focused on comparison dimensions, not benefits or role-fit prose.',
      'Keep FAQ answers conditional and practical, not generic paragraph restatements.',
    ],
  };
}

function validateBlueprint(rawBlueprint, input) {
  const fallback = buildFallbackBlueprint(input);
  const blueprint = rawBlueprint && typeof rawBlueprint === 'object' ? rawBlueprint : {};
  const sectionPlans = blueprint.section_plans && typeof blueprint.section_plans === 'object'
    ? blueprint.section_plans
    : fallback.section_plans;

  const categoryBoundary = blueprint.category_boundary && typeof blueprint.category_boundary === 'object'
    ? blueprint.category_boundary
    : fallback.category_boundary;

  const evidenceAssessment = blueprint.evidence_assessment && typeof blueprint.evidence_assessment === 'object'
    ? blueprint.evidence_assessment
    : fallback.evidence_assessment;

  const editorialFocus = blueprint.editorial_focus && typeof blueprint.editorial_focus === 'object'
    ? blueprint.editorial_focus
    : fallback.editorial_focus;

  const feature = normalizePlanItems(
    sectionPlans.feature_plan,
    (item) => {
      const title = cleanText(item?.title);
      const angle = cleanText(item?.angle);
      const priority = ['high', 'medium', 'low'].includes(cleanText(item?.priority).toLowerCase())
        ? cleanText(item?.priority).toLowerCase()
        : 'medium';
      if (!title || !angle || isWeakFeatureDimension(title, input.evaluationProfile)) return null;
      return { title, angle, priority };
    },
    input.targetCounts.feature,
  );

  const faq = normalizePlanItems(
    sectionPlans.faq_plan,
    (item) => {
      const question = cleanText(item?.question);
      if (!question) return null;
      return { question, intent_type: normalizeIntentType(item?.intent_type) };
    },
    input.targetCounts.faq,
  );

  return {
    category_thesis: cleanText(blueprint.category_thesis || fallback.category_thesis),
    category_boundary: {
      parent_category: cleanText(categoryBoundary.parent_category || fallback.category_boundary.parent_category),
      what_this_category_includes: uniqueNonEmpty(
        categoryBoundary.what_this_category_includes || fallback.category_boundary.what_this_category_includes,
        5,
      ),
      what_this_category_does_not_focus_on: uniqueNonEmpty(
        categoryBoundary.what_this_category_does_not_focus_on || fallback.category_boundary.what_this_category_does_not_focus_on,
        4,
      ),
      difference_from_parent: cleanText(categoryBoundary.difference_from_parent || fallback.category_boundary.difference_from_parent),
    },
    evidence_assessment: {
      level: ['rich', 'moderate', 'thin'].includes(cleanText(evidenceAssessment.level).toLowerCase())
        ? cleanText(evidenceAssessment.level).toLowerCase()
        : fallback.evidence_assessment.level,
      strengths: uniqueNonEmpty(evidenceAssessment.strengths || fallback.evidence_assessment.strengths, 5),
      gaps: uniqueNonEmpty(evidenceAssessment.gaps || fallback.evidence_assessment.gaps, 5),
      risk_notes: uniqueNonEmpty(evidenceAssessment.risk_notes || fallback.evidence_assessment.risk_notes, 5),
    },
    editorial_focus: {
      why_it_matters: cleanText(editorialFocus.why_it_matters || fallback.editorial_focus.why_it_matters),
      best_fit_buyers: uniqueNonEmpty(editorialFocus.best_fit_buyers || fallback.editorial_focus.best_fit_buyers, 5),
      overuse_or_misfit_cases: uniqueNonEmpty(
        editorialFocus.overuse_or_misfit_cases || fallback.editorial_focus.overuse_or_misfit_cases,
        4,
      ),
      buyer_cautions: uniqueNonEmpty(editorialFocus.buyer_cautions || fallback.editorial_focus.buyer_cautions, 4),
    },
    section_plans: {
      what_is_summary: {
        thesis: cleanText(sectionPlans.what_is_summary?.thesis || fallback.section_plans.what_is_summary.thesis),
        must_cover: uniqueNonEmpty(sectionPlans.what_is_summary?.must_cover || fallback.section_plans.what_is_summary.must_cover, 5),
        must_avoid: uniqueNonEmpty(sectionPlans.what_is_summary?.must_avoid || fallback.section_plans.what_is_summary.must_avoid, 5),
      },
      feature_plan: feature.length ? feature : fallback.section_plans.feature_plan,
      who_is_use: {
        audiences: uniqueNonEmpty(sectionPlans.who_is_use?.audiences || fallback.section_plans.who_is_use.audiences, 5),
        angle: cleanText(sectionPlans.who_is_use?.angle || fallback.section_plans.who_is_use.angle),
        misfit_cases: uniqueNonEmpty(sectionPlans.who_is_use?.misfit_cases || fallback.section_plans.who_is_use.misfit_cases, 4),
      },
      how_do_work: {
        workflow_steps: uniqueNonEmpty(sectionPlans.how_do_work?.workflow_steps || fallback.section_plans.how_do_work.workflow_steps, 5),
        angle: cleanText(sectionPlans.how_do_work?.angle || fallback.section_plans.how_do_work.angle),
      },
      advantages: {
        benefit_themes: uniqueNonEmpty(sectionPlans.advantages?.benefit_themes || fallback.section_plans.advantages.benefit_themes, 5),
        caution: cleanText(sectionPlans.advantages?.caution || fallback.section_plans.advantages.caution),
      },
      faq_plan: faq.length ? faq : fallback.section_plans.faq_plan,
    },
    anti_overlap_notes: uniqueNonEmpty(blueprint.anti_overlap_notes || fallback.anti_overlap_notes, 5),
  };
}

function buildOpeningDraft(rawPayload) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  return {
    what_is_summary: normalizeParagraphText(payload.what_is_summary),
  };
}

function buildStructuredDraft(rawPayload, blueprint, input) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const normalizedWhoIsUse = normalizeWhoIsUsePayload(payload.who_is_use);

  return {
    feature: uniqueNonEmpty((payload.feature || []).map((item) => normalizeFeatureDimension(item, input.evaluationProfile)), input.targetCounts.feature),
    who_is_use: normalizedWhoIsUse.text,
    who_is_use_struct: normalizedWhoIsUse,
    how_do_work: normalizeParagraphText(payload.how_do_work),
    advantages: normalizeParagraphText(payload.advantages),
    faq: normalizePlanItems(
      payload.faq,
      (item) => {
        const title = cleanText(item?.title || item?.question);
        const desc = normalizeParagraphText(item?.desc || item?.answer);
        if (!title || !desc) return null;
        return { title, desc };
      },
      input.targetCounts.faq,
    ),
    blueprint_feature_seed: blueprint.section_plans.feature_plan.map((item) => cleanText(item.title)).filter(Boolean),
  };
}

function mergeCategoryDraftParts(openingDraft, structuredDraft) {
  return {
    what_is_summary: openingDraft.what_is_summary,
    feature: structuredDraft.feature,
    who_is_use: structuredDraft.who_is_use,
    how_do_work: structuredDraft.how_do_work,
    advantages: structuredDraft.advantages,
    faq: structuredDraft.faq,
  };
}

function validateWordRange(text, fieldName, range) {
  const wordCount = countWords(text);
  const shortfall = Math.max(0, range.min - wordCount);
  if (!text) return [`${fieldName} is empty`];
  if (shortfall > SUMMARY_WORD_SOFT_SHORTFALL) {
    return [`${fieldName} too short: ${wordCount} words, expected >= ${range.min}`];
  }
  if (shortfall > 0) {
    console.warn(`[⚠️ soft-warning] ${fieldName} short by ${shortfall} words; allowing pass for manual review.`);
  }
  return [];
}

function validateBlueprintQuality(blueprint) {
  const validationErrors = [];

  if (!blueprint.category_thesis) {
    validationErrors.push('blueprint category_thesis is empty');
  }
  if (!blueprint.category_boundary.difference_from_parent) {
    validationErrors.push('blueprint did not define difference_from_parent');
  }
  if (!blueprint.category_boundary.what_this_category_does_not_focus_on.length) {
    validationErrors.push('blueprint did not define what this category does not focus on');
  }
  if (!blueprint.section_plans.what_is_summary.must_avoid.length) {
    validationErrors.push('blueprint did not define summary must_avoid guidance');
  }
  if (!blueprint.section_plans.feature_plan.length) {
    validationErrors.push('blueprint feature_plan is empty');
  }
  if (!blueprint.section_plans.faq_plan.length) {
    validationErrors.push('blueprint faq_plan is empty');
  }

  return validationErrors;
}

function validateOpeningDraft(draft, blueprint, input) {
  const validationErrors = [];

  validationErrors.push(...validateWordRange(draft.what_is_summary, 'what_is_summary', input.wordRanges.what_is_summary));

  if (draft.what_is_summary) {
    const lower = draft.what_is_summary.toLowerCase();
    const openingLead = getFirstTwoSentencesText(draft.what_is_summary).toLowerCase();
    if (!lower.includes(input.name.toLowerCase())) {
      validationErrors.push('what_is_summary must mention the category name explicitly');
    }
    if (input.parent_name && input.parent_name.toLowerCase() !== 'general' && !openingLead.includes(input.parent_name.toLowerCase())) {
      validationErrors.push('what_is_summary must reference the parent category explicitly');
    }
    if (!hasBoundaryLanguage(draft.what_is_summary)) {
      validationErrors.push('what_is_summary did not clearly describe the category boundary');
    }
    if (MARKETING_HYPE_PATTERN.test(draft.what_is_summary)) {
      validationErrors.push('what_is_summary contains hype language');
    }
    if (findMentionedToolNames(draft.what_is_summary, input).length) {
      validationErrors.push('what_is_summary must not mention specific tool names');
    }
  }

  return validationErrors;
}

function validateFaqItems(faq, blueprint, input) {
  const validationErrors = [];
  let conditionRichCount = 0;
  let qualifiedYesNoCount = 0;
  let terminatedEarly = false;

  if (faq.length < Math.max(1, blueprint.section_plans.faq_plan.length)) {
    validationErrors.push('faq did not reach blueprint depth');
  }

  for (const item of faq) {
    if (!item.title || !item.desc) {
      validationErrors.push('faq items must contain title and desc');
      terminatedEarly = true;
      break;
    }
    const faqContent = item.desc;
    const hasCondition = hasConditionLanguage(item.desc);

    if (FAQ_PLACEHOLDER_PATTERN.test(item.desc)) {
      validationErrors.push('faq contains placeholder copy');
      terminatedEarly = true;
      break;
    }
    if (containsProductRecommendation(faqContent, input)) {
      validationErrors.push('faq must not mention or recommend specific products');
      terminatedEarly = true;
      break;
    }
    if (FAQ_ABSOLUTE_PATTERN.test(item.desc) && !hasCondition) {
      validationErrors.push('faq contains overly absolute claims without enough qualification');
      terminatedEarly = true;
      break;
    }
    if (countWords(item.desc) < 16) {
      validationErrors.push('faq answers are too thin');
      terminatedEarly = true;
      break;
    }
    if (hasCondition) {
      conditionRichCount += 1;
    }
    if (!hasQualifiedYesNoStart(item.desc)) {
      validationErrors.push('faq yes/no answers must immediately add a condition or limitation');
      terminatedEarly = true;
      break;
    }
    if (FAQ_YES_NO_START_PATTERN.test(cleanText(item.desc))) {
      qualifiedYesNoCount += 1;
    }
  }

  if (!terminatedEarly) {
    const requiredConditionalAnswers = Math.min(faq.length, Math.max(2, Math.ceil(faq.length / 3)));
    if (faq.length && conditionRichCount < requiredConditionalAnswers) {
      validationErrors.push('faq answers lack enough conditional or nuanced language');
    }

    if (qualifiedYesNoCount > 0 && conditionRichCount < qualifiedYesNoCount) {
      validationErrors.push('faq yes/no framing is too absolute for a category-level guide');
    }
  }

  return validationErrors;
}

function validateSectionOverlap(draft) {
  const validationErrors = [];
  const featureText = draft.feature.join(' ');

  if (getTextSimilarity(draft.what_is_summary, draft.who_is_use) > 0.55) {
    validationErrors.push('what_is_summary overlaps too heavily with who_is_use');
  }
  if (getTextSimilarity(draft.what_is_summary, draft.how_do_work) > 0.5) {
    validationErrors.push('what_is_summary overlaps too heavily with how_do_work');
  }
  if (getTextSimilarity(featureText, draft.advantages) > 0.45) {
    validationErrors.push('feature overlaps too heavily with advantages');
  }

  return validationErrors;
}

function validateStructuredDraft(draft, blueprint, input) {
  const validationErrors = [];
  const whoIsUseStruct = draft.who_is_use_struct || normalizeWhoIsUsePayload(draft.who_is_use);

  validationErrors.push(...validateWordRange(draft.who_is_use, 'who_is_use', input.wordRanges.who_is_use));
  validationErrors.push(...validateWordRange(draft.how_do_work, 'how_do_work', input.wordRanges.how_do_work));
  validationErrors.push(...validateWordRange(draft.advantages, 'advantages', input.wordRanges.advantages));

  validationErrors.push(...validateFeatureList(draft.feature, input.evaluationProfile));

  if (draft.feature.length < Math.max(1, blueprint.section_plans.feature_plan.length)) {
    validationErrors.push('feature did not reach blueprint depth');
  }

  if (GENERIC_AUDIENCE_PATTERN.test(draft.who_is_use)) {
    validationErrors.push('who_is_use is too generic');
  }
  if (!whoIsUseStruct.best_for.length || !BEST_FOR_LABEL_PATTERN.test(draft.who_is_use)) {
    validationErrors.push('who_is_use must contain a Best For section');
  }
  if (!whoIsUseStruct.not_ideal_for.length || !NOT_IDEAL_FOR_LABEL_PATTERN.test(draft.who_is_use)) {
    validationErrors.push('who_is_use must contain a Not Ideal For section');
  }
  if (!POSITIVE_FIT_PATTERN.test(draft.who_is_use)) {
    validationErrors.push('who_is_use did not clearly identify best-fit audiences');
  }
  if (!MISFIT_PATTERN.test(draft.who_is_use)) {
    validationErrors.push('who_is_use did not identify weaker-fit or overkill cases');
  }
  if (!SUMMARY_LABEL_PATTERN.test(draft.who_is_use) && !whoIsUseStruct.summary) {
    validationErrors.push('who_is_use must contain a short summary');
  }
  if (!hasWorkflowProgression(draft.how_do_work, input.evaluationProfile)) {
    validationErrors.push('how_do_work does not describe a clear workflow progression');
  }
  if (!hasConditionLanguage(draft.advantages)) {
    validationErrors.push('advantages must include at least one caveat or dependency');
  }
  if (MARKETING_HYPE_PATTERN.test(draft.advantages)) {
    validationErrors.push('advantages contains hype language');
  }

  if (containsProductRecommendation(draft.advantages, input)) {
    validationErrors.push('advantages must stay category-level and must not recommend products');
  }

  if (findMentionedToolNames(`${draft.who_is_use}\n${draft.how_do_work}\n${draft.advantages}\n${draft.feature.join('\n')}`, input).length) {
    validationErrors.push('structured sections must not mention specific tool names');
  }

  validationErrors.push(...validateFaqItems(draft.faq, blueprint, input));

  return validationErrors;
}

function normalizeFinalCategoryPayload(openingDraft, structuredDraft, blueprint, input) {
  const draft = mergeCategoryDraftParts(openingDraft, structuredDraft);
  const validationErrors = [
    ...validateBlueprintQuality(blueprint),
    ...validateOpeningDraft(openingDraft, blueprint, input),
    ...validateStructuredDraft(draft, blueprint, input),
    ...validateSectionOverlap(draft),
  ];

  if (validationErrors.length) {
    throw new DraftValidationError(validationErrors[0], draft, validationErrors);
  }

  return draft;
}

async function callJsonModel({ systemPrompt, payload, temperature, label, category }) {
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
      console.warn(`[⚠️ ${label}] ID ${category.id} [${category.name}] 第 ${attempt}/${RETRY_LIMIT} 次失败: ${reason}`);
      if (attempt === RETRY_LIMIT) throw new Error(`${label} failed: ${reason}`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

function buildBlueprintPayload(input) {
  return {
    stage: 'blueprint',
    content_goal: 'rewrite shallow category copy into a premium editorial category guide',
    constraints: {
      category_tier: input.categoryTier,
      content_depth: input.contentDepth,
      target_counts: input.targetCounts,
      word_ranges: input.wordRanges,
    },
    editorial_musts: {
      exact_parent_name_in_opening: input.parent_name,
      forbid_specific_tool_names: input.toolSignals.top_tools.map((item) => item.name),
      who_is_use_format: ['Best For', 'Not Ideal For', 'Summary'],
      faq_policy: 'Never recommend or list specific products; stay at category-level selection guidance.',
    },
    evaluation_profile: {
      key: input.evaluationProfile.key,
      label: input.evaluationProfile.label,
      feature_dimensions: input.evaluationProfile.feature_dimensions,
      workflow_steps: input.evaluationProfile.workflow_steps,
      prompt_hints: input.evaluationProfile.prompt_hints,
    },
    category: {
      id: input.id,
      name: input.name,
      handle: input.handle,
      tool_count: input.tool_count,
      parent_name: input.parent_name,
      parent_handle: input.parent_handle,
    },
    legacy_content_role: 'existing content is a legacy draft to audit, not wording to inherit by default',
    existing_content: input.existingContent,
    evidence_summary: input.evidenceSummary,
    tool_signals: input.toolSignals,
  };
}

function buildOpeningPayload(input, blueprint) {
  return {
    stage: 'expansion',
    section: 'opening',
    constraints: {
      category_tier: input.categoryTier,
      content_depth: input.contentDepth,
      word_ranges: {
        what_is_summary: input.wordRanges.what_is_summary,
      },
      must_include_exact_parent_name_in_first_two_sentences: input.parent_name,
      forbidden_tool_names: input.toolSignals.top_tools.map((item) => item.name),
    },
    evaluation_profile: {
      key: input.evaluationProfile.key,
      label: input.evaluationProfile.label,
      prompt_hints: input.evaluationProfile.prompt_hints,
    },
    category: {
      id: input.id,
      name: input.name,
      handle: input.handle,
      tool_count: input.tool_count,
      parent_name: input.parent_name,
      parent_handle: input.parent_handle,
    },
    existing_content: input.existingContent,
    tool_signals: input.toolSignals,
    blueprint,
  };
}

function buildStructuredPayload(input, blueprint) {
  return {
    stage: 'expansion',
    section: 'structured',
    constraints: {
      category_tier: input.categoryTier,
      content_depth: input.contentDepth,
      target_counts: input.targetCounts,
      word_ranges: {
        who_is_use: input.wordRanges.who_is_use,
        how_do_work: input.wordRanges.how_do_work,
        advantages: input.wordRanges.advantages,
      },
      who_is_use_format: ['Best For', 'Not Ideal For', 'Summary'],
      forbidden_tool_names: input.toolSignals.top_tools.map((item) => item.name),
      faq_policy: 'Do not recommend, compare, or list specific products, brands, vendors, plans, or free-trial offers.',
      faq_style: 'Use conditional category-level phrasing such as may, can, often, depends on, varies by, typically, in practice, or in many cases. Keep pricing answers at the model level, such as usage-based or seat-based costs, and avoid absolute yes/no wording unless it is immediately qualified.',
      feature_style: 'Write buyer comparison dimensions using words like control, fit, burden, depth, consistency, scalability, oversight, or handoff quality. Avoid endings such as features, tools, platforms, options, templates, automation, or capabilities.',
    },
    evaluation_profile: {
      key: input.evaluationProfile.key,
      label: input.evaluationProfile.label,
      feature_dimensions: input.evaluationProfile.feature_dimensions,
      selection_keywords: input.evaluationProfile.selection_keywords,
      workflow_steps: input.evaluationProfile.workflow_steps,
      prompt_hints: input.evaluationProfile.prompt_hints,
    },
    category: {
      id: input.id,
      name: input.name,
      handle: input.handle,
      tool_count: input.tool_count,
      parent_name: input.parent_name,
      parent_handle: input.parent_handle,
    },
    existing_content: input.existingContent,
    tool_signals: input.toolSignals,
    blueprint,
  };
}

async function generateBlueprint(input) {
  if (input.evidenceSummary.status === 'reject') {
    throw new Error(`insufficient evidence for reliable rewrite: ${input.evidenceSummary.gaps.join('; ')}`);
  }

  const rawBlueprint = await callJsonModel({
    systemPrompt: CATEGORY_BLUEPRINT_SYSTEM_PROMPT,
    payload: buildBlueprintPayload(input),
    temperature: 0.25,
    label: 'stage1-blueprint',
    category: input,
  });

  return validateBlueprint(rawBlueprint, input);
}

async function generateCategoryContent(input, blueprint) {
  const openingRawPayload = await callJsonModel({
    systemPrompt: CATEGORY_OPENING_SYSTEM_PROMPT,
    payload: buildOpeningPayload(input, blueprint),
    temperature: 0.35,
    label: 'stage2-opening',
    category: input,
  });

  const openingDraft = buildOpeningDraft(openingRawPayload);

  const structuredRawPayload = await callJsonModel({
    systemPrompt: CATEGORY_STRUCTURED_SYSTEM_PROMPT,
    payload: buildStructuredPayload(input, blueprint),
    temperature: 0.3,
    label: 'stage2-structured',
    category: input,
  });

  const structuredDraft = buildStructuredDraft(structuredRawPayload, blueprint, input);

  return normalizeFinalCategoryPayload(openingDraft, structuredDraft, blueprint, input);
}

async function processCategoryWithAI(category) {
  const input = await normalizeCategoryInput(category);
  const blueprint = await generateBlueprint(input);
  return generateCategoryContent(input, blueprint);
}

function isWritableCategoryPayload(draft) {
  return Boolean(
    draft
      && typeof draft.what_is_summary === 'string'
      && Array.isArray(draft.feature)
      && typeof draft.who_is_use === 'string'
      && typeof draft.how_do_work === 'string'
      && typeof draft.advantages === 'string'
      && Array.isArray(draft.faq)
      && draft.faq.every((item) => item && typeof item.title === 'string' && typeof item.desc === 'string'),
  );
}

async function writeCategoryContent(categoryId, aiData) {
  await prisma.categoryLevel2.update({
    where: { id: categoryId },
    data: {
      whatIsSummary: aiData.what_is_summary,
      feature: aiData.feature,
      whoIsUse: aiData.who_is_use,
      howDoWork: aiData.how_do_work,
      advantages: aiData.advantages,
      faq: aiData.faq,
    },
  });
}

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function parseIdList(text) {
  const parts = String(text || '')
    .split(/[,，\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const ids = [];
  const seen = new Set();

  for (const part of parts) {
    const normalized = part.replace(/^#/, '');
    const id = Number.parseInt(normalized, 10);
    if (Number.isNaN(id) || id <= 0 || String(id) !== normalized) {
      throw new Error(`无效的 id: ${part}`);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids.sort((a, b) => a - b);
}

function parseRunInput(rawInput) {
  const input = cleanText(rawInput);

  if (input === '') {
    return { mode: 'FULL', limitCount: DEFAULT_BATCH_SIZE, targetIds: [] };
  }

  const idPrefixed = /^id:\s*(.+)$/i.exec(input);
  if (idPrefixed) {
    const targetIds = parseIdList(idPrefixed[1]);
    if (!targetIds.length) {
      throw new Error('id: 后至少需要一个有效 id');
    }
    return { mode: 'IDS', limitCount: targetIds.length, targetIds };
  }

  if (/[,，]/.test(input)) {
    const targetIds = parseIdList(input);
    if (!targetIds.length) {
      throw new Error('逗号分隔的 id 列表无效');
    }
    return { mode: 'IDS', limitCount: targetIds.length, targetIds };
  }

  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || String(parsed) !== input) {
    throw new Error('请输入正整数条数、id:12、或 12,45,88');
  }

  return { mode: 'TEST', limitCount: parsed, targetIds: [] };
}

function printPreviewPayload(category, aiData) {
  const preview = {
    id: category.id,
    name: cleanText(category.name),
    parent_name: cleanText(category.level1?.name || 'General'),
    original: {
      what_is_summary: normalizeParagraphText(category.whatIsSummary),
      feature: uniqueNonEmpty(category.feature, 8),
      who_is_use: normalizeParagraphText(category.whoIsUse),
      how_do_work: normalizeParagraphText(category.howDoWork),
      advantages: normalizeParagraphText(category.advantages),
      faq: normalizeFaqInput(category.faq),
    },
    generated: {
      what_is_summary: aiData.what_is_summary,
      feature: aiData.feature,
      who_is_use: aiData.who_is_use,
      how_do_work: aiData.how_do_work,
      advantages: aiData.advantages,
      faq: aiData.faq,
    },
  };

  console.log(`\n[👀 预览] ${preview.name} (id: ${preview.id})`);
  console.log(JSON.stringify(preview, null, 2));
}

function printFailedDraftPayload(category, error) {
  const failedDraft = error?.draft || {};
  const preview = {
    id: category.id,
    name: cleanText(category.name),
    parent_name: cleanText(category.level1?.name || 'General'),
    validation_errors: Array.isArray(error?.validationErrors) ? error.validationErrors : [error?.message || 'Unknown validation error'],
    original: {
      what_is_summary: normalizeParagraphText(category.whatIsSummary),
      feature: uniqueNonEmpty(category.feature, 8),
      who_is_use: normalizeParagraphText(category.whoIsUse),
      how_do_work: normalizeParagraphText(category.howDoWork),
      advantages: normalizeParagraphText(category.advantages),
      faq: normalizeFaqInput(category.faq),
    },
    failed_draft: {
      what_is_summary: normalizeParagraphText(failedDraft.what_is_summary),
      feature: uniqueNonEmpty(failedDraft.feature, 8),
      who_is_use: normalizeParagraphText(failedDraft.who_is_use),
      how_do_work: normalizeParagraphText(failedDraft.how_do_work),
      advantages: normalizeParagraphText(failedDraft.advantages),
      faq: normalizeFaqInput(failedDraft.faq),
    },
  };

  console.log(`\n[🧪 失败稿预览] ${preview.name} (id: ${preview.id})`);
  console.log(JSON.stringify(preview, null, 2));
}

const CATEGORY_INCLUDE = {
  level1: {
    select: {
      name: true,
      handle: true,
    },
  },
};

async function fetchCategoryBatch({ mode, limitCount, lastId, targetIds }) {
  if (mode === 'IDS') {
    return prisma.categoryLevel2.findMany({
      where: { id: { in: targetIds } },
      orderBy: { id: 'asc' },
      include: CATEGORY_INCLUDE,
    });
  }

  const take = mode === 'TEST' ? limitCount : DEFAULT_BATCH_SIZE;

  return prisma.categoryLevel2.findMany({
    where: mode === 'FULL' ? { id: { gt: lastId } } : undefined,
    take,
    orderBy: { id: 'asc' },
    include: CATEGORY_INCLUDE,
  });
}

async function main() {
  console.log('🤖 二级分类 Content 双阶段重写引擎就绪...');

  const totalCount = await prisma.categoryLevel2.count();
  console.log(`📊 二级分类共有 ${totalCount} 条，将按 id 升序直接重写并覆盖原数据。`);

  const input = await askQuestion(
    '请输入运行条数 / id / id 列表 (回车进入全量模式)\n'
    + '  示例: 10 | id:12 | 12,45,88 | id:12,45\n> ',
  );
  const runConfig = parseRunInput(input);
  const { mode, limitCount, targetIds } = runConfig;

  const previewAnswer = await askQuestion('是否只预览结果而不写库？(y/N): ');
  const previewOnly = ['y', 'yes', '1'].includes(previewAnswer.toLowerCase());

  const batchSize = mode === 'FULL' ? DEFAULT_BATCH_SIZE : limitCount;
  const useHighConcurrency = (mode === 'TEST' || mode === 'IDS') && limitCount > 1000;
  const activeConcurrency = mode === 'FULL' ? CONCURRENCY : (useHighConcurrency ? CONCURRENCY : 1);
  const queue = new PQueue({ concurrency: activeConcurrency });

  const modeLabel = mode === 'IDS'
    ? `指定 id (${targetIds.join(', ')})`
    : mode === 'TEST'
      ? `前 ${limitCount} 条 (id 升序)`
      : '全量 (id 升序分批)';
  console.log(`⚙️ 当前模式: ${mode} | ${modeLabel} | 并发: ${activeConcurrency} | 批次: ${batchSize} | 写库: ${previewOnly ? '否（预览）' : '是'}`);

  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let lastId = 0;

  while (true) {
    const categories = await fetchCategoryBatch({ mode, limitCount, lastId, targetIds });

    if (mode === 'IDS' && targetIds.length) {
      const foundIds = new Set(categories.map((category) => category.id));
      const missingIds = targetIds.filter((id) => !foundIds.has(id));
      if (missingIds.length) {
        console.warn(`[⚠️ 未找到] 以下 id 在数据库中不存在: ${missingIds.join(', ')}`);
      }
    }

    if (categories.length === 0) {
      console.log(mode === 'IDS' ? '🎉 指定 id 已全部处理或不存在！' : '🎉 所有二级分类都已处理完毕！');
      break;
    }

    console.log(`\n📦 准备处理 ${categories.length} 条数据 (id ${categories[0].id} - ${categories[categories.length - 1].id})...`);

    const promises = categories.map((category) => queue.add(async () => {
      try {
        const aiData = await processCategoryWithAI(category);

        if (previewOnly) {
          printPreviewPayload(category, aiData);
        } else {
          await writeCategoryContent(category.id, aiData);
        }

        successCount += 1;
        processedCount += 1;
        console.log(`[✅ 成功] ${category.name} (id: ${category.id} | toolCount: ${category.toolCount || 0} | 已完成 ${processedCount} 条${previewOnly ? ' | 未写库' : ''})`);
      } catch (error) {
        const writableDraft = error instanceof DraftValidationError && isWritableCategoryPayload(error.draft)
          ? error.draft
          : null;

        if (writableDraft) {
          try {
            if (previewOnly) {
              printFailedDraftPayload(category, error);
              console.warn(`[⚠️ 预览可写入] ${category.name}: ${error.validationErrors.join(' | ')}`);
            } else {
              await writeCategoryContent(category.id, writableDraft);
              console.warn(`[⚠️ 校验未过但已写入] ${category.name}: ${error.validationErrors.join(' | ')}`);
            }

            successCount += 1;
            processedCount += 1;
            console.log(`[⚠️ 放宽通过] ${category.name} (id: ${category.id} | toolCount: ${category.toolCount || 0} | 已完成 ${processedCount} 条${previewOnly ? ' | 预览未写库' : ' | 已写库'})`);
            return;
          } catch (writeError) {
            error = writeError;
          }
        }

        failureCount += 1;
        processedCount += 1;
        console.error(`[❌ 失败] ${category.name} (id: ${category.id}): ${error.message}`);

        if (error instanceof DraftValidationError) {
          if (previewOnly) {
            printFailedDraftPayload(category, error);
          }
          console.warn(`[📝 未写入] ${category.name}: ${error.validationErrors.join(' | ')}`);
        }
      }
    }));

    await Promise.all(promises);

    lastId = categories[categories.length - 1].id;
    if (mode === 'TEST' || mode === 'IDS') break;
  }

  console.log(`\n📈 运行结束：成功 ${successCount} 条，失败 ${failureCount} 条，共处理 ${processedCount} 条。`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('🚨 脚本异常中断：', error);
  await prisma.$disconnect();
  process.exit(1);
});
