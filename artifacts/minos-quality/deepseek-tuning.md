# MINOS DeepSeek Tuning — Per-Mode Parameters

Part of the Quality Engine (`minos-quality`, Agent 5). These are the recommended
DeepSeek sampling parameters and reasoning-token budgets for each of MINOS v2's
eight modes. They keep the two DeepSeek model families honest: **reasoner**
(the `deepseek-reasoner` modes) and **chat** (the `deepseek-chat` modes).

Consumed by the Orchestrator / chat flow to set `temperature`, `top_p`,
`max_tokens` (full-output budget) and `max_reasoning_tokens` before each call.

---

## Parameter philosophy

- **Temperature** controls creative breadth. Ministry modes that need voice and
  story (WhatsApp, Facebook) tolerate higher temperature; modes that must be
  doctrinally precise (Deep Study, Partner) run cooler.
- **top_p** (nucleus) teams with temperature. Keep it moderately tight (0.85–0.9)
  to avoid drifting into invented specifics.
- **max_reasoning_tokens** only applies to `deepseek-reasoner`. It budgets the
  CoT pre-processing. It stays **small** because the CoT is internal scaffolding —
  the reasoning block (Steps 1–6) is a tight checklist, not an essay, and the
  exposed `<thinking>` summary must be a few lines (D2 / QG5).
- **max_tokens** is the deliverable budget. It must be large enough to honor
  length-caps (full 8-layer study, full preaching guide) but the router's hard
  context cap (7900) already bounds total context; generation budget is separate.

---

## Central parameter table

| Mode | Model | temperature | top_p | max_reasoning_tokens | max_tokens (deliverable) | Notes |
|---|---|---|---|---|---|---|
| `deep-study` | reasoner | **0.30** | 0.90 | **1500** | 6000 | coldest — precision on original-language + scholarly claims |
| `sunday-message` | reasoner | **0.55** | 0.92 | **1600** | 5000 | preaching rhythm with doctrinal safety |
| `sermon-notes` | chat | **0.45** | 0.90 | — | 2500 | compressed faithful mirror, low variance |
| `whatsapp-devotional` | chat | **0.85** | 0.95 | — | 2000 | warm compelling voice; 7 days < 200 words each |
| `facebook-posts` | chat | **0.90** | 0.95 | — | 1500 | hook-driven, stop-the-scroll; ≤150 words/post |
| `partner-devotional` | reasoner | **0.45** | 0.90 | **1400** | 3500 | weighty, honoring, precise on covenant language |
| `prayer-guide` | chat | **0.60** | 0.92 | — | 2500 | declarative, structured |
| `morning-brief` | chat | **0.40** | 0.88 | — | 1200 | concise, scannable, low temperature for accuracy |

> `max_reasoning_tokens = —` for chat modes: DeepSeek-chat performs no exposed
> CoT; do not send a reasoning budget to chat models, and do not expect a
> `<thinking>` block (QG5 enforces that none appears).

---

## Rationale per mode

### Reasoner modes

- **deep-study (0.30, 1500 reasoning):** Highest accuracy demand — Greek/Hebrew
  transliterations, seminary-grade claims, 8 required layers. Cold temperature
  reduces invented lexicon/statistics (QG1). Generous reasoning budget lets the
  model verify every fact (reasoning Step 4) before composing.
- **sunday-message (0.55, 1600):** Needs preaching warmth and rhythm (S3, S4)
  while staying doctrinally safe. Medium-low temperature; the largest reasoning
  budget because it quotes many full backup scriptures (G4) and names two
  altar-call groups.
- **partner-devotional (0.45, 1400):** Weighty, prophetic, honoring — but must
  never beg or fabricate covenant/ stewardship claims (G7). Cool, disciplined.

### Chat modes

- **sermon-notes (0.45):** A faithful compressed mirror of the Sunday message.
  Low variance keeps it locked to the preached structure (G3).
- **whatsapp-devotional (0.85):** Intimate, warm, impossible to ignore — needs
  creative voice for hooks/stories, hence higher temperature. Still capped at
  <200 words/day; retrieval is grounded, so heat is safe.
- **facebook-posts (0.90):** The most creative/voice-driven register. Bold hooks
  legal (S4 note: hook must be *true*). Highest temperature — but QG1 still
  rejects fabricated stats.
- **prayer-guide (0.60):** Structured declarative agenda; moderate voice, kept
  worsh  ip-first with reliable scripture support.
- **morning-brief (0.40):** Shepherd-facing, must be practical and date-accurate.
  Coldest chat mode to keep facts/calendar right (QG1/QG4).

---

## Reasoning token rules (reasoner family)

- Budget the **checklist**, not the essay. Steps 1–6 fit in ~600–900 tokens of
  internal reasoning; the remainder of the budget covers verification of quoted
  verses (Step 4) and mode-skeleton drafting (Step 3).
- The exposed `<thinking>` summary (per D2) must consume **almost none** of the
  reasoning budget: a few lines. If a `<thinking>` block re-dumps the full chain
  or runs long, the gate flags it (QG5).
- Never route a chat mode to a reasoner model or vice-versa; model-follows-mode
  is part of G3/mode-modifiers doctrine.

---

## Guardrail integration

These parameters **support** the gate but do not replace it. Tuned sampling lowers
the *probability* of a hallucination; `validateOutput()` still **detects** one and
rejects it. The Orchestrator:

1. Selects temperature/top_p/max_tokens/max_reasoning_tokens from this table.
2. Calls `validateOutput(output, mode, context)`.
3. On failure, re-prompts with a tightened directive (bounded retries).
4. Logs tuning + gate result with the `[MINOS:q5]` prefix.

---

## When to override

- **User emphasises creativity** over precision (sandbox / draft request): raise
  temperature by +0.1–0.15 on the current mode's value, never above `0.95`.
- **User emphasises accuracy** ("make sure every verse is right"): drop
  temperature by −0.1 and raise the reasoner budget +200.
- **Source-empty (training-only)**: keep the mode's temperature but *label the
  response training-only* and keep claims conservative — do not add heat that
  invites fabrication when ungrounded (QG1/QG5).
- These overrides are advisory; the gate thresholds are not loosened for them.