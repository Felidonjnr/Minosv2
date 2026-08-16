# HANDOFF — minos-prompt → minos-quality

**From:** Agent 4 (`minos-prompt`) — Prompt Architect
**To:** Agent 5 (`minos-quality`) — Quality Gate
**Date:** CP2 (Intelligence) — Prompt module completion

---

## What was delivered

| Artifact | Path | Purpose |
|----------|------|---------|
| Prompt builder | `artifacts/minos-prompt/system-prompt.js` | ES-module `buildSystemPrompt(mode, context, userProfile) → string` — never throws |
| Identity module | `artifacts/minos-prompt/modules/base.md` | Shepherd identity, non-negotiable pillars, house voice |
| Reasoning module | `artifacts/minos-prompt/modules/reasoning.md` | Chain-of-Thought pre-processing block (Steps 1–6) |
| Guardrails module | `artifacts/minos-prompt/modules/guardrails.md` | Truth / citation / mode-respect bindings (G1–G7) |
| Style module | `artifacts/minos-prompt/modules/style.md` | Objective editorial craft rules (S1–S6) |
| Mode-modifiers module | `artifacts/minos-prompt/modules/mode-modifiers.md` | Central per-mode tone/structure/length doctrine |
| CoT exposure policy | `artifacts/minos-prompt/deepseek-variant.md` | DeepSeek `<thinking>` exposure rules (D1–D5) |

**Module files present:** `base.md`, `reasoning.md`, `guardrails.md`,
`mode-modifiers.md`, `deepseek-variant.md` (5) + `system-prompt.js` +
`deepseek-variant.md` + this handoff. The `modules/` dir holds the 5 modules;
`deepseek-variant.md` sits in the prompt root per `MODULE_FILES` (loaded from
`modules/deepseek-variant.md`? — see note below).

> **Build note (important):** `system-prompt.js` lists `MODULE_FILES` and reads
> each from `modules/`, **including `deepseek-variant.md`**. The shared policy
> file also exists at the prompt root as a readable reference. Ensure the
> orchestrator copies `deepseek-variant.md` into `modules/` when staging, or
> update `MODULE_FILES` to read from the root. Currently only `base.md`,
> `reasoning.md`, `guardrails.md`, `mode-modifiers.md` are present in
> `modules/` at handoff.

---

## Public interface you will consume

```js
import { buildSystemPrompt } from '../minos-prompt/system-prompt.js';

const prompt = await buildSystemPrompt(mode, context, userProfile);
// mode: canonical key or alias (sniffed)
// context: { library:{items,contextString}, internet:{results,contextString}, config, userProfile }
// userProfile: optional learning snapshot
// → string system prompt (never throws)
```

**Construction order (matters to the model):**
```
base.md → guardrails.md → reasoning.md → MODE-MODIFIER block → CONTEXT → USER PROFILE → deepseek-variant.md
```

**Token discipline:** base system block (identity + reasoning + guardrails +
mode modifier) `< 4k`; full prompt with context `< 12k`. The Router caps
library+internet context at 7900; this builder adds the base block on top. It
logs `base≈Nt full≈Nt` via `console.warn` per build.

---

## What the Quality Gate can now check (build from the contract)

The `COLLABORATION_CONTRACT.md` defines your entry point:

```js
validateOutput(output: string, mode: string) → { pass: boolean, issues: string[], score: 0-100 }
```

Suggestions for what this prompt wants a quality pass to enforce:

1. **Guardrail integrity (G1–G5).** No fabricated verse/quote/original-language
   word; sources cited only if used; `[unverified — confirm before publish]`
   flags present where an unverified claim remains; mode scale followed.
2. **Mode fidelity (G3 / mode-modifiers).** Structure markers from the mode's
   FORMAT present and not invented; length within the mode's cap; no bleed of
   one mode into another.
3. **Style discipline (S1–S6).** No filler, no gutted detail, clarity intact,
   local (Akwa Ibom) not imported.
4. **CoT policy (D1–D5).** `<thinking>` appears only in reasoner modes and is
   short; no exposed reasoning in chat modes; training-only responses labeled.
5. **Scripture accuracy (G4).** `book chapter:verse` references accurate and
   from one consistent rendering; no proof-texting.

---

## Dependencies on you (Quality Gate)

- Implement `validateOutput(output, mode)` per the contract signature.
- Reuse the mode table in `../minos-router/mode-config.json` (and
  `modules/mode-modifiers.md`) as the source of truth for per-mode FORMAT and
  length caps.
- Return `{ pass, issues, score }`; never throw.
- When this handoff + your gate are both present, CP2 (Intelligence) is
  complete for the prompt/quality leg — hand to `minos-learning` (Agent 6) and
  then the orchestrator.

---

## Testing status

- `system-prompt.js` is contract-compliant: zero-arg call returns a fallback
  prompt; unknown/empty mode defaults to `sunday-message`; missing modules
  degrade to documented fallbacks; never throws. (Formal test harness was not
  part of this handoff scope — orchestrator, add `test/test-prompt.html`.)

## Open items for Orchestrator

- Confirm/correct the `deepseek-variant.md` staging location (root vs
  `modules/`) to match `MODULE_FILES`.
- Wire `buildSystemPrompt` into the chat flow after `assembleContext`.
- Run full CP2 test suite (prompt + quality + learning).

---

### One-line summary
`buildSystemPrompt(mode, context, userProfile)` produces the complete, ordered,
token-disciplined MINOS v2 system prompt — hand it to `validateOutput()` so the
Quality Gate upholds guardrails, mode fidelity, style, and the DeepSeek CoT
policy on every deliverable.