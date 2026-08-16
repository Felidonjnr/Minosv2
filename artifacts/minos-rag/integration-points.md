# minos-rag — Integration Points (where to call in the chat flow)

**Module:** `artifacts/minos-rag/rag-engine.js`
**Consumers:** `minos-router` (Agent 3) assembles library context into the unified
prompt context; `minos-orchestrator` (Agent 8) performs final wiring.

---

## 1. Primary integration: before every LLM call — `sendMessage()`

**File:** `minos.html` (Door 1) / `minos_1.html` (Door 2) — **do not edit here**;
this documents where Router/Orchestrator inserts the call.

Exact current code (minos.html, ~line 884):

```js
var model=pickModel(text);
var dsMessages=[{role:'system',content:buildSYS()}].concat(chatHistory.slice(-10));
fetch(DS_URL,{ method:'POST', headers:{...}, body:JSON.stringify({model:model,max_tokens:8000,messages:dsMessages}) })
```

### What to change (integrated v2 file only)

Inject library context **before** building `dsMessages`:

```js
// 1. Determine the MINOS mode for this query (Router owns the mapping).
var mode = detectMode(text); // e.g. 'deep-study' | 'sunday-message' | ...

// 2. Call the RAG engine (async; resolve before fetch).
var lib = await searchLibrary(text, mode, 5, {
  items: window.items,            // existing global library map {id: item}
  supabaseClient: window.supabase  // fallback source (the "Firebase" table)
});

// 3. Append the context so the system prompt sees the library block.
var sys = buildSYS() + lib.contextString;

var dsMessages = [{ role:'system', content: sys }].concat(chatHistory.slice(-10));
```

**Important:** `sendMessage()` is currently synchronous and uses `.then()`. The Router
integration should pre-fetch the context with `await rag.searchLibrary(...)` before
building `dsMessages` (make `sendMessage` `async`, or fetch context then enter the
fetch chain). No other typing/chatHistory logic changes.

- Library context is prepended to the **system** message (not the user message).
- If `contextString` is empty (no results / offline), `sys` degrades to `buildSYS()`
  alone → model falls back to training only. Matches the contract chain.

---

## 2. Dependency injection (globals already present in minos.html)

| Global | Type | Used for |
|--------|------|----------|
| `window.items` | `{id: library_item}` | Primary local-search corpus (populated on load/Supabase sync) |
| `window.supabase` | Supabase client | Fallback source (queries `library_items`) |
| `buildSYS()` | Function → string | System prompt the context is appended to |
| `pickModel(text)` | Function → model | Model selection — untouched |
| `chatHistory` | Array | Appended as-is; ordering unchanged |

The RAG module is **render-clean** — it never touches the DOM or the library UI.

---

## 3. Where the Router consumes the output

`searchLibrary` returns `{ items, contextString, meta }`. Router merges it into the
shared context object (collaboration contract):

```js
context.library = await searchLibrary(query, mode, topK, { items, supabaseClient });
```

Then Router passes the full context to `buildSystemPrompt(mode, context, userProfile)`
(Agent 4). `contextString` is already in the required format:

```
LIBRARY CONTEXT:
---
[1] "Title" (Category)
...content snippet...
[2] ...
---
```

---

## 4. Performance targets

| Path | Target | Implementation |
|------|--------|----------------|
| Local search (preferred) | **< 500 ms** | Lazy inverted index + TF-IDF scoring on `items`; measured ~5 ms |
| Supabase fallback | **< 2 s** | One `library_items` query when local index is empty |
| Emptiness | ~0 ms | Returns `{ items: [], contextString: '' }` immediately |

The module caches the index (WeakMap keyed by the items map), so repeated calls in a
session are near-instant; use `opts.refresh` or `invalidate()` to force a rebuild.

---

## 5. Zero-UI / zero-backend guarantee

- **No schema changes** — reads the existing `library_items` table (read-only).
- **No writes** — never calls `upsert`/`insert`/`delete`/`update`.
- **No UI changes** — no DOM elements, no CSS, no new buttons.
- **No backend** — everything stays client-side static HTML.

---

## 6. Loading the module at runtime (ES module)

`rag-engine.js` is an ES module. Orchestrator wires it in, e.g.:

```html
<script type="module">
  import rag from './artifacts/minos-rag/rag-engine.js';
  window.minosRag = rag;               // expose for Router / inline classic script
</script>
```

Because `minos.html` currently uses a classic (non-module) `buildSYS`/`sendMessage`,
keep the classic side intact and expose the module via `window.minosRag` so both
doors share it without converting every script to modules.