/**
 * MINOS v2 — Recommendation Widget
 * ---------------------------------
 * UI component for the "Recommended for you" panel on the Library page.
 * Reads the Learning Engine profile (localStorage only — zero external calls)
 * and renders preferred sources, modes and topics. Includes a privacy-friendly
 * "Clear my data" button that wipes the learned profile.
 *
 * Contract: ES module. Single default export object. Mount is idempotent and
 * safe to call multiple times (re-renders in place).
 *
 * Log prefix: [MINOS:learning:widget]
 */

import learningEngine from "./learning-engine.js";

const LOG = "[MINOS:learning:widget]";
const DEFAULT_MOUNT_ID = "minos-recommendations";

const MODE_LABELS = {
  "deep-study": "Deep Study",
  "sunday-message": "Sunday Message",
  "sermon-notes": "Sermon Notes",
  "whatsapp-devotional": "WhatsApp Devotional",
  "facebook-posts": "Facebook Posts",
  "partner-devotional": "Partner Devotional",
  "prayer-guide": "Prayer Guide",
  "morning-brief": "Morning Brief",
};

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function section(title, items, max = 6) {
  if (!items || !items.length) return "";
  const list = items
    .slice(0, max)
    .map((i) => `<li>${esc(i)}</li>`)
    .join("");
  return `<div class="minos-rec-section"><h4>${esc(title)}</h4><ul>${list}</ul></div>`;
}

/** Build the widget's inner HTML from the engine profile. */
function renderInner() {
  try {
    const profile = learningEngine.getProfile();
    if (!profile || profile.error) {
      return `<p class="minos-rec-empty">Learning data unavailable right now.</p>`;
    }
    const recs = profile.recommendations || {};

    if (!recs.ready || recs.interactionCount < 1) {
      return (
        `<p class="minos-rec-empty">Keep using MINOS and I'll learn what helps you most` +
        ` (${learningEngine.PROFILE_READY_THRESHOLD} interactions to warm up).</p>`
      );
    }

    return (
      section("Preferred sources", recs.preferredSources) +
      section("Go-to modes", recs.preferredModes.map((m) => MODE_LABELS[m] || m)) +
      section("Topics you engage with", recs.preferredTopics, 8) +
      `<p class="minos-rec-meta">Based on <strong>${esc(recs.interactionCount)}</strong> interactions.</p>`
    );
  } catch (e) {
    console.warn(LOG, "render failed —", e.message);
    return `<p class="minos-rec-empty">Couldn't load recommendations.</p>`;
  }
}

/**
 * Mount the widget into an element (by id or element).
 * Clear button wipes the learning profile in place (privacy).
 */
function mount(target, opts = {}) {
  const mountId = opts.mountId || DEFAULT_MOUNT_ID;
  let root =
    typeof target === "string"
      ? document.getElementById(target)
      : target ||
        document.getElementById(mountId) ||
        (() => {
          const el = document.createElement("div");
          el.id = mountId;
          const host = document.querySelector(opts.insertBefore || "main") ||
            document.body;
          host.appendChild(el);
          return el;
        })();

  if (!root) {
    console.warn(LOG, "no mount node found (id=" + mountId + ") — skipping");
    return { ok: false, reason: "no-mount-node" };
  }

  root.classList.add("minos-rec-widget");
  root.innerHTML = `
    <div class="minos-rec-head">
      <h3>Recommended for you</h3>
      <button type="button" class="minos-rec-clear" data-action="clear">Clear my data</button>
    </div>
    <div class="minos-rec-body">${renderInner()}</div>
  `;

  // Wire clear button (redundancy-safe via event delegation on the root).
  const clearBtn = root.querySelector("[data-action='clear']");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const res = learningEngine.clearData();
      root.querySelector(".minos-rec-body").innerHTML =
        `<p class="minos-rec-empty">Your learning data has been cleared. Nothing personal was stored.</p>`;
      console.warn(LOG, "learning data cleared (" + (res.clearedInteractions || 0) + " interactions removed)");
      // Re-render to show empty/warm state.
      setTimeout(() => {
        root.querySelector(".minos-rec-body").innerHTML = renderInner();
      }, 600);
    });
  }

  return { ok: true };
}

/** Convenience: programmatic re-render (e.g. after a new interaction). */
function refresh(root) {
  const body = root && root.querySelector
    ? root.querySelector(".minos-rec-body")
    : document.querySelector("#" + DEFAULT_MOUNT_ID + " .minos-rec-body");
  if (body) body.innerHTML = renderInner();
  return !!body;
}

const recommendationWidget = {
  mount,
  refresh,
  renderInner,
  DEFAULT_MOUNT_ID,
  LOG,
};

export default recommendationWidget;