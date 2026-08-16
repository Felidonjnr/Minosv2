# HANDOFF — minos-refactor → minos-orchestrator

**Agent:** 7 · **Phase:** 3 (Integration & Zero Regression)
**Date:** 2026-08-16
**Workspace:** `/root/.openclaw/workspace/MINOS/artifacts/minos-refactor/`

---

## 1. What was delivered (6 files)

| file | purpose |
|---|---|
| `wiring-plan.md` | Step-by-step integration map: every v1 function → v2 module, with the shims/adapters required and a feature-by-feature regression matrix. |
| `adapter.js` | **Thin browser shim** (`window.MINOSV2`) that v1 `sendMessage()` calls. Internally runs `assembleContext → buildSystemPrompt → validateOutput` (bounded retries) and returns the final system prompt + model for the LLM call. |
| `door-sync.js` | Ensures **both doors** (minos.html / minos_1.html) load the **same shared module graph** (single source of truth; HTTP cache dedupes). Provides a `window.MINOS_DOOR_SYNC` handle. |
| `refactored-sendMessage.js` | **Drop-in replacement** for the v1 `sendMessage()` in the inline scripts. Produces the **identical DeepSeek request shape** as v1 → zero regression on the API/UI contract. |
| `regression-test.html` | Browser harness that exercises both doors with the same queries, asserts identical pipeline outputs + all v1 features still work. |
| `HANDOFF_minos-refactor_to_minos-orchestrator.md` | This document. |

---

## 2. Integration points (how it plugs into the immutable HTML)

### The design constraint that drove everything
`minos.html` / `minos_1.html` are **static, ES5-style single-page files with NO module loader**. They cannot run `import`/`export` inline. Every v2 module was written as ESM (`export default { ... }`). So we **port their pure logic** into a single dependency-free IIFE (`adapter.js`) that mounts on `window`. This is a *mirror build*: the v2 artifacts remain the source of truth; the adapter is the browser-safe equivalent.

### The ONLY HTML edit required (non-visual, one line per door)
```html
<script src="door-sync.js" defer></script>
```
Add this just before the door's closing `</body>` (or in `<head>` with `defer`). `door-sync.js` then loads `adapter.js` → `refactored-sendMessage.js` in deterministic order. **No other HTML/jS edit.** UI untouched.

### Why zero code-edit works
- The v1 click/keydown handlers call the **global variable** `sendMessage` by name (not a captured closure) — confirmed at `minos.html` lines 918–920 and 824–827, 1390–1452.
- `refactored-sendMessage.js` simply reassigns `window.sendMessage`. All UI paths instantly route through the adapter.
- The refactored function keeps the **exact** `fetch(DS_URL, {model, max_tokens:8000, messages})` shape + cost accounting, so the existing response/cost/typing/UI code path runs unmodified.

---

## 3. Shim API (the contract the orchestrator / next agents consume)

```
window.MINOSV2.prepareChat(query, modeHint?) → Promise<assembly>
  assembly = {
    systemPrompt,      // final system prompt string (v2 pipeline result)
    mode,              // canonical mode key (deep-study, sunday-message, …)
    model,             // 'deepseek-chat' | 'deepseek-reasoner'
    context,           // { library:{items,contextString}, internet:{results,contextString},
                       //   used:[], config, tokenEstimate, tokenCap, systemBase, modeModifier }
    used,              // ['library','internet','trainingOnly',...]
    fallback,          // true if degraded to training-only / v1 buildSYS
    assemblyMs,        // timing
    attempt            // bounded-retry attempt index
  }

window.MINOSV2.validate(output, mode, context) → { pass, issues:[], score }
window.MINOSV2.retryPrompt(query, mode, attempt) → Promise<assembly>
window.MINOSV2.resolveMode(query)                 → canonical mode
window.MINOSV2.diag()                             → { modes, promptModules, version }
```

**Bounded retries:** `prepareChat` retries the internal assembly up to `MAX_RETRIES = 2`; on total failure it falls back to the v1 `buildSYS()` output (identical fallback → zero regression). Quality is wired as `validate()` (available now; the orchestrator may choose to gate/regenerate on `pass===false` in a later phase).

---

## 4. What the adapter inlines (v2 modules it mirrors)

| v2 source artifact | adapter embedding |
|---|---|
| `minos-rag/rag-engine.js` | `ragSearch()` — client-side token scoring over the live `window.MINOS_ITEMS` (the app's `items` global). Mode-aware category boosts, IDF, title boost. |
| `minos-router/mode-router.js` + `mode-config.json` | `resolveMode()` + `assembleContext()` + full 8-mode `MODE_CONFIG` (weights, token budgets, tone/format). |
| `minos-search/search-engine.js` | `internetSearch()` — deterministic offline stub (preserves v1 budget & determinism). Live Brave/Google is OFF unless an operator provisions `minos_brave_key`/`minos_google_key`+`minos_google_cx` and flips the opt-in flag (documented in code). |
| `minos-prompt/system-prompt.js` + `modules/*.md` | `buildSystemPrompt()` with the five `.md` modules **embedded as strings** (the node `fs` reader was the only browser blocker). Byte-faithful prompt parity. |
| `minos-quality/quality-checks.js` | Full port: `validateOutput()` — QG1–QG6, 66-book chapter registry, `<thinking>` CoT policy, citation cross-check, format/length caps. |
| `minos-learning/learning-engine.js` | `readProfile()` — read-only snapshot from `localStorage['minos_learning_profile']`, injected as a USER PROFILE block. |

---

## 5. Door parity (dual-door guarantee)

`minos.html` (Door 1) and `minos_1.html` (Door 2) were verified **bit-identical** (`diff` clean). Both doors load the **same** `door-sync.js` → `adapter.js` → `refactored-sendMessage.js` from the same URLs. The browser serves **one copy** of each file (HTTP cache), so both doors get the identical module graph **by construction**. `parityCheck()` in the regression harness confirms deterministic equality (same query → same mode, model, used-sources, and near-identical prompt length across independent door runs).

---

## 6. Size budget (verified)

| item | bytes |
|---|---|
| `adapter.js` (RAG+Router+Prompt+Quality+Learning) | 54,953 |
| `door-sync.js` | 3,803 |
| `refactored-sendMessage.js` | 7,250 |
| **shared shipped payload (one graph) = 66,006** | **65.5 KB** |
| single v1 door (`minos.html`) | 84,449 |
| marginal cost per extra door | ~0 (cache/shared) |

**Shipped payload < one v1 door → budget satisfied with margin.** Both doors reuse the single shared graph.

---

## 7. Test results (node smoke + harness logic)

Verified in a Node browser-simulation (fixture library + stub fetch):

1. **Adapter loads**, exposes `MINOSV2 v2.0.0` with all 8 modes and 5 embedded prompt modules.
2. **RAG relevance:** query "Sunday message on the fear of the Lord" → top hit *The Fear of the Lord - Sunday Sermon*; "deep study on Romans 8 Greek word studies" → *Romans 8 Word Study Notes*. ✓
3. **Parity:** two independent door runs of the same query → identical `mode`, `model`, used-sources, prompt length delta = 0. ✓
4. **Mode/model routing (5/5):**
   - deep-study → `deepseek-reasoner` ✓
   - sunday-message → `deepseek-reasoner` ✓
   - whatsapp-devotional → `deepseek-chat` ✓
   - facebook-posts → `deepseek-chat` ✓
   - prayer-guide → `deepseek-chat` ✓
5. **Quality gate:** `validate()` returns `{pass, score, issues}`; correctly flags a missing training-only label + missing critical markers. ✓
6. **sendMessage end-to-end:** refactored `sendMessage()` → adapter pipeline → `fetch(DS_URL, {model:deepseek-reasoner, max_tokens:8000, messages:[system…]})` → user+assistant messages rendered via v1 `addMsg`. The request shape **matches v1 exactly**. ✓
7. **Zero regression guards:** if `adapter.js` fails to load, `door-sync` leaves the native v1 `sendMessage` active; `refactored-sendMessage.js` also falls back to `_v1send` / `buildSYS()`. ✓

`regression-test.html` is a documented in-browser harness (run on the deployed site) that re-runs all of the above against both doors and reports pass/fail in a table.

---

## 8. TODOs for orchestrator / downstream

- **Deploy wiring:** add the single `<script src="door-sync.js">` line to both `minos.html` and `minos_1.html` on the live site, and copy `adapter.js`, `door-sync.js`, `refactored-sendMessage.js` to the same directory. Verify `regression-test.html` green in a real browser.
- **Optional later phase:** enable live internet search by provisioning `minos_brave_key` (or `minos_google_key`+`minos_google_cx`) in localStorage and flipping the opt-in flag in `internetSearch()`. This is deliberately OFF to guarantee zero-regression/budget parity with v1. When enabled, `verifyCitations` already cross-checks internet citations.
- **Optional later phase:** wire the quality gate as a *regenerate-on-fail* loop using `retryPrompt()` (bounded retries already in place). Currently quality is advisory + surfaced in `assembly.context`; it does not block the first response, so no v1 UX regression.
- **Learning module:** `readProfile()` is wired to ingest any profile future phases write to `localStorage['minos_learning_profile']` (schema documented by Agent 6). No schema change required.
- **No Firebase/Supabase schema change** was made or required. All storage reads go through the existing v1 `items`/`supabase` globals.
