/**
 * MINOS v2 — Internet Search Engine (Agent 2: minos-search)
 * =====================================================================
 * Web-search module for MINOS. Before every AI call the Router calls
 * `searchInternet(query, mode)` to find credible, relevant resources on the
 * public web and inject them as context into the LLM prompt, per the
 * COLLABORATION_CONTRACT.
 *
 * Providers (auto-detected, in order):
 *   A. Brave Search API   — primary. Key read from localStorage `minos_brave_key`.
 *   B. Google Programmable Search Engine (CSE) — key `minos_google_key`,
 *      engine ID `minos_google_cx`. Used as an alternative when Brave is absent.
 *   C. Deterministic stub — offline, zero-network fallback. Always returns
 *      mode-appropriate seed resources so the Router always gets a non-empty
 *      (credible, hard-coded) context even with no keys and no network.
 *
 * Every public function NEVER throws. On any failure it degrades through the
 * chain above and returns `{ results: [], contextString: "" }` (or the stub),
 * so the Router can fall through "Internet -> Training only" per the contract.
 *
 * Context format produced (Router <- Search -> Prompt):
 *   INTERNET RESOURCES FOUND:
 *   ---
 *   [1] Title — url
 *   [2] Title — url
 *   ---
 * Empty results  ->  { results: [], contextString: "" }  (never throws).
 *
 * @module minos-search/search-engine
 * @author   minos-search (Agent 2)
 * @license  Private — Light Assembly Bible Church
 */

/* ------------------------------------------------------------------ *
 *  Constants & config (mirrors mode-config.json for standalone use)
 * ------------------------------------------------------------------ */

// Per-mode search strategy. `queryPrefix` words are appended to the raw query
// to steer the engine toward the right class of resources for each mode.
const MODE_STRATEGY = {
  'deep-study': {
    depth: 'deep',
    topK: 8,
    prefix: 'scholarly commentary Greek Hebrew lexicon theological seminary paper',
    credential: 'seminary, lexicon, academic',
    bibleLookup: true,
    strongs: true
  },
  'sunday-message': {
    depth: 'medium',
    topK: 6,
    prefix: 'sermon outline historical cultural context illustrations related scriptures preaching',
    credential: 'sermon outline, commentary, teaching ministry',
    bibleLookup: true,
    strongs: false
  },
  'sermon-notes': {
    depth: 'medium',
    topK: 5,
    prefix: 'commentary highlights key themes preaching resources sermon notes',
    credential: 'commentary, teaching ministry',
    bibleLookup: true,
    strongs: false
  },
  'whatsapp-devotional': {
    depth: 'shallow',
    topK: 4,
    prefix: 'daily devotional relatable story illustration short-form theological insight',
    credential: 'devotional, story, illustration',
    bibleLookup: true,
    strongs: false
  },
  'facebook-posts': {
    depth: 'shallow',
    topK: 5,
    prefix: 'viral Christian content patterns topical Bible teaching engagement hooks',
    credential: 'Christian content, engagement pattern',
    bibleLookup: true,
    strongs: false
  },
  'partner-devotional': {
    depth: 'deep',
    topK: 5,
    prefix: 'covenant partnership stewardship scriptures prophetic devotional partner teaching',
    credential: 'stewardship, covenant, prophetic teaching',
    bibleLookup: true,
    strongs: false
  },
  'prayer-guide': {
    depth: 'medium',
    topK: 5,
    prefix: 'prayer movements scripture-based prayer patterns revival resources prayer agenda',
    credential: 'prayer ministry, revival teaching',
    bibleLookup: true,
    strongs: false
  },
  'morning-brief': {
    depth: 'daily',
    topK: 5,
    prefix: 'today church calendar Christian observances shepherd devotional morning',
    credential: 'church calendar, devotional, current date',
    bibleLookup: true,
    strongs: false
  },
  'default': { depth: 'medium', topK: 5, prefix: '', credential: '', bibleLookup: false, strongs: false }
};

// Hard-coded, credible seed resources used by the deterministic stub fallback.
// Covers the main resource classes each mode leans on. URLs are stable,
// well-known Christian resource sites.
const STUB_SOURCES = [
  { title: 'Blue Letter Bible (Strong\'s & concordance)',            url: 'https://www.blueletterbible.org/' },
  { title: 'BibleGateway (passages & translations)',                 url: 'https://www.biblegateway.com/' },
  { title: 'Bible Hub (commentaries, lexicon, cross-references)',    url: 'https://biblehub.com/' },
  { title: 'Got Questions (pastoral Q&A)',                           url: 'https://www.gotquestions.org/' },
  { title: 'Desiring God (John Piper sermons & articles)',           url: 'https://www.desiringgod.org/' },
  { title: 'The Gospel Coalition (articles, TGC)',                   url: 'https://www.thegospelcoalition.org/' },
  { title: 'Christianity Today (magazine & news)',                   url: 'https://www.christianitytoday.com/' },
  { title: 'Our Daily Bread (daily devotionals)',                    url: 'https://odb.org/' },
  { title: 'Bible Study Tools (commentary library)',                 url: 'https://www.biblestudytools.com/' },
  { title: 'OpenBible.info (topics & verses)',                       url: 'https://www.openbible.info/topics/' }
];

const MAX_TOP_K = 10;      // hard cap to protect the token budget
const REQUEST_TIMEOUT_MS = 9000;   // per-request network timeout
const PINNED = { browser: null }; // Mono-polyfill so module runs in Node + browser

// Weak cache so repeated queries with same key/query don't re-hit network.
const searchCache = new Map();

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

function nowMs() { return Date.now(); }

function toText(v) { return v == null ? '' : String(v); }

function normalize(str) { return toText(str).replace(/\s+/g, ' ').trim(); }

function clampTopK(n) { return Math.max(1, Math.min((n >>> 0) || 5, MAX_TOP_K)); }

/**
 * Read a value from localStorage if present (browser). Returns '' otherwise.
 * Wrapped in try/catch so SSR/Node never throws on missing `window`.
 */
function readLocalStorage(key) {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : {};
    const ls = g.localStorage;
    if (!ls) return '';
    const v = ls.getItem(key);
    return v == null ? '' : toText(v).trim();
  } catch (_e) {
    return '';
  }
}

/** In-flight fetch with a timeout. Never throws: returns null on failure. */
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || REQUEST_TIMEOUT_MS) : null;
  try {
    const opts = Object.assign({}, init || {});
    if (controller) opts.signal = controller.signal;
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[MINOS:search-engine] Network call failed:', e && e.message || e);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pickStrategy(mode) {
  return MODE_STRATEGY[mode] || MODE_STRATEGY['default'];
}

/** Build a tuned query per mode: raw query + mode prefix. */
function buildQuery(query, mode) {
  const strat = pickStrategy(mode);
  const base = normalize(query);
  if (!base) {
    // No query: fall back to the mode prefix alone so we still surface something.
    return normalize(strat.prefix) || normalize(strat.credential) || '';
  }
  const prefix = normalize(strat.prefix);
  return prefix ? base + ' ' + prefix : base;
}

/* ------------------------------------------------------------------ *
 *  Brave Search provider
 * ------------------------------------------------------------------ */

async function braveSearch(query, strat, apiKey) {
  const url = 'https://api.search.brave.com/res/v1/web/search?q=' +
    encodeURIComponent(query) + '&count=' + strat.topK + '&safesearch=moderate';
  const json = await fetchWithTimeout(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } });
  if (!json || !Array.isArray(json.web && json.web.results)) return [];
  return (json.web.results || []).slice(0, strat.topK).map(r => ({
    title: toText(r.title),
    url: toText(r.url),
    snippet: toText(r.description || r.snippet),
    source: 'brave',
  }));
}

/* ------------------------------------------------------------------ *
 *  Google CSE provider
 * ------------------------------------------------------------------ */

async function googleSearch(query, strat, apiKey, cx) {
  const url = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(apiKey) +
    '&cx=' + encodeURIComponent(cx) + '&q=' + encodeURIComponent(query) + '&num=' + Math.min(strat.topK, 10);
  const json = await fetchWithTimeout(url);
  if (!json || !Array.isArray(json.items)) return [];
  return json.items.slice(0, strat.topK).map(r => ({
    title: toText(r.title),
    url: toText(r.link),
    snippet: toText(r.snippet),
    source: 'google',
  }));
}

/* ------------------------------------------------------------------ *
 *  Result post-processing (shared across providers)
 * ------------------------------------------------------------------ */

/** Filter to results that actually have a usable title + url. */
function cleanResults(raw) {
  const seen = new Set();
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach(r => {
    if (!r || !r.title || !r.url) return;
    const key = toText(r.url);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      title: normalize(toText(r.title)),
      url: toText(r.url),
      snippet: normalize(toText(r.snippet)).slice(0, 300),
      source: toText(r.source) || 'web',
    });
  });
  return out;
}

/** Pick the stub resources most relevant to the requested mode (heuristic). */
function stubResultsForMode(mode, k) {
  let pool = STUB_SOURCES.slice();
  const sets = {
    'deep-study':     [0, 2, 3, 8, 6, 4],   // BlueLetter, BibleHub, GotQ, BST, TGC, DG
    'sunday-message': [3, 4, 6, 8, 1],      // GotQ, DG, TGC, BST, BibleGateway
    'sermon-notes':   [2, 8, 1, 3, 0],      // BibleHub, BST, BibleGateway, GotQ, BlueLetter
    'whatsapp-devotional': [8, 4, 3, 1],    // ODB, DG, GotQ, BibleGateway
    'facebook-posts': [4, 6, 3, 5],         // DG, TGC, GotQ, OurDailyBread/hooks
    'partner-devotional': [3, 6, 1, 4],     // GotQ, TGC, BibleGateway, DG
    'prayer-guide':   [4, 6, 3, 2, 9],      // DG, TGC, GotQ, BibleHub, OpenBible
    'morning-brief':  [8, 1, 3, 6, 4],      // ODB, BibleGateway, GotQ, TGC, DG
    'default':        [1, 3, 4, 8, 6],
  };
  const order = sets[mode] || sets['default'];
  const ordered = order.map(i => pool[i]).filter(Boolean);
  pool = ordered.concat(pool.filter((_, i) => order.indexOf(i) === -1));
  return pool.slice(0, k);
}

/* ------------------------------------------------------------------ *
 *  Context builder (shared)
 * ------------------------------------------------------------------ */

/** Render results into the required context block. Empty -> "" (graceful). */
function buildContextString(results) {
  if (!results || !results.length) return '';
  const lines = results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`);
  return 'INTERNET RESOURCES FOUND:\n---\n' + lines.join('\n') + '\n---';
}

/* ------------------------------------------------------------------ *
 *  Public API
 * ------------------------------------------------------------------ */

/**
 * Search the public web for resources relevant to the query (mode-tuned).
 *
 * @param {string} query  The user's raw query (may be empty for mode-driven searches).
 * @param {string} [mode] MINOS mode key (deep-study, sunday-message, ...).
 * @param {Object} [opts] Overrides: { topK, apiKey, googleKey, googleCx, forceStub }
 * @returns {Promise<{ results: Array, contextString: string, meta: Object }>}
 */
async function searchInternet(query, mode, opts) {
  const o = opts || {};
  const strat = pickStrategy(mode);
  const k = clampTopK(o.topK != null ? o.topK : strat.topK);
  const t0 = nowMs();
  const startMode = toText(mode) || 'deep-study';

  // API keys from localStorage (browser) or injected via opts (for tests / Node).
  const braveKey = toText(o.apiKey || readLocalStorage('minos_brave_key'));
  const googleKey = toText(o.googleKey || readLocalStorage('minos_google_key'));
  const googleCx = toText(o.googleCx || readLocalStorage('minos_google_cx'));

  const q = buildQuery(query, startMode);
  const cacheKey = `${braveKey?'b':''}${googleKey?'g':''}|${startMode}|${q}|${k}|${!!o.forceStub}`;
  if (!o.forceStub && searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    return { results: cached.results, contextString: cached.contextString,
             meta: Object.assign({}, cached.meta, { cached: true }) };
  }

  try {
    let raw = [];
    let provider = 'stub';

    // Chain: Brave -> Google -> deterministic stub. Brave key present? Use it.
    if (!o.forceStub && braveKey) {
      const braveRes = await braveSearch(q, strat, braveKey);
      raw = cleanResults(braveRes);
      if (raw.length) provider = 'brave';
    }
    // Google as fallback when Brave gave nothing or no Brave key.
    if (!raw.length && !o.forceStub && googleKey && googleCx) {
      const gRes = await googleSearch(q, strat, googleKey, googleCx);
      raw = cleanResults(gRes);
      if (raw.length) provider = 'google';
    }
    // Deterministic stub fallback — ALWAYS resolves, never throws (graceful floor).
    if (!raw.length) {
      raw = stubResultsForMode(startMode, k).map((s, i) => ({
        title: s.title, url: s.url,
        snippet: 'Established Christian resource (offline fallback).',
        source: 'stub',
        stub: true,
      }));
      provider = 'stub';
    }

    // Trim to budget and normalise.
    const results = raw.slice(0, k).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet || '',
      source: r.source || provider,
      stub: !!r.stub,
    }));

    const contextString = buildContextString(results);
    const meta = { provider, matched: results.length, queriedQuery: q, totalMs: nowMs() - t0, mode: startMode, topK: k };

    if (!o.forceStub) searchCache.set(cacheKey, { results, contextString, meta });

    return { results, contextString, meta };
  } catch (err) {
    // Contract: never throw. Return empty context; Router falls to training-only.
    console.warn('[MINOS:search-engine] searchInternet error:', err && err.message || err);
    const meta = { provider: 'none', error: err && err.message || String(err), totalMs: nowMs() - t0, mode: startMode };
    return { results: [], contextString: '', meta };
  }
}

/** Force clear the module-level query cache. */
function clearCache() { searchCache.clear(); }

export default { searchInternet, clearCache, _buildContextString: buildContextString, _cleanResults: cleanResults, _MODE_STRATEGY: MODE_STRATEGY, _STUB_SOURCES: STUB_SOURCES };
export { searchInternet };