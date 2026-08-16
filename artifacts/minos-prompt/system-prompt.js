/**
 * MINOS v2 — Prompt Architect
 * Agent 4 (`minos-prompt`)
 *
 * buildSystemPrompt(mode, context, userProfile) → string
 *
 * Assembles the final system prompt from:
 *   - <base.md>              (Shepherd identity, non-negotiable pillars)
 *   - <reasoning.md>         (chain-of-thought pre-processing block)
 *   - <guardrails.md>        (truth / citation / mode-respect guardrails)
 *   - <mode-modifiers.md>    (tone, structure, length per mode)
 *   - <deepseek-variant.md>  (chain-of-thought exposure policy)
 *
 * Consumes the unified context format produced by the Router:
 *   { library: {items, contextString}, internet: {results, contextString},
 *     mode, userProfile }
 *
 * Contract-compliant: never throws, degrades gracefully, supports a
 * zero-arg call for a training-only fallback prompt.
 *
 * Token budget discipline:
 *   - Base (identity + reasoning + guardrails + mode modifier) stays < 4k.
 *   - Full prompt with library + internet context stays < 12k.
 *   - The Router enforces a hard 7900 context cap on library+internet;
 *     this builder adds the base system block on top.
 */

// ---------------------------------------------------------------------------
// Imports (static text, ESM)
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.join(__dirname, 'modules');

const MODULE_FILES = [
  'base.md',
  'reasoning.md',
  'guardrails.md',
  'mode-modifiers.md',
  'deepseek-variant.md',
];

/** Cache raw module text once loaded (prompt build cost is I/O-free after first call). */
let _moduleCache = null;

/**
 * Load all module markdown files. Never throws — on failure returns the
 * cached default strings (or empty) and logs a warning.
 * @returns {Promise<Record<string,string>>}
 */
async function loadModules() {
  if (_moduleCache) return _moduleCache;

  const out = {};
  for (const name of MODULE_FILES) {
    try {
      out[name.replace(/\.md$/, '')] = fs.readFileSync(
        path.join(MODULES_DIR, name),
        'utf8'
      );
    } catch (err) {
      console.warn(`[MINOS:p0]:loadModules:${name}`, err.message);
      out[name.replace(/\.md$/, '')] = '';
    }
  }
  _moduleCache = out;
  return out;
}

// ---------------------------------------------------------------------------
// Mode table (fallback config used when the Router passes no matches)
// Mirrors mode-config.json latent defaults so buildSystemPrompt is self-sufficient.
// ---------------------------------------------------------------------------
const FALLBACK_MODES = {
  'deep-study': {
    label: 'Deep Study', model: 'deepseek-reasoner', tone: 'scholarly, precise, academic but anointed',
    lengthCap: 'full 8 layers, never cut short',
  },
  'sunday-message': {
    label: 'Sunday Message', model: 'deepseek-reasoner', tone: 'weighty, anointed, preaching rhythm, directly to the congregation',
    lengthCap: 'full step-by-step preaching guide',
  },
  'sermon-notes': {
    label: 'Sermon Notes', model: 'deepseek-chat', tone: 'compressed, punchy, faithful mirror of the Sunday message',
    lengthCap: 'compressed, under the preached length',
  },
  'whatsapp-devotional': {
    label: 'WhatsApp Devotional', model: 'deepseek-chat', tone: 'captivating, warm, intimate, impossible to ignore, edifying',
    lengthCap: '7-day series, under 200 words/day',
  },
  'facebook-posts': {
    label: 'Facebook Posts', model: 'deepseek-chat', tone: 'bold, hook-driven, stop-the-scroll, spiritually rich, viral-but-holy',
    lengthCap: 'max 150 words/post, 9-line structure',
  },
  'partner-devotional': {
    label: 'Partner Devotional', model: 'deepseek-reasoner', tone: 'weighty, prophetic, honoring, personal-letter-from-God, never generic',
    lengthCap: 'personal letter, weighty and honoring',
  },
  'prayer-guide': {
    label: 'Prayer Guide', model: 'deepseek-chat', tone: 'structured, Spirit-led, declarative, worship-first',
    lengthCap: 'structured agenda with supporting scriptures',
  },
  'morning-brief': {
    label: 'Morning Brief', model: 'deepseek-chat', tone: 'concise, shepherd-focused, warm, practical for the day',
    lengthCap: 'short, scannable',
  },
};

const ALIASES = {
  study: 'deep-study', sunday: 'sunday-message', notes: 'sermon-notes',
  whatsapp: 'whatsapp-devotional', facebook: 'facebook-posts',
  partner: 'partner-devotional', prayer: 'prayer-guide', morning: 'morning-brief',
};

/**
 * Canonicalize a mode key (handles aliases + sniffing for recognizable words).
 * @param {*} mode
 * @returns {string}
 */
function canonicalMode(mode) {
  if (typeof mode !== 'string' || !mode) return 'sunday-message';
  const m = mode.trim().toLowerCase();
  if (FALLBACK_MODES[m] || ALIASES[m]) return ALIASES[m] || m;
  if (m.includes('study')) return 'deep-study';
  if (m.includes('sunday') || m.includes('message')) return 'sunday-message';
  if (m.includes('note')) return 'sermon-notes';
  if (m.includes('whatsapp')) return 'whatsapp-devotional';
  if (m.includes('facebook')) return 'facebook-posts';
  if (m.includes('partner')) return 'partner-devotional';
  if (m.includes('prayer')) return 'prayer-guide';
  if (m.includes('brief') || m.includes('morning')) return 'morning-brief';
  return 'sunday-message';
}

/**
 * Rough token estimate for logging (word-based). Not used to truncate — the
 * Router owns hard truncation; this is informational for the builder.
 * @param {string} text
 * @returns {number}
 */
function estTokens(text) {
  if (!text) return 0;
  return Math.round(text.length * 0.25);
}

/**
 * Build the mode-specific modifier block.
 * Preferred source is `context.config` (Router's mode-config.json entry).
 * Falls back to the local FALLBACK_MODES table when absent.
 * @param {string} mode
 * @param {object} context
 * @returns {{ text: string, meta: object }}
 */
function buildModeBlock(mode, context) {
  const cfg = (context && context.config) || FALLBACK_MODES[mode] || FALLBACK_MODES['sunday-message'];

  const label = cfg.label || FALLBACK_MODES[mode]?.label || 'Sunday Message';
  const tone = cfg.tone || FALLBACK_MODES[mode]?.tone || '';
  const format = cfg.format || '';
  const hint = cfg.outputFormatHint || FALLBACK_MODES[mode]?.lengthCap || '';
  const budget = cfg.tokenBudget ? JSON.stringify(cfg.tokenBudget) : '';

  const lines = [
    `# MODE-MODIFIER — ${label} (\`${mode}\`)`,
    '',
    `- **MODE:** \`${mode}\``,
    `- **LABEL:** ${label}`,
    `- **TONE:** ${tone}`,
  ];
  if (format) lines.push(`- **FORMAT:** ${format}`);
  if (hint) lines.push(`- **LENGTH / OUTPUT RULES:** ${hint}`);
  if (budget) lines.push(`- **TOKEN BUDGET (sources):** ${budget}`);

  // Tone is always required; fall back to base-house voice if missing.
  if (!tone) {
    lines.push('- **TONE FALLBACK:** warm, weighty, anointed, plainspoken (house voice)');
  }

  return {
    text: lines.join('\n'),
    meta: { label, tone, format, hint },
  };
}

/**
 * Render the two context blocks (library + internet).
 * Gracefully handles empty contextString (dropped silently).
 * @param {object} context
 * @returns {string}
 */
function renderContext(context) {
  const lib = context && context.library && context.library.contextString
    ? context.library.contextString
    : '';
  const net = context && context.internet && context.internet.contextString
    ? context.internet.contextString
    : '';

  if (!lib && !net) {
    return [
      'CONTEXT:',
      '---',
      'No library archive or internet resources were loaded for this query. Work from your TRAINING only.',
      'Clearly label a training-only response so the user knows sources were empty.',
      '---',
    ].join('\n');
  }
  return ['CONTEXT:', '---', lib, net].filter(Boolean).join('\n');
}

/**
 * Build the user-profile persona block (populated later by minos-learning).
 * @param {object} userProfile
 * @returns {string}
 */
function renderUserProfile(userProfile) {
  if (!userProfile || typeof userProfile !== 'object') return '';
  const prefs = userProfile.preferences || {};
  const weights = userProfile.weights || {};
  const prefsKeys = Object.keys(prefs);
  const weightsKeys = Object.keys(weights);
  if (prefsKeys.length === 0 && weightsKeys.length === 0) return '';

  const lines = ['# USER PROFILE', 'Adapt mildly toward these learned preferences:', ''];
  if (prefsKeys.length) {
    lines.push('**Preferences:**');
    for (const k of prefsKeys) lines.push(`- ${k}: ${String(prefs[k])}`);
    lines.push('');
  }
  if (weightsKeys.length) {
    lines.push('**Weights (source influence):**');
    for (const k of weightsKeys) lines.push(`- ${k}: ${String(weights[k])}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * MAIN EXPORT — buildSystemPrompt(mode, context, userProfile) → string
 *
 * @param {string} [mode='sunday-message']  canonical mode key (or alias)
 * @param {object} [context]  Router context: { library, internet, mode, config, userProfile }
 * @param {object} [userProfile]  optional learning profile snapshot
 * @returns {string}  assembled system prompt (never throws)
 */
export async function buildSystemPrompt(mode, context, userProfile) {
  const canonical = canonicalMode(mode);

  // -- 1. Load modules (cached; safe override for async-zero-arg call).
  let modules;
  try {
    modules = await loadModules();
  } catch (err) {
    console.warn('[MINOS:p0]:buildSystemPrompt:loadModules', err.message);
    modules = {};
  }

  const base = modules.base || '# BASE — MINOS v2 System Identity (missing module)';
  const reasoning = modules.reasoning || '';
  const guardrails = modules.guardrails || '';
  const variant = modules['deepseek-variant'] || '';
  const modeBlock = buildModeBlock(canonical, context);

  // -- 2. Model routing hint.
  const model = context && context.config && context.config.model
    ? context.config.model
    : (FALLBACK_MODES[canonical] && FALLBACK_MODES[canonical].model) || 'deepseek-chat';

  // -- 3. Assembly (order matters to the model):
  //        identity → guardrails → reasoning → context → mode modifier → user profile
  const parts = [];
  parts.push(base.trim());
  if (guardrails.trim()) parts.push(guardrails.trim());
  if (reasoning.trim()) parts.push(reasoning.trim());
  parts.push(modeBlock.text.trim());
  parts.push(renderContext(context));
  const profileBlock = renderUserProfile(userProfile || (context && context.userProfile));
  if (profileBlock) parts.push(profileBlock.trim());
  // DeepSeek <thinking> exposure policy always closes the block.
  if (variant.trim()) parts.push(variant.trim());

  const prompt = parts.join('\n\n---\n\n') + '\n';

  const estTotal = estTokens(prompt);
  const estBase =
    estTokens(base) + estTokens(reasoning) + estTokens(guardrails) + estTokens(modeBlock.text) + estTokens(variant);

  console.warn(
    `[MINOS:p0]:built mode=${canonical} model=${model} base≈${estBase}t full≈${estTotal}t (cap <4000 base, <12000 full)`
  );

  return prompt;
}

// Optional named default export alias for contract consumers expecting a default.
export default buildSystemPrompt;