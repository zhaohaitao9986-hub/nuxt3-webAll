'use strict';

const GENERIC_FAQ_SEEDS = [
  { question: 'What defines this category?', intent_type: 'definition' },
  { question: 'How should buyers compare tools in this category?', intent_type: 'selection' },
  { question: 'How does this category fit into a workflow?', intent_type: 'workflow' },
  { question: 'Where are the main limitations of this category?', intent_type: 'limitations' },
  { question: 'Are free or entry-level options common in this category?', intent_type: 'pricing' },
];

const TEMPLATE_LIBRARY = {
  default_general: {
    label: 'General evaluation template',
    feature_dimensions: [
      'quality consistency under repeat use',
      'control over outputs and adjustments',
      'workflow fit for the target task',
      'review burden for accuracy and trust',
      'handoff quality for export or publishing',
      'cost scalability for recurring usage',
    ],
    selection_keywords: [
      'quality', 'control', 'fit', 'burden', 'oversight', 'consistency', 'accuracy', 'flexibility',
      'workflow', 'originality', 'scalability', 'review', 'cost', 'speed', 'depth', 'support',
      'handoff', 'latency', 'retention', 'memory', 'localization', 'compatibility',
    ],
    workflow_stage_groups: [
      ['input', 'prompt', 'brief', 'source', 'upload', 'request', 'topic', 'keyword'],
      ['analyze', 'analyzes', 'generate', 'generates', 'process', 'draft', 'compose', 'transform', 'classify', 'render'],
      ['review', 'edit', 'adjust', 'refine', 'approve', 'export', 'publish', 'deliver', 'handoff'],
    ],
    workflow_steps: ['input preparation', 'AI generation or analysis', 'review and delivery'],
    faq_seeds: GENERIC_FAQ_SEEDS,
    prompt_hints: [
      'Use buyer comparison dimensions rather than generic capability labels.',
      'Describe workflow as a sequence from input to review, export, or publish.',
    ],
    normalization_rules: [],
  },
  writing_content: {
    label: 'Writing content evaluation template',
    feature_dimensions: [
      'brand-voice control and tone consistency',
      'search-intent optimization depth and workflow fit',
      'topic relevance and idea quality consistency',
      'editing burden for accuracy and originality',
      'publishing workflow handoff quality',
      'cost scalability for recurring content production',
    ],
    selection_keywords: [
      'brand voice', 'tone consistency', 'search intent', 'seo depth', 'topic relevance', 'idea quality',
      'editing burden', 'originality', 'publishing workflow', 'cms', 'scalability', 'review burden',
    ],
    workflow_stage_groups: [
      ['topic', 'keyword', 'brief', 'outline', 'prompt'],
      ['generate', 'draft', 'compose', 'optimize', 'research'],
      ['review', 'edit', 'revise', 'publish', 'cms', 'export'],
    ],
    workflow_steps: ['topic or keyword input', 'AI drafting and optimization', 'review and publishing handoff'],
    prompt_hints: [
      'Prioritize brand voice control, search-intent depth, review burden, and publishing fit.',
    ],
    normalization_rules: [
      { pattern: /^seo optimization integration and keyword handling$/i, replacement: 'search-intent optimization depth and workflow fit' },
      { pattern: /^seo evaluation capabilities$/i, replacement: 'search-intent optimization depth and workflow fit' },
      { pattern: /^idea generation quality and topical relevance$/i, replacement: 'topic relevance and idea quality consistency' },
      { pattern: /^editing and revision workflow handoff$/i, replacement: 'revision workflow handoff and approval fit' },
      { pattern: /^customization depth for brand voice and tone consistency$/i, replacement: 'brand-voice control and tone consistency' },
      { pattern: /^content originality and human oversight burden$/i, replacement: 'originality risk and human oversight burden' },
    ],
  },
  writing_book: {
    label: 'Book writing evaluation template',
    feature_dimensions: [
      'narrative structure support for plot and chapter planning',
      'character consistency across long-form manuscript sections',
      'long-form memory for multi-chapter coherence',
      'iterative refinement control between author and AI',
      'export flexibility for publishing workflows',
      'cost scalability for multi-book projects',
    ],
    selection_keywords: [
      'narrative structure', 'plot', 'chapter', 'character consistency', 'long-form memory', 'manuscript',
      'refinement control', 'publishing workflow', 'export flexibility', 'multi-book',
    ],
    workflow_stage_groups: [
      ['premise', 'outline', 'chapter', 'character', 'notes'],
      ['generate', 'draft', 'expand', 'brainstorm', 'structure'],
      ['review', 'revise', 'edit', 'format', 'export', 'publish'],
    ],
    workflow_steps: ['outline or manuscript setup', 'AI-assisted drafting and structure work', 'revision and export'],
    prompt_hints: [
      'Emphasize plot development, chapter coherence, and long-form memory instead of generic writing features.',
    ],
    normalization_rules: [],
  },
  social_caption: {
    label: 'Caption and subtitle evaluation template',
    feature_dimensions: [
      'caption accuracy and contextual relevance to media content',
      'tone control for brand and platform fit',
      'localization depth across languages and audience contexts',
      'bulk processing throughput for high-volume publishing',
      'review burden for accuracy and brand alignment',
      'export and platform handoff quality',
    ],
    selection_keywords: [
      'caption accuracy', 'contextual relevance', 'tone control', 'platform fit', 'localization',
      'bulk processing', 'throughput', 'brand alignment', 'export', 'handoff', 'engagement fit',
      'hashtag', 'subtitle',
    ],
    workflow_stage_groups: [
      ['upload', 'uploads', 'image', 'video', 'media', 'audio'],
      ['analyze', 'analyzes', 'detect', 'generate', 'generates', 'caption', 'transcribe'],
      ['adjust', 'edit', 'review', 'export', 'publish', 'schedule'],
    ],
    workflow_steps: ['media upload and input selection', 'AI caption or subtitle generation', 'review, export, and publishing handoff'],
    faq_seeds: [
      { question: 'How much human review do AI captions or subtitles usually need?', intent_type: 'limitations' },
      { question: 'What should buyers compare beyond raw caption speed?', intent_type: 'selection' },
      { question: 'How much can caption quality vary by media quality, language, or platform?', intent_type: 'workflow' },
      { question: 'What usually drives cost in caption and subtitle workflows?', intent_type: 'pricing' },
      { question: 'When is a dedicated caption workflow a stronger fit than a broader content tool?', intent_type: 'fit' },
    ],
    prompt_hints: [
      'Use evaluation dimensions like caption accuracy, platform fit, localization, and review burden.',
      'In FAQ answers, qualify output quality by media clarity, language coverage, platform norms, and review needs rather than using flat yes/no claims.',
      'Keep pricing FAQ answers at category level by discussing usage volume, seats, languages, or review workload instead of vendor plans or free-trial examples.',
    ],
    normalization_rules: [],
  },
  ai_chat: {
    label: 'Chat and conversational AI evaluation template',
    feature_dimensions: [
      'natural-language understanding accuracy for ambiguous inputs',
      'conversation memory and multi-turn context retention',
      'latency and reliability under concurrent conversations',
      'brand-voice control for tone and response boundaries',
      'workflow handoff quality with CRM or helpdesk systems',
      'feedback-loop control for refinement and escalation',
    ],
    selection_keywords: [
      'natural-language understanding', 'context retention', 'conversation memory', 'latency', 'reliability',
      'concurrent conversations', 'brand-voice control', 'workflow handoff', 'crm', 'helpdesk', 'feedback loop',
      'escalation', 'tool calling',
    ],
    workflow_stage_groups: [
      ['message', 'chat', 'user input', 'query', 'conversation'],
      ['analyze', 'classify', 'retrieve', 'generate', 'respond'],
      ['handoff', 'escalate', 'log', 'review', 'refine', 'follow-up'],
    ],
    workflow_steps: ['user message intake', 'response generation with context handling', 'handoff, logging, or escalation'],
    prompt_hints: [
      'Prioritize conversation memory, latency, escalation fit, and integration handoff over generic chatbot features.',
    ],
    normalization_rules: [],
  },
  image_generation: {
    label: 'Image generation evaluation template',
    feature_dimensions: [
      'image quality and prompt fidelity',
      'style control and edit flexibility',
      'generation speed for iterative workflows',
      'commercial-usage clarity and licensing fit',
      'upscaling and export workflow quality',
      'cost scalability for batch asset creation',
    ],
    selection_keywords: ['image quality', 'prompt fidelity', 'style control', 'edit flexibility', 'generation speed', 'licensing', 'export workflow'],
    workflow_stage_groups: [
      ['prompt', 'reference', 'image', 'asset'],
      ['generate', 'render', 'upscale', 'edit'],
      ['review', 'export', 'publish', 'deliver'],
    ],
    workflow_steps: ['prompt or reference input', 'image generation and refinement', 'review and export'],
    prompt_hints: [],
    normalization_rules: [],
  },
  video_generation: {
    label: 'Video generation evaluation template',
    feature_dimensions: [
      'rendering quality and motion consistency',
      'avatar or scene control for brand needs',
      'render speed for production timelines',
      'editing flexibility for post-production workflows',
      'export quality and format coverage',
      'cost scalability for recurring video production',
    ],
    selection_keywords: ['rendering quality', 'motion consistency', 'avatar control', 'render speed', 'editing flexibility', 'export quality'],
    workflow_stage_groups: [
      ['script', 'prompt', 'assets', 'scene'],
      ['generate', 'render', 'animate', 'compose'],
      ['review', 'edit', 'export', 'publish'],
    ],
    workflow_steps: ['script or asset setup', 'video generation and rendering', 'review and export'],
    prompt_hints: [],
    normalization_rules: [],
  },
  audio_generation: {
    label: 'Audio evaluation template',
    feature_dimensions: [
      'voice naturalness and clarity',
      'language coverage and localization depth',
      'emotion or style control',
      'latency for real-time delivery',
      'licensing clarity for commercial use',
      'editing flexibility and export quality',
    ],
    selection_keywords: ['voice naturalness', 'clarity', 'language coverage', 'localization', 'emotion control', 'latency', 'licensing', 'export quality'],
    workflow_stage_groups: [
      ['script', 'text', 'voice settings', 'audio'],
      ['generate', 'synthesize', 'transcribe', 'process'],
      ['review', 'edit', 'export', 'publish'],
    ],
    workflow_steps: ['script or audio input', 'generation or synthesis', 'review and export'],
    prompt_hints: [],
    normalization_rules: [],
  },
};

const DIRECT_HANDLE_MAP = {
  'ai-blog-generator': 'writing_content',
  'ai-book-writing': 'writing_book',
  'ai-caption-generator': 'social_caption',
  'ai-chat-generator': 'ai_chat',
};

const KEYWORD_RULES = [
  { key: 'social_caption', terms: ['caption', 'subtitle', 'social caption'] },
  { key: 'ai_chat', terms: ['chat', 'chatbot', 'conversation', 'conversational'] },
  { key: 'writing_book', terms: ['book', 'novel', 'story', 'manuscript'] },
  { key: 'writing_content', terms: ['blog', 'article', 'newsletter', 'copywriting', 'essay'] },
  { key: 'video_generation', terms: ['video', 'animation', 'avatar video'] },
  { key: 'image_generation', terms: ['image', 'photo', 'art generator', 'picture'] },
  { key: 'audio_generation', terms: ['audio', 'voice', 'speech', 'music', 'podcast'] },
];

const PARENT_KEYWORD_RULES = [
  { key: 'writing_content', terms: ['writing & editing', 'writing'] },
  { key: 'image_generation', terms: ['image', 'photo', 'design'] },
  { key: 'video_generation', terms: ['video'] },
  { key: 'audio_generation', terms: ['audio', 'music', 'voice'] },
];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

function mergeTemplate(key, source, baseTemplate, overrideTemplate) {
  const base = baseTemplate || TEMPLATE_LIBRARY.default_general;
  const override = overrideTemplate || {};

  return {
    key,
    source,
    label: override.label || base.label,
    feature_dimensions: uniqueStrings([...(base.feature_dimensions || []), ...(override.feature_dimensions || [])]),
    selection_keywords: uniqueStrings([...(base.selection_keywords || []), ...(override.selection_keywords || [])]),
    workflow_stage_groups: override.workflow_stage_groups?.length ? override.workflow_stage_groups : base.workflow_stage_groups,
    workflow_steps: uniqueStrings(override.workflow_steps?.length ? override.workflow_steps : base.workflow_steps),
    faq_seeds: override.faq_seeds?.length ? override.faq_seeds : base.faq_seeds,
    prompt_hints: uniqueStrings([...(base.prompt_hints || []), ...(override.prompt_hints || [])]),
    normalization_rules: [...(base.normalization_rules || []), ...(override.normalization_rules || [])],
  };
}

function findTemplateByTerms(text, rules) {
  const haystack = cleanText(text).toLowerCase();
  if (!haystack) return null;

  for (const rule of rules) {
    if (rule.terms.some((term) => haystack.includes(term))) {
      return rule.key;
    }
  }

  return null;
}

function resolveTemplateKey(category) {
  const handle = cleanText(category.handle).toLowerCase();
  const name = cleanText(category.name).toLowerCase();
  const parentName = cleanText(category.parent_name).toLowerCase();

  if (DIRECT_HANDLE_MAP[handle]) return { key: DIRECT_HANDLE_MAP[handle], source: 'direct-handle' };

  const byName = findTemplateByTerms(name, KEYWORD_RULES);
  if (byName) return { key: byName, source: 'name-keyword' };

  const byHandle = findTemplateByTerms(handle.replace(/-/g, ' '), KEYWORD_RULES);
  if (byHandle) return { key: byHandle, source: 'handle-keyword' };

  const byParent = findTemplateByTerms(parentName, PARENT_KEYWORD_RULES);
  if (byParent) return { key: byParent, source: 'parent-keyword' };

  return { key: 'default_general', source: 'default' };
}

const DEFAULT_EVALUATION_PROFILE = mergeTemplate('default_general', 'default', TEMPLATE_LIBRARY.default_general, {});

function resolveEvaluationProfile(category) {
  const resolved = resolveTemplateKey(category);
  if (resolved.key === 'default_general') {
    return DEFAULT_EVALUATION_PROFILE;
  }

  return mergeTemplate(resolved.key, resolved.source, TEMPLATE_LIBRARY.default_general, TEMPLATE_LIBRARY[resolved.key]);
}

module.exports = {
  DEFAULT_EVALUATION_PROFILE,
  resolveEvaluationProfile,
};