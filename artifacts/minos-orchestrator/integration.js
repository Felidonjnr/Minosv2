/**
 * MINOS v2 — Integration Orchestrator (Agent 8)
 * =============================================
 * The single ES module that wires every v2 module into one end-to-end pipeline:
 *
 *   minosQuery(query, mode, options)
 *     └─ assembleContext(query, mode)          ← minos-router
 *     └─ buildSystemPrompt(mode, ctx, profile) ← minos-prompt
 *     └─ LLM call (DeepSeek, injectable)        ← transport
 *     └─ validateOutput(output, mode, ctx)      ← minos-quality (bounded retries)
 *     └─ return final output
 *
 * Contract compliance (COLLABORATION_CONTRACT.md):
 *   - ES module, named export `minosQuery` (+ default export object).
 *   - Never throws — degrades to `{ error, fallback }` on hard failure.
 *   - API key read from localStorage (`minos_ds_ak`) only; never logged.
 *   - Bounded retry budget so the quality gate can never loop forever.
 *   - Pure wiring: no DOM access, no global side effects.
 *
 * Log prefix: [MINOS:o8]
 *
 * @module minos-orchestrator/integration
 */

import routerDefault, { assembleContext, listModes } from '../minos-router/mode-router.js';
const resolveMode = routerDefault.resolveMode;
import { buildSystemPrompt } from '../minos-prompt/system-prompt.js';
import { validateOutput } from '../minos-quality/quality-checks.js';
import learningEngine from '../minos-learning/learning-engine.js';

/* ============================================================
 * 1) DeepSeek transport + tuning (see minos-quality/deepseek-tuning.md)
 * ============================================================ */

const DS_URL = 'https://api.deepseek.com/chat/completions';
const DS_CHAT = 'deepseek-chat';
const DS_REASON = 'deepseek-reasoner';

/** Reasoner model families (receive a reasoning token budget; chat ones do not). */
const REASONER_MODES = new Set(['deep-study', 'sunday-message', 'partner-devotional']);

/** Per-mode sampling params — source of truth: minos-quality/deepseek-tuning.md. */
const TUNING = {
  'deep-study':        { model: DS_REASON, temperature: 0.30, top_p: 0.90, max_reasoning_tokens: 1500, max_tokens: 6000 },
  'sunday-message':    { model: DS_REASON, temperature: 0.55, top_p: 0.92, max_reasoning_tokens: 1600, max_tokens: 5000 },
  'sermon-notes':      { model: DS_CHAT,   temperature: 0.45, top_p: 0.90, max_tokens: 2500 },
  'whatsapp-devotional':{ model: DS_CHAT,  temperature: 0.85, top_p: 0.95, max_tokens: 2000 },
  'facebook-posts':    { model: DS_CHAT,   temperature: 0.90, top_p: 0.95, max_tokens: 1500 },
  'partner-devotional':{ model: DS_REASON, temperature: 0.45, top_p: 0.90, max_reasoning_tokens: 1400, max_tokens: 3500 },
  'prayer-guide':      { model: DS_CHAT,   temperature: 0.60, top_p: 0.92, max_tokens: 2500 },
  'morning-brief':     { model: DS_CHAT,   temperature: 0.40, top_p: 0.88, max_tokens: 1200 },
};

/** Default retry budget (max total generation attempts). Bounded — never infinite. */
const DEFAULT_RETRIES = 2;

const log = (...a) => console.warn('[MINOS:o8]', ...a);

/**
 * Read the DeepSeek API key from localStorage, never logging it.
 * Returns '' when absent (degrade path, contract-compliant).
 */
function getKey() {
  try {
    return (globalThis.localStorage && localStorage.getItem('minos_ds_ak')) || '';
  } catch {
    return '';
  }
}

/** Build the DeepSeek request body for a mode (respect reasoner/chat families). */
function buildRequestBody(model, messages, mode) {
  const t = TUNING[mode] || TUNING['sunday-message'];
  const body = {
    model: model || t.model,
    temperature: t.temperature,
    top_p: t.top_p,
    max_tokens: t.max_tokens || 2000,
    messages,
  };
  // Only reasoner modes get a reasoning budget; chat modes must NOT receive one
  // (QG5 enforces zero exposed <thinking> in chat, and DeepSeek-chat ignores it anyway).
  if (REASONER_MODES.has(mode) && t.max_reasoning_tokens) {
    body.max_reasoning_tokens = t.max_reasoning_tokens;
  }
  return body;
}

/**
 * Default LLM transport: POST to DeepSeek.
 * Injectable via options.llm so tests/policy can substitute a deterministic stub.
 *
 * @param {object} opts { system, user, mode, model, apiKey, history? }
 * @returns {Promise<string>} the assistant reply text
 */
async function defaultLLM(opts) {
  const key = opts.apiKey || getKey();
  if (!key) {
    throw new Error('no_api_key');
  }
  const messages = [{ role: 'system', content: opts.system }];
  if (Array.isArray(opts.history) && opts.history.length) {
    messages.push(...opts.history);
  }
  messages.push({ role: 'user', content: opts.user });
  const body = buildRequestBody(opts.model, messages, opts.mode);
  const res = await fetch(DS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || 'HTTP ' + res.status;
    throw new Error('llm_error: ' + msg);
  }
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  return typeof content === 'string' ? content : '';
}

/** Extract the blocking issues (that force a re-prompt) from a quality result. */
function blockingIssues(result) {
  return (result && Array.isArray(result.issues) ? result.issues : [])
    .filter((i) => typeof i === 'string' && i.startsWith('[blocking]'));
}

/** Build a tightened directive echoing the gate's blocking issues back to the model. */
function tightenDirective(result, mode, attempt) {
  const blockers = blockingIssues(result);
  const soft = (result && Array.isArray(result.issues) ? result.issues : []).filter(
    (i) => typeof i === 'string' && i.startsWith('[soft]')
  );
  const lines = [
    'REVISION PASS ' + attempt + ' (quality gate did not pass). Fix ALL of the following and regenerate the ENTIRE deliverable:',
    ...blockers.map((b) => '- ' + b),
    ...soft.slice(0, 4).map((s) => '- ' + s),
    '- Respect the mode-specified structure markers and length caps exactly.',
    '- Only cite library/internet sources that were actually provided. If none were provided, state that this is training-only and cite nothing.',
  ];
  return lines.filter(Boolean).join('\n');
}

/* ============================================================
 * 2) Main pipeline
 * ============================================================ */

/**
 * Run the full MINOS v2 pipeline for one query.
 *
 * @param {string} query            raw user text
 * @param {string} [mode]           canonical mode key or UI alias (auto-sniffed if omitted)
 * @param {object} [options]
 *   - systemBase?: string          override router identity prefix
 *   - loadDeps?: boolean           pass through to assembleContext (default true)
 *   - retries?: number             bounded retry budget (default 2 total attempts)
 *   - llm?: (opts)=>Promise<string> injectable LLM (default: DeepSeek fetch)
 *   - apiKey?: string              override for tests; default reads localStorage
 *   - history?: array              [{role,content}] prior turns (optional)
 *   - profile?: object             explicit learning snapshot (default: engine.getProfile())
 *
 * @returns {Promise<{output, meta, sources}>}  never rejects
 *   meta: { mode, model, attempts, pass, score, issues, used, retries, error? }
 */
export async function minosQuery(query, mode, options = {}) {
  const retries = Math.max(1, options.retries || DEFAULT_RETRIES);
  try {
    // --- 1. Resolve canonical mode (alias / sniffing / default) ---
    const resolvedMode = resolveMode(mode, query);
    const modeKey = listModes().some((m) => m.mode === resolvedMode)
      ? resolvedMode
      : 'deep-study';
    const tuning = TUNING[modeKey] || TUNING['sunday-message'];

    // --- 2. Assemble context (Router: RAG + Search + fallback chain) ---
    const { sources } = await assembleContext(query, modeKey, {
      systemBase: options.systemBase,
      loadDeps: options.loadDeps !== false,
    });

    // --- 3. Learning profile (nudge, no-op before 10 interactions) ---
    let profile = options.profile;
    if (!profile) {
      try {
        profile = learningEngine.getProfile();
      } catch {
        profile = { preferences: {}, weights: {} };
      }
    }

    // --- 4. Build system prompt (Prompt Architect) ---
    const promptContext = {
      library: sources.library,
      internet: sources.internet,
      mode: modeKey,
      config: sources.config,
      userProfile: profile,
    };
    const systemPrompt = await buildSystemPrompt(modeKey, promptContext, profile);

    // --- 5. Bounded retry loop: generate → validate → tighten → regenerate ---
    const llm = options.llm || defaultLLM;
    let lastResult = null;
    let finalOutput = '';
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      let userMessage = query;
      if (attempt > 1 && lastResult) {
        userMessage = query + '\n\n' + tightenDirective(lastResult, modeKey, attempt - 1);
      }

      let output;
      try {
        output = await llm({
          system: systemPrompt,
          user: userMessage,
          mode: modeKey,
          model: options.model || tuning.model,
          apiKey: options.apiKey,
          history: options.history,
          attempt,
        });
      } catch (e) {
        // Transport failure (network / no key) — degrade gracefully, do not retry.
        const msg = String((e && e.message) || e);
        if (msg === 'no_api_key') {
          return {
            output: '',
            meta: { mode: modeKey, model: tuning.model, attempts: attempt, pass: false, score: 0,
                    issues: ['[blocking] No DeepSeek API key (minos_ds_ak) in localStorage.'],
                    used: sources.used, retries, error: 'no_api_key' },
            sources,
          };
        }
        return {
          output: '',
          meta: { mode: modeKey, model: tuning.model, attempts: attempt, pass: false, score: 0,
                  issues: ['[blocking] LLM transport error: ' + msg],
                  used: sources.used, retries, error: 'llm_error' },
          sources,
        };
      }

      // Validate against the Quality Gate.
      lastResult = validateOutput(output, modeKey, promptContext);
      log(`attempt=${attempt}/${retries} mode=${modeKey} pass=${lastResult.pass} score=${lastResult.score} issues=${lastResult.issues.length}`);

      if (lastResult.pass) {
        finalOutput = output;
        return {
          output,
          meta: {
            mode: modeKey,
            model: tuning.model,
            attempts: attempt,
            pass: true,
            score: lastResult.score,
            issues: lastResult.issues,
            used: sources.used,
            retries,
          },
          sources,
        };
      }
      finalOutput = output; // keep last candidate as fallback
    }

    // --- 6. Retry budget exhausted ---
    const blockers = blockingIssues(lastResult);
    // Training-only rule: if sources were empty, ship with the label rather than drop.
    const sourcesEmpty = !sources.library.items.length && !sources.internet.results.length;
    if (sourcesEmpty && finalOutput) {
      const labeled = finalOutput.trim() + (/\n$/.test(finalOutput) ? '' : '') +
        '\n\n[training-only — no library or internet sources were available; generated from model knowledge only]';
      return {
        output: labeled,
        meta: { mode: modeKey, model: tuning.model, attempts: retries, pass: false, score: lastResult?.score,
                issues: lastResult?.issues, used: sources.used, retries, error: 'quality_gate_training_fallback' },
        sources,
      };
    }
    // Otherwise surface the rejection (do not ship hallucinating/unsafe content).
    return {
      output: '',
      meta: { mode: modeKey, model: tuning.model, attempts: retries, pass: false, score: lastResult?.score,
              issues: lastResult?.issues, used: sources.used, retries, error: 'quality_gate_rejected', blockers },
      sources,
    };
  } catch (e) {
    // Contract: never throw — degrade to a well-formed error shape.
    log('pipeline exception', String((e && e.message) || e));
    return {
      output: '',
      meta: { mode: '', model: '', attempts: 0, pass: false, score: 0,
              issues: ['[internal] minosQuery: ' + String((e && e.message) || e)], used: ['trainingOnly'], retries, error: 'internal' },
      sources: null,
    };
  }
}

/** Convenience re-exports so the UI has one import surface. */
export { assembleContext, resolveMode, listModes, buildSystemPrompt, validateOutput, getKey, TUNING, REASONER_MODES };

/** Contract-friendly default export. */
export default { minosQuery, assembleContext, resolveMode, listModes, buildSystemPrompt, validateOutput, getKey, TUNING, REASONER_MODES, DEFAULT_RETRIES };
