# HANDOFF — MINOS Learning → Router

**From:** `minos-learning` (Agent: Learning Engine)
**To:** `minos-router` — mode weights & source bias
**Date:** 2026-08-16
**Contract ref:** `/MINOS/COLLABORATION_CONTRACT.md`

## tl;dr

The Learning Engine is **read-only toward the Router**: it never mutates
`mode-config.json`. It exposes a pure function the Router calls at decision-time
to *nudge* mode selection and boost trusted sources/topics. If there is
insufficient data (< 10 interactions) it returns empty objects so the Router
falls through to its configured defaults with zero change.

---

## What the Router should consume

Import the default export from `artifacts/minos-learning/learning-engine.js`
(a pure ES module, no side effects):

```js
import learningEngine from "../minos-learning/learning-engine.js";
```

Then, at mode-selection time:

```js
const feed = learningEngine.routerFeed();
```

`routerFeed()` returns:

```js
{
  modeBoost: {
    "sunday-message": 0.4,   // 0.05..0.40 additive boost, only for used modes
    "sermon-notes": 0.22
  },
  preferredSources: ["sermon", "commentary"],  // top-5 by sourceTrust (desc)
  preferredModes:    ["sunday-message", "sermon-notes"],
  preferredTopics:   ["sermon", "psalms", "faith"],
  ready: true,          // false until >= 10 interactions
  interactionCount: 42
}
```

### How to apply

1. **Mode selection:** if `feed.ready`, compute
   `effectiveScore(mode) = configuredWeight[mode] + (feed.modeBoost[mode] || 0)`
   when ranking candidates for the default/suggested mode. `modeBoost` is
   bounded (max +0.40) so it *biases without overriding* — the configured
   weights still dominate.

2. **Source injection:** when a mode asks for multiple sources
   (library vs internet vs training), bump the result-injection rank of items
   whose category/source matches `feed.preferredSources` and
   `feed.preferredTopics` — move them up the `topK` selection. Do **not**
   exceed the `tokenBudget`/`contextTokenCap` in `mode-config.json`.

3. **Fallback:** if `!feed.ready`, ignore the feed entirely and use
   `mode-config.json` untouched. The engine returns `modeBoost: {}` in that case,
   so `(... + 0)` is a no-op by construction.

### Contract shape (for Router's assembled context)

`getProfile()` returns the shape the Router's `userProfile` expects:

```js
{
  preferences: {
    sourceTrust: { sermon: 0.92 },
    topicAffinities: { sermon: 1, psalms: 0.6 },
    preferredModes: [], preferredSources: [], preferredTopics: []
  },
  weights: {
    modeWeights: { "sunday-message": 1, "sermon-notes": 0.9 },
    sourceBoost: { "sunday-message": 0.4 }   // additive nudge
  },
  recommendations: { ... } // preferredSource/mode/topic + ready flag
}
```

Router maps `userProfile = { preferences: prof.preferences, weights: prof.weights }`.

---

## Data notes / constraints

- **Storage:** `localStorage` only. Key: `minos_learning_profile` (schema v1),
  history: `minos_learning_history`. Zero external calls.
- **Privacy:** No PII ever stored or logged. `console` logs use the prefix
  `[MINOS:learning]` / `[MINOS:learning:widget]` and contain only mode/category
  slugs and counts. `clearData()` wipes both keys.
- **Warm-up:** recommendations only surface after **10 interactions**.
- **Categories** map to the `library_items.cat` enum:
  `sermon|notes|whatsapp|facebook|partner|prayer|study|other`.
- **What this module does NOT do:** does not call Supabase, does not read
  `mode-config.json`, does not throw (returns `{ error, fallback }`).

---

## For the Orchestrator (Agent 8)

- CP2 (Intelligence): run `test/minos-learning-test.html` (shipped with the
  agent) to verify `recordInteraction → getProfile → routerFeed → clearData`
  sequence in a browser with an empty localStorage.
- Router's CP1/CP2 gate: confirm `routerFeed()` returns `ready:false` (no-op)
  before 10 interactions and biases correctly after.