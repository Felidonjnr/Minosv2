# MINOS v2 — Sub-Agent Architecture

**Goal:** Build the best church AI assistant in the world — mode-aware, library-aware, internet-aware, learning, Fable-class output.

---

## Sub-Agent Roster (8 Agents)

| # | Agent ID | Role | Primary Deliverable | Est. Time |
|---|----------|------|---------------------|-----------|
| 1 | `minos-rag` | **RAG Engineer** | Firebase Library search — vector/local search, context injection | 1 hr |
| 2 | `minos-search` | **Internet Search Engineer** | Web search API + Bible API integration, result injection | 1.5 hr |
| 3 | `minos-router` | **Mode Router** | 8-mode search strategies, routing logic, context assembly | 1 hr |
| 4 | `minos-prompt` | **Prompt Architect** | Modular system prompt, reasoning layers, CoT pre-processing | 1 hr |
| 5 | `minos-learning` | **Learning Engineer** | Usage tracking, personalized recommendations, profile building | 1.5 hr |
| 6 | `minos-quality` | **Quality Engineer** | DeepSeek optimization, output checks, Fable-class guardrails | 1 hr |
| 7 | `minos-refactor` | **Code Quality** | Refactor, comments, dual-door sync, no UI regression | 0.5 hr |
| 8 | `minos-orchestrator` | **Integration Lead** | End-to-end integration, regression testing, final assembly | 1 hr |

**Total: ~8.5 hrs** (slightly above plan due to integration overhead)

---

## Collaboration Protocol

### Shared Contract (every agent reads first)
- **File:** `MINOS/COLLABORATION_CONTRACT.md` — interfaces, data formats, error handling, testing checkpoints
- **Immutable:** `index.html`, `minos.html` (Door 1), `minos_1.html` (Door 2) — UI untouched
- **Firebase schema:** read-only — existing data must survive
- **No backend:** all client-side, static HTML
- **API keys:** localStorage only

### Communication Bus
- **Artifacts:** Each agent writes to `MINOS/artifacts/<agent-id>/` — specs, code modules, test results
- **Handoffs:** Explicit PR-style: `HANDOFF_<from>_to_<to>.md` with integration notes
- **Sync points:** 3 mandatory checkpoints (see below)

### Sync Checkpoints

| Checkpoint | When | Agents Involved | Gate |
|------------|------|-----------------|------|
| **CP1: Foundation** | After Agents 1, 2, 3 complete | RAG, Search, Router, Orchestrator | All three modules load, no console errors, search+RAG inject into context |
| **CP2: Intelligence** | After Agents 4, 5, 6 complete | Prompt, Learning, Quality, Orchestrator | Modular prompt loads, learning writes to localStorage, quality checks pass on sample outputs |
| **CP3: Polish** | After Agent 7 complete | Refactor, Orchestrator | Both doors identical, zero lint warnings, build size ≤ current |

---

## Agent Specifications

### 1. `minos-rag` — RAG Engineer
**Mission:** Before every AI call, search Firebase Library for relevant saved items and inject as context.

**Inputs:**
- User query + current mode
- Firebase config (from existing `minos.html`)
- Existing library schema (sermons, notes, series, books)

**Outputs:**
- `artifacts/minos-rag/rag-engine.js` — ES module: `searchLibrary(query, mode, topK) → { items, contextString }`
- `artifacts/minos-rag/integration-points.md` — where to call in chat flow
- `HANDOFF_minos-rag_to_minos-router.md`

**Acceptance:**
- Returns relevant items in < 500ms (local) / < 2s (Firebase)
- Context string formatted: `LIBRARY CONTEXT:\n---\n[item1]\n[item2]\n---`
- Handles empty results gracefully
- No Firebase schema changes

---

### 2. `minos-search` — Internet Search Engineer
**Mission:** Search the open web + Bible APIs for mode-appropriate resources and inject alongside library context.

**Inputs:**
- User query + current mode
- Search API key (localStorage → Brave/Google CSE)
- Bible API endpoints (public domain)

**Outputs:**
- `artifacts/minos-search/search-engine.js` — ES module: `searchInternet(query, mode) → { results, contextString }`
- `artifacts/minos-search/bible-api.js` — passage lookup, cross-refs, Strong's
- `artifacts/minos-search/mode-strategies.md` — search params per mode (from plan table)
- `HANDOFF_minos-search_to_minos-router.md`

**Acceptance:**
- 8 mode-specific search strategies implemented (table in plan)
- Bible API: passage text, cross-references, Greek/Hebrew lemmas
- Results ranked, deduplicated, top 5 injected
- Context string: `INTERNET RESOURCES FOUND:\n---\n[source1]\n[source2]\n---`
- Graceful degradation if API fails/quota exceeded

---

### 3. `minos-router` — Mode Router
**Mission:** Route every query through the correct RAG + Search strategy per mode, assemble unified context.

**Inputs:**
- 8 modes: Deep Study, Sunday Message, Sermon Notes, WhatsApp Devotional, Facebook Posts, Partner Devotional, Prayer Guide, Morning Brief
- Outputs from RAG + Search engines

**Outputs:**
- `artifacts/minos-router/mode-router.js` — ES module: `assembleContext(query, mode) → { fullContext, sources }`
- `artifacts/minos-router/mode-config.json` — per-mode weights, search params, prompt modifiers
- `HANDOFF_minos-router_to_minos-prompt.md`

**Acceptance:**
- All 8 modes produce distinct context signatures
- Context = System Base + Library + Internet + Mode Modifier
- Token budget respected (target < 8k context tokens)
- Fallback chain: Library → Internet → Training only

---

### 4. `minos-prompt` — Prompt Architect
**Mission:** Build modular, reasoning-enhanced system prompt that consumes assembled context and produces Fable-class output.

**Inputs:**
- Current monolithic system prompt (from `minos.html`)
- Context format from Router
- DeepSeek reasoning patterns

**Outputs:**
- `artifacts/minos-prompt/system-prompt.js` — ES module: `buildSystemPrompt(mode, context, userProfile) → string`
- `artifacts/minos-prompt/modules/` — separate files: `base.md`, `reasoning.md`, `style.md`, `guardrails.md`, `mode-modifiers.md`
- `artifacts/minos-prompt/deepseek-variant.md` — optimized for DeepSeek reasoning
- `HANDOFF_minos-prompt_to_minos-quality.md`

**Acceptance:**
- Prompt < 4k tokens base, < 12k with context
- Chain-of-thought pre-processing block included
- Mode-specific modifiers applied (tone, structure, length)
- DeepSeek variant uses `<thinking>` tags effectively
- Guardrails: no hallucination, cite sources, respect mode format

---

### 5. `minos-learning` — Learning Engineer
**Mission:** Track usage patterns, build user profile, personalize recommendations and search weights.

**Inputs:**
- Query history, mode selections, dwell time, explicit feedback (thumbs up/down), saved items
- localStorage persistence

**Outputs:**
- `artifacts/minos-learning/learning-engine.js` — ES module: `recordInteraction(data)`, `getProfile() → { preferences, weights, recommendations }`
- `artifacts/minos-learning/profile-schema.json` — localStorage schema
- `artifacts/minos-learning/recommendation-widget.js` — UI component for "Recommended for you"
- `HANDOFF_minos-learning_to_minos-router.md` (feeds back into mode weights)

**Acceptance:**
- Zero external calls — pure localStorage
- Profile builds within 10 interactions
- Recommendations appear on Library page
- Privacy: clear data button, no PII in logs
- Feeds Router: boosts preferred sources, modes, topics

---

### 6. `minos-quality` — Quality Engineer
**Mission:** Ensure Fable-class output even on DeepSeek — output checks, regression tests, guardrails.

**Inputs:**
- Prompt variants from Prompt Architect
- Sample queries per mode (test suite)
- DeepSeek reasoning traces

**Outputs:**
- `artifacts/minos-quality/quality-checks.js` — ES module: `validateOutput(output, mode) → { pass, issues, score }`
- `artifacts/minos-quality/test-suite.json` — 50+ test cases (query, mode, expected patterns)
- `artifacts/minos-quality/guardrails.md` — hallucination detection, citation verification, format compliance
- `artifacts/minos-quality/deepseek-tuning.md` — temperature, top-p, reasoning token budget per mode
- `HANDOFF_minos-quality_to_minos-orchestrator.md`

**Acceptance:**
- Automated test runner (browser console) passes 95%+
- Hallucination rate < 2% on known passages
- Citation accuracy > 90%
- Output format compliance per mode (outline vs devotional vs post)
- DeepSeek params tuned per mode

---

### 7. `minos-refactor` — Code Quality
**Mission:** Clean, commented, dual-door synced, zero regression.

**Inputs:**
- All artifact modules from Agents 1–6
- Current `minos.html` (Door 1) and `minos_1.html` (Door 2)

**Outputs:**
- `artifacts/minos-refactor/minos-v2.html` — Door 1, integrated
- `artifacts/minos-refactor/minos_1-v2.html` — Door 2, identical logic
- `artifacts/minos-refactor/changelog.md` — what changed, why
- `artifacts/minos-refactor/lint-report.txt` — ESLint/Prettier clean

**Acceptance:**
- Both doors functionally identical
- Zero console errors/warnings
- Bundle size ≤ current (no new deps beyond search/Bible APIs)
- All existing features work: Read Aloud, Library, Save, Sync, Share, Copy
- Comments on all new modules

---

### 8. `minos-orchestrator` — Integration Lead
**Mission:** End-to-end integration, regression testing, final delivery.

**Inputs:**
- All artifacts from Agents 1–7
- Current production files

**Outputs:**
- `artifacts/minos-orchestrator/INTEGRATION_REPORT.md` — test results, known issues, launch checklist
- `artifacts/minos-orchestrator/LAUNCH_PACKAGE/` — final `minos.html`, `minos_1.html`, `README_DEPLOY.md`
- `HANDOFF_minos-orchestrator_to_GODSHAND.md` — deployment instructions, API key setup, verification steps

**Acceptance:**
- Full smoke test: 8 modes × 3 queries each = 24 passes
- Firebase sync verified (save → sync → load on Door 2)
- Read Aloud works on new outputs
- Library search + internet search both functional
- Learning profile persists across sessions
- Deployment doc complete

---

## Spawn Order & Dependencies

```
Phase 1 (Parallel):
  ├─ minos-rag
  ├─ minos-search
  └─ minos-router (waits for RAG + Search interfaces)

Phase 2 (Parallel, after CP1):
  ├─ minos-prompt (needs Router context format)
  ├─ minos-learning (independent, feeds Router later)
  └─ minos-quality (needs Prompt variants)

Phase 3 (Sequential):
  ├─ minos-refactor (integrates all modules)
  └─ minos-orchestrator (final test + package)
```

---

## Quick Spawn Commands (for Godshand)

```bash
# Phase 1
openclaw spawn "Build RAG engine: Firebase Library search module per MINOS/SUB_AGENT_ARCHITECTURE.md Agent 1 spec. Output to MINOS/artifacts/minos-rag/." --name minos-rag
openclaw spawn "Build Internet Search engine: Web search + Bible API per Agent 2 spec. Output to MINOS/artifacts/minos-search/." --name minos-search
openclaw spawn "Build Mode Router: 8-mode context assembly per Agent 3 spec. Output to MINOS/artifacts/minos-router/." --name minos-router

# After CP1 verified
openclaw spawn "Build Modular Prompt Architecture per Agent 4 spec. Output to MINOS/artifacts/minos-prompt/." --name minos-prompt
openclaw spawn "Build Learning Engine per Agent 5 spec. Output to MINOS/artifacts/minos-learning/." --name minos-learning
openclaw spawn "Build Quality Checks + Test Suite per Agent 6 spec. Output to MINOS/artifacts/minos-quality/." --name minos-quality

# Phase 3
openclaw spawn "Refactor & sync both doors per Agent 7 spec. Output to MINOS/artifacts/minos-refactor/." --name minos-refactor
openclaw spawn "Final integration, test, launch package per Agent 8 spec. Output to MINOS/artifacts/minos-orchestrator/." --name minos-orchestrator
```

---

## Collaboration Contract (Starter)

**File:** `MINOS/COLLABORATION_CONTRACT.md` — to be created first, all agents read before starting.

```markdown
# MINOS v2 Collaboration Contract

## Module Interface Standard
All modules: ES6, default export, single function/object.
Naming: `minos-<feature>.js` in artifacts/<agent>/

## Context Format (Router → Prompt)
{
  library: { items: [], contextString: "" },
  internet: { results: [], contextString: "" },
  mode: "deep-study" | "sunday-message" | ...,
  userProfile: { preferences: {}, weights: {} }
}

## Prompt Builder Signature
buildSystemPrompt(mode, context, userProfile) → string

## Quality Check Signature
validateOutput(output, mode) → { pass: bool, issues: [], score: 0-100 }

## Learning Profile Schema
{ version: 1, modeWeights: {}, topicAffinities: {}, sourceTrust: {}, updated: timestamp }

## Error Handling
- Never throw — return { error, fallback }
- Log to console.warn with [MINOS:<module>] prefix
- Degrade gracefully: library → internet → training only

## Testing
- Each agent provides test.html in artifacts/<agent>/test/
- Orchestrator runs full suite

## Git Discipline
- Agents commit to feature branches: `minos/<agent-id>`
- Orchestrator merges to `minos/v2-integration`
- No direct pushes to main
```

---

## Next Step

Create `MINOS/COLLABORATION_CONTRACT.md` from the starter above, then spawn Phase 1 agents.