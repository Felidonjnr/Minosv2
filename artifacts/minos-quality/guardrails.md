# MINOS Quality Guardrails

Part of the Quality Engine (`minos-quality`, Agent 5). These guardrails define
what **passes** for a ministry-ready deliverable in MINOS v2. They are enforced
programmatically by `quality-checks.js` and documented here as the source of
truth for what that engine checks.

The guardrails are a *superset* of the prompt-side guardrails in
`minos-prompt/modules/guardrails.md` (G1–G7). The prompt binds the **model**;
this document binds the **gate**. The model is told what to avoid; the gate
verifies the model actually avoided it.

---

## QG1 — No hallucination (detection)

The gate detects, not just forbids, fabrication. Any of the following constitutes
a hallucination that fails the output:

1. **Fabricated verse references.** A `book chapter:verse` reference whose
   reference pattern is malformed, whose book is not a real Bible book, or whose
   chapter:verse falls outside the book's plausible range. (See QG4 for the
   verification registry.)
2. **Fabricated original-language words.** A Greek/Hebrew word presented as
   transliteration+translation that the gate cannot map to a known lexicon token,
   or that appears without an inline translation.
3. **Fabricated citations.** A `(from library: "...")` or `(per: ...)` block that
   references a source not supplied in context. The gate cross-checks quoted
   source titles against `context.library.items` and `context.internet.results`.
4. **Fabricated numbers/statistics.** Unexplained figures presented as fact
   (percentages, years, attendance, amounts) with no `[unverified]` flag.
5. **Claimed external source with none loaded.** If `context` reports empty
   library AND internet, the output must be labeled `training-only`. Presenting
   it as sourced is a fabrication.

**Detection signals the gate scans for:**
- Regex for verse refs → validated against a real-book+chapter registry.
- Heuristic for dangling `(from library:` / `(per:` that never closes.
- Absence of the `[unverified — confirm before publish]` marker next to a
  hedged/uncertain claim.
- `training-only` label missing when sources were empty.

**Pass rule:** zero detected/invented facts and no unverified claims left unflagged.

---

## QG2 — Citation honesty (verification)

- **Library citations** must match a library item title (fuzzy) + category present
  in `context.library.items`. A citation to an absent title **fails**.
- **Internet citations** must match `context.internet.results` titles/URLs.
  A fabricated external source title **fails**.
- **Training-only** responses must not contain *any* `(from library:` / `(per:`
  citation (there was no source to cite). Their presence is a failure.
- **No citation padding.** A citation counts only if the source appears in
  context. Cite-to-pad is scored down but not auto-fail unless a title is invented.

**Pass rule:** every citation groundable to context (or legitimately absent in a
training-only response). Zero invented sources.

---

## QG3 — Format compliance per mode (outline vs devotional vs post)

Each mode declares a **structure contract** in `mode-config.json` and the prompt's
mode-modifier table. The gate enforces structure markers, length caps, and
cross-mode bleed detection.

| Mode family | Enforce markers | Length cap |
|---|---|---|
| `deep-study` | 8 layers (anchor texts, word studies, historical, scholarly voices, theology, biblical thread, local illustrations, pastoral application) | full, no hard cut |
| `sunday-message` | Title, Texts, One Truth, hook, 3–5 body sections (KEY POINT / BACKUP SCRIPTURE / EXPLANATION / WORD STUDY / ILLUSTRATION / DEMONSTRATION / IBIBIO MOMENT), 5-day table, altar call, closing prayer, POWER POINTS | full preaching guide |
| `sermon-notes` | every heading, KEY POINT (bold), Backup Scripture, 2–3 line explanations, 5-day table, altar call, POWER POINTS | under preached length |
| `whatsapp-devotional` | 7 days: DAY + TITLE, hook, anchor scripture, revelation, story, action point, declaration | < 200 words/day |
| `facebook-posts` | HOOK, TENSION, REVELATION, APPLICATION, CLOSE, FOOTER (Light Assembly Bible Church...) | ≤ 150 words/post |
| `partner-devotional` | hook, anchor scripture, revelation, word for the covenant partner, declaration, activation | weighty, honoring |
| `prayer-guide` | opening worship direction, themed prayer sections w/ scripture, declarations, closing prayer | structured agenda |
| `morning-brief` | scripture, word for the Shepherd, church status + TODAY, growth challenge, cultural awareness, declaration | short, scannable |

**Pass rule:** the mode's required markers present (not invented), the mode's
length cap honored, and no foreign mode's markers bleeding in (e.g. a WhatsApp
devotional must NOT contain "POWER POINTS" or a 5-day table).

---

## QG4 — Scripture accuracy

- Every `book chapter:verse` reference is parsed and checked against a built-in
  registry of the 66 canonical Bible books with their plausible chapter ranges.
  A reference to a non-existent chapter (e.g. *Genesis 99:1*) **fails**.
- Verse form is standardized to `Book N:N` (or `Book N:N–N` ranges). Malformed
  refs are flagged.
- The output should use **one consistent rendering**; heavy mid-deliverable
  switching of the anchor rendering is scored down (proof-texting guardrail).

**Pass rule:** every explicit reference resolves within a real book/chapter.
Zero impossible refs.

---

## QG5 — CoT / DeepSeek policy compliance

- **Reasoner modes** (`deep-study`, `sunday-message`, `partner-devotional`):
  at most ONE short `<thinking>` block; it must be brief (≤ ~6 lines) and must
  not re-dump the full reasoning chain in prose.
- **Chat modes** (`sermon-notes`, `whatsapp-devotional`, `facebook-posts`,
  `prayer-guide`, `morning-brief`): **zero** `<thinking>` blocks; only the
  deliverable. Any `<thinking>` here **fails**.
- **Training-only** responses must be labeled `training-only` in the text.

**Pass rule:** think-blocks appear iff the mode is a reasoner mode, and only one,
short.

---

## QG6 — Local & ethical (Akwa Ibom)

- No fakery: output should not claim a specific local name/place/statistic unless
  verifiable or flagged.
- No manipulation toward giving; no tone-deaf imported cliché without localization.
- Confidence scored; not hard-failed unless it fabricates a local fact.

Scored at the discretion of the evaluator; surfaced as advisory issues.

---

## The Score Formula (mirrored in `quality-checks.js`)

```
Start at 100.
- Hard failures (hallucination, fabricated citation, impossible verse,
  missing training-only label when sources empty, `<thinking>` in a chat mode):
  each is a blocking failure → those outputs are marked unsafe.
- Soft deductions (missing optional marker, length slightly over, citation
  present but source only weakly matched, chat-mode length well under spec):
  5–15 each depending on severity; capped so a single soft issue ≤ 15.

score = max(0, 100 - sum(weighted issues))
pass   = (score >= PASS_THRESHOLD) AND (no blocking failure)
```

- **Blocking failure present** → `pass: false` regardless of score.
- **No blocking failure**, score ≥ `PASS_THRESHOLD` (default 80) → pass.
- The gate returns `{ pass, issues, score }`; it **never throws**.

Default thresholds in `quality-checks.js`:
`PASS_THRESHOLD = 80`, `PERFECT = 100`, single-issue weight cap = 15.

---

## Interaction with the rest of MINOS v2

- Consumes the **Router** context shape `{ library:{items,contextString},
  internet:{results,contextString}, mode, config, userProfile }` (may be absent
  → treated as "no context", i.e. training-only).
- Consumes the **Prompt** module's mode-modifier doctrine (structure/length)
  so format checks align with what the model was told.
- The **Orchestrator** calls `validateOutput(output, mode, context)` after each
  generation and re-prompts on failure (bounded retries).
- Emits logs `[MINOS:q5]` and never throws.