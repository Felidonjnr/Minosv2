// MINOS v2 — Node smoke runner for minos-search (Agent 2)
// Usage: node test/node-smoke.mjs
import searchEngine from '../search-engine.js';
import bible from '../bible-api.js';

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n); } };

// Stub search for every mode (no keys, no network)
const MODES = ['deep-study','sunday-message','sermon-notes','whatsapp-devotional',
               'facebook-posts','partner-devotional','prayer-guide','morning-brief'];
for (const m of MODES) {
  const r = await searchEngine.searchInternet('grace', m, { forceStub: true });
  ok(r.results.length > 0, `[${m}] returns ${r.results.length} results`);
  ok(r.contextString.startsWith('INTERNET RESOURCES FOUND:'), `[${m}] context header`);
  ok(!r.contextString.includes('undefined'), `[${m}] no undefined leak`);
}

// Default export also usable (Router calls .default fallback)
const viaDefault = await searchEngine.searchInternet('faith', 'sunday-message');
ok(Array.isArray(viaDefault.results), 'default .searchInternet resolves in Node (stub)');

// Empty query -> still returns mode-tuned results
const emptyQ = await searchEngine.searchInternet('', 'morning-brief', { forceStub: true });
ok(emptyQ.results.length > 0, 'empty query -> results via mode prefix');

// Never throws on garbage
try { await searchEngine.searchInternet(null, 'bogus'); ok(true, 'null/garbage does not throw'); }
catch (e) { ok(false, 'threw: ' + e.message); }

// topK clamp
const clamped = await searchEngine.searchInternet('x', 'deep-study', { forceStub: true, topK: 999 });
ok(clamped.results.length <= 10, 'topK clamped to 10 (got ' + clamped.results.length + ')');

// Strategy distinctness
const seen = new Set();
MODES.forEach(m => { const s = searchEngine._MODE_STRATEGY[m];
  seen.add(JSON.stringify([s.topK, s.depth, s.prefix, s.strongs])); });
ok(seen.size >= 8, '8 distinct mode strategies (' + seen.size + ')');

// bible-api
const s1 = await bible.strongsLookup('agape');
ok(s1.ok && s1.strongs === 'G26', 'strongs agape -> G26');
const s2 = await bible.strongsLookup('hesed');
ok(s2.ok && s2.strongs === 'H2617', 'strongs hesed -> H2617');
const s3 = await bible.strongsLookup('nonsense');
ok(s3.ok && s3.found === false, 'unknown strongs degrades gracefully');
const c = await bible.enrichBibleContext('John 3:16', 'deep-study', { strongs: true });
ok(typeof c.contextString === 'string', 'enrichBibleContext returns string');
const pass1 = await bible.lookupPassage('John 1:1', 'deep-study');
ok(pass1.ok === false || pass1.ok === true, 'passage lookup resolves (network dependent)');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);