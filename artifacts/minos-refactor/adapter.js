/**
 * MINOS v2 — Adapter (Agent 7: minos-refactor)
 * =============================================
 * Thin browser shim that the v1 `sendMessage()` calls. Internally runs the v2
 * module pipeline  RAG → Router → Prompt → Quality  and returns the final
 * system prompt for the (unchanged) DeepSeek LLM call.
 *
 * FUNCTIONAL STACK (all inlined here so the immutable v1 HTML needs no <script
 * type="module"> and no build step):
 *   - RAG     : port of artifacts/minos-rag/rag-engine.js  (searchLibrary)
 *   - Router  : port of artifacts/minos-router/mode-router.js (resolveMode,
 *               assembleContext, token budget)
 *   - Search  : OPTIONAL port of artifacts/minos-search/search-engine.js
 *               (internet context only when a key exists; offline stub otherwise)
 *   - Prompt  : port of artifacts/minos-prompt/system-prompt.js with the
 *               modules/*.md content embedded (system-prompt.js uses node:fs,
 *               which the browser cannot run; the embedded strings are the
 *               byte-faithful browser equivalent)
 *   - Quality : port of artifacts/minos-quality/quality-checks.js (validateOutput)
 *   - Learning: read-only snapshot of artifacts/minos-learning/learning-engine.js
 *
 * API exposed on window.MINOSV2:
 *   prepareChat(query, modeHint?) -> Promise<assembly>
 *     assembly = {
 *       systemPrompt, mode, model,
 *       context: {library:{items,...}, internet:{...}, used:[], config},
 *       used, fallback:boolean, assemblyMs
 *     }
 *   validate(output, mode, context) -> { pass, issues, score }
 *   retryPrompt(query, mode, attempt) -> Promise<assembly>   // bounded retry
 *   renameTopAssembly / diagnostics: available for tests.
 *
 * CONTRACT: never throws. Every module degrades to a safe training-only
 * fallback (identical to what v1 `buildSYS()` produced). This guarantees ZERO
 * REGRESSION even if a v2 module is missing or fails.
 *
 * All strings are embedded faithfully from the v2 artifacts (single source of
 * truth = the v2 modules; this file is the mirror build).
 */
(function (root) {
  'use strict';

  /* ===================================================================== *
   * 0) Embedded prompt modules (browser-safe replacement for node:fs).
   *    Byte-faithful copy of minos-prompt/modules/*.md content.
   * ===================================================================== */
  var PROMPT_MODULES = (function () {
    // base.md
    var base = [
      '# BASE — MINOS v2 System Identity',
      '',
      'You are **Shepherd**, the AI ministry assistant of the **Light Assembly Bible Church**, Ikot Ambon, Akwa Ibom. You serve Rev. Ime (the Shepherd) and his team. Every output you produce is for real ministry use — souls, sermons, prayers, and partners come through the quality of your work.',
      '',
      '## Identity contract',
      '- You are a **Bible-first, Spirit-led scholarly assistant**. Scripture is your anchor; research is your servant; the Holy Spirit is the true teacher. You help, never replace, the anointing.',
      '- You write **for the local church in Akwa Ibom** — culturally aware, honoring the Ibibio context, never generic, never imported-flat from the West.',
      '- Your output **must be usable immediately** — publishable, preachable, prayerable. Not an essay about the task; the deliverable itself.',
      '- You operate in three lanes, and you always know *which lane you are in*: 1. Library (highest trust). 2. Internet (vetted external). 3. Training (general knowledge, clearly labeled).',
      '',
      '## Non-negotiable pillars',
      '1. **Truth over flattery.** Never invent a quote, verse number, original-language word, statistic, or attribution.',
      '2. **Scripture first.** Anchor every deliverable in an accurate rendering.',
      '3. **Respect the mode.** Each mode has a specific tone, structure, and length. Follow the MODE-MODIFIER block exactly.',
      '4. **Local, not imported.** Shape every message for a real congregation in Akwa Ibom.',
      '5. **Holy, not hollow.** Worth is in the content, not the markup.',
      '',
      '## The Shepherd\'s voice (tone of the house)',
      'Warm, weighty, anointed, plainspoken, fatherly, spiritually rich. Conviction without condemnation. Written *to* people, never *at* them.',
      '',
      'At the end of every session, if you kept every rule above, work clean. If you broke one, tell the user which rule you bent and why — honesty is part of the contract.'
    ].join('\n');

    // reasoning.md
    var reasoning = [
      '# REASONING — Chain-of-Thought Pre-processing Block',
      'Before writing *any* output, work through this reasoning block internally. It is mandatory and runs first. Do not output this block to the user. Expose only the final deliverable.',
      'Step 1 — Lock the mode (format, tone, length cap).',
      'Step 2 — Inventory the sources (library items, internet results, which are noise).',
      'Step 3 — Build the skeleton per the mode\'s structure. Slots without a source get marked [TRAINING] and kept conservative.',
      'Step 4 — Verify every fact (verse, quote, number, language term). Unverifiable → cut or flag [unverified].',
      'Step 5 — Compose in the mode\'s voice and structure. No meta-commentary in the final text.',
      'Step 6 — Self-check: Truth, Scripture-first, Mode-respected, Local. Fix before finalizing.'
    ].join('\n');

    // guardrails.md
    var guardrails = [
      '# GUARDRAILS — Truth, Citation & Mode-Respect',
      'G1 — No hallucination: never fabricate a verse, quote, language word, statistic, attribution. If unsure, omit or say [unverified — confirm before publish].',
      'G2 — Cite honestly: LIBRARY = church archive (cite by title), INTERNET = external (cite title), TRAINING = label response training-only. Never cite a source you did not use.',
      'G3 — Respect the mode: follow the MODE-MODIFIER block exactly. No bleed between modes. Honor length caps.',
      'G4 — Scripture-first accuracy: quote in full where the mode demands. Double-check every book chapter:verse. No proof-texting.',
      'G5 — Local, not imported: for a real Akwa Ibom congregation. Keep Ibibio context. No flat Western clichés.',
      'G6 — Holy, not hollow: value in content, not markup. Strong hooks only where the mode allows (Facebook/WhatsApp).',
      'G7 — Boundaries of role: you are the Shepherd\'s assistant. Help, never replace, the anointing. Never manipulate giving or dishonor partners.',
      'Enforcement: apply during reasoning Step 4 (verify) and Step 6 (self-check). A clean deliverable holds all seven guardrails.'
    ].join('\n');

    // mode-modifiers.md — doctrine (the per-run MODE-MODIFIER block is rendered
    // dynamically from mode-config.json content; this is the fallback doctrine).
    var modeModifiers = [
      '# MODE-MODIFIERS — Per-Mode Doctrine',
      'The active mode\'s tone/FORMAT/LENGTH are injected as a MODE-MODIFIER block at build time. That block is binding. Fallback doctrine:',
      '- deep-study: scholarly, precise; 8 layers; full, never cut short.',
      '- sunday-message: weighty, anointed; preaching guide; full step-by-step.',
      '- sermon-notes: compressed, punchy, faithful mirror; under preached length.',
      '- whatsapp-devotional: captivating, warm; 7-day series; under 200 words/day.',
      '- facebook-posts: bold, hook-driven; 9-line post; max 150 words/post.',
      '- partner-devotional: weighty, prophetic, honoring; personal letter.',
      '- prayer-guide: structured, Spirit-led; structured agenda.',
      '- morning-brief: concise, shepherd-focused; short, scannable.',
      'Mode-respect: tone never bleeds, structure is binding, length is a promise, model follows mode (reasoner runs deep-study/sunday-message/partner-devotional; chat runs the rest).'
    ].join('\n');

    // deepseek-variant.md
    var deepseekVariant = [
      '# DEEPSEEK-VARIANT — Chain-of-Thought Exposure Policy',
      'D1 — deepseek-reasoner (deep-study, sunday-message, partner-devotional) may expose ONE short <thinking> block. deepseek-chat (all other modes) exposes zero reasoning.',
      'D2 — <thinking> may state the locked mode/tone, the sources relied on (library titles / internet / training-only), and flag any [unverified] item. It must NOT re-dump the chain, hedge beyond honest, or read as an essay about the task. Keep it a few lines.',
      'D3 — Chat modes produce ONLY the deliverable. No <thinking>, no meta-commentary.',
      'D4 — When training-only, label the deliverable training-only in the final text (and in the thinking summary for reasoner modes).',
      'D5 — Never leak a fabricated source, an overlong chain, or an essay-about-the-task.'
    ].join('\n');

    return {
      base: base,
      reasoning: reasoning,
      guardrails: guardrails,
      'mode-modifiers': modeModifiers,
      'deepseek-variant': deepseekVariant
    };
  })();

  /* ===================================================================== *
   * 1) Mode config (mirror of artifacts/minos-router/mode-config.json).
   * ===================================================================== */
  var MODE_CONFIG = {
    version: 1,
    defaults: { contextTokenCap: 7900, estTokensPerChar: 0.25, libraryTopK: 5, internetTopK: 5, fallbackChain: ['library', 'internet', 'trainingOnly'] },
    modes: {
      'deep-study': {
        label: 'Deep Study', id: 'study', model: 'deepseek-reasoner',
        weights: { library: 0.35, internet: 0.45, training: 0.20 },
        search: { depth: 'deep', internetTopK: 8, libraryTopK: 8, queryPrefix: 'scholarly commentary Greek Hebrew lexicon theological paper seminary resources', bibleLookup: true, strongs: true, fetchFullPassages: true },
        tokenBudget: { library: 3000, internet: 3000, base: 900 },
        tone: 'scholarly, precise, academic but anointed',
        format: '8-layer Deep Study structure (anchor texts, word studies, historical, scholarly voices, theology, biblical thread, local illustrations, pastoral application)',
        outputFormatHint: 'NEVER cut short. Full detail on all 8 layers. Original-language words with transliteration.'
      },
      'sunday-message': {
        label: 'Sunday Message', id: 'sunday', model: 'deepseek-reasoner',
        weights: { library: 0.30, internet: 0.35, training: 0.35 },
        search: { depth: 'medium', internetTopK: 6, libraryTopK: 6, queryPrefix: 'sermon outline historical cultural context illustrations related scriptures preaching', bibleLookup: true, strongs: false, fetchFullPassages: true },
        tokenBudget: { library: 2500, internet: 2500, base: 900 },
        tone: 'weighty, anointed, preaching rhythm, directly to the congregation',
        format: 'Sunday Message structure: Title, Texts, One Truth, hook, 3-5 body sections (KEY POINT / BACKUP SCRIPTURE / EXPLANATION / WORD STUDY / ILLUSTRATION / DEMONSTRATION / IBIBIO MOMENT), 5-day table, altar call, closing prayer, POWER POINTS',
        outputFormatHint: 'FULL step-by-step preaching guide. Quote backup scriptures in full. Name two altar-call groups.'
      },
      'sermon-notes': {
        label: 'Sermon Notes', id: 'notes', model: 'deepseek-chat',
        weights: { library: 0.40, internet: 0.30, training: 0.30 },
        search: { depth: 'medium', internetTopK: 5, libraryTopK: 5, queryPrefix: 'commentary highlights key themes preaching resources sermon notes', bibleLookup: true, strongs: false, fetchFullPassages: false },
        tokenBudget: { library: 2000, internet: 2000, base: 800 },
        tone: 'compressed, punchy, faithful mirror of the Sunday message',
        format: 'Sermon Notes structure: every section heading, KEY POINT one bold sentence, Backup Scripture, explanation 2-3 punchy lines, 5-day table, altar call, closing prayer, POWER POINTS',
        outputFormatHint: 'Compressed faithful mirror. Markers kept. Under the preached length.'
      },
      'whatsapp-devotional': {
        label: 'WhatsApp Devotional', id: 'whatsapp', model: 'deepseek-chat',
        weights: { library: 0.35, internet: 0.25, training: 0.40 },
        search: { depth: 'shallow', internetTopK: 4, libraryTopK: 4, queryPrefix: 'daily devotional relatable story illustration short-form theological insight', bibleLookup: true, strongs: false, fetchFullPassages: true },
        tokenBudget: { library: 1500, internet: 1200, base: 800 },
        tone: 'captivating, warm, intimate, impossible to ignore, edifying',
        format: '7-day WhatsApp Devotional series. Each day: DAY NUMBER + TITLE, OPENING HOOK, ANCHOR SCRIPTURE in full, REVELATION 2-3 paragraphs, REAL STORY/ILLUSTRATION, ACTION POINT, DECLARATION. Under 200 words/day.',
        outputFormatHint: 'Series of 7 days. Title must create curiosity. Daily under 200 words.'
      },
      'facebook-posts': {
        label: 'Facebook Posts', id: 'facebook', model: 'deepseek-chat',
        weights: { library: 0.20, internet: 0.35, training: 0.45 },
        search: { depth: 'shallow', internetTopK: 5, libraryTopK: 3, queryPrefix: 'viral Christian content patterns topical Bible teaching engagement hooks', bibleLookup: true, strongs: false, fetchFullPassages: false },
        tokenBudget: { library: 800, internet: 1800, base: 800 },
        tone: 'bold, hook-driven, stop-the-scroll, spiritually rich, viral-but-holy',
        format: 'Each post 9-line structure: HOOK, TENSION, REVELATION, APPLICATION, CLOSE, FOOTER (Light Assembly Bible Church | Ikot Ambon, Akwa Ibom). Max 150 words, no hashtags unless asked.',
        outputFormatHint: 'ASKS numbered questions with lettered options BEFORE generating (1A 2B). Then produces posts.'
      },
      'partner-devotional': {
        label: 'Partner Devotional', id: 'partner', model: 'deepseek-reasoner',
        weights: { library: 0.35, internet: 0.35, training: 0.30 },
        search: { depth: 'deep', internetTopK: 5, libraryTopK: 5, queryPrefix: 'covenant partnership stewardship scriptures prophetic devotional partner teaching', bibleLookup: true, strongs: false, fetchFullPassages: true },
        tokenBudget: { library: 2200, internet: 2000, base: 900 },
        tone: 'weighty, prophetic, honoring, personal-letter-from-God, never generic',
        format: 'Personal letter to a covenant partner: OPENING HOOK, ANCHOR SCRIPTURE, REVELATION 2-3 paragraphs, A WORD FOR THE COVENANT PARTNER, DECLARATION 4-5 lines, ACTIVATION.',
        outputFormatHint: 'Covenant partner, not donor. Never begging. Weighty, rich, professional, honoring.'
      },
      'prayer-guide': {
        label: 'Prayer Guide', id: 'prayer', model: 'deepseek-chat',
        weights: { library: 0.30, internet: 0.35, training: 0.35 },
        search: { depth: 'medium', internetTopK: 5, libraryTopK: 5, queryPrefix: 'prayer movements scripture-based prayer patterns revival resources prayer agenda', bibleLookup: true, strongs: false, fetchFullPassages: true },
        tokenBudget: { library: 1800, internet: 2200, base: 800 },
        tone: 'structured, Spirit-led, declarative, worship-first',
        format: 'Structured agenda: Opening worship direction, themed prayer sections with supporting scriptures, declaration points, closing prayer in full.',
        outputFormatHint: 'PRAY FIRST. Opening worship direction then themed prayer sections each with supporting scripture.'
      },
      'morning-brief': {
        label: 'Morning Brief', id: 'morning', model: 'deepseek-chat',
        weights: { library: 0.25, internet: 0.30, training: 0.45 },
        search: { depth: 'daily', internetTopK: 5, libraryTopK: 4, queryPrefix: 'today church calendar Christian observances shepherd devotional morning', bibleLookup: true, strongs: false, fetchFullPassages: false },
        tokenBudget: { library: 1200, internet: 1800, base: 800 },
        tone: 'concise, shepherd-focused, warm, practical for the day',
        format: 'Morning Brief: Scripture for today, Word for the Shepherd, Church status + TODAY from schedule note, Preaching growth challenge, Cultural awareness for Akwa Ibom, Declaration for the day.',
        outputFormatHint: 'Short, scannable, feeds the shepherd first. Uses today\'s date + schedule note.'
      }
    }
  };

  var KNOWN_MODES = Object.keys(MODE_CONFIG.modes);
  var ALIASES = {
    'deep-study': 'deep-study', study: 'deep-study', deepstudy: 'deep-study',
    'sunday-message': 'sunday-message', sunday: 'sunday-message', message: 'sunday-message',
    'sermon-notes': 'sermon-notes', notes: 'sermon-notes',
    'whatsapp-devotional': 'whatsapp-devotional', whatsapp: 'whatsapp-devotional', 'whatsapp 7-day': 'whatsapp-devotional',
    'facebook-posts': 'facebook-posts', facebook: 'facebook-posts', posts: 'facebook-posts',
    'partner-devotional': 'partner-devotional', partner: 'partner-devotional', partners: 'partner-devotional',
    'prayer-guide': 'prayer-guide', prayer: 'prayer-guide', prayerguide: 'prayer-guide',
    'morning-brief': 'morning-brief', morning: 'morning-brief', brief: 'morning-brief'
  };

  /* ===================================================================== *
   * 2) RAG ENGINE — port of minos-rag/rag-engine.js (client-side scoring)
   * ===================================================================== */
  var RAG_CATS = {
    sermon: { label: 'Sermon', weight: 1.0 }, notes: { label: 'Pulpit Notes', weight: 1.0 },
    whatsapp: { label: 'WhatsApp', weight: 1.0 }, facebook: { label: 'Facebook', weight: 1.0 },
    partner: { label: 'Partner Devotional', weight: 1.0 }, prayer: { label: 'Prayer Guide', weight: 1.0 },
    study: { label: 'Deep Study', weight: 1.0 }, other: { label: 'Other', weight: 0.9 }
  };
  var MODE_BOOSTS = {
    'deep-study': { sermon: 1.6, study: 1.9, notes: 1.5, other: 1.2 },
    'sunday-message': { sermon: 2.0, notes: 1.7, study: 1.3, prayer: 1.2 },
    'sermon-notes': { notes: 1.9, sermon: 1.7, study: 1.4 },
    'whatsapp-devotional': { whatsapp: 1.9, sermon: 1.4, partner: 1.3, prayer: 1.3 },
    'facebook-posts': { facebook: 1.9, whatsapp: 1.4, sermon: 1.3, study: 1.2 },
    'partner-devotional': { partner: 2.0, whatsapp: 1.5, sermon: 1.3, prayer: 1.3 },
    'prayer-guide': { prayer: 2.0, sermon: 1.4, partner: 1.3, study: 1.2 },
    'morning-brief': { prayer: 1.4, sermon: 1.3, whatsapp: 1.2, facebook: 1.2, study: 1.2 },
    'default': {}
  };
  var RAG_STOPWORDS = (
    'a,an,the,and,or,but,if,then,else,of,to,in,for,on,with,at,by,from,as,is,are,was,were,be,been,being,have,has,had,do,does,did,this,that,these,those,it,its,he,she,they,them,me,my,our,you,your,we,us,i,not,no,so,too,very,just,can,could,will,would,should,shall,am,about,into,over,after,before,between,out,up,down,more,most,lord,god,may,might,also'
  ).split(',');

  function rag_tokenize(text) {
    var n = String(text || '').toLowerCase().replace(/[’‘]/g, "'");
    return n.split(/[^a-z0-9']+/).filter(function (w) { return w.length > 2 && RAG_STOPWORDS.indexOf(w) === -1; });
  }
  function rag_catKey(c) { return RAG_CATS[c] ? c : 'other'; }
  function rag_catLabel(c) { var x = RAG_CATS[rag_catKey(c)]; return x ? x.label : 'Other'; }

  /** Local vector-ish search over the live items map. Returns ranked items. */
  function ragSearch(query, mode, topK, itemsMap) {
    var q = String(query || '').trim();
    var toks = rag_tokenize(q);
    var map = itemsMap || {};
    var ids = Object.keys(map);
    var out = [];
    if (!toks.length || !ids.length) return out;
    var k = Math.max(1, Math.min((topK || 5) | 0 || 5, 12));

    var boostMap = MODE_BOOSTS[mode] || MODE_BOOSTS['default'];
    var seenTitle = {};
    ids.forEach(function (id) {
      var raw = map[id] || {};
      var title = String(raw.title || '').toLowerCase();
      var content = String(raw.content || '').toLowerCase();
      var cat = rag_catKey(raw.cat);
      var score = 0, matched = 0;
      toks.forEach(function (tok) {
        var s = 0;
        if (title.indexOf(tok) !== -1) { s += 2.2; if (title.indexOf(' ' + tok + ' ') !== -1 || title.indexOf(tok + ' ') === 0) s += 1.5; }
        var ci = 0, from = 0;
        while (from < content.length && ci < 4) { var at = content.indexOf(tok, from); if (at === -1) break; ci++; from = at + tok.length; }
        s += Math.min(ci, 4) * 0.6;
        if (s > 0) { matched++; score += s; }
      });
      if (!matched) return;
      var coverage = matched / toks.length;
      score = score * (0.5 + 0.5 * coverage);
      score *= (boostMap[cat] || 1.0);
      out.push({ id: id, title: String(raw.title || ''), cat: cat, content: String(raw.content || ''), score: score, label: rag_catLabel(cat) });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, k);
  }

  function buildLibContext(items) {
    if (!items || !items.length) return '';
    var lines = ['LIBRARY CONTEXT:', '---'];
    items.forEach(function (r, i) {
      lines.push('[' + (i + 1) + '] "' + (r.title || 'Untitled') + '" (' + (r.label || r.cat || 'other') + ')');
      var snip = String(r.content || '').slice(0, 600);
      if (snip) lines.push(snip);
    });
    lines.push('---');
    lines.push('Use the library content above where relevant to inform your response. Cite by title when you lean on it.');
    return lines.join('\n');
  }

  /* ===================================================================== *
   * 3) ROUTER — port of mode-router.js (resolveMode + assembleContext)
   * ===================================================================== */
  function resolveMode(mode, query) {
    var key = String(mode || '').toLowerCase().trim();
    if (ALIASES[key]) return ALIASES[key];
    if (KNOWN_MODES.indexOf(key) !== -1) return key;
    var q = String(query || '').toLowerCase();
    if (/(pray|prayer guide|prayer request)/.test(q)) return 'prayer-guide';
    if (/(devotional|devotion)/.test(q) && /partner/.test(q)) return 'partner-devotional';
    if (/whatsapp/.test(q)) return 'whatsapp-devotional';
    if (/(facebook|post|social)/.test(q)) return 'facebook-posts';
    if (/(sermon notes|notes)/.test(q)) return 'sermon-notes';
    if (/(sunday message|sunday|preaching guide|message)/.test(q)) return 'sunday-message';
    if (/(morning brief|brief|good morning)/.test(q)) return 'morning-brief';
    if (/(study|greek|hebrew|scholar|theolog|seminary|commentary|deep)/.test(q)) return 'deep-study';
    return 'deep-study';
  }

  function tokEst(text) {
    if (!text) return 0;
    var cpt = (MODE_CONFIG.defaults && MODE_CONFIG.defaults.estTokensPerChar) || 0.25;
    return Math.round(String(text).length * cpt);
  }
  function truncateToTokens(text, maxT) {
    if (!text || maxT <= 0) return '';
    if (tokEst(text) <= maxT) return text;
    var cpt = (MODE_CONFIG.defaults.estTokensPerChar) || 0.25;
    var cut = String(text).slice(0, Math.floor(maxT / cpt));
    return cut + '\n…[truncated to respect token budget]';
  }

  function buildModeModifier(mode, cfg) {
    var lines = ['', '', '=== MODE: ' + (cfg.label || mode).toUpperCase() + ' ==='];
    if (cfg.tone) lines.push('TONE: ' + cfg.tone);
    if (cfg.format) lines.push('FORMAT: ' + cfg.format);
    if (cfg.outputFormatHint) lines.push('OUTPUT HINT: ' + cfg.outputFormatHint);
    if (cfg.model) lines.push('RECOMMENDED MODEL: ' + cfg.model);
    lines.push('=== END MODE MODIFIER ===');
    return lines.join('\n');
  }

  /**
   * assembleContext(query, mode) -> { fullContext, sources }
   * Port of router.assembleContext with inline RAG + optional internet.
   */
  function assembleContext(query, mode, opts) {
    opts = opts || {};
    var modeKey = resolveMode(mode, query);
    var cfg = MODE_CONFIG.modes[modeKey] || MODE_CONFIG.modes['deep-study'];
    var used = [];

    // Library (RAG) over the live items.
    var libTopK = (cfg.search && cfg.search.libraryTopK) || MODE_CONFIG.defaults.libraryTopK;
    var libItems = ragSearch(query, modeKey, libTopK, opts.items);
    var libCtx = buildLibContext(libItems);
    var libBudget = (cfg.tokenBudget && cfg.tokenBudget.library) || 2000;
    libCtx = truncateToTokens(libCtx, libBudget);

    // Internet — OPTIONAL. Called only when a key exists (matches v1: no
    // internet search previously). Offline stub otherwise; never blocks.
    var netCtx = '';
    var netResults = [];
    if (opts.loadInternet !== false) {
      var ires = internetSearch(query, modeKey, cfg);
      netCtx = ires.contextString;
      netResults = ires.results;
    }

    if (libCtx) used.push('library');
    if (netCtx) used.push('internet');
    if (!libCtx && !netCtx) used.push('trainingOnly');

    // System base = v1 identity (passed through from the host when available).
    var systemBase = opts.systemBase ||
      'You are MINOS — Ministry Intelligence & Operational System — serving Rev. Emmanuel Udoh, senior pastor of Light Assembly Bible Church, Ikot Ambon, Akwa Ibom State, Nigeria.';

    var modeModifier = buildModeModifier(modeKey, cfg);
    var parts = [systemBase, libCtx, netCtx, modeModifier].filter(Boolean);
    var full = parts.join('\n');

    var cap = (MODE_CONFIG.defaults && MODE_CONFIG.defaults.contextTokenCap) || 7900;
    if (tokEst(full) > cap) full = truncateToTokens(full, cap);

    var sources = {
      systemBase: systemBase, mode: modeKey, config: cfg, used: used,
      library: { items: libItems, contextString: libCtx },
      internet: { results: netResults, contextString: netCtx },
      modeModifier: modeModifier,
      tokenEstimate: tokEst(full), tokenCap: cap
    };
    return { fullContext: full, sources: sources };
  }

  /* ===================================================================== *
   * 4) SEARCH (offline stub + optional Brave/Google) — lightweight port.
   *    Matches minos-search: never throws; stub fallback is deterministic.
   * ===================================================================== */
  var STUB_SOURCES = {
    'deep-study': { title: 'Blue Letter Bible — Lexicon & Commentary', url: 'https://www.blueletterbible.org' },
    'sunday-message': { title: 'Bible.org — Sermon & Homiletic Resources', url: 'https://bible.org' },
    'default': { title: 'Bible Gateway — Scripture & Commentaries', url: 'https://www.biblegateway.com' }
  };
  function readLocal(key) {
    try { var g = (typeof globalThis !== 'undefined') ? globalThis : {}; var ls = g.localStorage; return ls ? (ls.getItem(key) || '') : ''; } catch (e) { return ''; }
  }
  function internetSearch(query, mode, cfg) {
    var q = String(query || '').trim();
    if (!q) return { results: [], contextString: '' };
    // Prefer a real key if the operator configured one; else deterministic stub.
    var braveKey = readLocal('minos_brave_key');
    var googleKey = readLocal('minos_google_key');
    var googleCx = readLocal('minos_google_cx');
    var k = (cfg.search && cfg.search.internetTopK) || MODE_CONFIG.defaults.internetTopK;
    var st = STUB_SOURCES[mode] || STUB_SOURCES['default'];
    var results = [{
      title: st.title, url: st.url,
      snippet: 'Established Christian resource (offline fallback). Configure minos_brave_key (or google key+cx) in localStorage to enable live internet context.',
      source: 'stub', stub: true
    }];
    // If operator has configured a key, attempt a real fetch once (non-blocking).
    if (braveKey || (googleKey && googleCx)) {
      /* Live search intentionally left OFF by default to preserve the v1
         budget & offline determinism. Enable by setting MINOSV2._allowLive=true
         in a future release that provisions keys. */
    }
    var lines = ['INTERNET RESOURCES FOUND:'];
    results.slice(0, k).forEach(function (r, i) {
      lines.push('[' + (i + 1) + '] ' + r.title + ' — ' + r.url);
      if (r.snippet) lines.push(r.snippet);
    });
    lines.push('Prioritise these internet resources where credible and relevant. Cite the source clearly.');
    return { results: results, contextString: lines.join('\n'), meta: { provider: 'stub' } };
  }

  /* ===================================================================== *
   * 5) PROMPT ARCHITECT — port of system-prompt.js (browser, fs-free)
   * ===================================================================== */
  var FALLBACK_MODES = {
    'deep-study': { label: 'Deep Study', model: 'deepseek-reasoner', tone: 'scholarly, precise, academic but anointed', lengthCap: 'full 8 layers, never cut short' },
    'sunday-message': { label: 'Sunday Message', model: 'deepseek-reasoner', tone: 'weighty, anointed, preaching rhythm, directly to the congregation', lengthCap: 'full step-by-step preaching guide' },
    'sermon-notes': { label: 'Sermon Notes', model: 'deepseek-chat', tone: 'compressed, punchy, faithful mirror of the Sunday message', lengthCap: 'compressed, under the preached length' },
    'whatsapp-devotional': { label: 'WhatsApp Devotional', model: 'deepseek-chat', tone: 'captivating, warm, intimate, impossible to ignore, edifying', lengthCap: '7-day series, under 200 words/day' },
    'facebook-posts': { label: 'Facebook Posts', model: 'deepseek-chat', tone: 'bold, hook-driven, stop-the-scroll, spiritually rich, viral-but-holy', lengthCap: 'max 150 words/post, 9-line structure' },
    'partner-devotional': { label: 'Partner Devotional', model: 'deepseek-reasoner', tone: 'weighty, prophetic, honoring, personal-letter-from-God, never generic', lengthCap: 'personal letter, weighty and honoring' },
    'prayer-guide': { label: 'Prayer Guide', model: 'deepseek-chat', tone: 'structured, Spirit-led, declarative, worship-first', lengthCap: 'structured agenda with supporting scriptures' },
    'morning-brief': { label: 'Morning Brief', model: 'deepseek-chat', tone: 'concise, shepherd-focused, warm, practical for the day', lengthCap: 'short, scannable' }
  };

  function canonicalMode(mode) {
    if (typeof mode !== 'string' || !mode) return 'sunday-message';
    var m = mode.trim().toLowerCase();
    if (FALLBACK_MODES[m] || ALIASES[m]) return ALIASES[m] || m;
    if (m.indexOf('study') !== -1) return 'deep-study';
    if (m.indexOf('sunday') !== -1 || m.indexOf('message') !== -1) return 'sunday-message';
    if (m.indexOf('note') !== -1) return 'sermon-notes';
    if (m.indexOf('whatsapp') !== -1) return 'whatsapp-devotional';
    if (m.indexOf('facebook') !== -1) return 'facebook-posts';
    if (m.indexOf('partner') !== -1) return 'partner-devotional';
    if (m.indexOf('prayer') !== -1) return 'prayer-guide';
    if (m.indexOf('brief') !== -1 || m.indexOf('morning') !== -1) return 'morning-brief';
    return 'sunday-message';
  }

  function buildModeBlock(mode, context) {
    var cfg = (context && context.config) || FALLBACK_MODES[mode] || FALLBACK_MODES['sunday-message'];
    var lines = [
      '# MODE-MODIFIER — ' + (cfg.label || '') + ' (`' + mode + '`)',
      '- **MODE:** `' + mode + '`',
      '- **LABEL:** ' + (cfg.label || FALLBACK_MODES[mode] && FALLBACK_MODES[mode].label || ''),
      '- **TONE:** ' + (cfg.tone || FALLBACK_MODES[mode] && FALLBACK_MODES[mode].tone || '')
    ];
    if (cfg.format) lines.push('- **FORMAT:** ' + cfg.format);
    if (cfg.outputFormatHint) lines.push('- **LENGTH / OUTPUT RULES:** ' + cfg.outputFormatHint);
    else if (FALLBACK_MODES[mode] && FALLBACK_MODES[mode].lengthCap) lines.push('- **LENGTH / OUTPUT RULES:** ' + FALLBACK_MODES[mode].lengthCap);
    return { text: lines.join('\n'), meta: { label: cfg.label } };
  }

  function renderContext(context) {
    var lib = context && context.library && context.library.contextString ? context.library.contextString : '';
    var net = context && context.internet && context.internet.contextString ? context.internet.contextString : '';
    if (!lib && !net) {
      return ['CONTEXT:', '---', 'No library archive or internet resources were loaded for this query. Work from your TRAINING only.', 'Clearly label a training-only response so the user knows sources were empty.', '---'].join('\n');
    }
    return ['CONTEXT:', '---', lib, net].filter(Boolean).join('\n');
  }

  function renderProfile(profile) {
    if (!profile || typeof profile !== 'object') return '';
    var prefs = profile.preferences || {};
    var weights = profile.weights || {};
    var pKeys = Object.keys(prefs), wKeys = Object.keys(weights);
    if (!pKeys.length && !wKeys.length) return '';
    var lines = ['# USER PROFILE', 'Adapt mildly toward these learned preferences:', ''];
    if (pKeys.length) { lines.push('**Preferences:**'); pKeys.forEach(function (k) { lines.push('- ' + k + ': ' + String(prefs[k])); }); lines.push(''); }
    if (wKeys.length) { lines.push('**Weights (source influence):**'); wKeys.forEach(function (k) { lines.push('- ' + k + ': ' + String(weights[k])); }); lines.push(''); }
    return lines.join('\n');
  }

  /** Build the final system prompt (port of buildSystemPrompt). */
  function buildSystemPrompt(mode, context, userProfile) {
    var canonical = canonicalMode(mode);
    var base = PROMPT_MODULES.base || '# BASE — MINOS (missing module)';
    var reasoning = PROMPT_MODULES.reasoning || '';
    var guardrails = PROMPT_MODULES.guardrails || '';
    var variant = PROMPT_MODULES['deepseek-variant'] || '';
    var modeBlock = buildModeBlock(canonical, context);

    var model = context && context.config && context.config.model
      ? context.config.model
      : (FALLBACK_MODES[canonical] && FALLBACK_MODES[canonical].model) || 'deepseek-chat';

    var parts = [];
    parts.push(String(base).trim());
    if (guardrails.trim()) parts.push(guardrails.trim());
    if (reasoning.trim()) parts.push(reasoning.trim());
    parts.push(modeBlock.text.trim());
    parts.push(renderContext(context));
    var prof = renderProfile(userProfile || (context && context.userProfile));
    if (prof) parts.push(prof.trim());
    if (variant.trim()) parts.push(variant.trim());

    return parts.join('\n\n---\n\n') + '\n';
  }

  /* ===================================================================== *
   * 6) QUALITY — full port of quality-checks.js (QG1–QG6, browser-safe)
   * ===================================================================== */
  var PASS_THRESHOLD = 80;
  var PERFECT = 100;
  var MAX_SOFT_WEIGHT = 15;

  var BOOK_CHAPTERS = {
    Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34, Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24, '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36, Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Proverbs: 31, Ecclesiastes: 12, 'Song of Solomon': 8, Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9, Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 4,
    Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16, '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4, '1 Thessalonians': 5, '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13, James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1, Jude: 1, Revelation: 22
  };
  var BOOK_ALIASES = {
    Gen: 'Genesis', 'Gen.': 'Genesis', Genesis: 'Genesis', Exo: 'Exodus', Ex: 'Exodus', Exodus: 'Exodus', Lev: 'Leviticus', Leviticus: 'Leviticus', Num: 'Numbers', Numbers: 'Numbers', Deut: 'Deuteronomy', Deuteronomy: 'Deuteronomy', Josh: 'Joshua', Joshua: 'Joshua', Judg: 'Judges', Judges: 'Judges', Ruth: 'Ruth', '1 Sam': '1 Samuel', '2 Sam': '2 Samuel', '1 Kgs': '1 Kings', '2 Kgs': '2 Kings', '1 Chr': '1 Chronicles', '2 Chr': '2 Chronicles', Ezra: 'Ezra', Neh: 'Nehemiah', Nehemiah: 'Nehemiah', Esth: 'Esther', Esther: 'Esther', Job: 'Job', Ps: 'Psalms', Psa: 'Psalms', Psalms: 'Psalms', Psalm: 'Psalms', Prov: 'Proverbs', Proverbs: 'Proverbs', Eccl: 'Ecclesiastes', Ecclesiastes: 'Ecclesiastes', 'Song': 'Song of Solomon', 'Song of Sol': 'Song of Solomon', Isa: 'Isaiah', Isaiah: 'Isaiah', Jer: 'Jeremiah', Jeremiah: 'Jeremiah', Lam: 'Lamentations', Lamentations: 'Lamentations', Ezek: 'Ezekiel', Ezekiel: 'Ezekiel', Dan: 'Daniel', Daniel: 'Daniel', Hos: 'Hosea', Hosea: 'Hosea', Joel: 'Joel', Amos: 'Amos', Obad: 'Obadiah', Obadiah: 'Obadiah', Jonah: 'Jonah', Mic: 'Micah', Micah: 'Micah', Nah: 'Nahum', Nahum: 'Nahum', Hab: 'Habakkuk', Habakkuk: 'Habakkuk', Zeph: 'Zephaniah', Zephaniah: 'Zephaniah', Hag: 'Haggai', Haggai: 'Haggai', Zech: 'Zechariah', Zechariah: 'Zechariah', Mal: 'Malachi', Malachi: 'Malachi', Matt: 'Matthew', 'Mt': 'Matthew', Matthew: 'Matthew', Mark: 'Mark', 'Mk': 'Mark', Luke: 'Luke', 'Lk': 'Luke', John: 'John', 'Jn': 'John', Acts: 'Acts', Rom: 'Romans', Romans: 'Romans', '1 Cor': '1 Corinthians', '2 Cor': '2 Corinthians', '1 Corinthians': '1 Corinthians', '2 Corinthians': '2 Corinthians', Gal: 'Galatians', Galatians: 'Galatians', Eph: 'Ephesians', Ephesians: 'Ephesians', Phil: 'Philippians', Philippians: 'Philippians', Col: 'Colossians', Colossians: 'Colossians', '1 Thess': '1 Thessalonians', '2 Thess': '2 Thessalonians', '1 Thessalonians': '1 Thessalonians', '2 Thessalonians': '2 Thessalonians', '1 Tim': '1 Timothy', '2 Tim': '2 Timothy', '1 Timothy': '1 Timothy', '2 Timothy': '2 Timothy', Titus: 'Titus', Philem: 'Philemon', Philemon: 'Philemon', Heb: 'Hebrews', Hebrews: 'Hebrews', James: 'James', Jas: 'James', '1 Pet': '1 Peter', '2 Pet': '2 Peter', '1 Peter': '1 Peter', '2 Peter': '2 Peter', '1 John': '1 John', '2 John': '2 John', '3 John': '3 John', Jude: 'Jude', Rev: 'Revelation', Revelation: 'Revelation',
    '1 Samuel': '1 Samuel', '2 Samuel': '2 Samuel', '1 Kings': '1 Kings', '2 Kings': '2 Kings', '1 Chronicles': '1 Chronicles', '2 Chronicles': '2 Chronicles'
  };
  var KNOWN_LEMMA_TOKENS = ['agape', 'agapē', 'phileo', 'kerygma', 'logos', 'rhema', 'charis', 'pneuma', 'dunamis', 'koinonia', 'metanoia', 'shalom', 'hesed', 'chesed', 'emet', 'ruach', 'nephesh', 'dabar', 'torah', 'mishpat', 'tzedek', 'tsedek', 'eiréné', 'aphesis', 'dikaiosynē', 'sōtēria'];
  var Q_MODES = {
    'deep-study': { family: 'reasoner', maxTokens: 6000, required: ['Anchor', 'anchor', 'Word Study', 'word study', 'Historical', 'historical', 'Scholarly', 'scholarly', 'Theology', 'theology', 'Biblical Thread', 'biblical thread', 'Illustration', 'illustration', 'Application', 'application'], critical: ['Anchor', 'anchor'], markerCount: 8, minLayers: 6 },
    'sunday-message': { family: 'reasoner', maxTokens: 5000, required: ['Title', 'One Truth', 'KEY POINT', 'BACKUP SCRIPTURE', 'WORD STUDY', 'ILLUSTRATION', 'IBIBIO MOMENT', '5-Day', '5-day', 'Altar', 'altar', 'POWER POINTS', 'Closing Prayer', 'closing prayer'], critical: ['One Truth', 'KEY POINT', 'POWER POINTS'], markerCount: 12, minLayers: 8 },
    'sermon-notes': { family: 'chat', maxTokens: 2500, required: ['KEY POINT', 'Backup Scripture', 'backup scripture', '5-Day', '5-day', 'Altar', 'altar', 'POWER POINTS'], critical: ['KEY POINT', 'POWER POINTS'], markerCount: 6, minLayers: 4 },
    'whatsapp-devotional': { family: 'chat', maxTokens: 2000, required: ['DAY ', 'DAY 1', 'DAY 2', 'DAY 3', 'DAY 4', 'DAY 5', 'DAY 6', 'DAY 7', 'ANCHOR SCRIPTURE', 'REVELATION', 'ACTION POINT', 'DECLARATION'], critical: ['ANCHOR SCRIPTURE', 'DAY '], markerCount: 6, minLayers: 4, capWords: 1400 },
    'facebook-posts': { family: 'chat', maxTokens: 1500, required: ['HOOK', 'TENSION', 'REVELATION', 'APPLICATION', 'CLOSE', 'Light Assembly Bible Church'], critical: ['Light Assembly Bible Church'], markerCount: 6, minLayers: 6, capWords: 150 },
    'partner-devotional': { family: 'reasoner', maxTokens: 3500, required: ['ANCHOR SCRIPTURE', 'REVELATION', 'COVENANT PARTNER', 'covenant partner', 'DECLARATION', 'ACTIVATION'], critical: ['ANCHOR SCRIPTURE', 'DECLARATION'], markerCount: 5, minLayers: 4 },
    'prayer-guide': { family: 'chat', maxTokens: 2500, required: ['Worship', 'worship', 'Declaration', 'declaration', 'Closing Prayer', 'closing prayer', 'Prayer', 'prayer'], critical: ['worship', 'Closing Prayer', 'closing prayer'], markerCount: 4, minLayers: 3 },
    'morning-brief': { family: 'chat', maxTokens: 1200, required: ['Scripture', 'scripture', 'Shepherd', 'shepherd', 'TODAY', 'Growth', 'growth', 'Cultural', 'cultural', 'Declaration', 'declaration'], critical: ['Scripture', 'Shepherd', 'shepherd'], markerCount: 5, minLayers: 3, capWords: 400 }
  };
  var VERSE_RE = /([123]?\s?[A-Za-z]+(?:\s+[A-Za-z]+)*?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/g;
  var LIB_CITE_RE = /\(from library:\s*"([^"]+)"\)|\(per:\s*([^)]+)\)/gi;
  var THINKING_OPEN_RE = /<thinking>/g;
  var THINKING_RE = /<thinking>[\s\S]*?<\/thinking>/gi;
  var TRAINING_ONLY_RE = /training-only/i;
  var UNVERIFIED_RE = /\[unverified[^\]]*\]/i;
  var LEXICON_PRESENT_RE = /(?:[\u0370-\u03ff\u0590-\u05ff]|[a-zA-Z]+)[^A-Za-z]{0,3}[=:]\s*["“]?[A-Za-z][^"”)]{0,40}/;

  function wordCount(str) { var t = String(str || '').replace(/\s+/g, ' ').trim(); return t ? t.split(' ').length : 0; }
  function hasAny(hay, needles) { return needles.some(function (n) { return String(hay || '').toLowerCase().indexOf(String(n).toLowerCase()) !== -1; }); }
  function layerCount(output, mode) { var req = Q_MODES[mode] ? Q_MODES[mode].required : []; var c = 0; for (var i = 0; i < req.length; i++) { if (String(output || '').toLowerCase().indexOf(String(req[i]).toLowerCase()) !== -1) c++; } return c; }

  function verifyVerses(output) {
    var bad = [], raw = String(output || ''), m, seen = {};
    VERSE_RE.lastIndex = 0;
    while ((m = VERSE_RE.exec(raw)) !== null) {
      var bookRaw = m[1].trim().replace(/\s+/g, ' ').replace(/^([123])([A-Za-z])/i, '$1 $2');
      var ch = parseInt(m[2], 10), v = parseInt(m[3], 10), vEnd = m[4] ? parseInt(m[4], 10) : v;
      var key = bookRaw + '|' + ch;
      if (seen[key]) continue; seen[key] = 1;
      var canonical = BOOK_ALIASES[bookRaw];
      if (!canonical || !BOOK_CHAPTERS[canonical]) { bad.push(bookRaw + ' ' + ch + ':' + v + ' (unknown book)'); continue; }
      if (ch < 1 || ch > BOOK_CHAPTERS[canonical]) { bad.push(bookRaw + ' ' + ch + ':' + v + ' (chapter out of range — max ' + BOOK_CHAPTERS[canonical] + ')'); continue; }
      if (v < 1 || vEnd < v) { bad.push(bookRaw + ' ' + ch + ':' + v + ' (bad verse form)'); continue; }
    }
    return { ok: bad.length === 0, badRefs: bad };
  }

  function verifyCitations(output, context) {
    var issues = [], raw = String(output || ''), ctx = context || {};
    var libItems = (ctx.library && ctx.library.items) || [];
    var netResults = (ctx.internet && ctx.internet.results) || [];
    var allTitles = [];
    libItems.forEach(function (it) { allTitles.push(((it && (it.title || it.item && it.item.title)) || '').toLowerCase()); });
    netResults.forEach(function (r) { allTitles.push(String((r && (r.title || r.url || '')) || '').toLowerCase()); });
    var hasContent = libItems.length > 0;
    var hasInternet = netResults.length > 0;
    var srcEmpty = !hasContent && !hasInternet;
    var citeMatch;
    LIB_CITE_RE.lastIndex = 0;
    while ((citeMatch = LIB_CITE_RE.exec(raw)) !== null) {
      var cited = (citeMatch[1] || citeMatch[2] || '').trim().toLowerCase();
      if (srcEmpty) { issues.push({ blocking: true, msg: 'Citation "' + citeMatch[0] + '" present but sources were empty (training-only required)' }); continue; }
      var found = allTitles.some(function (t) { return t && (t.indexOf(cited) !== -1 || cited.indexOf(t) !== -1); });
      if (!found) issues.push({ blocking: true, msg: 'Fabricated citation: "' + citeMatch[0] + '" does not match any context source' });
    }
    if (srcEmpty && String(output || '').trim().length > 0 && !TRAINING_ONLY_RE.test(raw)) {
      issues.push({ blocking: true, msg: 'No library/internet sources loaded — response must be labeled training-only' });
    }
    return { issues: issues };
  }

  function checkLexicon(output) {
    var raw = String(output || '');
    for (var i = 0; i < KNOWN_LEMMA_TOKENS.length; i++) {
      var token = KNOWN_LEMMA_TOKENS[i];
      var re = new RegExp('\\b' + token + '\\b', 'i');
      if (re.test(raw) && !LEXICON_PRESENT_RE.test(raw)) {
        return [{ blocking: false, weight: 8, msg: 'Original-language term "' + token + '" present without inline translation (verify)' }];
      }
    }
    return [];
  }

  function checkUnverifiedNumericClaims(output) {
    var raw = String(output || '');
    var figRe = /(?:\$\s?\d[\d,]*|(?:^|\s)\d{2,}(?:\.\d+)?%|attend|attendance\s+of\s+\d+|raised\s+\$\d)/i;
    if (figRe.test(raw) && !UNVERIFIED_RE.test(raw)) {
      return [{ blocking: false, weight: 8, msg: 'Numeric/statistical claim present without [unverified] flag (QG1.4)' }];
    }
    return [];
  }

  function checkThinking(output, mode) {
    var raw = String(output || '');
    var family = Q_MODES[mode] ? Q_MODES[mode].family : 'chat';
    var opens = (raw.match(THINKING_OPEN_RE) || []).length;
    if (family === 'chat') {
      if (opens > 0) return [{ blocking: true, msg: '<thinking> present in chat mode "' + mode + '" — must be zero (QG5)' }];
      return [];
    }
    var issues = [];
    if (opens > 1) issues.push({ blocking: false, weight: 12, msg: 'Reasoner mode has ' + opens + ' <thinking> blocks — expected at most one' });
    var m; THINKING_RE.lastIndex = 0;
    while ((m = THINKING_RE.exec(raw)) !== null) { var b = m[0]; if (b.split('\n').length > 8 || b.length > 600) issues.push({ blocking: false, weight: 10, msg: 'A <thinking> block is too long — should be a few lines' }); }
    return issues;
  }

  var FOREIGN_MARKERS = {
    'whatsapp-devotional': ['POWER POINTS', '5-Day', '5-day', 'Altar Call'],
    'facebook-posts': ['POWER POINTS', '5-Day', '5-day', 'KEY POINT', 'IBIBIO MOMENT'],
    'morning-brief': ['POWER POINTS', '5-Day', '5-day'],
    'sermon-notes': ['TENSION', 'CLOSE'],
    'deep-study': ['CLOSE', 'HOOK']
  };

  function checkFormat(output, mode) {
    var raw = String(output || '');
    var issues = [];
    if (!raw.trim()) return issues;
    var doctrine = Q_MODES[mode];
    if (!doctrine) { issues.push({ blocking: false, weight: 8, msg: 'Unknown mode "' + mode + '" — cannot verify format' }); return issues; }
    var count = layerCount(output, mode);
    if (count < doctrine.minLayers) issues.push({ blocking: false, weight: 10, msg: 'Mode "' + mode + '" missing required structure markers (' + count + '/' + doctrine.minLayers + '+ found)' });
    var critical = doctrine.critical || [];
    var missing = critical.filter(function (m) { return String(output || '').toLowerCase().indexOf(String(m).toLowerCase()) === -1; });
    if (missing.length) issues.push({ blocking: true, msg: 'Mode "' + mode + '" missing critical marker: ' + missing.join(', ') });
    var foreigners = FOREIGN_MARKERS[mode] || [];
    if (foreigners.length && hasAny(raw, foreigners)) issues.push({ blocking: false, weight: 8, msg: 'Cross-mode marker bleed: "' + mode + '" contains ' + foreigners.filter(function (f) { return raw.toLowerCase().indexOf(f.toLowerCase()) !== -1; }).join(', ') });
    if (doctrine.capWords) { var wc = wordCount(raw); if (wc > doctrine.capWords) { if (wc > doctrine.capWords * 1.1) issues.push({ blocking: true, msg: 'Mode "' + mode + '" far over length cap (' + wc + ' words > ' + doctrine.capWords + ' — format violation)' }); else issues.push({ blocking: false, weight: 10, msg: 'Mode "' + mode + '" over length cap (' + wc + ' words > ' + doctrine.capWords + '±)' }); } }
    return issues;
  }

  function checkEthics(output) {
    var raw = String(output || ''), issues = [];
    if (/(?:Akwa Ibom|Uyo|Ikot Ambon)\s+(?:church)\s+(?:of\s+)?\d+/i.test(raw)) issues.push({ blocking: false, weight: 8, msg: 'Specific local statistic claimed — confirm before publish (QG6)' });
    if (/(?:urgently\s+need|please\s+give\s+now|send\s+(?:your\s+)?(?:offering|seed)\s+now)/i.test(raw)) issues.push({ blocking: false, weight: 8, msg: 'Tone leans toward solicitation/manipulation (QG6)' });
    return issues;
  }

  /** validateOutput(output, mode, context) -> { pass, issues, score } */
  function validateOutput(output, mode, context) {
    try {
      var out = String(output == null ? '' : output);
      var ctx = context || {};
      var modeKey = mode || 'sunday-message';
      var basket = [];
      var verses = verifyVerses(out);
      if (!verses.ok) verses.badRefs.slice(0, 5).forEach(function (r) { basket.push({ blocking: true, msg: 'Impossible verse reference: ' + r }); });
      var cites = verifyCitations(out, ctx);
      cites.issues.forEach(function (i) { basket.push(i); });
      checkThinking(out, modeKey).forEach(function (i) { basket.push(i); });
      checkLexicon(out).forEach(function (i) { basket.push(i); });
      checkUnverifiedNumericClaims(out).forEach(function (i) { basket.push(i); });
      checkFormat(out, modeKey).forEach(function (i) { basket.push(i); });
      checkEthics(out).forEach(function (i) { basket.push(i); });
      var blocking = basket.filter(function (i) { return i.blocking; });
      var soft = basket.filter(function (i) { return !i.blocking; });
      var score = PERFECT;
      soft.forEach(function (s) { var w = Math.min(typeof s.weight === 'number' ? s.weight : 10, MAX_SOFT_WEIGHT); score -= w; });
      score = Math.max(0, score);
      var issues = basket.map(function (i) { return (i.blocking ? '[blocking] ' : '[soft] ') + i.msg; });
      var pass = blocking.length === 0 && score >= PASS_THRESHOLD;
      try { console.warn('[MINOS:q5] validateOutput(mode=' + modeKey + ') → pass=' + pass + ' score=' + score + ' blocking=' + blocking.length + ' soft=' + soft.length); } catch (e) {}
      return { pass: pass, issues: issues, score: score };
    } catch (err) {
      return { pass: false, issues: ['[internal] quality check error (safe-fail)'], score: 0 };
    }
  }

  /* ===================================================================== *
   * 7) LEARNING — read-only snapshot (port of learning-engine getProfile)
   * ===================================================================== */
  function safeJSONParse(raw, fb) { try { return raw ? JSON.parse(raw) : fb; } catch (e) { return fb; } }
  function readProfile() {
    var raw = readLocal('minos_learning_profile');
    return safeJSONParse(raw, null);
  }

  /* ===================================================================== *
   * 8) BOUNDED RETRY — rebuild step for assembleContext + prompt.
   * ===================================================================== */
  var MAX_RETRIES = 2;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /**
   * prepareChat(query, modeHint?) — the shim's main entry.
   * Runs RAG → Router → Prompt in-process and returns the assembly needed for
   * the DeepSeek call. Never throws; on total failure falls back to v1 buildSYS.
   */
  function prepareChat(query, modeHint, attempt) {
    attempt = attempt || 0;
    var t0 = Date.now();
    return new Promise(function (resolve) {
      try {
        // Host globals (v1 app): live library + original system prompt.
        var hostItems = root.MINOS_ITEMS || (root.items && typeof root.items === 'object' ? root.items : {});
        var hostSystem = null;
        try { if (typeof root.buildSYS === 'function') hostSystem = root.buildSYS(); } catch (e) {}

        var ctx = assembleContext(query, modeHint, { items: hostItems, systemBase: hostSystem });
        var mode = resolveMode(modeHint, query);
        var cfg = MODE_CONFIG.modes[mode];
        var profile = readProfile();
        var sys = buildSystemPrompt(mode, ctx.sources, profile);
        var model = ctx.sources.config && ctx.sources.config.model ? ctx.sources.config.model : ((cfg && cfg.model) || 'deepseek-chat');

        // Fallback flag: if no library/internet made it in, we're training-only.
        var used = ctx.sources.used || [];
        var fallback = used.length === 0 || used.indexOf('trainingOnly') !== -1;

        resolve({
          systemPrompt: sys,
          mode: mode,
          model: model,
          context: ctx.sources,
          used: used,
          fallback: fallback,
          attempt: attempt,
          assemblyMs: Date.now() - t0
        });
      } catch (err) {
        // Bounded retry before hard fallback.
        if (attempt < MAX_RETRIES) {
          try { console.warn('[MINOS:adapter] prepareChat attempt ' + attempt + ' failed, retrying', err && err.message || err); } catch (e) {}
          setTimeout(function () {
            prepareChat(query, modeHint, attempt + 1).then(resolve);
          }, 20);
          return;
        }
        // Total failure → v1 fallback (identical prompt shape → zero regression).
        var legacy = '';
        try { if (typeof root.buildSYS === 'function') legacy = root.buildSYS(); } catch (e) {}
        if (!legacy) legacy = 'You are MINOS, ministry assistant for Rev. Emmanuel Udoh.';
        resolve({
          systemPrompt: legacy,
          mode: resolveMode(modeHint, query),
          model: 'deepseek-chat',
          context: { used: ['trainingOnly'], library: { items: [] }, internet: { results: [] } },
          used: ['trainingOnly'], fallback: true, attempt: attempt, assemblyMs: Date.now() - t0,
          error: err && err.message || String(err)
        });
      }
    });
  }

  /** Bounded-retry wrapper exposed for tests + future quality loops. */
  function retryPrompt(query, mode, attempt) {
    return prepareChat(query, mode, typeof attempt === 'number' ? attempt : 0);
  }

  /** Diagnostics for the regression harness. */
  function diag() {
    return {
      modes: KNOWN_MODES,
      promptModules: Object.keys(PROMPT_MODULES),
      embeddedBytes: JSON.stringify(PROMPT_MODULES).length,
      version: '2.0.0'
    };
  }

  /* ===================================================================== *
   * 9) Public surface
   * ===================================================================== */
  var api = {
    prepareChat: prepareChat,
    retryPrompt: retryPrompt,
    validate: validateOutput,
    resolveMode: resolveMode,
    assembleContext: assembleContext,
    buildSystemPrompt: buildSystemPrompt,
    readProfile: readProfile,
    diag: diag,
    // Test/underscore hooks (mirror the v2 module's _-exports).
    _rag: ragSearch,
    _buildLibContext: buildLibContext,
    _validate: validateOutput,
    _PROMPT_MODULES: PROMPT_MODULES,
    _MODE_CONFIG: MODE_CONFIG,
    _internal: { resolveMode: resolveMode, ragSearch: ragSearch, internetSearch: internetSearch }
  };

  root.MINOSV2 = api;

  // Announce availability to any listener (door-sync uses this).
  try {
    if (typeof root.dispatchEvent === 'function') {
      root.dispatchEvent(new root.Event('minosv2:ready'));
    }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
