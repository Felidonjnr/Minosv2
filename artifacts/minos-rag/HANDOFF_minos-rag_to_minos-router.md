# HANDOFF — minos-rag → minos-router

**From:** Agent 1 (`minos-rag`) — RAG Engineer
**To:** Agent 3 (`minos-router`) — Mode Router
**Date:** handoff at CP1 (Phase 1 completion)

---

## What was delivered

| Artifact | Path | Purpose |
|----------|------|---------|
| RAG engine | `artifacts/minos-rag/rag-engine.js` | ES-module Firebase/Supabase Library search + context builder |
| Integration points | `artifacts/minos-rag/integration-points.md` | Exactly where/how to call in the chat flow |
| Test harness | `artifacts/minos-rag/test/test-rag-engine.js` | **12 assertions — all pass** (local ≈ 5 ms) |
| Collab contract | `MINOS/COLLABORATION_CONTRACT.md` | Shared interface standard (created per SUB_AGENT_ARCHITECTURE) |

> **Backend note:** `minos.html` actually uses **Supabase** (the `library_items` table),
> which the architecture doc calls "Firebase". `rag-engine.js` targets that real schema.

---

## Public interface

```js
import rag from '../minos-rag/rag-engine.js';

const { items, contextString, meta } = await rag.searchLibrary(query, mode, topK, opts);
```

**Signature**
```
searchLibrary(query: string, mode?: string, topK?: number (1..12),
              opts?: { items?, supabaseClient?, refresh? })
  → Promise<{ items: Array, contextString: string,
              meta: { source, localMs, supabaseMs, totalMs, matched, error? } }>
```

- `query` — raw user text.
- `mode` — one of the 8 MINOS modes (see `MODE_BOOSTS`). Optional.
- `topK` — max results; defaults 5, hard-capped at 12.
- `opts.items` — the app library map `{id: item}` (usually `window.items`). Primary source.
- `opts.supabaseClient` — `window.supabase`; used **only** when local is empty.
- `opts.refresh` — force re-index even if cached.

**Return**
- `items` — `[{ id, title, cat, date, content, score, label }]`, relevance-ranked desc.
- `contextString` — the exact block to splice into the prompt:
  ```
  LIBRARY CONTEXT:
  ---
  [1] "Title" (Category)
  ...content snippet...
  ---
  ```
- `meta` — provenance + timing (`source: local | supabase | none`).

**Guarantees (contract-compliant)**
- Never throws. On any error/empty input/empty library/offline → `{ items: [], contextString: '' }`.
- Local path always < 500 ms (measured 5 ms). Supabase fallback < 2 s.
- Read-only — never mutates the library or schema.

---

## How to consume in your Router

```js
const context = {
  library: await searchLibrary(query, mode, topK, { items: window.items, supabaseClient: window.supabase }),
  internet: null,        // filled by minos-search (Agent 2)
  mode,
  userProfile: {}        // filled later by minos-learning (Agent 5)
};
// Later: buildSystemPrompt(mode, context, userProfile) — Agent 4
```

### Fallback chain (mirror the contract)
1. **Local** — fastest; use when `meta.source === 'local'`.
2. **Supabase fallback** — triggered automatically inside `searchLibrary` when the
   local map yields nothing and a client is supplied.
3. **Empty context** — if `contextString === ''`, omit the library block and fall
   through "training only". Do NOT fabricate items.

**Router responsibility:** pass a sensible `mode` per query so category boosts fire
(e.g. `sunday-message` boosts `sermon`, `prayer-guide` boosts `prayer`). See
`MODE_BOOSTS` in `rag-engine.js`. Tune with the Learning agent at CP2 if desired.

---

## Dependencies on you (Router)

- Route each query to a mode **before** calling `searchLibrary`.
- Keep `topK` small (3–5) for the <8k-context-token budget.
- Merge **library** context before **internet**: `LIBRARY CONTEXT:` then
  `INTERNET RESOURCES FOUND:` per contract.

---

## Testing status
- `node artifacts/minos-rag/test/test-rag-engine.js` → **12/12 pass**.
- Covers: relevance ranking, mode boost, empty/blank query, no-source graceful,
  Supabase mock fallback, topK cap, exact context-string format.

## Open items for Router/Orchestrator
- Final DOM/script wiring of the ES module into the classic `sendMessage()` (see
  `integration-points.md` §6). RAG module needs no DOM access.
- Confirm `mode` keys match `MODE_BOOSTS`. If your router uses different strings,
  map them or add aliases to `MODE_BOOSTS`.

---

### One-line summary
`await searchLibrary(query, mode, topK, { items, supabaseClient })` returns ranked
library hits + the ready-to-inject `contextString` — drop it into the system message
before every LLM call. Fast, fault-tolerant, schema-safe.