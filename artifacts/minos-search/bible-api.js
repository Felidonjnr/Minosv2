/**
 * MINOS v2 — Bible API Module (Agent 2: minos-search)
 * =====================================================================
 * Passage lookup, cross-references and Strong's concordance helpers used by
 * the Internet Search engine to enrich deep-study and bibleLookup modes.
 *
 * Public free endpoints (no key required):
 *   - bible-api.com  — JSON Bible lookup + cross-references (KJV/ASV etc.)
 *   - api.scripture.api.bible / api.bible  — wider translations (needs an
 *     API key for some, but a public key exists for bible-api.com; we treat
 *     api.bible as optional and require `minos_bible_key` in localStorage).
 *
 * This module NEVER throws. Every public function returns a well-formed object
 * and degrades to safe empty shapes, ready to be folded into a `contextString`.
 *
 * @module minos-search/bible-api
 * @license  Private — Light Assembly Bible Church
 */

/* ------------------------------------------------------------------ *
 *  Config
 * ------------------------------------------------------------------ */

const PASSAGE_MAX_SNIPPET = 700;  // chars of passage text kept in context

// Transports: bible-api.com (primary, keyless) + optional api.bible.
const ENDPOINTS = {
  bibleCom: 'https://bible-api.com',              // GET /{ref}?translation=kjv
  apiBible: 'https://api.scripture.api.bible/v1'  // needs key (minos_bible_key)
};

// Default translation per mode (bible-api.com codes).
const MODE_TRANSLATION = {
  'deep-study':          'kjv',
  'sunday-message':      'kjv',
  'sermon-notes':        'kjv',
  'whatsapp-devotional': 'web',
  'facebook-posts':      'web',
  'partner-devotional':  'kjv',
  'prayer-guide':        'kjv',
  'morning-brief':       'web',
  'default':             'kjv'
};

// Named cross-reference groups bible-api.com returns via `include=references`.
const REFERENCE_GROUPS = ['related', 'crossrefs'];

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

function toText(v) { return v == null ? '' : String(v); }
function normalizeBool(v) { return typeof v === 'boolean' ? v : !!v; }

function readLocalStorage(key) {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : {};
    const ls = g.localStorage;
    if (!ls) return '';
    const v = ls.getItem(key);
    return v == null ? '' : toText(v).trim();
  } catch (_e) { return ''; }
}

async function fetchJson(url, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || 8000) : null;
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[MINOS:bible-api] fetch failed:', e && e.message || e);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pickTranslation(mode) { return MODE_TRANSLATION[mode] || MODE_TRANSLATION['default']; }

function cleanRef(ref) { return normalizeBool(ref) ? toText(ref).trim() : ''; }

/* ------------------------------------------------------------------ *
 *  Passage lookup
 * ------------------------------------------------------------------ */

/**
 * Fetch a Bible passage as plain text.
 *
 * @param {string} ref   e.g. "John 3:16" or "Romans 8:28-30".
 * @param {string} [mode] MINOS mode (selects a default translation).
 * @param {Object} [opts] { translation, snippet }
 * @returns {Promise<{ ok: boolean, text, reference, translation, version, snippet, contextString }>}
 */
async function lookupPassage(ref, mode, opts) {
  const o = opts || {};
  const reference = cleanRef(ref);
  const translation = toText(o.translation || pickTranslation(mode) || 'kjv');
  const snippetMax = (o.snippet && o.snippet > 0) ? o.snippet : PASSAGE_MAX_SNIPPET;

  if (!reference) {
    return { ok: false, text: '', reference: '', translation, version: '', snippet: '',
             contextString: '', error: 'empty-reference' };
  }

  try {
    const url = `${ENDPOINTS.bibleCom}/${encodeURIComponent(reference)}?translation=${encodeURIComponent(translation)}`;
    const json = await fetchJson(url);
    if (!json || !json.text) {
      return { ok: false, text: '', reference, translation, version: '', snippet: '', contextString: '', error: 'not-found' };
    }

    const text = normalizeBool(o.plain) ? json.text : json.text; // already plain
    const completed = toText(json.reference) || reference;
    const version = toText(json.translation_name) || toText(json.translation_id) || translation;
    const snippet = text.slice(0, snippetMax);

    const contextString =
      `BIBLE PASSAGE: ${completed} (${version})\n` +
      `---\n${snippet}${text.length > snippetMax ? '\n…[passage truncated]' : ''}\n---`;

    return { ok: true, text, reference: completed, translation, version, snippet, contextString };
  } catch (e) {
    console.warn('[MINOS:bible-api] lookupPassage error:', e && e.message || e);
    return { ok: false, text: '', reference, translation, version: '', snippet: '',
             contextString: '', error: e && e.message || String(e) };
  }
}

/* ------------------------------------------------------------------ *
 *  Cross-references
 * ------------------------------------------------------------------ */

/**
 * Fetch cross-references (related passages) for a Bible reference.
 * Uses bible-api.com `include=crossrefs,related` where supported.
 *
 * @returns {Promise<{ ok, references: string[], contextString }>}
 */
async function crossReferences(ref, mode, opts) {
  const o = opts || {};
  const reference = cleanRef(ref);
  if (!reference) {
    return { ok: false, references: [], contextString: '', error: 'empty-reference' };
  }
  try {
    const url = `${ENDPOINTS.bibleCom}/${encodeURIComponent(reference)}?include=${REFERENCE_GROUPS.join(',')}`;
    const json = await fetchJson(url);
    if (!json) return { ok: false, references: [], contextString: '', error: 'not-found' };

    const seen = new Set();
    const refs = [];
    (json.crossrefs || []).concat(json.related || []).forEach(r => {
      const rf = toText(r && (r.reference || r.crossref));
      if (rf && !seen.has(rf)) { seen.add(rf); refs.push(rf); }
    });

    const list = refs.slice(0, o.max || 8);
    const contextString = list.length
      ? `CROSS REFERENCES (${reference}):\n---\n${list.map((r, i) => `[${i + 1}] ${r}`).join('\n')}\n---`
      : '';

    return { ok: true, references: list, contextString };
  } catch (e) {
    console.warn('[MINOS:bible-api] crossReferences error:', e && e.message || e);
    return { ok: false, references: [], contextString: '', error: e && e.message || String(e) };
  }
}

/* ------------------------------------------------------------------ *
 *  Strong's concordance
 * ------------------------------------------------------------------ */

// Basic Hebrew/Greek to English word gloss helper — covers the high-frequency
// words the deep-study mode is likely to hit. Purely a local lexicon fallback
// when the network Strong's service is unavailable. Public domain Strong's data
// could be dropped into `STRONGS` later without changing the interface.
const SMALL_LEXICON = {
  // Greek (G)
  agape: { type: 'G', num: 'G26', gloss: 'love (selfless, divine love)' },
  agapao: { type: 'G', num: 'G25', gloss: 'to love (act of divine love)' },
  charis: { type: 'G', num: 'G5485', gloss: 'grace, favour, kindness' },
  pistis: { type: 'G', num: 'G4102', gloss: 'faith, faithfulness, conviction' },
  logos:  { type: 'G', num: 'G3056', gloss: 'word, reason, message (the Word)' },
  zoe:    { type: 'G', num: 'G2222', gloss: 'life (divine, eternal life)' },
  pneuma: { type: 'G', num: 'G4151', gloss: 'spirit, breath, wind' },
  sophia: { type: 'G', num: 'G4678', gloss: 'wisdom' },
  dunamis:{ type: 'G', num: 'G1411', gloss: 'power, ability, miraculous power' },
  hamartia:{ type: 'G', num: 'G266', gloss: 'sin, failure, missing the mark' },
  // Hebrew (H)
  shalom: { type: 'H', num: 'H7965', gloss: 'peace, wholeness, completeness' },
  hesed:  { type: 'H', num: 'H2617', gloss: 'steadfast love, lovingkindness, mercy' },
  emunah: { type: 'H', num: 'H530', gloss: 'faithfulness, faith, steadfastness' },
  dabar:  { type: 'H', num: 'H1697', gloss: 'word, matter, thing' },
  torah:  { type: 'H', num: 'H8451', gloss: 'law, instruction, teaching' },
  kadosh: { type: 'H', num: 'H6918', gloss: 'holy, set apart, sacred' },
  ruach:  { type: 'H', num: 'H7307', gloss: 'spirit, breath, wind' },
  chayyim:{ type: 'H', num: 'H2416', gloss: 'life, living, alive' }
};

/**
 * Fetch a Strong's word study for a Greek/Hebrew term (e.g. "agape", "hesed").
 * Uses the local lexicon; network service can be layered in later.
 *
 * @returns {Promise<{ ok, term, strongs, gloss, contextString }>}
 */
async function strongsLookup(term, mode, opts) {
  const o = opts || {};
  const t = toText(term).toLowerCase().trim();
  if (!t) {
    return { ok: false, term: '', strongs: '', gloss: '', contextString: '', error: 'empty-term' };
  }
  try {
    const entry = SMALL_LEXICON[t];
    if (!entry) {
      const contextString = `STRONG'S WORD STUDY: "${t}"\n---\n(No entry in local lexicon; query a concordance like Blue Letter Bible for the full entry.)\n---`;
      return { ok: true, term: t, strongs: '', gloss: '', contextString, found: false };
    }
    const contextString =
      `STRONG'S WORD STUDY: "${t}"\n---\n` +
      `${entry.type} Strong's ${entry.num} — ${entry.gloss}\n---`;
    return { ok: true, term: t, strongs: entry.num, gloss: entry.gloss, contextString, found: true };
  } catch (e) {
    console.warn('[MINOS:bible-api] strongsLookup error:', e && e.message || e);
    return { ok: false, term: t, strongs: '', gloss: '', contextString: '', error: e && e.message || String(e) };
  }
}

/* ------------------------------------------------------------------ *
 *  Combined helper used by the search engine's bibleLookup modes
 * ------------------------------------------------------------------ */

/**
 * Enrichment helper: given a mode and an optional passage reference, produce a
 * combined bible-context string (passage + crossrefs + Strong's as the mode asks).
 */
async function enrichBibleContext(reference, mode, opts) {
  const o = opts || {};
  const m = toText(mode) || 'default';
  const needStrongs = (o.strongs != null) ? normalizeBool(o.strongs) : false;
  const parts = [];
  const meta = { lookedUp: '', crossrefs: 0, strongs: [] };

  // Passage
  if (reference) {
    const pass = await lookupPassage(reference, m, { snippet: o.snippet });
    if (pass.ok) { parts.push(pass.contextString); meta.lookedUp = pass.reference; }
    // Cross-references
    const refs = await crossReferences(reference, m, { max: o.maxRefs || 6 });
    if (refs.ok && refs.contextString) { parts.push(refs.contextString); meta.crossrefs = refs.references.length; }
  }

  // Strong's words (from opts.strongsWords, or mode default when enabled)
  const words = Array.isArray(o.strongsWords) && o.strongsWords.length
    ? o.strongsWords
    : (needStrongs ? ['agape', 'charis', 'pneuma', 'hesed', 'shalom'] : []);
  for (const w of words) {
    const s = await strongsLookup(w, m);
    if (s.ok && s.contextString) { parts.push(s.contextString); if (s.strongs) meta.strongs.push(s.term + ':' + s.strongs); }
  }

  const contextString = parts.join('\n\n');
  return { contextString, meta };
}

export default {
  lookupPassage,
  crossReferences,
  strongsLookup,
  enrichBibleContext,
  _MODELESS_BASE_ENDPOINTS: ENDPOINTS,
  _STRONGS_LEXICON: SMALL_LEXICON
};
export { lookupPassage, crossReferences, strongsLookup, enrichBibleContext };