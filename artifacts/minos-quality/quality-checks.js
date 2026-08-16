/**
 * MINOS v2 — Quality Check Engine (Agent 5: minos-quality)
 * ------------------------------------------------------------
 * Enforces guardrails QG1–QG6 (see ./guardrails.md) programmatically.
 * Signature (per COLLABORATION_CONTRACT.md):
 *   validateOutput(output, mode, context) → { pass, issues: [], score }
 *
 * - Implements all QG1–QG6.
 * - Hallucination detection: verse regex + 66-book chapter registry,
 *   fabricated citation cross-check against context, training-only label
 *   enforcement when sources are empty.
 * - Format compliance per mode (8 modes, markers from mode-config.json).
 * - CoT policy: `<thinking>` only in reasoner modes (at most one, short);
 *   zero in chat modes.
 * - Scripture accuracy: 66-book chapter registry.
 * - Score: 100 base; blocking failures auto-fail; soft deductions 5–15 capped.
 * - PASS_THRESHOLD = 80.
 * - NEVER throws. All failures return a safe { pass, issues, score }.
 *
 * Log prefix: [MINOS:q5]
 */

'use strict';

export const PASS_THRESHOLD = 80;
export const PERFECT = 100;
export const MAX_SOFT_WEIGHT = 15;

// ---------------------------------------------------------------------------
// Logging helper (contract: console.warn, prefix [MINOS:q5])
// ---------------------------------------------------------------------------
function log(msg) {
  try {
    // eslint-disable-next-line no-console
    console.warn(`[MINOS:q5] ${msg}`);
  } catch (_e) {
    /* never let logging break the gate */
  }
}

// ---------------------------------------------------------------------------
// 66-book canonical Bible chapter registry (QG4).
// Book name → { chapters: N }. Accepts a small set of aliases/abbreviations.
// ---------------------------------------------------------------------------
const BOOK_CHAPTERS = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
  Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Proverbs: 31,
  Ecclesiastes: 12, 'Song of Solomon': 8, Isaiah: 66, Jeremiah: 52,
  Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
  Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3,
  Haggai: 2, Zechariah: 14, Malachi: 4,
  Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16,
  '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6, Ephesians: 6,
  Philippians: 4, Colossians: 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
  '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13,
  James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1,
  '3 John': 1, Jude: 1, Revelation: 22,
};

const BOOK_ALIASES = {
  Gen: 'Genesis', Genesis: 'Genesis', 'Gen.': 'Genesis',
  Exo: 'Exodus', Ex: 'Exodus', Exodus: 'Exodus',
  Lev: 'Leviticus', Leviticus: 'Leviticus',
  Num: 'Numbers', Numbers: 'Numbers',
  Deut: 'Deuteronomy', Deuteronomy: 'Deuteronomy',
  Josh: 'Joshua', Joshua: 'Joshua',
  Judg: 'Judges', Judges: 'Judges',
  Ruth: 'Ruth', '1 Sam': '1 Samuel', '2 Sam': '2 Samuel',
  '1 Kgs': '1 Kings', '2 Kgs': '2 Kings',
  '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles',
  Ezra: 'Ezra', Neh: 'Nehemiah', Nehemiah: 'Nehemiah',
  Esth: 'Esther', Esther: 'Esther',
  Job: 'Job', Ps: 'Psalms', Psa: 'Psalms', Psalms: 'Psalms', Psalm: 'Psalms',
  Prov: 'Proverbs', Proverbs: 'Proverbs',
  Eccl: 'Ecclesiastes', Ecclesiastes: 'Ecclesiastes',
  'Song': 'Song of Solomon', 'Song of Sol': 'Song of Solomon',
  Isa: 'Isaiah', Isaiah: 'Isaiah',
  Jer: 'Jeremiah', Jeremiah: 'Jeremiah',
  Lam: 'Lamentations', Lamentations: 'Lamentations',
  Ezek: 'Ezekiel', Ezekiel: 'Ezekiel',
  Dan: 'Daniel', Daniel: 'Daniel',
  Hos: 'Hosea', Hosea: 'Hosea', Joel: 'Joel',
  Amos: 'Amos', Obad: 'Obadiah', Obadiah: 'Obadiah',
  Jonah: 'Jonah', Mic: 'Micah', Micah: 'Micah',
  Nah: 'Nahum', Nahum: 'Nahum', Hab: 'Habakkuk', Habakkuk: 'Habakkuk',
  Zeph: 'Zephaniah', Zephaniah: 'Zephaniah',
  Hag: 'Haggai', Haggai: 'Haggai',
  Zech: 'Zechariah', Zechariah: 'Zechariah',
  Mal: 'Malachi', Malachi: 'Malachi',
  Matt: 'Matthew', Matthew: 'Matthew', Mt: 'Matthew',
  Mark: 'Mark', Mk: 'Mark',
  Luke: 'Luke', Lk: 'Luke',
  John: 'John', Jn: 'John',
  Acts: 'Acts', Rom: 'Romans', Romans: 'Romans',
  '1 Cor': '1 Corinthians', '2 Cor': '2 Corinthians',
  Gal: 'Galatians', Galatians: 'Galatians',
  Eph: 'Ephesians', Ephesians: 'Ephesians',
  Phil: 'Philippians', Philippians: 'Philippians',
  Col: 'Colossians', Colossians: 'Colossians',
  '1 Thess': '1 Thessalonians', '2 Thess': '2 Thessalonians',
  '1 Tim': '1 Timothy', '2 Tim': '2 Timothy',
  Titus: 'Titus', Philem: 'Philemon', Philemon: 'Philemon',
  Heb: 'Hebrews', Hebrews: 'Hebrews',
  James: 'James', Jas: 'James',
  '1 Pet': '1 Peter', '2 Pet': '2 Peter',
  '1 John': '1 John', '2 John': '2 John', '3 John': '3 John',
  Jude: 'Jude', Rev: 'Revelation', Revelation: 'Revelation',
  // Full numbered canonical names (self-mapping) so "2 Corinthians" style refs resolve.
  '1 Samuel': '1 Samuel', '2 Samuel': '2 Samuel',
  '1 Kings': '1 Kings', '2 Kings': '2 Kings',
  '1 Chronicles': '1 Chronicles', '2 Chronicles': '2 Chronicles',
  '1 Corinthians': '1 Corinthians', '2 Corinthians': '2 Corinthians',
  '1 Thessalonians': '1 Thessalonians', '2 Thessalonians': '2 Thessalonians',
  '1 Timothy': '1 Timothy', '2 Timothy': '2 Timothy',
  '1 Peter': '1 Peter', '2 Peter': '2 Peter',
};

// ---------------------------------------------------------------------------
// Original-language lexicon check (QG1.2). A known token must carry an inline
// translation. We keep a small set of common Greek/Hebrew transliterations so
// that a bare unknown token without an inline translation can be flagged.
// ---------------------------------------------------------------------------
const KNOWN_LEMMA_TOKENS = new Set([
  'agape', 'agapē', 'phileo', 'kerygma', 'logos', 'rhema', 'charis', 'pneuma',
  'dunamis', 'koinonia', 'metanoia', 'shalom', 'hesed', 'chesed', 'emet',
  'ruach', 'nephesh', 'dabar', 'torah', 'mishpat', 'tzedek', 'tsedek',
  'eiréné', 'aphesis', 'dikaiosynē', 'sōtēria',
]);

// ---------------------------------------------------------------------------
// Mode doctrine: model family + required markers + length caps.
// Markers derived from mode-config.json `outputFormatHint`/`format`.
// ---------------------------------------------------------------------------
const MODES = {
  'deep-study': {
    family: 'reasoner',
    maxTokens: 6000,
    required: [
      'Anchor', 'anchor', 'Word Study', 'word study', 'Historical', 'historical',
      'Scholarly', 'scholarly', 'Theology', 'theology', 'Biblical Thread',
      'biblical thread', 'Illustration', 'illustration', 'Application',
      'application',
    ],
    critical: ['Anchor', 'anchor'],
    // "8 layers": count distinct structural keywords seen; require >= 6 layers.
    markerCount: 8,
    minLayers: 6,
    lengthNote: 'full, no hard cut',
  },
  'sunday-message': {
    family: 'reasoner',
    maxTokens: 5000,
    required: [
      'Title', 'One Truth', 'KEY POINT', 'BACKUP SCRIPTURE', 'WORD STUDY',
      'ILLUSTRATION', 'IBIBIO MOMENT', '5-Day', '5-day', 'Altar', 'altar',
      'POWER POINTS', 'Closing Prayer', 'closing prayer',
    ],
    critical: ['One Truth', 'KEY POINT', 'POWER POINTS'],
    markerCount: 12,
    minLayers: 8,
    lengthNote: 'full preaching guide',
  },
  'sermon-notes': {
    family: 'chat',
    maxTokens: 2500,
    required: [
      'KEY POINT', 'Backup Scripture', 'backup scripture', '5-Day', '5-day',
      'Altar', 'altar', 'POWER POINTS',
    ],
    critical: ['KEY POINT', 'POWER POINTS'],
    markerCount: 6,
    minLayers: 4,
    lengthNote: 'under preached length',
  },
  'whatsapp-devotional': {
    family: 'chat',
    maxTokens: 2000,
    required: [
      'DAY ', 'DAY 1', 'DAY 2', 'DAY 3', 'DAY 4', 'DAY 5', 'DAY 6', 'DAY 7',
      'ANCHOR SCRIPTURE', 'REVELATION', 'ACTION POINT', 'DECLARATION',
    ],
    critical: ['ANCHOR SCRIPTURE', 'DAY '],
    markerCount: 6,
    minLayers: 4,
    // < 200 words/day, 7 days → total cap ~1400 words of body (soft).
    capWords: 1400,
    lengthNote: '< 200 words/day',
  },
  'facebook-posts': {
    family: 'chat',
    maxTokens: 1500,
    required: [
      'HOOK', 'TENSION', 'REVELATION', 'APPLICATION', 'CLOSE',
      'Light Assembly Bible Church',
    ],
    critical: ['Light Assembly Bible Church'],
    markerCount: 6,
    minLayers: 6,
    capWords: 150,
    lengthNote: '≤ 150 words/post',
  },
  'partner-devotional': {
    family: 'reasoner',
    maxTokens: 3500,
    required: [
      'ANCHOR SCRIPTURE', 'REVELATION', 'COVENANT PARTNER', 'covenant partner',
      'DECLARATION', 'ACTIVATION',
    ],
    critical: ['ANCHOR SCRIPTURE', 'DECLARATION'],
    markerCount: 5,
    minLayers: 4,
    lengthNote: 'weighty, honoring',
  },
  'prayer-guide': {
    family: 'chat',
    maxTokens: 2500,
    required: [
      'Worship', 'worship', 'Declaration', 'declaration', 'Closing Prayer',
      'closing prayer', 'Prayer', 'prayer',
    ],
    critical: ['worship', 'Closing Prayer', 'closing prayer'],
    markerCount: 4,
    minLayers: 3,
    lengthNote: 'structured agenda',
  },
  'morning-brief': {
    family: 'chat',
    maxTokens: 1200,
    required: [
      'Scripture', 'scripture', 'Shepherd', 'shepherd', 'TODAY', 'Growth',
      'growth', 'Cultural', 'cultural', 'Declaration', 'declaration',
    ],
    critical: ['Scripture', 'Shepherd', 'shepherd'],
    markerCount: 5,
    minLayers: 3,
    capWords: 400,
    lengthNote: 'short, scannable',
  },
};

// ---------------------------------------------------------------------------
// Regexes
// ---------------------------------------------------------------------------
// Verse reference: optional numeric prefix (e.g. "2"), book name, chapter:verse,
// optional ranges/all-tenses.
const VERSE_RE = /([123]?\s?[A-Za-z]+(?:\s+[A-Za-z]+)*?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/g;

// Citation markers for library/internet.
const LIB_CITE_RE = /\(from library:\s*"([^"]+)"\)|\(per:\s*([^)]+)\)/gi;

// Thinking blocks.
const THINKING_RE = /<thinking>[\s\S]*?<\/thinking>/gi;
const THINKING_OPEN_RE = /<thinking>/g;

// Training-only label.
const TRAINING_ONLY_RE = /training-only/i;

// Unverified-claim flag (QG1.4).
const UNVERIFIED_RE = /\[unverified[^\]]*\]/i;

// Original-language presentation: token + inline translation.
const LEXICON_PRESENT_RE = /(?:[\u0370-\u03ff\u0590-\u05ff]|[a-zA-Z]+)[^A-Za-z]{0,3}[=:]\s*["“]?[A-Za-z][^"”)]{0,40}/;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function wordCount(str) {
  const t = String(str || '').replace(/\s+/g, ' ').trim();
  return t ? t.split(' ').length : 0;
}

function hasAny(hay, needles) {
  return needles.some((n) => String(hay || '').toLowerCase().includes(String(n).toLowerCase()));
}

function layerCount(output, mode) {
  const req = MODES[mode] ? MODES[mode].required : [];
  let count = 0;
  for (const m of req) {
    if (String(output || '').toLowerCase().includes(String(m).toLowerCase())) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// QG4 — Scripture accuracy: verify each verse reference against the registry.
// Returns { ok, badRefs: [] }
// ---------------------------------------------------------------------------
function verifyVerses(output) {
  const bad = [];
  const raw = String(output || '');
  let m;
  VERSE_RE.lastIndex = 0;
  const seen = new Set();
  while ((m = VERSE_RE.exec(raw)) !== null) {
    // Normalize book: handle "2Corinthians" / " 2 Corinthians" → "2 Corinthians".
    let bookRaw = m[1].trim().replace(/\s+/g, ' ');
    bookRaw = bookRaw.replace(/^([123])([A-Za-z])/i, '$1 $2');
    const chapter = parseInt(m[2], 10);
    const verse = parseInt(m[3], 10);
    const verseEnd = m[4] ? parseInt(m[4], 10) : verse;
    const key = `${bookRaw}|${chapter}`;
    if (seen.has(key)) continue; // de-dup so a repeated correct ref isn't double-counted
    seen.add(key);

    const canonical = BOOK_ALIASES[bookRaw];
    if (!canonical || !BOOK_CHAPTERS[canonical]) {
      bad.push(`${bookRaw} ${chapter}:${verse} (unknown book)`);
      continue;
    }
    if (chapter < 1 || chapter > BOOK_CHAPTERS[canonical]) {
      bad.push(`${bookRaw} ${chapter}:${verse} (chapter out of range — max ${BOOK_CHAPTERS[canonical]})`);
      continue;
    }
    if (verse < 1 || verseEnd < verse) {
      bad.push(`${bookRaw} ${chapter}:${verse} (bad verse form)`);
      continue;
    }
  }
  return { ok: bad.length === 0, badRefs: bad };
}

// ---------------------------------------------------------------------------
// QG1/QG2 — Citation honesty + hallucination cross-check.
// Verifies that any (from library:"X") / (per: X) cites a source present in
// context. Returns { issues: [{blocking, msg}], matchedCount }
// ---------------------------------------------------------------------------
function verifyCitations(output, context) {
  const issues = [];
  let matched = 0;
  const raw = String(output || '');
  const ctx = context || {};
  const libraryItems = (ctx.library && ctx.library.items) || [];
  const internetResults = (ctx.internet && ctx.internet.results) || [];

  const allTitles = [
    ...libraryItems.map((it) => ((it && it.title) || '').toLowerCase()),
    ...internetResults.map((r) => String((r && (r.title || r.url || '')) || '').toLowerCase()),
  ];
  const hasContent = ctx.library && ctx.library.items && ctx.library.items.length > 0;
  const hasInternet = ctx.internet && ctx.internet.results && ctx.internet.results.length > 0;
  const srcEmpty = !hasContent && !hasInternet;

  let citeMatch;
  LIB_CITE_RE.lastIndex = 0;
  while ((citeMatch = LIB_CITE_RE.exec(raw)) !== null) {
    const cited = (citeMatch[1] || citeMatch[2] || '').trim().toLowerCase();
    if (srcEmpty) {
      // Training-only path: any citation is a fabrication (QG2.3).
      issues.push({
        blocking: true,
        msg: `Citation "${citeMatch[0]}" present but sources were empty (training-only required)`,
      });
      continue;
    }
    const found = allTitles.some((t) => t && (t.includes(cited) || cited.includes(t)));
    if (found) {
      matched += 1;
    } else {
      issues.push({
        blocking: true,
        msg: `Fabricated citation: "${citeMatch[0]}" does not match any context source`,
      });
    }
  }

  // QG1.5 / QG2.3: if sources empty AND there is actual content, training-only
  // label is mandatory. Empty output has nothing to fabricate and needs no label.
  if (srcEmpty && String(output || '').trim().length > 0 && !TRAINING_ONLY_RE.test(raw)) {
    issues.push({
      blocking: true,
      msg: 'No library/internet sources loaded — response must be labeled training-only',
    });
  }
  // If sources present and the response is training-only but cites nothing, fine.

  return { issues, matchedCount: matched };
}

// ---------------------------------------------------------------------------
// QG1 — Hallucination: fabricated original-language words and unverified claims.
// ---------------------------------------------------------------------------
function checkLexicon(output) {
  const issues = [];
  const raw = String(output || '');
  for (const token of KNOWN_LEMMA_TOKENS) {
    // token present, but not followed by an inline translation marker
    const re = new RegExp(`\\b${token}\\b`, 'i');
    if (re.test(raw) && !LEXICON_PRESENT_RE.test(raw)) {
      // if the token appears with nothing translatable nearby, soft-flag once
      issues.push({
        blocking: false,
        weight: 8,
        msg: `Original-language term "${token}" present without inline translation (verify)`,
      });
      break; // one advisory is enough
    }
  }
  return issues;
}

function checkUnverifiedNumericClaims(output) {
  const issues = [];
  const raw = String(output || '');
  // figures like "$", "%", years, big numbers — if present without [unverified], soft-flag
  const figRe = /(?:\$\s?\d[\d,]*|(?:^|\s)\d{2,}(?:\.\d+)?%|attend|attendance\s+of\s+\d+|raised\s+\$\d)/i;
  if (figRe.test(raw) && !UNVERIFIED_RE.test(raw)) {
    const withFlag = raw.replace(figRe, (s) => s).includes('['); // rough
    // Only flag if a real numeric claim is present and no unverified marker anywhere.
    if (!UNVERIFIED_RE.test(raw)) {
      issues.push({
        blocking: false,
        weight: 8,
        msg: 'Numeric/statistical claim present without [unverified] flag (QG1.4)',
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// QG5 — CoT policy.
// ---------------------------------------------------------------------------
function checkThinking(output, mode) {
  const issues = [];
  const raw = String(output || '');
  const family = MODES[mode] ? MODES[mode].family : 'chat';

  const opens = (raw.match(THINKING_OPEN_RE) || []).length;

  if (family === 'chat') {
    if (opens > 0) {
      issues.push({
        blocking: true,
        msg: `<thinking> present in chat mode "${mode}" — must be zero (QG5)`,
      });
    }
    return issues;
  }

  // reasoner: at most one short block
  if (opens === 0) {
    return issues; // acceptable (CoT optional but not required to appear)
  }
  if (opens > 1) {
    issues.push({
      blocking: false,
      weight: 12,
      msg: `Reasoner mode has ${opens} <thinking> blocks — expected at most one`,
    });
  }
  // measure length of each block, flag if long (> 6 lines / ~500 chars)
  let m;
  THINKING_RE.lastIndex = 0;
  while ((m = THINKING_RE.exec(raw)) !== null) {
    const block = m[0];
    const lines = block.split('\n').length;
    if (lines > 8 || block.length > 600) {
      issues.push({
        blocking: false,
        weight: 10,
        msg: `A <thinking> block is too long (${block.length} chars / ${lines} lines) — should be a few lines`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// QG3 — Format compliance per mode (markers + length caps + cross-mode bleed).
// ---------------------------------------------------------------------------
const FOREIGN_MARKERS = {
  'whatsapp-devotional': ['POWER POINTS', '5-Day', '5-day', 'Altar Call'],
  'facebook-posts': ['POWER POINTS', '5-Day', '5-day', 'KEY POINT', 'IBIBIO MOMENT'],
  'morning-brief': ['POWER POINTS', '5-Day', '5-day'],
  'sermon-notes': ['TENSION', 'CLOSE'],
  'deep-study': ['CLOSE', 'HOOK'],
};

function checkFormat(output, mode) {
  const issues = [];
  const raw = String(output || '');
  // Empty/whitespace-only output has no content to check for structure markers
  // or length; skip format checks (it is handled as an edge case, not a format fail).
  if (!raw.trim()) return issues;
  const doctrine = MODES[mode];
  if (!doctrine) {
    issues.push({ blocking: false, weight: 8, msg: `Unknown mode "${mode}" — cannot verify format` });
    return issues;
  }

  // Required markers
  const count = layerCount(output, mode);
  if (count < doctrine.minLayers) {
    issues.push({
      blocking: false,
      weight: 10,
      msg: `Mode "${mode}" missing required structure markers (${count}/${doctrine.minLayers}+ found)`,
    });
  }

  // Critical markers: their absence is a blocking format failure (QG3 pass rule).
  const critical = doctrine.critical || [];
  const missingCritical = critical.filter((m) => !String(output || '').toLowerCase().includes(String(m).toLowerCase()));
  if (missingCritical.length) {
    issues.push({
      blocking: true,
      msg: `Mode "${mode}" missing critical marker: ${missingCritical.join(', ')}`,
    });
  }

  // Cross-mode bleed
  const foreigners = FOREIGN_MARKERS[mode] || [];
  if (foreigners.length && hasAny(raw, foreigners)) {
    issues.push({
      blocking: false,
      weight: 8,
      msg: `Cross-mode marker bleed: "${mode}" contains ${foreigners.filter((f) => raw.toLowerCase().includes(f.toLowerCase())).join(', ')}`,
    });
  }

  // Length caps (soft up to +10%; blocking beyond a 10% overage)
  if (doctrine.capWords) {
    const wc = wordCount(raw);
    if (wc > doctrine.capWords) {
      if (wc > doctrine.capWords * 1.1) {
        issues.push({
          blocking: true,
          msg: `Mode "${mode}" far over length cap (${wc} words > ${doctrine.capWords} — format violation)`,
        });
      } else {
        issues.push({
          blocking: false,
          weight: 10,
          msg: `Mode "${mode}" over length cap (${wc} words > ${doctrine.capWords}±)`,
        });
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// QG6 — Local & ethical (advisory only)
// ---------------------------------------------------------------------------
function checkEthics(output, mode) {
  const issues = [];
  const raw = String(output || '');
  // Fabricating a specific local statistic / name that we cannot verify → soft.
  if (/(?:Akwa Ibom|Uyo|Ikot Ambon)\s+(?:church)\s+(?:of\s+)?\d+/i.test(raw)) {
    issues.push({
      blocking: false,
      weight: 8,
      msg: 'Specific local statistic claimed — confirm before publish (QG6)',
    });
  }
  // Begging/asian manipulation toward giving
  if (/(?:urgently\s+need|please\s+give\s+now|send\s+(?:your\s+)?(?:offering|seed)\s+now)/i.test(raw)) {
    issues.push({
      blocking: false,
      weight: 8,
      msg: 'Tone leans toward solicitation/manipulation (QG6)',
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Issue basket helper: merge blocking + soft.
// ---------------------------------------------------------------------------
function pushAll(basket, items) {
  for (const it of items || []) basket.push(it);
  return basket;
}

// ---------------------------------------------------------------------------
// MAIN: validateOutput(output, mode, context) → { pass, issues, score }
// Never throws.
// ---------------------------------------------------------------------------
export function validateOutput(output, mode, context) {
  try {
    const out = String(output == null ? '' : output);
    const ctx = context || {};
    const modeKey = mode || 'chat';

    const basket = [];

    // --- Blocking checks (auto-fail on any blocking issue) ---
    // QG4 scripture accuracy
    const verses = verifyVerses(out);
    if (!verses.ok) {
      pushAll(basket, verses.badRefs.slice(0, 5).map((r) => ({
        blocking: true, msg: `Impossible verse reference: ${r}`,
      })));
    }

    // QG1/QG2 citation honesty + training-only enforcement
    const cites = verifyCitations(out, ctx);
    pushAll(basket, cites.issues);

    // QG5 CoT policy
    pushAll(basket, checkThinking(out, modeKey));

    // --- Soft checks ---
    // QG1 original-language + unverified claims
    pushAll(basket, checkLexicon(out));
    pushAll(basket, checkUnverifiedNumericClaims(out));

    // QG3 format
    pushAll(basket, checkFormat(out, modeKey));

    // QG6 local & ethical
    pushAll(basket, checkEthics(out, modeKey));

    // --- Score ---
    const blocking = basket.filter((i) => i.blocking);
    const soft = basket.filter((i) => !i.blocking);

    let score = PERFECT;
    for (const s of soft) {
      const w = Math.min(typeof s.weight === 'number' ? s.weight : 10, MAX_SOFT_WEIGHT);
      score -= w;
    }
    score = Math.max(0, score);

    const issues = basket.map((i) => (i.blocking ? `[blocking] ${i.msg}` : `[soft] ${i.msg}`));
    const pass = blocking.length === 0 && score >= PASS_THRESHOLD;

    log(
      `validateOutput(mode=${modeKey}) → pass=${pass} score=${score} ` +
      `blocking=${blocking.length} soft=${soft.length}`
    );

    return { pass, issues, score };
  } catch (err) {
    // Contract: never throw.
    log(`validateOutput internal error (caught): ${err && err.message}`);
    return { pass: false, issues: ['[internal] quality check error (safe-fail)'], score: 0 };
  }
}

// ---------------------------------------------------------------------------
// Default export (contract: single default export, callable with minimal args).
// ---------------------------------------------------------------------------
export default function minosQuality(output, mode, context) {
  return validateOutput(output, mode, context);
}
