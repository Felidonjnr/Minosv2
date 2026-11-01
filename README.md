# MINOS — Ministry Intelligence & Operational System

**Light Assembly Bible Church · Ikot Ambon, Akwa Ibom State, Nigeria**  
*Serving Rev. Emmanuel Udoh*

MINOS is an advanced church pastoral assistant and operational dashboard rewritten in **React, TypeScript, and Vite** with Tailwind CSS styling.

---

## Features

1. **💬 Conversational Ministry Intelligence (Chat with MINOS)**
   - Tailored system prompt respecting Light Assembly's identity, Akwa Ibom context, and Rev. Emmanuel Udoh's voice.
   - Intelligent DeepSeek model routing (`deepseek-reasoner` for theological deep studies, Greek/Hebrew studies, and Sunday messages; `deepseek-chat` for devotionals, social posts, and quick briefs).
   - High-fidelity offline and local pastoral generator for preview and zero-delay prototyping.
   - Quick prompts: Morning Brief, Deep Study (8 scholarly layers), Sunday Preaching Guide, Pulpit Notes, WhatsApp 7-Day Devotional, Facebook Posts, Partner Devotional, Prayer Guide, Greek & Hebrew Studies, Scholars Analysis, Theological Frameworks.
   - Smart Context forms for tailored content parameters.
   - Daily Pastoral Rhythm recommendation banner based on current day of the week.

2. **💼 Pastor Hub (Pastor Command Centre)**
   - **Sermon Planner:** Plan title, text, date, and pastoral outcomes; save and "Build with MINOS" directly into chat.
   - **Prayer & Follow-up:** Private pastoral care, prayer requests, counseling, and visitation tracking with completion toggles.
   - **Ministry Week:** Calendar rhythm (Sunday Workers Class & Service, Wednesday Prayer, Thursday Word & Communion, Friday Prayer, Saturday Outreach) and custom events.
   - **House Memory:** Church vision, doctrinal boundaries, sermon series, preaching style, and seasonal goals injected into every AI response.
   - **Content Studio:** Generates complete coordinated ministry packs across WhatsApp, Facebook, Prayer, and Partner channels from one sermon or scripture.

3. **📚 Library Archive & RAG Memory**
   - Color-coded category stripes and badges (Sermon, Pulpit Notes, WhatsApp, Facebook, Partner, Prayer, Deep Study, Other).
   - Real-time search by keyword, title, or scripture text with category filter counts.
   - Instant RAG integration: Automatically searches library items to enrich subsequent generations with saved sermons and church context.
   - Supabase PostgreSQL cloud sync + offline localStorage persistence.

4. **📖 Read View & Voice Read Aloud**
   - Fullscreen reader with serif typography and markdown styling.
   - Voice Read Aloud with Google Cloud TTS and browser Web Speech API fallback with play, pause, resume, and stop controls.
   - Single-tap Copy (with markdown stripped) and Web Share API.

5. **⚙️ Settings & Dynamic Directives**
   - DeepSeek API key and Google Cloud TTS key configuration.
   - Real-time API cost tracker (per generation and cumulative session total).
   - Live AI prompt updater: pastor can add custom instructions that dynamically augment MINOS intelligence.

---

## Development & Build

- **Start dev server:** `npm run dev` (Listens on port 3000, host `0.0.0.0`)
- **Type check & Build:** `npm run build`
- **Lint:** `npm run lint`
