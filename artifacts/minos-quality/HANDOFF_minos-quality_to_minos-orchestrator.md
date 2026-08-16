# HANDOFF — minos-quality → minos-orchestrator

**From:** Agent 5 (minos-quality) — Quality Engine
**To:** Agent 8 (minos-orchestrator) — Integration / Runtime gate
**Version:** MINOS v2
**Log prefix:** `[MINOS:q5]`

This doc tells the Orchestrator exactly how to consume the Quality Engine.
The behavioral source of truth lives in `guardrails.md`; the sampling parameter
table lives in `deepseek-tuning.md`; the code lives in `quality-checks.js`; the
acceptance fixture set lives in `test-suite.json`.

---

## 1. Public API (COLLABORATION_CONTRACT compliant)

```js
import validateOutput from './minos-quality/quality-checks.js';
// or: import { validateOutput } from './minos-quality/quality-checks.js';

const result = validateOutput(output, mode, context);
```

### Signature
```js
validateOutput(output, mode, context) → { pass, issues: [], score }
```

### Params
| Param | Type | Notes |
|---|---|---|
| `output` | `string` | The raw generated deliverable (may be empty) |
| `mode` | `string` | One of the 8 mode keys: `deep-study`, `sunday-message`, `sermon-notes`, `whatsapp-devotional`, `facebook-posts`, `partner-devotional`, `prayer-guide`, `morning-brief` (defaults to `chat` family behavior if unknown) |
| `context` | `object` | Router context shape (see §4). May be `undefined`/absent → treated as "no sources" (training-only) |

### Return shape
```json
{
  "pass": true,
  "issues": [
    "[soft] Mode \"deep-study\" missing required structure markers (5/6+ found)",
    "[blocking] Impossible verse reference: Genesis 99:1 (chapter out of range — max 50)"
  ],
  "score": 72
}
```

- **`pass`** = `true` only when there are **zero blocking issues** AND `score >= 80`.
- **`issues`** — each string prefixed `[blocking]` or `[soft]`. Blocking ⇒ unsafe; soft ⇒ deductions.
- **`score`** — integer 0–100. Starts at 100; soft deductions 5–15 each (capped at 15/issue); blocking issues don't subtract (they auto-fail).
- **Never throws.** Even internal errors return `{ pass:false, issues:['[internal] …'], score:0 }`.

### Exports
- **default export:** `function minosQuality(output, mode, context)` alias.
- **named exports:** `validateOutput`, plus constants `PASS_THRESHOLD` (=80), `PERFECT` (=100), `MAX_SOFT_WEIGHT` (=15).

---

## 2. How the Orchestrator calls it (bounded retries)

The Orchestrator runs the gate **after every generation** and, on `pass === false`,
re-prompts with a tightened directive — with a **bounded retry budget** so the flow
can never loop forever.

```
N = 1                       // retry budget (max total attempts)
while (attempt <= N):
    params = tuningFor(mode)                    // from deepseek-tuning.md §table
    output = await generate(mode, context, params)
    result = validateOutput(output, mode, context)
    log(`[MINOS:q5] attempt=${attempt} pass=${result.pass} score=${result.score} issues=${result.issues.length}`)

    if (result.pass):
        return output                       // ship it
    else:
        directive = tightenDirective(result.issues, attempt)   // echo blocking issues back
        if (attempt < N):
            re-prompt with directive
        else:
            degrade to fallback             // see §5
```

### Recommended tuning lookup (from deepseek-tuning.md)
```
deep-study:        { temp:0.30, top_p:0.90, max_reasoning_tokens:1500, max_tokens:6000 }
sunday-message:    { temp:0.55, top_p:0.92, max_reasoning_tokens:1600, max_tokens:5000 }
sermon-notes:      { temp:0.45, top_p:0.90, max_tokens:2500 }
whatsapp-devotional:{ temp:0.85, top_p:0.95, max_tokens:2000 }
facebook-posts:    { temp:0.90, top_p:0.95, max_tokens:1500 }
partner-devotional:{ temp:0.45, top_p:0.90, max_reasoning_tokens:1400, max_tokens:3500 }
prayer-guide:      { temp:0.60, top_p:0.92, max_tokens:2500 }
morning-brief:     { temp:0.40, top_p:0.88, max_tokens:1200 }
```
- **Reasoner modes** (`deep-study`, `sunday-message`, `partner-devotional`) take
  `max_reasoning_tokens`. **Chat modes** take **none** — do not send a reasoning
  budget to chat models (QG5 enforces zero `<thinking>` there).
- Overrides (creativity/accuracy/source-empty) are advisory per `deepseek-tuning.md`;
  the gate thresholds are never loosened for them.

---

## 3. Guardrail coverage (what the gate enforces)

| GR | What it checks | Behavior on violation |
|---|---|---|
| **QG1** Hallucination | Fake verse, fake original-language token w/o inline translation, dangling/absent citations, unverified stats, missing `training-only` label when sources empty | Fabricated verse/cite/missing label = **blocking**; lexicon/unverified stat = **soft** |
| **QG2** Citation honesty | `(from library:"…")` / `(per: …)` cross-checked against `context.library.items` + `context.internet.results`; training-only must cite nothing | True fabricated source = **blocking**; cite-to-pad an existing title = **soft** |
| **QG3** Format/mode | Required structure markers per mode from `mode-config.json`; length caps; cross-mode bleed (e.g. POWER POINTS in a WhatsApp devotional) | Missing markers / over cap / bleed = **soft** |
| **QG4** Scripture accuracy | 66-book chapter registry; every `Book N:N` / range checked | Impossible chapter/verse/book = **blocking** |
| **QG5** CoT policy | `reasoner`: ≤1 short `<thinking>`; `chat`: **zero** `<thinking>` | `<thinking>` in chat = **blocking**; many/long reasoner blocks = **soft** |
| **QG6** Local & ethical | Akwa Ibom local-stat fabrication, begging/solicitation tone | **Soft / advisory** (never blocking) |

Mode families:
- **reasoner:** `deep-study`, `sunday-message`, `partner-devotional`
- **chat:** `sermon-notes`, `whatsapp-devotional`, `facebook-posts`, `prayer-guide`, `morning-brief`

---

## 4. Integration with the Router context shape

`validateOutput` consumes the same context the Router assembles for the Prompt
builder (from `COLLABORATION_CONTRACT.md`):

```js
context = {
  library:  { items: [ { id, title, cat, content, date } ], contextString: "" },
  internet: { results: [ { title, url } ], contextString: "" },
  mode: "deep-study" | "…",
  config: { /* optional */ },
  userProfile: { preferences: {}, weights: {} }
}
```

- Only `context.library.items[].title`, `context.internet.results[].title/url` are
  used for citation cross-checking; `contextString` is ignored by the gate.
- **Absent / empty** `library.items` **and** `internet.results` ⇒ the gate treats it as
  "no sources" and **requires** the `training-only` label in the output, and rejects
  any citation.
- **Missing context entirely (`undefined`)** ⇒ treated as no-sources (training-only rules).
- This mirrors the Router's `fallbackChain: ["library","internet","trainingOnly"]`.

**Router integration example:**
```js
const result = validateOutput(output, routerContext.mode, {
  library: routerContext.library,
  internet: routerContext.internet,
  mode: routerContext.mode,
  userProfile: routerContext.userProfile
});
```

---

## 5. Error handling & graceful degradation

- `validateOutput` **never throws**. Wrap in try/catch anyway if you want a custom
  fallback, but the gate already safe-fails to `pass:false, score:0`.
- On final retry exhaustion, the Orchestrator should:
  1. Log the blocking issues with `[MINOS:q5]`.
  2. If sources were empty (training-only), emit the response with the `training-only`
     label applied rather than dropping it.
  3. Otherwise return `{ error: 'quality_gate_rejected', issues }` to the caller so
     the UI can surface "generation needs refinement" instead of shipping a
     hallucinating/unsafe deliverable.

---

## 6. Testing

`test-suite.json` ships 55 cases (50+ required):
`{ id, query, mode, context, output, expectedPatterns, shouldPass }`.

Coverage:
- **All 8 modes** × format markers + length caps.
- **Hallucination (QG1):** fake verse (`Genesis 99:1`, `Psalm 150:999`), fake book,
  missing `training-only` label, unverified stats.
- **CoT policy (QG5):** `<thinking>` in chat = fail; short single `<thinking>` in
  reasoner = pass; long/multi block in reasoner = fail.
- **Citation honesty (QG2):** cite absent library item = fail; cite present item = pass;
  cite with empty sources = fail.
- **Scripture accuracy (QG4):** out-of-range chapter/verse, malformed range = fail;
  valid ranges + abbreviations pass.
- **Edge:** empty output, empty context (training-only required), unknown mode.

Run during CP2 (Intelligence) and re-run in CP3. The Orchestrator can execute the
suite by importing `validateOutput` and asserting each case's `pass` equals
`shouldPass` (allowing the documented "advisory soft" cases to be scored rather than
hard-asserted — see per-case `note` fields).

---

## 7. Files delivered (Agent 5 artifact dir)

```
artifacts/minos-quality/
├── guardrails.md          (source of truth, QG1–QG6 + score formula)
├── deepseek-tuning.md     (per-mode sampling params)
├── quality-checks.js      (the gate — ESM, default+named export, never throws)
├── test-suite.json        (55 acceptance cases)
└── test/                  (runnable scratch area for Orchestrator harness)
```

Log prefix for anything the Orchestrator surfaces from this module: **`[MINOS:q5]`**.
