/**
 * MINOS v2 — Mode Router smoke test (Node)
 * =========================================
 * Verifies the Agent 3 acceptance criteria that are testable WITHOUT the
 * RAG/Search engines being present yet (they build in parallel):
 *
 *   1. All 8 modes registered, with distinct labels and ≥2 distinct models
 *   2. Every mode produces a DISTINCT context signature
 *   3. Token budget respected (< 8000 context tokens) on real output
 *   4. Graceful fallback: absent engines → trainingOnly, never throws
 *   5. Unknown mode resolves to a safe default (deep-study)
 *
 * Run:  node artifacts/minos-router/test/test.mjs
 * Browser-equivalent: open test.html
 */
import { assembleContext, listModes } from '../mode-router.js';

const QUERIES = {
  'deep-study': 'Study the Greek of Hebrews 11:1',
  'sunday-message': 'Sunday Message on faith',
  'sermon-notes': 'Notes on my faith sermon',
  'whatsapp-devotional': '7-day devotional on hope',
  'facebook-posts': 'viral post about grace',
  'partner-devotional': 'partner devotional on giving',
  'prayer-guide': 'prayer guide for healing',
  'morning-brief': 'brief for Monday',
};

const tok = (s) => Math.round(String(s || '').length * 0.25);

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \u2713', name); }
  else { fail++; console.log('  \u2717', name); }
}

async function main() {
  console.log('MINOS Router smoke test\n=======================');

  // 1) Registration
  const modes = listModes();
  check('8 modes registered', modes.length === 8);
  check('distinct labels', new Set(modes.map((m) => m.label)).size === 8);
  check('>=2 distinct models (reasoner/chat)', new Set(modes.map((m) => m.model)).size >= 2);

  // 2) Distinct signatures + token budget
  const sigs = new Set();
  let under8k = true;
  for (const [m, q] of Object.entries(QUERIES)) {
    const { fullContext, sources } = await assembleContext(q, m, { systemBase: '<SYS BASE>' });
    sigs.add(fullContext);
    if (tok(fullContext) >= 8000) { under8k = false; console.log('    [over budget]', m, tok(fullContext)); }
    // NOTE: right now engines are absent, so used=['trainingOnly'] is expected.
  }
  check('distinct fullContext signatures (8/8)', sigs.size === 8);
  check('all contexts under 8k tokens', under8k);

  // 3) Fallback chain
  const fb = await assembleContext('anything', 'prayer-guide');
  check('never throws; returns fullContext', !!fb.fullContext);
  check('trainingOnly fallback when engines absent', fb.sources.used.includes('trainingOnly'));

  // 4) Unknown mode → safe default
  const unK = await assembleContext('no keywords here', 'totally-unknown');
  check('unknown mode -> deep-study', unK.sources.mode === 'deep-study');

  // 5) Mode sniffing from query text (no explicit mode)
  const sniffed = await assembleContext('Give me a prayer guide for the sick', null);
  check('query mode sniffing (prayer-guide)', sniffed.sources.mode === 'prayer-guide');

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

main();