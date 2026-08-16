# MINOS v2 Collaboration Contract

All sub-agents read this BEFORE starting. This is the shared interface, data-format,
and error-handling standard for every module produced under `MINOS/artifacts/`.

## Immutable Files (never modify)
- `index.html` (launcher / Door page) — UI untouched
- `minos.html` (Door 1) — UI + existing logic untouched by sub-agents
- `minos_1.html` (Door 2) — same
- `minos-claude.html`, `minos-deepseek.html` — reference copies

Only `minos-refactor` (Agent 7) and `minos-orchestrator` (Agent 8) may produce
integrated final files, in `artifacts/minos-refactor/` and `artifacts/minos-orchestrator/`.

## Backend Note (IMPORTANT)
The production app uses **Supabase** (PostgreSQL via the `@supabase/supabase-js` SDK),
not Google Firebase. The architecture docs loosely refer to it as "Firebase".
Treat "Firebase" → **Supabase** for schema and queries. Schema is READ-ONLY — no DDL changes.

**Primary table `library_items`:**
```sql
id          TEXT PRIMARY KEY
title       TEXT NOT NULL
cat         TEXT NOT NULL   -- sermon|notes|whatsapp|facebook|partner|prayer|study|other
content     TEXT NOT NULL
date        BIGINT NOT NULL -- epoch ms
created_at  TIMESTAMPTZ
```

**Secondary tables (touched only if needed):**
- `prompt_addons` — custom system-prompt addons (`{ addons: [] }`)
- `usage_data` — generic JSON usage bucket

## Module Interface Standard
- All modules: **ES modules (ES6)**, single default export (function or object).
- Naming: `minos-<feature>.js` placed in `artifacts/<agent-id>/`.
- Pure/isolated: no global side effects; accept injected dependencies where needed
  (e.g. an `items` map or an HTTP client) so Router can supply them.
- Every public function must be callable with a zero-arg / minimal fallback.

## Context Format (Router ← RAG/Search → Prompt)
Modules return a `{ items, contextString }` shape. Router assembles:

```js
{
  library:  { items: [], contextString: "" },
  internet: { results: [], contextString: "" },
  mode: "deep-study" | "sunday-message" | "...",
  userProfile: { preferences: {}, weights: {} }
}
```

### Library Context String (RAG)
```
LIBRARY CONTEXT:
---
[1] "Title" [sermon] ...
[2] "Title" [notes] ...
---
```
Empty results → `contextString: ""` and `items: []` (never throw).

### Internet Context String (Search)
```
INTERNET RESOURCES FOUND:
---
[1] Title — url
[2] Title — url
---
```

## Prompt Builder Signature
```js
buildSystemPrompt(mode, context, userProfile) → string
```

## Quality Check Signature
```js
validateOutput(output, mode) → { pass, issues: [], score: 0-100 }
```

## Learning Profile Schema (localStorage)
```js
{ version: 1, modeWeights: {}, topicAffinities: {}, sourceTrust: {}, updated: timestamp }
```

## API Keys
- Stored in localStorage only. RAG reads nothing new.
- Current key: `minos_ds_ak` (DeepSeek). Secure — never logged.

## Error Handling
- Never throw — return `{ error, fallback }`.
- Log with prefix `[MINOS:<module>]` via `console.warn`.
- Degrade gracefully: local → Supabase fetch → empty context "training only".

## Testing
- Each agent ships `test/<name>.html` (or a runnable test doc) in its artifact dir.
- Orchestrator (Agent 8) runs the full suite during CP1/CP2/CP3.

## Git Discipline
- Agents commit to feature branches: `minos/<agent-id>`.
- Orchestrator merges to `minos/v2-integration`.
- No direct pushes to `main`.

## Sync Checkpoints (at /MINOS/SUB_AGENT_ARCHITECTURE.md)
- CP1 (Foundation): after RAG, Search, Router — modules load, no console errors, search+RAG inject into context.
- CP2 (Intelligence): after Prompt, Learning, Quality.
- CP3 (Polish): after Refactor — both doors identical, lint clean, size ≤ current.