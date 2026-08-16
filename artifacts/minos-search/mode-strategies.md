# MINOS v2 — Internet Search Mode Strategies

Engine: `minos-search/search-engine.js` (Agent 2)
Consumed by: `minos-router/mode-router.js` via `searchInternet(query, mode)`.

Each of the 8 modes maps to a distinct search strategy. The engine appends a
`prefix` of domain vocabulary to the user's raw query to steer the web provider
toward the right class of resources, and applies a `topK`/`depth` cap so the
injected context stays within the Router's token budget.

## Strategy Table

| Mode | Depth | topK | Query prefix (appended to raw query) | Min. credibility | Bible lookup | Strong's | Example query focus |
|------|-------|------|--------------------------------------|------------------|--------------|----------|---------------------|
| **deep-study** | deep | 8 | scholarly commentary Greek Hebrew lexicon theological seminary paper | seminary, lexicon, academic | ✅ | ✅ | Original-language word study, commentary, historical background |
| **sunday-message** | medium | 6 | sermon outline historical cultural context illustrations related scriptures preaching | sermon outline, commentary, teaching ministry | ✅ | — | Sermon outlines, illustrations, contextual background |
| **sermon-notes** | medium | 5 | commentary highlights key themes preaching resources sermon notes | commentary, teaching ministry | ✅ | — | Commentaries, key themes, punchy notes |
| **whatsapp-devotional** | shallow | 4 | daily devotional relatable story illustration short-form theological insight | devotional, story, illustration | ✅ | — | Devotionals, relatable stories, short-form insight |
| **facebook-posts** | shallow | 5 | viral Christian content patterns topical Bible teaching engagement hooks | Christian content, engagement pattern | ✅ | — | Virality patterns, hooks, topical teaching |
| **partner-devotional** | deep | 5 | covenant partnership stewardship scriptures prophetic devotional partner teaching | stewardship, covenant, prophetic teaching | ✅ | — | Covenant partnership, stewardship, prophetic teaching |
| **prayer-guide** | medium | 5 | prayer movements scripture-based prayer patterns revival resources prayer agenda | prayer ministry, revival teaching | ✅ | — | Prayer movements, revival, scripture-based prayer |
| **morning-brief** | daily | 5 | today church calendar Christian observances shepherd devotional morning | church calendar, devotional, current date | ✅ | — | Today's church calendar, shepherd devotional |
| **default** (fallback) | medium | 5 | *(none)* | *(none)* | — | — | Any |

## How the strategy is applied

1. **Query construction** — `buildQuery(query, mode)`:
   `rawQuery + " " + prefixWords` (prefix omitted when raw query is empty). This
   biases the provider toward the intended resource class without hiding the
   user's intent.
2. **Provider chain** — Brave → Google CSE → deterministic stub:
   - Brave key `minos_brave_key` (localStorage), Google key `minos_google_key` +
     engine id `minos_google_cx`.
   - If no keys or the network fails, the engine returns a hard-coded set of
     credible Christian resource sites tuned to the mode (still non-empty).
3. **Token safety** — `topK` is clamped to `1..10` (MAX_TOP_K). The uniform
   context format only injects `Title — url` lines (no full snippets by default),
   so even `deep-study` (topK=8) stays lightweight. The Router additionally caps
   to per-mode internet token budgets.

## Bible enrichment (bibleLookup / Strong's)

- `lookupPassage(ref, mode)` fetches from `bible-api.com` (keyless). Translation
  per mode: KJV for teaching/study modes, WEB for short-form (devotional/facebook/
  morning-brief) modes.
- `crossReferences(ref, mode)` pulls related/crossref passages.
- `strongsLookup(term)` resolves common Greek/Hebrew words to Strong's numbers via
  a bundled lexicon (extensible), surfaced in deep-study mode.

## Context contract (Router)

```
INTERNET RESOURCES FOUND:
---
[1] Title — url
[2] Title — url
---
```

Empty results → `{ results: [], contextString: "" }` (never throws). The Router
then falls through "Internet → Training only" per the COLLABORATION_CONTRACT.