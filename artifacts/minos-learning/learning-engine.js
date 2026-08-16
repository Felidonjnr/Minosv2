/**
 * MINOS v2 — Learning Engine
 * ---------------------------
 * Pure localStorage personalisation. Zero external calls.
 * Builds a user profile from recorded interactions (mode usage, topic
 * affinity, source trust) within ~10 interactions, then feeds the Router
 * (mode weights) and the Library recommendation widget.
 *
 * Contract: ES module. Single default export object. Every public method
 * is callable with a minimal/zero-arg fallback. Never throws — returns
 * `{ error, fallback }` and degrades gracefully.
 *
 * Log prefix: [MINOS:learning]
 */

const MODULE = "learning";
const LOG = "[MINOS:learning]";

// localStorage key. Contract schema: { version, modeWeights, topicAffinities, sourceTrust, updated }
const DEFAULT_KEY = "minos_learning_profile";
const DEFAULT_VERSION = 1;

// Interaction history (kept for incremental learning + widget "recent").
const HISTORY_KEY = "minos_learning_history";

// Soft thresholds & constants
const PROFILE_READY_THRESHOLD = 10; // interactions before recommendations are "warm"
const MAX_HISTORY = 200;            // cap stored interactions to bound localStorage

/** Known categories from the library_items table (sermon|notes|whatsapp|facebook|partner|prayer|study|other). */
const KNOWN_CATEGORIES = ["sermon", "notes", "whatsapp", "facebook", "partner", "prayer", "study", "other"];

/** Decay — older signals weigh less (0.98^n, ~49% after ~35 events). */
const DECAY = 0.98;

/**
 * Mode id → category mapping (mirrors mode-config.json ids).
 * Used to translate mode usage into library category affinity.
 */
const MODE_TO_CATEGORY = {
  "deep-study": "study",
  "sunday-message": "sermon",
  "sermon-notes": "notes",
  "whatsapp-devotional": "whatsapp",
  "facebook-posts": "facebook",
  "partner-devotional": "partner",
  "prayer-guide": "prayer",
  "morning-brief": "other",
};

/** ------------------------- storage helpers ------------------------- */

function safeJSONParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : fallback;
  } catch (e) {
    console.warn(LOG, "corrupt profile JSON, using fallback —", e.message);
    return fallback;
  }
}

function readProfile(key) {
  const k = key || DEFAULT_KEY;
  let base = safeJSONParse(
    typeof localStorage !== "undefined" ? localStorage.getItem(k) : null,
    null
  );
  if (!base || base.version !== DEFAULT_VERSION) {
    base = emptyProfile();
  }
  // Ensure shape even if partially populated.
  return {
    version: DEFAULT_VERSION,
    modeWeights: normalizeWeights(base.modeWeights || {}),
    topicAffinities: base.topicAffinities || {},
    sourceTrust: base.sourceTrust || {},
    interactionCount: Number(base.interactionCount) || 0,
    updated: base.updated || Date.now(),
  };
}

function writeProfile(profile, key) {
  profile.updated = Date.now();
  profile.interactionCount = profile.interactionCount || 0;
  try {
    (typeof localStorage !== "undefined" ? localStorage : null)
      ?.setItem(key || DEFAULT_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn(LOG, "localStorage unavailable (size/private?) — in-memory only —", e.message);
  }
  return profile;
}

function readHistory(key) {
  const k = key || HISTORY_KEY;
  const arr = safeJSONParse(
    typeof localStorage !== "undefined" ? localStorage.getItem(k) : null,
    null
  );
  return Array.isArray(arr) ? arr : [];
}

function writeHistory(history, key) {
  const capped = history.slice(-MAX_HISTORY);
  try {
    (typeof localStorage !== "undefined" ? localStorage : null)
      ?.setItem(key || HISTORY_KEY, JSON.stringify(capped));
  } catch (e) {
    console.warn(LOG, "could not persist history —", e.message);
  }
}

function emptyProfile() {
  return {
    version: DEFAULT_VERSION,
    modeWeights: {},   // PRE-learning: empty → Router uses its defaults.
    topicAffinities: {},
    sourceTrust: {},
    interactionCount: 0,
    updated: Date.now(),
  };
}

/** Normalize weights to a 0..1 affine scale but keep keys; if empty, stay empty. */
function normalizeWeights(w) {
  if (!w || typeof w !== "object") return {};
  const out = {};
  for (const k of Object.keys(w)) {
    const n = Number(w[k]);
    if (Number.isFinite(n) && n > 0) out[k] = Math.min(1, n);
  }
  return out;
}

/** Iterate keys of an object of countable signals. */
function keysOf(o) {
  return o && typeof o === "object" ? Object.keys(o) : [];
}

/** Merge a signal bump into a counter map, applying decay to existing values first. */
function bumpCounts(map, keys, weight) {
  const out = {};
  for (const k of keysOf(map)) {
    const v = Number(map[k]) || 0;
    if (v > 0) out[k] = v * DECAY;
  }
  for (const k of keys) {
    if (!k) continue;
    out[k] = (out[k] || 0) + weight;
  }
  return out;
}

/**
 * Turn raw click counts into a 0..1 affinity map.
 * Out = count / max(count). Normalised across the set.
 */
function countsToAffinity(counts) {
  const items = Object.entries(counts || {}).filter(([, v]) => Number(v) > 0);
  if (!items.length) return {};
  const max = Math.max(...items.map(([, v]) => Number(v)));
  if (!max) return {};
  const out = {};
  for (const [k, v] of items) out[k] = Number(v) / max;
  return out;
}

/** Turn raw scores into 0..1 weights (softmax not needed; affine is stabler). */
function scoresToWeights(scores) {
  const items = Object.entries(scores || {}).filter(([, v]) => Number(v) > 0);
  if (!items.length) return {};
  const max = Math.max(...items.map(([, v]) => Number(v)));
  if (!max) return {};
  const out = {};
  for (const [k, v] of items) out[k] = Number(v) / max;
  return out;
}

/** ------------------------- normalisation map for Router feeds ------------------------- */

/**
 * Router feed: turn modeWeights (learned from usage counts) into a set of
 * per-mode boosts the Router can multiply into its own defaults.
 * Returns 0..1 per known mode, empty if not enough data.
 */
function buildRecommendations(profile, history) {
  const recs = {
    preferredSources: [],
    preferredModes: [],
    preferredTopics: [],
    sourceTrust: {},
    ready: (profile.interactionCount || 0) >= PROFILE_READY_THRESHOLD,
    interactionCount: profile.interactionCount || 0,
  };

  const srcTrust = profile.sourceTrust || {};
  const trustPairs = Object.entries(srcTrust)
    .map(([k, v]) => ({ k, v: Number(v) || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  recs.preferredSources = trustPairs.slice(0, 5).map((x) => x.k);
  recs.sourceTrust = { ...srcTrust };

  const modePairs = Object.entries(profile.modeWeights || {})
    .map(([k, v]) => ({ k, v: Number(v) || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  recs.preferredModes = modePairs.slice(0, 5).map((x) => x.k);

  const topicPairs = Object.entries(countsToAffinity(profile.topicAffinities || {}))
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v);
  recs.preferredTopics = topicPairs.slice(0, 8).map((x) => x.k);

  // Compact summaries for debugging/UI without PII.
  recs.modeBoost = buildModeBoost(modePairs);

  return recs;
}

/**
 * Map learned mode preference into Router-friendly additive boosts.
 * Router (minos-router) consumes these to bias its mode selection.
 */
function buildModeBoost(modePairs) {
  const points = modePairs.slice(0, 8);
  if (!points.length) return {};
  const max = points[0].v;
  const boost = {};
  for (const p of points) {
    // Range ~ +0.05 .. +0.40 so it nudges without overriding configured weights.
    boost[p.k] = 0.05 + 0.35 * (p.v / max);
  }
  return boost;
}

/** Extract library category from an interaction's item, if any. */
function categoryOf(data) {
  const c = (data && (data.category || data.cat)) || "";
  return KNOWN_CATEGORIES.includes(c) ? c : (MODE_TO_CATEGORY[data && data.mode] || "other");
}

function topicKeysOf(data) {
  const t = data && data.topics;
  if (Array.isArray(t)) return t.map(String).filter(Boolean);
  if (typeof t === "string") return t.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return [] ;
}

function sourceOf(data) {
  const s = data && (data.source || data.sourceType);
  if (typeof s === "string" && s.trim()) return s.trim();
  // Fall back to library category as a source signal.
  return categoryOf(data);
}

/** ------------------------- public API ------------------------- */

/**
 * recordInteraction(data)
 * data shape (all optional):
 *   { mode?, category?|cat?, topics?: string[]|string, source?|sourceType?,
 *     itemId?, title?, durationMs?, completed?, intent? }
 * A recording of a user action (picked a mode, saved/used an item, etc.)
 */
function recordInteraction(data = {}) {
  try {
    const now = Date.now();
    const prof = readProfile();
    const history = readHistory();

    // --- mode weight ---
    const mode = data.mode || (data.modeId) || null;
    if (mode && typeof mode === "string") {
      prof.modeWeights = bumpCounts(prof.modeWeights || {}, [mode], 1);
    }

    // --- topic affinity (always; uses topics if given else derives from category) ---
    let topics = topicKeysOf(data);
    if (!topics.length) {
      const cat = categoryOf(data);
      if (cat && cat !== "other") topics = [cat];
    }
    if (topics.length) {
      prof.topicAffinities = bumpCounts(prof.topicAffinities || {}, topics, 1);
    }

    // --- source trust ---
    const src = sourceOf(data);
    if (src) {
      // Completion or explicit positive intent raises trust more.
      const base = data.completed ? 2 : data.intent === "negative" ? -1 : 1;
      if (base > 0) {
        prof.sourceTrust = bumpCounts(prof.sourceTrust || {}, [src], base);
      } else if (base < 0) {
        const cur = Number((prof.sourceTrust || {})[src]) || 0;
        prof.sourceTrust = bumpCounts(prof.sourceTrust || {}, [], 1); // decay others
        prof.sourceTrust[src] = Math.max(0, cur - 1);
      }
    }

    prof.interactionCount = (Number(prof.interactionCount) || 0) + 1;

    // Persist profile + history.
    writeProfile(prof);
    history.push({
      t: now,
      mode: mode || null,
      cat: categoryOf(data),
      topics: topics.slice(0, 8),
      source: src || null,
      completed: !!data.completed,
      durationMs: Number(data.durationMs) || null,
    });
    writeHistory(history);

    return { ok: true, interactionCount: prof.interactionCount };
  } catch (e) {
    console.warn(LOG, "recordInteraction failed —", e.message);
    return { error: e.message, fallback: { ok: false } };
  }
}

/**
 * getProfile()
 * → { preferences, weights, recommendations }
 * Contracts reads this to build userProfile.{ preferences, weights }.
 */
function getProfile() {
  try {
    const prof = readProfile();
    const history = readHistory();

    const preferences = {
      sourceTrust: { ...prof.sourceTrust },
      topicAffinities: countsToAffinity(prof.topicAffinities),
      preferredModes: buildRecommendations(prof, history).preferredModes,
      preferredSources: buildRecommendations(prof, history).preferredSources,
      preferredTopics: buildRecommendations(prof, history).preferredTopics,
    };

    const weights = {
      modeWeights: scoresToWeights(prof.modeWeights),
      // These feed Router's source-weight nudges directly.
      sourceBoost: buildRecommendations(prof, history).modeBoost,
    };

    const recommendations = buildRecommendations(prof, history);

    return {
      preferences,
      weights,
      recommendations,
      raw: prof, // full profile (Router/test use)
    };
  } catch (e) {
    console.warn(LOG, "getProfile failed —", e.message);
    return {
      error: e.message,
      fallback: { preferences: {}, weights: {}, recommendations: null, raw: emptyProfile() },
    };
  }
}

/**
 * Clear all learned data. Privacy requirement: no data survives.
 * Returns the prior interactionCount for the caller's knowledge.
 */
function clearData() {
  const had = Number((readProfile()).interactionCount) || 0;
  try {
    (typeof localStorage !== "undefined" ? localStorage : null)?.removeItem(DEFAULT_KEY);
    (typeof localStorage !== "undefined" ? localStorage : null)?.removeItem(HISTORY_KEY);
  } catch (e) {
    console.warn(LOG, "clearData failed —", e.message);
  }
  return { ok: true, clearedInteractions: had };
}

/**
 * Router feed helper. Returns the subset of the profile the Router should
 * apply when selecting modes / boosting sources. Zero-arg safe.
 * Shape: { modeBoost, preferredSources, preferredModes, preferredTopics, ready }
 */
function routerFeed() {
  const recs = buildRecommendations(readProfile(), readHistory());
  return {
    modeBoost: recs.modeBoost,
    preferredSources: recs.preferredSources,
    preferredModes: recs.preferredModes,
    preferredTopics: recs.preferredTopics,
    ready: recs.ready,
    interactionCount: recs.interactionCount,
  };
}

/** How many interactions recorded so far (0..N). */
function interactionCount() {
  return readProfile().interactionCount || 0;
}

/** Warmth: true once >= PROFILE_READY_THRESHOLD interactions. */
function isReady() {
  return (readProfile().interactionCount || 0) >= PROFILE_READY_THRESHOLD;
}

const learningEngine = {
  MODULE,
  PROFILE_READY_THRESHOLD,
  recordInteraction,
  getProfile,
  clearData,
  routerFeed,
  interactionCount,
  isReady,
  buildRecommendations,
  _storage: { DEFAULT_KEY, HISTORY_KEY }, // exposed for tests/debug
};

export default learningEngine;