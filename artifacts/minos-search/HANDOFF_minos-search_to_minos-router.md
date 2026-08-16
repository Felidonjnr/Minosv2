# HANDOFF — minos-search → minos-router

**Source:** `MINOS/artifacts/minos-search/` (Agent 2 — Internet Search Engine)
**Destination:** `MINOS/artifacts/minos-router/mode-router.js` (Agent 3)
**Date:** 2026-08-16 · **MINOS v2 (CP1 Foundation)**

## What this artifact delivers

Two ES modules:
- `search-engine.js` — web search interface `searchInternet(query, mode)`.
- `bible-api.js` — passage lookup, cross-references, Strong's concordance.

Plus `mode-strategies.md` (the 8-mode strategy table above).

## ⚠️ Import path update required in the Router

`mode-router.js` currently points at `../minos-search/search-engine.js`. The
artifact lives at `MINOS/artifacts/minos-search/search-engine.js`, so **the path
is already correct and no change is needed**. If the Router is ever relocated,
update `SEARCH_MODULE` to:

```js
const SEARCH_MODULE = '../minos-search/search-engine.js';
```

## Exposed interface (call exactly like this)

```js
import searchEngine from '../minos-search/search-engine.js'; // ESM default
// or: import { searchInternet } from '../minos-search/search-engine.js';

const result = await searchEngine.searchInternet(query, mode); // or default export
// => { results: Array, contextString: string, meta: Object }
```

The Router already calls `searchModule.searchInternet || searchModule.default`,
so **both entry points work** (named export and default object both expose
`searchInternet`).

## Field contract (what the Router consumes)

```
result = {
  results: [
    { title: string, url: string, snippet: string, source: 'brave'|'google'|'stub', stub?: bool }
  ],
  contextString: string,   // "INTERNET RESOURCES FOUND:\n---\n[1] …\n[2] …\n---" or ""
  meta: { provider, matched, queriedQuery, totalMs, mode, topK, cached?, error? }
}
```

- `results: []` and `contextString: ""` on any failure — **never throws**.
- `meta.provider` tells the Router which source survived: `brave` | `google` | `stub`.
- `meta.cached` is present when a repeated query was served from the module cache.
- Two optional args: `opts = { topK, apiKey, googleKey, googleCx, forceStub }`
  for testing/Node injection.

## bible-api.js surface (used by search-engine; also standalone-callable)

```js
lookupPassage(ref, mode, opts)  // -> { ok, text, reference, translation, version, snippet, contextString }
crossReferences(ref, mode, opts) // -> { ok, references: string[], contextString }
strongsLookup(term, mode, opts)  // -> { ok, term, strongs, gloss, contextString, found }
enrichBibleContext(ref, mode, opts) // -> { contextString, meta }
```

All return `ok:false` + empty shapes instead of throwing.

## API keys (localStorage, per COLLABORATION_CONTRACT)

| Purpose | Key | Format |
|---------|-----|--------|
| Brave Search (primary) | `minos_brave_key` | `X-Subscription-Token` string |
| Google CSE (fallback) | `minos_google_key` | API key |
| Google CSE engine id | `minos_google_cx` | engine id (cx) |
| api.bible (optional, heavier) | `minos_bible_key` | API key (not currently wired) |

Keys are read lazily from `globalThis.localStorage` inside `try/catch`, so the
module also runs headless/Node (returns stub results there) and never logs keys.

## Fallback chain (graceful degradation, never throws)

```
Brave (key) → Google CSE (key+cx) → deterministic stub (always resolves)
```

The stub returns a hard-coded set of credible Christian resource sites tuned per
mode, so the Router **always** receives a non-empty context even fully offline
(or "training only" is reached only if the Router itself strips it).

## All 8 modes are distinct (verification)

Each mode has a distinct `{ depth, topK, prefix, credential, strongs }` tuple
(see `mode-strategies.md`). `deep-study` is the only mode that enables Strong's.
`morning-brief` adds "today"/church-calendar vocabulary for current-date search.

## Tests

- `MINOS/artifacts/minos-search/test/search-engine.test.html` — runs the full
  suite in-browser (Brave/Google paths stubbed; exercises stub, empty-query,
  context format, never-throw, all 8 modes, keyless degradation).
- Node smoke runner: `node test/node-smoke.mjs`.

## Acceptance notes for Router integration

1. No change to `mode-router.js` required — import path already correct.
2. Router's `buildInternetContext` already matches the `results`/`contextString`
   shape this engine produces.
3. Token budget: engine caps `topK ≤ 10` and emits only `Title — url` lines by
   default; Router's per-mode internet budget trimming still applies on top.
4. Clean shutdown: add `searchEngine.clearCache()` if you want to drop the module
   query cache between sessions.