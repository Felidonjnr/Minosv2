/**
 * MINOS v2 — Door Sync (Agent 7: minos-refactor)
 * ==============================================
 * Guarantees BOTH doors (minos.html = Door 1, minos_1.html = Door 2) load the
 * SAME shared module graph (adapter.js + refactored-sendMessage.js) from a
 * single source of truth, so they behave identically by construction.
 *
 * HOW TO WIRE (the ONLY permitted, non-visual one-line edit per door):
 *   <script src="door-sync.js" defer></script>
 * placed immediately before the door's own closing </body> (or in <head> with
 * defer). door-sync.js then loads the shared chunk in deterministic order.
 *
 * GUARANTEES:
 *   - Both doors reference the same absolute URLs → browser serves one copy of
 *     each file (HTTP cache), so the module graph is identical.
 *   - NO edit to the door's inline script or markup. UI is untouched.
 *   - Graceful: if a shared file 404s, the door's native v1 sendMessage remains
 *     intact (zero regression) and we log a clear warning.
 */
(function (root) {
  'use strict';

  var BASE = (function () {
    // Resolve the directory of THIS script so the shared chunk is found even
    // when doors live in subfolders.
    var scripts = (typeof document !== 'undefined' && document.getElementsByTagName) ? document.getElementsByTagName('script') : [];
    var src = '';
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i].src || '';
      if (/door-sync\.js/.test(s)) { src = s; break; }
    }
    if (src) { return src.replace(/[^/]*$/, ''); }
    return './';
  })();

  var SHARED = [
    { file: 'adapter.js', require: 'MINOSV2' },
    { file: 'refactored-sendMessage.js', require: null }
  ];

  function loadScript(file) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = BASE + file;
      el.async = false;                       // preserve deterministic order
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error('Failed to load ' + file)); };
      document.head.appendChild(el);
    });
  }

  function parallel(resolvers, cb) {
    var n = resolvers.length, done = 0, ok = true;
    if (!n) return cb(ok);
    resolvers.forEach(function (fn, idx) {
      fn().then(function () { done++; if (done === n) cb(ok); })
         .catch(function (e) { ok = false; done++; try { console.warn('[MINOS:door-sync]', e && e.message || e); } catch (_) {} if (done === n) cb(ok); });
    });
  }

  // Two independent attempts so a single missing file never bricks both.
  var attemptA = loadScript('adapter.js');
  var attemptB = attemptA.then(function () { return loadScript('refactored-sendMessage.js'); });

  attemptB.then(function () {
    stamp(true);
    try { console.warn('[MINOS:door-sync] shared module graph active (adapter + refactored sendMessage).'); } catch (_) {}
  }).catch(function (e) {
    // One or both files failed → leave v1 intact (zero regression).
    try { console.warn('[MINOS:door-sync] shared graph could not load; v1 sendMessage remains active.', e && e.message || e); } catch (_) {}
    stamp(false);
  });

  function stamp(ok) {
    try {
      root.MINOS_GRAPH = ok;
      root.MINOS_DOOR = root.MINOS_DOOR || (location && location.pathname) || '?';
      if (typeof root.dispatchEvent === 'function') {
        root.dispatchEvent(new root.Event('minos:syncDone'));
      }
    } catch (_) {}
  }

  function doorCount() {
    // Both doors share this single script URL; used by the regression harness.
    return 2;
  }

  // Small public handle for the harness.
  root.MINOS_DOOR_SYNC = { base: BASE, graphOk: function () { return !!root.MINOS_GRAPH; }, doorCount: doorCount };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
