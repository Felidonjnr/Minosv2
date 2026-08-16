/** Test harness for minos-rag/rag-engine.js (run: node test/test-rag-engine.js) */
import rag from '../rag-engine.js';
let pass = 0, fail = 0;
function assert(cond, name) { if (cond) { pass++; console.log('  ok ' + name); } else { fail++; console.error('  FAIL ' + name); } }

const items = {
  '1': { id: '1', title: 'The Potter and the Clay', cat: 'sermon', content: 'God shapes us like a potter shapes clay, Jeremiah 18. Faithfulness under pressure.', date: Date.now() - 864e5 * 5 },
  '2': { id: '2', title: 'Faith that Moves Mountains', cat: 'notes', content: 'Faith, not feeling. Mark 11:22-24. Speak to the mountain.', date: Date.now() - 864e5 * 30 },
  '3': { id: '3', title: 'Covenant Faithfulness', cat: 'partner', content: 'Partner devotional on keeping covenant with God and the saints.', date: Date.now() - 864e5 * 60 },
  '4': { id: '4', title: 'Healing Prayer Guide', cat: 'prayer', content: 'Prayer points for divine healing, Isaiah 53:5, healing scriptures.', date: Date.now() - 864e5 * 10 },
  '5': { id: '5', title: 'Wednesday Prayer Meeting notes', cat: 'prayer', content: 'Intercession for church growth and the community.', date: Date.now() - 864e5 * 3 },
  '6': { id: '6', title: 'Marriage and Ministry', cat: 'study', content: 'Deep study notes on the pastoral marriage, Eph 5:25-28.', date: Date.now() - 864e5 * 100 }
};
const fmt = c => c ? c.startsWith('LIBRARY CONTEXT:\n---\n') && c.trimEnd().endsWith('---') : true;

const t0 = Date.now();
const r1 = await rag.searchLibrary('faith mountain moving', 'sunday-message', 3, { items });
assert(r1.items.length > 0, 'basic: returns items');
assert(r1.contextString.includes('Faith that Moves Mountains'), 'basic: relevant top hit');
assert(fmt(r1.contextString), 'basic: context format');
assert(Date.now() - t0 < 500, 'basic: <500ms (actual ' + (Date.now() - t0) + 'ms)');

const r2 = await rag.searchLibrary('healing points scriptures', 'prayer-guide', 3, { items });
assert(r2.items[0].cat === 'prayer', 'mode boost: prayer-guide -> prayer first');

const r3 = await rag.searchLibrary('xkcd nonexistent query zzzq', 'deep-study', 3, { items });
assert(r3.items.length === 0 && r3.contextString === '', 'empty: graceful no results');

const r4 = await rag.searchLibrary('', 'default', 3, { items });
assert(r4.items.length === 0 && r4.contextString === '', 'empty: blank query');

const r5 = await rag.searchLibrary('faith', 'default', 3, {});
assert(r5.items.length === 0 && r5.contextString === '', 'no source: graceful no throw');

const mockClient = { from: () => ({ select: () => ({ limit: () => ({ order: async () => ({ data: Object.values(items) }) }) }) }) };
const r6 = await rag.searchLibrary('covenant partners devotional', 'partner-devotional', 3, { supabaseClient: mockClient });
assert(r6.items.length > 0, 'supabase fallback: returns items');
assert(r6.meta.source === 'supabase', 'supabase fallback: meta.source');
assert(r6.items[0].cat === 'partner', 'supabase fallback: partner boost');

const r7 = await rag.searchLibrary('prayer', 'prayer-guide', 99, { items });
assert(r7.items.length <= 12, 'topK capped at 12');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
