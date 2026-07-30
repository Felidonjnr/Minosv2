# MINOS Update Plan — v2.0

**Light Assembly Bible Church | Rev. Emmanuel Udoh**

**Goal:** The best church AI assistant in the world. MINOS should pull from saved library content AND the open internet to deliver the best results possible — mode-aware, context-rich, referenced.

---

## What Stays (UI)

- Navy + gold theme, two-door landing page, chat UI, library page, read view, save modal, settings, Firebase sync, Google TTS Read Aloud — **untouched**

---

## Core Features

### 1. 🔥 REBUILD Series — Already Done ✅
- Removed hardcoded series name from system prompt
- Kept structural references (needTopic, pickModel, Layer 8 series context) — now generic

### 2. 📚 RAG — Library-Aware (Your Saved Content)
Before every AI call, search the church's Firebase Library for relevant saved items and inject them as context.

### 3. 🌐 Internet Search — Open Church Resources
This is the big new piece. MINOS should search the web for the best church resources depending on what mode the pastor is in.

**How it works:**
- Before the AI call, run a web search for the query
- Inject the best results into the context alongside library items
- The AI now has: **your saved sermons + internet resources + its own training**

**What to search by mode:**

| Mode | What to search for |
|------|-------------------|
| **Deep Study** | Scholarly commentaries, Greek/Hebrew lexicons, theological papers, seminary resources, Bible dictionaries, academic articles on the passage |
| **Sunday Message** | Sermon outlines on the topic, historical/cultural context, illustrations, related scripture passages |
| **Sermon Notes** | Commentary highlights, key themes scholars have identified, preaching resources |
| **WhatsApp Devotional** | Daily devotional resources, relatable stories/illustrations, short-form theological insights |
| **Facebook Posts** | Viral Christian content patterns, topical Bible teachings, engagement hooks |
| **Partner Devotional** | Covenant/partnership teaching, stewardship scriptures, prophetic devotionals |
| **Prayer Guide** | Prayer movements, scripture-based prayer patterns, revival resources |
| **Morning Brief** | Today's church calendar connections, current Christian observances |

**Open-source resources to reference:**
- Bible APIs (passage lookup, cross-references, word studies)
- Public commentaries (Matthew Henry, etc. — public domain)
- Theological dictionaries (public domain)
- Bible encyclopedias
- Original language tools (Strong's Concordance, Greek/Hebrew lexicons)

**Implementation approach (static HTML, no backend):**
- Use a search API (Brave Search, Google CSE, etc.) — search results injected into context
- Bible API integration for scripture lookups
- All searches happen client-side before the AI call
- Results are injected into the system prompt as: "INTERNET RESOURCES FOUND: ..."

### 4. 🧠 Learning Over Time
Track usage patterns to personalize recommendations.

### 5. 🏆 Fable-Class Output (Even on DeepSeek)
Chain-of-thought pre-processing, modular system prompt, DeepSeek-optimized variant, output quality checks.

---

## Updated Build Order

| Phase | What | Time |
|-------|------|------|
| ✅ 1 | REBUILD removal | Done |
| **2** | **RAG — Firebase Library search (local content)** | **~1 hr** |
| **3** | **Internet search — search API + Bible API integration** | **~1.5 hrs** |
| **4** | **Mode-aware routing — different search strategies per mode** | **~1 hr** |
| 5 | Prompt architecture — modular system prompt + reasoning layers | ~1 hr |
| 6 | Learning system — usage tracking + personalized recommendations | ~1.5 hrs |
| 7 | Quality optimization — DeepSeek-specific, output checks | ~1 hr |
| 8 | Code cleanup — refactor, comments, sync both doors | ~30 min |
| **Total** | | **~7.5 hrs** |

---

## What NOT To Do

- ❌ Don't change the UI/layout
- ❌ Don't touch Firebase schema — existing data must survive
- ❌ Don't add a backend server — keep it static HTML
- ❌ Don't add complex auth — localStorage API key approach is fine
- ❌ Don't break Read Aloud, Library, Save, Sync, Share, Copy
