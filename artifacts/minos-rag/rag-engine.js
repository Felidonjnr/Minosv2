/**
 * MINOS v2 — RAG Engine (Agent 1: minos-rag)
 * =====================================================================
 * Firebase/Supabase Library search module for MINOS.
 *
 * Before every AI call, the Router calls `searchLibrary(query, mode, topK)`
 * to find relevant saved church content (sermons, pulpit notes, WhatsApp
 * devotionals, Facebook posts, partner devotionals, prayer guides, deep-study
 * notes, books/other) and injects the result as context into the LLM prompt.
 *
 * The module NEVER writes to the library and makes zero schema/DDL changes:
 * it is strictly read-only.
 *
 * Architecture
 * ---------------------------------------------------------------------
 *   1. LOCAL VECTOR SEARCH (preferred, < 500 ms)
 *      - Lazy-builds an in-memory inverted index + TF-IDF style weights from
 *        the caller-injected `items` map (typically the app's global `items`).
 *      - Token-overlap scoring with IDF weighting, title boost and category
 *        boost from the current mode. Pure client-side; no network.
 *
 *   2. SUPABASE ("Firebase") QUERY FALLBACK (< 2 s)
 *      - If no local index is available (e.g. app hasn't loaded `items` yet),
 *        it queries the `library_items` table, then re-scores + ranks the
 *        returned rows with the same scoring for consistent ordering.
 *      - Requires the caller to pass the app's Supabase client. If not
 *        provided, degrades gracefully.
 *
 *   3. GRACEFUL DEGRADATION
 *      - Empty/invalid query, empty library, or network failure all return
 *        `{ items: [], contextString: "" }`. The Router then falls through
 *        "Library → Internet → Training only" per the collaboration contract.
 * ---------------------------------------------------------------------
 *
 * @module minos-rag/rag-engine
 * @author   minos-rag (Agent 1)
 * @license  Private — Light Assembly Bible Church
 */

/* ------------------------------------------------------------------ *
 *  Constants & config
 * ------------------------------------------------------------------ */

// Maps app categories -> readable labels + base weight. Mirrors MINOS `CATS`
// but self-contained so the module runs standalone (no globals required).
const CATS = {
  sermon:    { label: 'Sermon',               weight: 1.0 },
  notes:     { label: 'Pulpit Notes',         weight: 1.0 },
  whatsapp:  { label: 'WhatsApp',             weight: 1.0 },
  facebook:  { label: 'Facebook',             weight: 1.0 },
  partner:   { label: 'Partner Devotional',   weight: 1.0 },
  prayer:    { label: 'Prayer Guide',         weight: 1.0 },
  study:     { label: 'Deep Study',           weight: 1.0 },
  other:     { label: 'Other',                weight: 0.9 }
};

// Per-mode category boost. The Router passes `mode`; each mode bumps the
// categories most likely to contain relevant saved content.
const MODE_BOOSTS = {
  'deep-study':            { sermon: 1.6, study: 1.9, notes: 1.5, other: 1.2 },
  'sunday-message':        { sermon: 2.0, notes: 1.7, study: 1.3, prayer: 1.2 },
  'sermon-notes':          { notes: 1.9, sermon: 1.7, study: 1.4 },
  'whatsapp-devotional':   { whatsapp: 1.9, sermon: 1.4, partner: 1.3, prayer: 1.3 },
  'facebook-posts':        { facebook: 1.9, whatsapp: 1.4, sermon: 1.3, study: 1.2 },
  'partner-devotional':    { partner: 2.0, whatsapp: 1.5, sermon: 1.3, prayer: 1.3 },
  'prayer-guide':          { prayer: 2.0, sermon: 1.4, partner: 1.3, study: 1.2 },
  'morning-brief':         { prayer: 1.4, sermon: 1.3, whatsapp: 1.2, facebook: 1.2, study: 1.2 },
  'default':               {}
};

const MAX_SNIPPET = 600;   // max chars of content snapshot injected per item
const DEFAULT_TOP_K = 5;   // default number of results
const MAX_TOP_K = 12;      // hard cap to protect the token budget
const STOPWORDS = new Set(
  ('a,an,the,and,or,but,if,then,else,of,to,in,for,on,with,at,by,from,as,is,are,was,were,' +
   'be,been,being,have,has,had,do,does,did,this,that,these,those,it,its,he,she,they,them,' +
   'me,my,our,you,your,we,us,i,not,no,so,too,very,just,can,could,will,would,should,shall,' +
   'am,about,into,over,after,before,between,out,up,down,more,most,lord,god,may,might,also')
    .split(',').filter(Boolean).map(s => s.trim().toLowerCase())
);

// Keep a module-level cache of built indexes keyed by the items-map reference.
let indexCache = new WeakMap();

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

function nowMs() { return Date.now(); }

function toText(v) { return v == null ? '' : String(v); }

function normalize(str) {
  return toText(str).toLowerCase().replace(/[’‘]/g, "'").trim();
}

/** Tokenize text into cleaned, stopword-filtered tokens. */
function tokenize(text) {
  if (!text) return [];
  return normalize(text)
    .split(/[^a-z0-9']+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

/* ------------------------------------------------------------------ *
 *  Local index builder (lazy, cached per items-map reference)
 * ------------------------------------------------------------------ */

/**
 * Build a lightweight inverted index + document stats for fast local scoring.
 */
function buildIndex(itemsMap) {
  const index = {
    items: [],        // array of { id, title, content, cat, date, raw, toks }
    idf: new Map(),   // token -> idf weight
    numDocs: 0
  };
  const byId = itemsMap || {};
  const ids = Object.keys(byId);
  if (!ids.length) return index;

  const docFreq = new Map(); // token -> # docs containing it
  const docs = [];

  ids.forEach(id => {
    const raw = byId[id] || {};
    const title = normalize(raw.title);
    const content = normalize(raw.content);
    const toks = tokenize(title + ' ' + content);
    if (!toks.length) return;

    const uniq = new Set(toks);
    uniq.forEach(t => docFreq.set(t, (docFreq.get(t) || 0) + 1));
    docs.push({ id, title, content, cat: toText(raw.cat), date: (raw.date) || 0, raw, toks });
  });

  index.numDocs = docs.length;
  index.items = docs;

  const N = Math.max(docs.length, 1);
  docFreq.forEach((df, tok) => {
    index.idf.set(tok, Math.log(1 + N / (df + 1)) + 0.01);
  });
  return index;
}

/** Get (and lazily cache) the index for a given items map. */
function getIndex(itemsMap) {
  if (!itemsMap) return { numDocs: 0, items: [], idf: new Map() };
  let idx = indexCache.get(itemsMap);
  if (!idx) {
    idx = buildIndex(itemsMap);
    indexCache.set(itemsMap, idx);
  }
  return idx;
}

/** Force-refresh the local index cache for a given items map. */
function invalidate(itemsMap) {
  if (itemsMap) indexCache.delete(itemsMap);
}

/* ------------------------------------------------------------------ *
 *  Scoring
 * ------------------------------------------------------------------ */

function catKey(cat) {
  return CATS[cat] ? cat : 'other';
}

function catLabel(cat) {
  const c = CATS[catKey(cat)];
  return c ? c.label : 'Other';
}

/** IDF-scaled term-frequency score, with title boosts. */
function tokenScore(doc, tok, idf) {
  const t = tok.toLowerCase();
  let s = 0;
  const inTitle = doc.title.includes(t);
  if (inTitle) s += 2.2;
  if (doc.title.includes(' ' + t + ' ') || doc.title.startsWith(t + ' ') || doc.title.endsWith(' ' + t)) s += 1.5;

  let ci = 0, from = 0, slices = 0;
  while (from < doc.content.length && slices < 40) {
    const at = doc.content.indexOf(t, from);
    if (at === -1) break;
    ci++;
    from = at + t.length;
    slices++;
  }
  s += Math.min(ci, 4) * 0.6;
  const w = idf.get(t) || 0.5;
  return s * w;
}

/** Produce a 0+ relevance score for a doc given query tokens + mode. */
function scoreDoc(doc, queryTokens, idf, mode) {
  if (!queryTokens.length) return 0;
  let raw = 0, matched = 0;
  queryTokens.forEach(tok => {
    if (!tok) return;
    const s = tokenScore(doc, tok, idf);
    if (s > 0) matched++;
    raw += s;
  });
  if (!matched) return 0;

  const coverage = matched / queryTokens.length;
  let score = raw * (0.5 + 0.5 * coverage);

  const boostMap = (mode && MODE_BOOSTS[mode]) || MODE_BOOSTS['default'];
  score *= (boostMap[catKey(doc.cat)] || 1.0);

  const age = Date.now() - (doc.date || 0);
  if (age < 90 * 864e5) score *= 1.05;

  return score;
}

/* ------------------------------------------------------------------ *
 *  Local search + context builder
 * ------------------------------------------------------------------ */

function runLocalSearch(query, idx, k, mode) {
  if (!idx || !idx.items || !idx.items.length) return [];
  const toks = tokenize(query);
  if (!toks.length) return [];
  const scored = [];
  idx.items.forEach(doc => {
    const s = scoreDoc(doc, toks, idx.idf, mode);
    if (s > 0) scored.push({ doc, score: s });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function formatItem(result, i) {
  const doc = result.doc;
  const title = toText(doc.raw && doc.raw.title) || toText(doc.title) || 'Untitled';
  const label = catLabel(doc.cat);
  const snippet = normalize(toText(doc.raw && doc.raw.content) || toText(doc.content)).slice(0, MAX_SNIPPET);
  return `[${i}] "${title}" (${label})\n${snippet}`;
}

/** Render results into the required context block. Empty -> "" (graceful). */
function buildContextString(results) {
  if (!results.length) return '';
  const lines = results.map((r, i) => formatItem(r, i + 1));
  return 'LIBRARY CONTEXT:\n---\n' + lines.join('\n') + '\n---';
}

/* ------------------------------------------------------------------ *
 *  Supabase fallback
 * ------------------------------------------------------------------ */

async function runSupabaseFallback(query, client, k, mode) {
  const t0 = nowMs();
  const toks = tokenize(query);
  if (!toks.length || !client) return { results: [], ms: nowMs() - t0 };
  try {
    let rows = [];
    // textSearch full-text path (if the client supports it)
    try {
      const res = await client.from('library_items').select('*').textSearch('content', toks.join(' ')).limit(k * 5);
      rows = Array.isArray(res && res.data) ? res.data : [];
    } catch (_e) { rows = []; }

    if (!rows.length) {
      const res = await client.from('library_items').select('*').limit(100).order('date', { ascending: false });
      rows = Array.isArray(res && res.data) ? res.data : [];
    }
    if (!rows.length) return { results: [], ms: nowMs() - t0 };

    const tempMap = {};
    rows.forEach(r => { if (r && r.id) tempMap[r.id] = r; });
    const idx = getIndex(tempMap);
    const results = runLocalSearch(query, idx, k, mode);
    return { results, ms: nowMs() - t0 };
  } catch (err) {
    console.warn('[MINOS:rag-engine] Supabase fallback failed:', err.message);
    return { results: [], ms: nowMs() - t0 };
  }
}

/* ------------------------------------------------------------------ *
 *  Public API
 * ------------------------------------------------------------------ */

/**
 * Search the saved library for content relevant to the query.
 *
 * @param {string} query   The user's raw query.
 * @param {string} [mode]  MINOS mode key (deep-study, sunday-message, ...).
 * @param {number} [topK]  Max results (default 5, capped at 12).
 * @param {Object} [opts]  { items, supabaseClient, refresh }
 * @returns {Promise<{ items: Array, contextString: string, meta: Object }>}
 */
async function searchLibrary(query, mode, topK, opts) {
  const o = opts || {};
  const itemsMap = o.items || null;
  const q = toText(query).trim();
  const k = Math.max(1, Math.min((topK || DEFAULT_TOP_K) >>> 0 || DEFAULT_TOP_K, MAX_TOP_K));
  const t0 = nowMs();
  const startMode = toText(mode);

  try {
    let idx = getIndex(itemsMap);
    if (o.refresh && itemsMap) { invalidate(itemsMap); idx = getIndex(itemsMap); }

    let results = runLocalSearch(q, idx, k, startMode);
    let meta = { source: 'local', localMs: 0, supabaseMs: 0, totalMs: nowMs() - t0, matched: results.length };

    if (results.length === 0) {
      const fb = await runSupabaseFallback(q, o.supabaseClient, k, startMode);
      if (fb.results.length) { results = fb.results; meta.source = 'supabase'; meta.supabaseMs = fb.ms; }
    }
    meta.totalMs = nowMs() - t0;

    const items = results.map(r => ({
      id: r.doc.id,
      title: toText(r.doc.raw && r.doc.raw.title) || toText(r.doc.title),
      cat: catKey(r.doc.cat),
      date: r.doc.date || 0,
      content: toText(r.doc.raw && r.doc.raw.content) || toText(r.doc.content),
      score: Math.round(r.score * 1000) / 1000,
      label: catLabel(r.doc.cat)
    }));

    return { items, contextString: buildContextString(results), meta };
  } catch (err) {
    // Guaranteed graceful degradation (contract: never throw).
    console.warn('[MINOS:rag-engine] searchLibrary error:', err.message);
    return { items: [], contextString: '', meta: { error: err.message, source: 'none', localMs: nowMs() - t0, matched: 0 } };
  }
}

export default {
  searchLibrary,
  invalidate,
  _tokenize: tokenize,
  _catLabel: catLabel,
  _CATS: CATS,
  _MODE_BOOSTS: MODE_BOOSTS
};