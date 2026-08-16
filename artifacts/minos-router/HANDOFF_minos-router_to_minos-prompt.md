# HANDOFF — minos-router → minos-prompt

**From:** Agent 3 (`minos-router`) — Mode Router
**To:** Agent 4 (`minos-prompt`) — Prompt Architect
**Date:** CP1 completion (Phase 1)

---

## What was delivered

| Artifact | Path | Purpose |
|----------|------|---------|
| Router engine | `artifacts/minos-router/mode-router.js` | ES-module assembles unified context from RAG + Search + mode config |
| Mode config | `artifacts/minos-router/mode-config.json` | Full per-mode config (8 modes: weights, search params, token budgets, tones, formats) |
| Test harness | `artifacts/minos-router/test/test.mjs` | 7 assertions — **all pass** |
| Test HTML | `artifacts/minos-router/test/test.html` | Browser smoke test |

---

## Public interface you will call

```js
import { assembleContext } from '../minos-router/mode-router.js';

const { fullContext, sources } = await assembleContext(query, mode, options);
```

**Signature**

```
assembleContext(query: string, mode?: string, options?: {
  systemBase?: string,
  loadDeps?: boolean
}) → Promise<{
  fullContext: string,        // System Base + Library + Internet + Mode Modifier
  sources: {
    systemBase: string,
    mode: string,             // canonical mode key
    config: object,           // mode-config.json entry for this mode
    used: string[],           // e.g. ['library','internet','trainingOnly']
    library: { items, contextString, budget },
    internet: { results, contextString, budget },
    modeModifier: string,
    tokenEstimate: number,
    tokenCap: number,
    error?: string
  }
}>
```

- `query` — raw user text.
- `mode` — one of 8 canonical keys (see `config.modes`). Aliases + query sniffing supported.
- `options.systemBase` — override the static identity prefix (default in code).
- `options.loadDeps` — default `true`; set `false` to skip dynamic import of RAG/Search.

**Return guarantees (contract-compliant)**
- Never throws. On any failure → `fullContext` = system base only, `sources.used = ['trainingOnly']`, `error` set.
- Token cap enforced (default 7900). Context auto-truncated with `…[truncated]` marker.
- Distinct context signature per mode (8/8 verified by tests).

---

## Context format you will receive (Router → Prompt)

This is exactly the shape defined in `COLLABORATION_CONTRACT.md`:

```js
{
  library:  { items: [], contextString: "LIBRARY CONTEXT:\n---\n[1] ...\n---" },
  internet: { results: [], contextString: "INTERNET RESOURCES FOUND:\n---\n[1] ...\n---" },
  mode: "deep-study",
  userProfile: { preferences: {}, weights: {} }   // populated later by minos-learning
}
```

The `fullContext` string is simply these pieces joined:
```
<systemBase>
<library.contextString>
<internet.contextString>
<modeModifier>
```
…with hard truncation to `< 8000 tokens`.

---

## Per-mode config you will read (from `sources.config`)

Every mode entry has these fields you'll need for prompt construction:

```json
{
  "label": "Deep Study",
  "id": "study",
  "model": "deepseek-reasoner",
  "weights": { "library": 0.35, "internet": 0.45, "training": 0.20 },
  "search": {
    "depth": "deep",
    "internetTopK": 8,
    "libraryTopK": 8,
    "queryPrefix": "scholarly commentary Greek Hebrew lexicon theological paper seminary resources",
    "bibleLookup": true,
    "strongs": true,
    "fetchFullPassages": true,
    "minSourceCredibility": "seminary, lexicon, academic"
  },
  "tokenBudget": { "library": 3000, "internet": 3000, "base": 900 },
  "tone": "scholarly, precise, academic but anointed",
  "format": "8-layer Deep Study structure...",
  "outputFormatHint": "NEVER cut short. Full detail on all 8 layers..."
}
```

**All 8 modes:** `deep-study`, `sunday-message`, `sermon-notes`, `whatsapp-devotional`, `facebook-posts`, `partner-devotional`, `prayer-guide`, `morning-brief`.

---

## How to consume in your Prompt Architect

```js
import { assembleContext } from '../minos-router/mode-router.js';
import { buildSystemPrompt } from '../minos-prompt/system-prompt.js'; // you will write this

async function handleQuery(query, mode, userProfile) {
  const { fullContext, sources } = await assembleContext(query, mode);
  const prompt = buildSystemPrompt(sources.mode, {
    library: sources.library,
    internet: sources.internet,
    mode: sources.mode,
    userProfile
  }, userProfile);
  return { prompt, sources };
}
```

### Fallback chain (mirror the contract)
1. **Library + Internet** — both `contextString` present → full context.
2. **Library only** — internet empty → `used = ['library']`.
3. **Internet only** — library empty → `used = ['internet']`.
4. **Training only** — both empty → `used = ['trainingOnly']`, prompt = base + modeModifier.

Your `buildSystemPrompt` should gracefully handle empty `library.contextString` and `internet.contextString`.

---

## Dependencies on you (Prompt Architect)

- Implement `buildSystemPrompt(mode, context, userProfile) → string` per `COLLABORATION_CONTRACT.md`.
- Use `sources.config.tone`, `format`, `outputFormatHint`, `weights` to shape the prompt.
- Respect `sources.config.model` for model routing (reasoner vs chat).
- The `sources.config.search` block is informational (already used by Router).

---

## Testing status
- `node artifacts/minos-router/test/test.mjs` → **7/7 pass**.
- Verifies: 8 modes registered, distinct signatures, token budget <8k, graceful fallback, unknown mode default, query sniffing.

## Open items for Prompt/Orchestrator
- Final DOM/script wiring of the Router + RAG + Search into the classic `sendMessage()` (see `integration-points.md` in RAG artifacts). Router itself needs no DOM access.
- Confirm `mode` keys used in UI quick-buttons match `ALIASES` in `mode-router.js`. If different, add aliases there.

---

### One-line summary
`await assembleContext(query, mode)` returns `{ fullContext, sources }` — the complete, token-capped, mode-distinct system prompt context ready for your Prompt Architect. Just wrap it with `buildSystemPrompt()` and send to the LLM.