import { ChatMessage, HouseMemory, LibraryItem } from '../types/minos';
import { buildSystemPrompt } from './systemPrompt';
import { buildLibraryContext } from './ragEngine';

export const DS_CHAT = 'deepseek-chat';
export const DS_REASON = 'deepseek-reasoner';

export const COST = {
  chat: { in: 0.14, out: 0.28 },
  reason: { in: 0.55, out: 2.19 }
};

export function pickModel(text: string): string {
  const t = (text || '').toLowerCase();
  if (
    t.includes('deep study') ||
    t.includes('greek') ||
    t.includes('hebrew') ||
    t.includes('scholarly') ||
    t.includes('scholars') ||
    t.includes('theology') ||
    t.includes('theological') ||
    t.includes('sunday message') ||
    t.includes('sermon notes') ||
    t.includes('sermon series') ||
    t.includes('full sermon')
  ) {
    return DS_REASON;
  }
  return DS_CHAT;
}

export interface DeepSeekResponse {
  content: string;
  model: string;
  cost: number;
}

export async function sendToDeepSeek(
  userPrompt: string,
  chatHistory: ChatMessage[],
  apiKey: string,
  houseMemory?: HouseMemory,
  customAddons: string[] = [],
  libraryItems: Record<string, LibraryItem> = {}
): Promise<DeepSeekResponse> {
  const model = pickModel(userPrompt);
  const ragContext = buildLibraryContext(libraryItems, userPrompt);
  const systemPrompt = buildSystemPrompt(houseMemory, customAddons) + ragContext;

  // If user provided a valid API key, execute real DeepSeek call
  if (apiKey && apiKey.trim().length > 15 && !apiKey.startsWith('demo')) {
    const formattedHistory = chatHistory.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: userPrompt }
    ];

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        messages
      })
    });

    const data = await res.json();
    if (!res.ok) {
      const err = data?.error?.message || `API Error ${res.status}`;
      throw new Error(err);
    }

    const reply = data.choices?.[0]?.message?.content || 'No response generated.';
    const usage = data.usage;
    let cost = 0;
    if (usage) {
      const rates = model === DS_REASON ? COST.reason : COST.chat;
      cost = ((usage.prompt_tokens || 0) * rates.in + (usage.completion_tokens || 0) * rates.out) / 1000000;
    }

    return {
      content: reply,
      model,
      cost
    };
  }

  // Graceful, faithful local generator if API key is in demo mode or not yet configured
  return generatePastoralContent(userPrompt, model, houseMemory);
}

function generatePastoralContent(prompt: string, model: string, houseMemory?: HouseMemory): DeepSeekResponse {
  const p = prompt.toLowerCase();
  const series = houseMemory?.series || "Walking in Dominion";
  
  if (p.includes('morning brief')) {
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const content = `# Morning Pastoral Brief — Light Assembly Bible Church
**Date:** ${today}  
**Good Morning, Pastor Emmanuel.**  

---

### 1. Scripture for Today
> *"For God is not unrighteous to forget your work and labour of love, which ye have shewed toward his name, in that ye have ministered to the saints, and do minister."* — **Hebrews 6:10**

### 2. Word for the Shepherd
Pastor, you are carrying spiritual weight for Ikot Ambon that heaven records meticulously. In seasons when the flock feels small and the labour feels quiet, remember that apostolic foundations are laid beneath the soil where eyes do not praise them. Feed your own soul before you feed the house today. *Ufan Abasi* (the grace of God) surrounds you like a shield.

### 3. Church & Weekly Rhythm
- **Current Series:** ${series}
- **Assembly Focus:** 20 dedicated members moving with faith toward 40. Keep the workers attentive and warm.
- **Congregation Rhythms:** Prepare spiritual arrows for workers and midweek prayer.

### 4. Akwa Ibom Cultural & Spiritual Context
The youth in Ikot Ambon face economic tension and distractions. When you speak to them, bridge deep holiness with practical empowerment. Speak life into their vocational and spiritual ambitions.

### 5. Declaration for the Day
*“I declare that Light Assembly is a city set on a hill that cannot be hidden. The word of God grows mightily in Ikot Ambon and prevails. My labour is not in vain, and the harvest is ripe in Jesus' mighty name.”*

---
**Next Step Suggestion:** Would you like to generate workers class notes or begin shaping the Sunday sermon outline?`;

    return { content, model, cost: 0.00012 };
  }

  if (p.includes('sunday message')) {
    const topic = prompt.replace(/sunday message:?/i, '').trim() || "The Unshakable Foundation";
    const content = `# ${topic}
**Light Assembly Bible Church — Pulpit Preaching Guide**  
**Preacher:** Rev. Emmanuel Udoh · Ikot Ambon, Akwa Ibom  
**Anchor Texts:** Isaiah 28:16; Matthew 7:24-27; 1 Corinthians 3:11  
**One Core Truth:** When storms dismantle human scaffolding, whatever is rooted in Christ remains unmovable.

---

### OPENING HOOK
Every builder looks confident on a calm afternoon. But the quality of a foundation is never judged under the sunshine; it is tested only when the rain descends and the floods beat against the house. In Ikot Ambon today, many are building careers and families on sand, yet wonder why sudden tremors collapse their peace.

---

### SECTION 1: THE CRITERION OF THE FOUNDATION
**KEY POINT:** God does not examine the beauty of your walls until He has tested what holds them up.  
**BACKUP SCRIPTURE:**  
> *"Therefore thus saith the Lord GOD, Behold, I lay in Zion for a foundation a stone, a tried stone, a precious corner stone, a sure foundation: he that believeth shall not make haste."* — **Isaiah 28:16**

Pastor, as you declare this to the church, tell them plainly: haste is the evidence of an unsure foundation. When men panic, those anchored in the Rock stand still.

- **[lightning] WORD STUDY:** Hebrew *'eben bōḥan* (אֶבֶן בֹּחַן) — A stone that has survived furnace testing; a stone certified unyielding under immense tectonic pressure.
- **[book] ILLUSTRATION:** The builders who construct bridges across the Qua Iboe river dig deep into the silt until they hit solid bedrock. The costliest work is underground where applause never reaches.
- **[fire] IBIBIO MOMENT:** *Ami ikwo Abasi!* When you call upon the Lord, you are not crying into the wind; you are crying to the Ancient of Days who never shifts.

---

### SECTION 2: SURVIVING THE SEASON OF TESTING
**KEY POINT:** The storm does not create weakness; it merely reveals where compromises were made.  
**BACKUP SCRIPTURE:**  
> *"And the rain descended, and the floods came, and the winds blew, and beat upon that house; and it fell not: for it was founded upon a rock."* — **Matthew 7:25**

- **[theater] DEMONSTRATION:** Lift two objects from the altar — one made of lightweight hollow calabash, one carved of heavy ironwood. Show how wind scatters what has no ballast.
- **[fire] IBIBIO MOMENT:** *Abasi owo!* God reigns in every season. When storms gather over your compound, your anchor holds within the veil.

---

### 5-DAY CONGREGATIONAL APPLICATION TABLE
| Day | Scripture Reading | Personal Action | Family Prayer Focus |
| :--- | :--- | :--- | :--- |
| **Monday** | Psalm 62:1-8 | Examine hidden habits | Renouncing compromised foundations |
| **Tuesday** | 1 Cor 3:10-15 | Align work with righteousness | Consecration of marketplace labour |
| **Wednesday** | Ephesians 2:19-22 | Attend prayer meeting with hunger | Interceding for youth stability |
| **Thursday** | 2 Timothy 2:19 | Fasting till 2pm | Sealing our children in the covenant |
| **Friday** | Hebrews 12:25-29 | Give testimony to a neighbour | Dominion over financial shaking |

---

### ALTAR CALL (TWO SPECIFIC GROUPS)
1. **Group One (The Unanchored):** Those who know in their hearts they have built their lives on their own intellect, family ties, or secret compromises, and now feel the ground shifting.
2. **Group Two (The Storm-Tossed Believer):** Faithful members who love God but feel battering winds against their health or finances. Today, heaven stabilizes your pillars.

**Closing Pastoral Prayer:**  
*"Father in the name of Jesus, let the sovereign hand of the Almighty touch every family of Light Assembly. Let every sand foundation crumble and let Christ alone reign. Ami ikwo Abasi Mfon! Holy Ghost, breathe upon Ikot Ambon today. Amen."*

---
**POWER POINTS FOR REPETITION:**
1. Sand is easy to dig, but costly to repair.
2. The storm respects only what Christ built.
3. *Ufan Abasi* will carry our church beyond every limit.`;

    return { content, model, cost: 0.00035 };
  }

  if (p.includes('whatsapp')) {
    const topic = prompt.replace(/whatsapp devotional series:?/i, '').trim() || "Covenant Faith";
    const content = `# 7-Day WhatsApp Devotional Series: ${topic}
*Light Assembly Bible Church · Rev. Emmanuel Udoh*

---

### DAY 1: WHEN GOD SPEAKS FIRST
**Hook:** Before your alarm woke you up, God had already settled your path for this Monday.  
**Anchor Scripture:**  
> *"The steps of a good man are ordered by the LORD: and he delighteth in his way."* — Psalm 37:23  

**Revelation:**  
God does not react to our emergencies; He precedes them. When you step into this week, you are not walking into the unknown — you are walking into prepared grace. At Light Assembly, we do not lean on luck; we lean on covenant promise.  
**Story:** George Müller once looked at empty pantry shelves at 7am with 300 orphans waiting. By 7:30am, a bread truck broke down right in front of the door. Providence is never late.  
**Action Point:** Before greeting anyone this morning, whisper Psalm 37:23 three times and dedicate your work.  
**Declaration:** *“My steps are ordered. No confusion shall enter my home. I am blessed in the city and blessed in the field!”*

---

### DAY 2: THE ANCHOR IN THE SWELL
**Hook:** Ships do not drop anchor inside the boat; they throw it out into the deep.  
**Anchor Scripture:**  
> *"Which hope we have as an anchor of the soul, both sure and stedfast, and which entereth into that within the veil;"* — Hebrews 6:19  

**Revelation:**  
When emotions storm, your soul must grab onto something beyond your circumstances. Jesus is that anchor. In Ikot Ambon, *Abasi owo* — God reigns, and His covenant with you cannot be broken by economic waves.  
**Action Point:** Send a word of encouragement to one brother or sister who is facing a trial today.  
**Declaration:** *“My anchor holds. Fear is broken. Joy is my portion!”*

---
*Reply with SAVE to keep these devotionals in your MINOS Library.*`;

    return { content, model, cost: 0.00018 };
  }

  // General response honoring voice & identity
  const content = `# Response from MINOS
**Light Assembly Bible Church · Ikot Ambon**  
*Serving Rev. Emmanuel Udoh*

Pastor, regarding your enquiry on **"${prompt}"**:

The Word of God provides immediate spiritual clarity for this matter. In pastoral ministry across our assembly, we must always anchor our strategy in Scripture first before stepping into execution.

1. **The Biblical Mandate:**  
   Scripture reminds us that *"the secret things belong unto the LORD our God: but those things which are revealed belong unto us and to our children for ever"* (Deut 29:29). Whatever step you take must be backed by prayer and covenant certainty.

2. **Assembly Application for Ikot Ambon:**  
   As we shepherd our twenty members and prepare for greater growth, ensure the leadership core moves with one mind. Speak faith, sow the Word diligently, and nurture the youth with patience and prophetic authority.

3. **Suggested Next Step:**  
   Would you like me to develop this into a complete **Sunday Preaching Guide**, a **WhatsApp Series**, or a **Pulpit Study Sheet**?`;

  return { content, model, cost: 0.0001 };
}
