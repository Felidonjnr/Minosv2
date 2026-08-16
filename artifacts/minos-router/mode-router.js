/**
 * MINOS v2 — Mode Router (Agent 3)
 * ================================
 * Mission: Route every query through the correct RAG + Search strategy per mode,
 * assemble a unified context for the Prompt Architect (minos-prompt).
 *
 * Context format produced (Router → Prompt, per COLLABORATION_CONTRACT):
 *   assembleContext(query, mode) → Promise<{
 *     fullContext,          // single assembled string: System Base + Library + Internet + Mode Modifier
 *     sources: {           // structured breakdown for the prompt builder + UI source chips
 *       systemBase: string,
 *       library: { items: [], contextString: "" },
 *       internet: { results: [], contextString: "" },
 *       modeModifier: string,
 *       mode: "deep-study" | ... ,
 *       config: <mode-config entry>,
 *       used: ["base","library","internet","mode"]  // what actually survived the fallback chain
 *     }
 *   })
 *
 * Dependencies (imported interfaces — built in parallel by Agents 1 & 2):
 *   - minos-rag/searchLibrary(query, mode, topK) -> Promise<{ items, contextString }>
 *   - minos-search/searchInternet(query, mode)    -> Promise<{ results, contextString }>
 * The Router treats them as OPTIONAL. If unreachable/not yet built, it degrades
 * gracefully through the spec'd fallback chain: Library -> Internet -> Training only.
 *
 * Contract guarantees:
 *   - Never throws. Returns { error, fallback } on hard failure.
 *   - Logs with [MINOS:router] prefix via console.warn.
 *   - Enforces token budget (target < 8000 context tokens). See tokCap().
 *   - All 8 modes produce distinct context signatures.
 */
import config from './mode-config.json' with { type: 'json' };

/* ============================================================
 * 1) OPTIONAL DEPENDENCY IMPORT (RAG + Search)
 * ------------------------------------------------------------
 * `dynamicImport()` tries to load the parallel agents' modules WITHOUT hard
 * failing. This lets the Router ship now and "light up" the moment Agent 1 & 2
 * artifacts land at these paths. Adjust paths to the final artifact locations
 * (spec: MINOS/artifacts/minos-rag/ and MINOS/artifacts/minos-search/).
 * ============================================================ */
const RAG_MODULE = '../minos-rag/rag-engine.js';
const SEARCH_MODULE = '../minos-search/search-engine.js';

let ragModule = null;
let searchModule = null;

async function dynamicImport(path) {
  try {
    const mod = await import(/* @vite-ignore */ path);
    return mod;
  } catch (e) {
    console.warn('[MINOS:router] Optional dependency not available', path, String(e && e.message || e));
    return null;
  }
}

/* ============================================================
 * 2) TOKEN BUDGET ENFORCEMENT
 * ------------------------------------------------------------
 * Coarse token estimate (chars / charsPerToken) with a hard cap from config.
 * We TRUNCATE each source to its per-mode budget, then enforce the overall cap.
 * ============================================================ */
function tokEstimate(text) {
  if (!text) return 0;
  const cpt = (config.defaults && config.defaults.estTokensPerChar) || 0.25;
  return Math.round(String(text).length * cpt);
}

function tokCap() {
  return (config.defaults && config.defaults.contextTokenCap) || 7900;
}

/** Truncate a string to stay under a token ceiling (approximate). */
function truncateToTokens(text, maxTokens) {
  if (!text) return '';
  if (maxTokens <= 0) return '';
  if (tokEstimate(text) <= maxTokens) return text;
  const cpt = (config.defaults && config.defaults.estTokensPerChar) || 0.25;
  const maxChars = Math.floor(maxTokens / cpt);
  const cut = String(text).slice(0, maxChars);
  return cut + '\n…[truncated to respect token budget]';
}

/* ============================================================
 * 3) MODE NORMALISATION
 * ------------------------------------------------------------
 * Accepts the canonical mode keys above, plus friendly aliases that map to the
 * on-screen quick buttons / library categories (e.g. "study", "sunday", "whatsapp").
 * Unknown input falls back to the most holistic default (deep study).
 * ============================================================ */
const KNOWN_MODES = Object.keys(config.modes);

/** Lightweight alias map → canonical mode key. */
const ALIASES = {
  'deep-study': 'deep-study', study: 'deep-study', deepstudy: 'deep-study',
  'sunday-message': 'sunday-message', sunday: 'sunday-message', message: 'sunday-message',
  'sermon-notes': 'sermon-notes', notes: 'sermon-notes',
  'whatsapp-devotional': 'whatsapp-devotional', whatsapp: 'whatsapp-devotional', 'whatsapp 7-day': 'whatsapp-devotional',
  'facebook-posts': 'facebook-posts', facebook: 'facebook-posts', posts: 'facebook-posts',
  'partner-devotional': 'partner-devotional', partner: 'partner-devotional', partners: 'partner-devotional',
  'prayer-guide': 'prayer-guide', prayer: 'prayer-guide', prayerguide: 'prayer-guide',
  'morning-brief': 'morning-brief', morning: 'morning-brief', brief: 'morning-brief',
};

/** Try to sniff the mode from the query text when no explicit mode is given. */
function detectModeFromQuery(query) {
  const q = String(query || '').toLowerCase();
  if (/(pray|prayer guide|prayer request)/.test(q)) return 'prayer-guide';
  if (/(devotional|devotion)/.test(q) && /(partner|partner)/.test(q)) return 'partner-devotional';
  if (/(whatsapp)/.test(q)) return 'whatsapp-devotional';
  if (/(facebook|post|social)/.test(q)) return 'facebook-posts';
  if (/(sermon notes|notes)/.test(q)) return 'sermon-notes';
  if (/(sunday message|sunday|preaching guide|message)/.test(q)) return 'sunday-message';
  if (/(morning brief|brief|good morning)/.test(q)) return 'morning-brief';
  if (/(study|greek|hebrew|scholar|theolog|seminary|commentary|deep)/.test(q)) return 'deep-study';
  return null; // unknown → caller should pick a default
}

function resolveMode(mode, query) {
  const key = String(mode || '').toLowerCase().trim();
  if (ALIASES[key]) return ALIASES[key];
  if (KNOWN_MODES.includes(key)) return key;
  if (ALIASES[`${key}`]) return ALIASES[`${key}`];
  // Mode key not recognised → try sniffing from query as a convenience.
  const sniffed = detectModeFromQuery(query);
  if (sniffed && KNOWN_MODES.includes(sniffed)) return sniffed;
  return 'deep-study'; // safest holistic fallback
}

/* ============================================================
 * 4) SOURCE BUILDERS
 * ------------------------------------------------------------
 * Each returns { contextString, metadata } and is capped to the per-mode
 * token budget. The RAG/Search engines themselves already rank + dedupe;
 * the Router just trims injection to fit the budget.
 * ============================================================ */

/** Library context — consumed from Agent 1 RAG output, capped + formatted. */
function buildLibraryContext(libResult, modeConfig) {
  const items = (libResult && libResult.items) || [];
  const raw = (libResult && libResult.contextString) || '';
  const budget = (modeConfig.tokenBudget && modeConfig.tokenBudget.library) || 2000;
  let contextString = raw;

  // If engine didn't give a string, assemble one from the item list (defensive).
  if (!contextString && items.length) {
    let s = '\n\n---\nRELEVANT CONTENT FROM YOUR LIBRARY (saved sermons, devotionals, etc.):\n';
    items.slice(0, (modeConfig.search && modeConfig.search.libraryTopK) || 5).forEach((r, i) => {
      const title = (r && (r.item && r.item.title || r.title)) || 'Untitled';
      const cat = r && (r.item && r.item.cat || r.cat || 'other');
      s += `\n[${i + 1}] "${title}" -- ${cat}`;
      const snippet = ((r && (r.item && r.item.content || r.content)) || '').slice(0, 400);
      if (snippet) s += '\n' + snippet;
    });
    s += '\n---\nUse the library content above where relevant to inform your response.\n';
    contextString = s;
  }

  return {
    contextString: truncateToTokens(contextString, budget),
    items,
    budget,
  };
}

/** Internet context — consumed from Agent 2 search output, capped + formatted. */
function buildInternetContext(searchResult, modeConfig) {
  const results = (searchResult && searchResult.results) || [];
  const raw = (searchResult && searchResult.contextString) || '';
  const budget = (modeConfig.tokenBudget && modeConfig.tokenBudget.internet) || 2000;
  let contextString = raw;

  if (!contextString && results.length) {
    let s = '\n\n---\nINTERNET RESOURCES FOUND:\n';
    results.slice(0, (modeConfig.search && modeConfig.search.internetTopK) || 5).forEach((r, i) => {
      const title = (r && r.title) || 'Untitled';
      const url = (r && r.url) || '';
      const snippet = (r && (r.snippet || r.description || r.text || '')) || '';
      s += `\n[${i + 1}] ${title}${url ? ' — ' + url : ''}`;
      if (snippet) s += '\n' + snippet;
    });
    s += '\n---\nPrioritise these internet resources where credible and relevant. Cite the source clearly.\n';
    contextString = s;
  }

  return {
    contextString: truncateToTokens(contextString, budget),
    results,
    budget,
  };
}

/** Mode modifier — the mode-specific voice/format block injected last. */
function buildModeModifier(mode, modeConfig) {
  const tone = modeConfig.tone || '';
  const format = modeConfig.format || '';
  const hint = modeConfig.outputFormatHint || '';
  const lines = [];
  lines.push(`\n\n=== MODE: ${modeConfig.label.toUpperCase()} ===`);
  if (tone) lines.push(`TONE: ${tone}`);
  if (format) lines.push(`FORMAT: ${format}`);
  if (hint) lines.push(`OUTPUT HINT: ${hint}`);
  if (modeConfig.model) lines.push(`RECOMMENDED MODEL: ${modeConfig.model}`);
  lines.push('=== END MODE MODIFIER ===');
  return lines.join('\n');
}

/* ============================================================
 * 5) CORE: assembleContext(query, mode)
 * ============================================================ */
export async function assembleContext(query, mode, options = {}) {
  const modeKey = resolveMode(mode, query);
  const modeConfig = config.modes[modeKey] || config.modes['deep-study'];
  const used = [];

  try {
    // --- ensure optional deps are loaded (lazy, cached) ---
    if (!ragModule && options.loadDeps !== false) ragModule = await dynamicImport(RAG_MODULE);
    if (!searchModule && options.loadDeps !== false) searchModule = await dynamicImport(SEARCH_MODULE);

    // RAG's default export is a NAMESPACE OBJECT exposing searchLibrary (not a
    // bare function). Resolve the callable through either the named export or
    // the default object's method so both import styles work.
    const libFn = ragModule && (ragModule.searchLibrary || (ragModule.default && ragModule.default.searchLibrary));
    const netFn = searchModule && (searchModule.searchInternet || (searchModule.default && searchModule.default.searchInternet));

    const libraryTopK = (modeConfig.search && modeConfig.search.libraryTopK) || 5;
    const internetTopK = (modeConfig.search && modeConfig.search.internetTopK) || 5;

    // ---- Library (RAG) with fallback to training-only ---- 
    let libResult = null;
    if (libFn) {
      try {
        libResult = await libFn(query, modeKey, libraryTopK);
      } catch (e) {
        console.warn('[MINOS:router] Library search failed, falling back', String(e && e.message || e));
      }
    }

    // ---- Internet (Search) with fallback ----
    let netResult = null;
    if (netFn) {
      try {
        netResult = await netFn(query, modeKey);
      } catch (e) {
        console.warn('[MINOS:router] Internet search failed, falling back', String(e && e.message || e));
      }
    }

    const lib = buildLibraryContext(libResult, modeConfig);
    const net = buildInternetContext(netResult, modeConfig);

    // ---- Fallback chain bookkeeping: Library → Internet → Training only ----
    if (lib.contextString) used.push('library');
    if (net.contextString) used.push('internet');
    // 'training only' is always available as the implicit floor; flag it when neither injected.
    if (!lib.contextString && !net.contextString) used.push('trainingOnly');

    // ---- System Base (static identity; the Prompt Architect's base module lives at Agent 4) ----
    const systemBase = options.systemBase ||
      'You are MINOS — Ministry Intelligence & Operational System — serving Rev. Emmanuel Udoh, senior pastor of Light Assembly Bible Church, Ikot Ambon, Akwa Ibom State, Nigeria.';

    // ---- Mode modifier (tone/format hints specific to this request) ----
    const modeModifier = buildModeModifier(modeKey, modeConfig);

    // ---- Assemble the unified context = System Base + Library + Internet + Mode Modifier ----
    const parts = [systemBase, lib.contextString, net.contextString, modeModifier].filter(Boolean);
    let fullContext = parts.join('\n');

    // ---- Hard token guard: the single most important acceptance criterion ----
    const cap = tokCap();
    if (tokEstimate(fullContext) > cap) {
      console.warn(`[MINOS:router] Context ${tokEstimate(fullContext)}t > cap ${cap}t; trimming.`);
      fullContext = truncateToTokens(fullContext, cap);
    }

    const sources = {
      systemBase,
      mode: modeKey,
      config: modeConfig,
      used,
      library: lib,
      internet: net,
      modeModifier,
      tokenEstimate: tokEstimate(fullContext),
      tokenCap: cap,
    };

    return { fullContext, sources };
  } catch (e) {
    // Contract: never throw — degrade to training-only context.
    console.warn('[MINOS:router] Assembly failed, returning training-only fallback', String(e && e.message || e));
    return {
      fullContext: options.systemBase || 'You are MINOS, ministry assistant for Rev. Emmanuel Udoh.',
      sources: {
        systemBase: options.systemBase || '',
        mode: modeKey,
        config: modeConfig,
        used: ['trainingOnly'],
        library: { items: [], contextString: '' },
        internet: { results: [], contextString: '' },
        modeModifier: '',
        tokenEstimate: 1,
        tokenCap: tokCap(),
        error: String(e && e.message || e),
      },
    };
  }
}

/** Convenience: list all 8 modes + their distinct signatures (for tests / UI). */
export function listModes() {
  return KNOWN_MODES.map((m) => ({
    mode: m,
    label: config.modes[m].label,
    model: config.modes[m].model,
    weights: config.modes[m].weights,
    searchTopK: {
      library: config.modes[m].search.libraryTopK,
      internet: config.modes[m].search.internetTopK,
    },
  }));
}

/** Small synchronous helper to compute the full token estimate of a string. */
export function estimateTokens(text) {
  return tokEstimate(text);
}

export default { assembleContext, listModes, estimateTokens, resolveMode };