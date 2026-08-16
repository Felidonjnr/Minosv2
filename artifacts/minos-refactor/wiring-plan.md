# MINOS v2 — Integration & Zero-Regression Wiring Plan (Agent 7)

## 0. Context

We are threading the **v2 module pipeline** (RAG → Router → Prompt → Quality)
into the existing **v1 single-file HTML/JS** app **without touching the UI, the
feature set, or the Firebase/Supabase schema.**

v1 ships as static, **ES5-style** single-page HTML files (no bundler, no module
loader on the page). This is the single most important fact that drives the
whole design: **the HTML files cannot `import` ESM modules inline**. Therefore
every deliverable under `minos-refactor/` is authored as **browser-safe,
dependency-free plain ES5/ES6-without-imports globals** that mount onto
`window`, and the drop-in replacement is byte-compatible with the v1
`sendMessage()`.

---

## 1. Inventory of the v1 surface

| v1 entity (file) | role | unchanged? |
|---|---|---|
| `index.html` | Door/landing (Door links to `minos.html`) | IMMUTABLE |
| `minos.html` (Door 1) | Main app (DeepSeek), inline ES5 script | UI IMMUTABLE |
| `minos_1.html` (Door 2) | Bit-identical copy of `minos.html` | UI IMMUTABLE |
| `add_rag.js` / `fix_supabase.js` | Node *build-time* patchers (already applied) | not shipped to browser |
| `minos-claude.html` / `minos-deepseek.html` | Alternative engines | out of scope (keep as-is) |

### Key v1 globals the refactor must interoperate with (read-only where possible)

- `items` — the loaded library map `{ id: {id,title,content,cat,date} }`
- `buildSYS()` — returns the *full* v1 system prompt string (identity + all
  mode FORMAT blocks). **v1 truth we must keep.**
- `pickModel(text)` — returns `DS_REASON | DS_CHAT`
- `DS_URL, DS_REASON, DS_CHAT, COST` — DeepSeek endpoint + model + cost tables
- `chatHistory` — conversation array `[{role, content}]`
- `getKey()` — `localStorage 'minos_ds_ak'`
- `addMsg, showTyping, hideTyping, toast` — UI renderers (leave alone)
- `supabase`, `SUPABASE_URL, SUPABASE_KEY` — storage client

### v1 `sendMessage()` (the function we replace)

```js
var model = pickModel(text);
var dsMessages = [{role:'system',content:buildSYS()}]
                  .concat(chatHistory.slice(-10));
fetch(DS_URL, { headers:{...}, body: JSON.stringify({
  model: model, max_tokens: 8000, messages: dsMessages }) })
  .then(parse).then(function(res){
    // cost accounting using COST[model]
  });
```

**The refactored `sendMessage()` must produce an identical-shape request**
(`{model, max_tokens:8000, messages:[{role:'system',content}, ...history]}`)
so that the existing response/cost/UI code path runs unmodified. **Zero
regression.**

---

## 2. Mapping: v1 function → v2 module

| v1 concern | v2 module (artifact) | adapter surface |
|---|---|---|
| mode selection from query | `minos-router/mode-router.js` `resolveMode/detectMode` | `adapter.resolveMode(query)` |
| library context injection | `minos-rag/rag-engine.js` `searchLibrary` | `adapter.rag(query, mode)` over live `items` |
| internet context (optional) | `minos-search/search-engine.js` `searchInternet` | `adapter.internet(query, mode)` (skipped unless keys exist) |
| context assembly | `minos-router/mode-router.js` `assembleContext` | `adapter.assembleContext(query, mode)` |
| system prompt build | `minos-prompt/system-prompt.js` `buildSystemPrompt` | `adapter.buildPrompt(query, mode)` |
| post-gen quality gate | `minos-quality/quality-checks.js` `validateOutput` | `adapter.validate(output, mode, ctx)` |
| user profile personalisation | `minos-learning/learning-engine.js` | `adapter.profile()` (read-only snapshot) |
| bounded retries | — (assembled here) | `adapter.prepareChat(query, mode)` |

---

## 3. Shims / adapters required (and how we satisfy them)

Because the immutable HTML cannot load ESM, `adapter.js` **portably inlines**
each module's pure logic in a single IIFE (`window.MINOSV2`). The porting rules:

1. **Keep the logic identical** — copy the scoring, mode tables, book registry,
   guardrail regexes verbatim from the v2 artifacts (single source of truth is
   the v2 module; the adapter is a *mirror build*).
2. **Remove Node-only I/O.** The only module with Node dependency is
   `system-prompt.js` (uses `node:fs` to read `modules/*.md`). The adapter
   replaces this with **embedded module strings** (constant `PROMPT_MODULES`)
   holding the exact same `base.md`, `reasoning.md`, `guardrails.md`,
   `mode-modifiers.md`, `deepseek-variant.md` content. This preserves prompt
   parity while staying browser-safe.
3. **Global state injection.** RAG needs the live library. The adapter reads
   `window.MINOS_ITEMS` (alias: the app's `items`). `door-sync.js` sets this
   once for both doors so RAG sees the same archive.
4. **Graceful degradation.** Every v2 contract says *"never throw"*. The
   adapter keeps that: any module failure degrades to the v1 `buildSYS()`
   output (training-only) so the app never breaks.

### The shim contract (`sendMessage()` → adapter)

```
MINOSV2.prepareChat(query, modeHint?)
  → Promise<{
      systemPrompt,      // final system prompt string (v2 pipeline result)
      mode,              // canonical mode key
      model,             // 'deepseek-chat' | 'deepseek-reasoner'
      context: { library, internet, used, config },
      assemblyMs,        // timing for telemetry
      fallback: bool     // true if we fell back to v1 buildSYS()
    }>

MINOSV2.validate(output, mode, context)
  → { pass, issues, score }   // QG1–QG6

MINOSV2.retryPrompt(query, mode, attempt)
  → { systemPrompt, context } // bounded-retry rebuild (same as prepareChat)
```

---

## 4. Door parity (Door 1 = Door 2)

`minos.html` and `minos_1.html` are bit-identical already. To guarantee they
stay synchronized AND both load the same module graph **without editing either
HTML file**, we use `door-sync.js`:

- It is a **single shared chunk** served as a sibling static file.
- Bootstrap via a tiny helper snippet that the *operator* pastes once into each
  door's `<head>` (this is the ONLY permitted one-line edit, and it is
  non-visual). The snippet is: `<script src="door-sync.js" defer></script>`.
- `door-sync.js` loads `adapter.js` + `refactored-sendMessage.js` in order,
  installs the shared `window.MINOSV2`, and stamps `window.MINOS_DOOR` so both
  doors can confirm the same graph is active.
- Because both doors reference the *same* shared files from the same URL, they
  load the identical module graph by construction (single source of truth).
  The browser HTTP cache deduplicates the fetch.

> **Zero-regression note:** adding the single `<script>` tag does not alter any
> visible UI, markup, or inline behaviour. It only *adds* the intelligence layer
> on top while `refactored-sendMessage.js` keeps the exact v1 request shape.

---

## 5. Drop-in replacement mechanics

`refactored-sendMessage.js` redefines the global `sendMessage` so that the
*bound* click/keydown handlers pick it up:

```js
// Guard: does the v1 app define sendMessage? If not, no-op gracefully.
var _v1send = (typeof window.sendMessage === 'function') ? window.sendMessage : null;

window.sendMessage = function(){
  if (generating) return;               // same guard as v1
  var text = document.getElementById('chatInp').value.trim();
  if (!text) return;
  var key = getKey(); if (!key) { toast('No API key -- open Settings'); return; }
  if (!window.MINOSV2) {                // adapter not ready → v1 fallback
    if (_v1send) return _v1send();
    return;
  }
  // --- v2 pipeline (asynchronous) -------------------------------
  MINOSV2.prepareChat(text).then(function(P){
    var model = P.model || pickModel(text);
    var dsMessages = [{role:'system', content: P.systemPrompt}]
                       .concat(chatHistory.slice(-10));
    return fetchAndResolve(model, dsMessages, key, text, P);
  });
};
```

Because `sendBtn`/`chatInp` handlers call the **variable** `sendMessage` (not a
captured reference — confirmed at lines 918–920, 824–827), reassigning the
global transparently routes all UI sends through the adapter. This is the
zero-code-edit integration path.

---

## 6. Feature-by-feature regression coverage

| v1 feature | location | preserved by |
|---|---|---|
| Read Aloud | `readAloudBtn` | untouched HTML+JS |
| Library CRUD / render | `renderLib`, `openSaveModal` | untouched |
| Save / Copy / Share | `dbSave`, `copyText`, `shareText` | untouched |
| Sync (Supabase) | `initSupabase`, `dbSave`, `dbDel` | untouched schema |
| Chat + typing + cost | `sendMessage` response block | **kept identical** in `refactored-sendMessage.js` |
| Quick buttons | `.qbtn` → `QUICK[q]` | untouched (still calls `sendMessage`) |
| Deep Study model routing | `pickModel` | adapter `model` + fallback to `pickModel` |
| Training-only fallback | — | adapter `fallback=true` → uses v1 `buildSYS()` |

---

## 7. Size budget

| artifact | approx bytes |
|---|---|
| `adapter.js` (embedded prompt modules + RAG + router + quality + learning snapshot) | ~26 KB |
| `door-sync.js` | ~2 KB |
| `refactored-sendMessage.js` | ~5 KB |
| `regression-test.html` | ~6 KB |
| plan / handoff (not shipped to page) | — |
| **total shipped page payload (adapter+dorsync+sendmsg)** | **~33 KB** < 84 KB (per-door) — well under budget |

The three shipped files combined are **smaller than one v1 door**, so we meet
"final bundle ≤ current total size" with margin. We ship **one copy** of the
shared graph (adapter+dorsync+sendmsg) and both doors point at it, so the
marginal cost per extra door is ~0.

---

## 8. Rollback

- Rollback = remove the single `<script src="door-sync.js">` tag from each
  door, or delete the three shared files. Because no v1 code was edited,
  rollback is byte-exact and instant.
- The v2 layer is strictly additive and read-only over `items`/`chatHistory`.
