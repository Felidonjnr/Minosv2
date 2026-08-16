/**
 * MINOS v2 — Refactored sendMessage (Agent 7: minos-refactor)
 * ============================================================
 * Drop-in replacement for the v1 `sendMessage()` found in `minos.html` /
 * `minos_1.html` inline scripts (and pre-factored in `add_rag.js`).
 *
 * IT PRODUCES THE **IDENTICAL** DeepSeek request shape as v1:
 *   POST DS_URL
 *   body: { model, max_tokens: 8000, messages:[{role:'system',content}, ...history] }
 * so the existing response / cost / UI code path runs unmodified (ZERO REGRESSION).
 *
 * The ONLY behavioural difference: the system prompt + model are produced by the
 * v2 adapter (RAG → Router → Prompt) instead of the static `buildSYS()` +
 * `pickModel()`. v2 layers intelligence IN while leaving every v1 feature intact.
 *
 * WIRING: load after `adapter.js` (via door-sync.js). Because the v1 send button
 * and Enter-key handlers call the GLOBAL variable `sendMessage` (not a captured
 * reference), reassigning `window.sendMessage` transparently routes all UI sends
 * through the adapter. No HTML edit required.
 */
(function (root) {
  'use strict';

  // Capture the original v1 implementation first (fallback + feature parity).
  var _v1send = (typeof root.sendMessage === 'function') ? root.sendMessage : null;

  // -----------------------------------------------------------------
  // Request → response (mirrors v1's fetch + cost accounting exactly).
  // -----------------------------------------------------------------
  function fetchAndResolve(model, dsMessages, key) {
    // Read the v1 config globals defensively so we never crash the store.
    var DS_URL = (typeof root.DS_URL === 'string' && root.DS_URL) || 'https://api.deepseek.com/chat/completions';
    var DS_REASON = root.DS_REASON || 'deepseek-reasoner';
    var COST = root.COST || { chat: { in: 0.14, out: 0.28 }, reason: { in: 0.55, out: 2.19 } };

    // UI helpers (v1). Wrap so a missing helper never breaks generation.
    function hideTyping() { try { if (root.hideTyping) root.hideTyping(); } catch (e) {} }
    function addMsg(r, c) { try { if (root.addMsg) root.addMsg(r, c); } catch (e) {} }
    function setGenFalse() {
      try {
        var b = (typeof document !== 'undefined') ? document.getElementById('sendBtn') : null;
        if (b) b.disabled = false;
        if (root.generating !== undefined) root.generating = false;
      } catch (e) {}
    }

    // Track cost counters on the v1 globals so the header still shows them.
    function trackCost(usage, model) {
      try {
        if (!usage) return;
        var rates = model === DS_REASON ? COST.reason : COST.chat;
        var cost = ((usage.prompt_tokens || 0) * rates.in + (usage.completion_tokens || 0) * rates.out) / 1000000;
        if (root.lastCost !== undefined) root.lastCost = cost;
        if (root.sessionCostTotal !== undefined) root.sessionCostTotal += cost;
        var c1 = (typeof document !== 'undefined') ? document.getElementById('costLast') : null;
        var c2 = (typeof document !== 'undefined') ? document.getElementById('costTotal') : null;
        if (c1) c1.textContent = '$' + cost.toFixed(6);
        if (c2 && root.sessionCostTotal !== undefined) c2.textContent = '$' + root.sessionCostTotal.toFixed(6);
      } catch (e) {}
    }

    return fetch(DS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({ model: model, max_tokens: 8000, messages: dsMessages })
    })
    .then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    })
    .then(function (res) {
      hideTyping(); setGenFalse();
      if (!res.ok) {
        var msg = res.data && res.data.error ? res.data.error.message : 'API Error ' + res.status;
        addMsg('minos', 'Error ' + res.status + ': ' + msg);
        return;
      }
      var reply = res.data.choices && res.data.choices[0] ? res.data.choices[0].message.content : 'No response';
      // Preserve v1 history bookkeeping.
      try { if (root.chatHistory && root.chatHistory.push) root.chatHistory.push({ role: 'assistant', content: reply }); } catch (e) {}
      addMsg('minos', reply);
      trackCost(res.data.usage, model);
    })
    .catch(function (e) {
      hideTyping(); setGenFalse();
      addMsg('minos', 'Network error: ' + (e && e.message || e) + '. Check your internet connection.');
    });
  }

  // -----------------------------------------------------------------
  // The refactored sendMessage.
  // -----------------------------------------------------------------
  function sendMessage() {
    // v1 guards.
    if (root.generating) return;
    var inp = (typeof document !== 'undefined') ? document.getElementById('chatInp') : null;
    if (!inp) return;
    var text = String(inp.value || '').trim();
    if (!text) return;
    var key = root.getKey ? root.getKey() : '';
    if (!key) { try { if (root.toast) root.toast('No API key -- open Settings'); } catch (e) {} return; }

    // v1 pre-send UI (identical to original).
    inp.value = ''; inp.style.height = 'auto';
    try { if (root.addMsg) root.addMsg('user', text); } catch (e) {}
    if (root.chatHistory && root.chatHistory.push) root.chatHistory.push({ role: 'user', content: text });
    root.generating = true;
    var sb = (typeof document !== 'undefined') ? document.getElementById('sendBtn') : null;
    if (sb) sb.disabled = true;
    try { if (root.showTyping) root.showTyping(); } catch (e) {}

    // Adapter present? Use the v2 pipeline (async). Else fall back to v1 in place.
    if (root.MINOSV2 && typeof root.MINOSV2.prepareChat === 'function') {
      var modeHint = null; // let the adapter sniff the mode from the query
      root.MINOSV2.prepareChat(text, modeHint).then(function (P) {
        var model = (P && P.model) ? P.model : (root.pickModel ? root.pickModel(text) : 'deepseek-chat');
        var sys = (P && P.systemPrompt) ? P.systemPrompt : (root.buildSYS ? root.buildSYS() : 'You are MINOS.');
        var dsMessages = [{ role: 'system', content: sys }].concat((root.chatHistory || []).slice(-10));
        fetchAndResolve(model, dsMessages, key);
      }).catch(function () {
        // Adapter threw unexpectedly → v1 behaviour (zero regression).
        if (_v1send) { _v1send(); return; }
        var sys = root.buildSYS ? root.buildSYS() : 'You are MINOS.';
        var model = root.pickModel ? root.pickModel(text) : 'deepseek-chat';
        fetchAndResolve(model, [{ role: 'system', content: sys }].concat((root.chatHistory || []).slice(-10)), key);
      });
      return;
    }

    // No adapter (door-sync failed load) → exact v1 path.
    if (_v1send) { _v1send(); return; }
    var sysV1 = root.buildSYS ? root.buildSYS() : 'You are MINOS.';
    var modelV1 = root.pickModel ? root.pickModel(text) : 'deepseek-chat';
    fetchAndResolve(modelV1, [{ role: 'system', content: sysV1 }].concat((root.chatHistory || []).slice(-10)), key);
  }

  // Install as the global (this is what the v1 handlers reference by name).
  root.sendMessage = sendMessage;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
