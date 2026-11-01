import React, { useState } from 'react';
import { SermonPlan, CareItem, CalendarEvent, HouseMemory } from '../types/minos';

interface PastorHubTabProps {
  sermons: SermonPlan[];
  careItems: CareItem[];
  events: CalendarEvent[];
  houseMemory: HouseMemory;
  onSaveSermon: (plan: Omit<SermonPlan, 'id'>) => void;
  onDeleteSermon: (id: string) => void;
  onBuildSermonWithMinos: (plan: SermonPlan) => void;
  onSaveCareItem: (item: Omit<CareItem, 'id' | 'done'>) => void;
  onToggleCareDone: (id: string) => void;
  onDeleteCareItem: (id: string) => void;
  onSaveEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onDeleteEvent: (id: string) => void;
  onSaveHouseMemory: (memory: HouseMemory) => void;
  onGenerateContentPack: (topic: string, source: string, formats: string[]) => void;
  onShowToast: (msg: string) => void;
}

export const PastorHubTab: React.FC<PastorHubTabProps> = ({
  sermons,
  careItems,
  events,
  houseMemory,
  onSaveSermon,
  onDeleteSermon,
  onBuildSermonWithMinos,
  onSaveCareItem,
  onToggleCareDone,
  onDeleteCareItem,
  onSaveEvent,
  onDeleteEvent,
  onSaveHouseMemory,
  onGenerateContentPack,
  onShowToast
}) => {
  // Sermon Planner state
  const [sTitle, setSTitle] = useState('');
  const [sText, setSText] = useState('');
  const [sDate, setSDate] = useState('');
  const [sGoal, setSGoal] = useState('');

  // Care state
  const [cName, setCName] = useState('');
  const [cNeed, setCNeed] = useState('');
  const [cType, setCType] = useState<'Prayer' | 'Follow-up' | 'Visit' | 'Counselling'>('Prayer');
  const [cDue, setCDue] = useState('');

  // Event state
  const [eTitle, setETitle] = useState('');
  const [eDate, setEDate] = useState('');
  const [eTime, setETime] = useState('');

  // House Memory state
  const [mVision, setMVision] = useState(houseMemory.vision || '');
  const [mDoctrine, setMDoctrine] = useState(houseMemory.doctrine || '');
  const [mSeries, setMSeries] = useState(houseMemory.series || '');
  const [mStyle, setMStyle] = useState(houseMemory.style || '');
  const [mFocus, setMFocus] = useState(houseMemory.focus || '');

  // Content Studio state
  const [studioTopic, setStudioTopic] = useState('');
  const [studioSource, setStudioSource] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>([
    'WhatsApp devotional',
    'Facebook post',
    'Prayer guide'
  ]);

  const handleSaveSermon = () => {
    if (!sTitle.trim()) {
      onShowToast('Add a sermon title first');
      return;
    }
    onSaveSermon({
      title: sTitle.trim(),
      text: sText.trim(),
      date: sDate,
      goal: sGoal.trim()
    });
    setSTitle('');
    setSText('');
    setSDate('');
    setSGoal('');
    onShowToast('Sermon plan saved');
  };

  const handleBuildSermonNow = () => {
    if (!sTitle.trim()) {
      onShowToast('Add a sermon title first');
      return;
    }
    onBuildSermonWithMinos({
      id: 'temp',
      title: sTitle.trim(),
      text: sText.trim(),
      date: sDate,
      goal: sGoal.trim()
    });
  };

  const handleSaveCare = () => {
    if (!cName.trim() || !cNeed.trim()) {
      onShowToast('Add a name and care note');
      return;
    }
    onSaveCareItem({
      name: cName.trim(),
      need: cNeed.trim(),
      type: cType,
      due: cDue
    });
    setCName('');
    setCNeed('');
    setCDue('');
    onShowToast('Added to care list');
  };

  const handleSaveCalendarEvent = () => {
    if (!eTitle.trim()) {
      onShowToast('Add an event name');
      return;
    }
    onSaveEvent({
      title: eTitle.trim(),
      date: eDate,
      time: eTime
    });
    setETitle('');
    setEDate('');
    setETime('');
    onShowToast('Calendar event added');
  };

  const handleSaveMemory = () => {
    onSaveHouseMemory({
      vision: mVision.trim(),
      doctrine: mDoctrine.trim(),
      series: mSeries.trim(),
      style: mStyle.trim(),
      focus: mFocus.trim(),
      updated: Date.now()
    });
    onShowToast('House Memory saved');
  };

  const toggleFormat = (fmt: string) => {
    if (selectedFormats.includes(fmt)) {
      setSelectedFormats(selectedFormats.filter(f => f !== fmt));
    } else {
      setSelectedFormats([...selectedFormats, fmt]);
    }
  };

  const handleGeneratePack = () => {
    if (!studioTopic.trim()) {
      onShowToast('Add a sermon, scripture, or topic first');
      return;
    }
    if (selectedFormats.length === 0) {
      onShowToast('Choose at least one content format');
      return;
    }
    onGenerateContentPack(studioTopic.trim(), studioSource.trim(), selectedFormats);
  };

  const activeMemoryCount = [mVision, mDoctrine, mSeries, mStyle, mFocus].filter(Boolean).length;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-[#f5f7fa]">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Hero banner */}
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1a4fa8] text-white rounded-2xl p-4 sm:p-6 shadow-md">
          <h2 className="font-serif-heading text-xl sm:text-2xl font-bold mb-1">
            Pastor Command Centre
          </h2>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            Plan the Word, shepherd people, and lead the week with clarity. All records stay private to Light Assembly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* 1. Sermon Planner */}
          <div className="bg-white border-2 border-[#e2e8f0] rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">&#128214;</span>
                <h3 className="font-serif-heading text-lg font-bold text-black">
                  Sermon Planner
                </h3>
              </div>
              <p className="text-xs text-[#475569] mb-3">
                Capture the next message, then let MINOS build from it.
              </p>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Sermon title or theme"
                  value={sTitle}
                  onChange={e => setSTitle(e.target.value)}
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Main text, e.g. John 3:16"
                    value={sText}
                    onChange={e => setSText(e.target.value)}
                    className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                  />
                  <input
                    type="date"
                    value={sDate}
                    onChange={e => setSDate(e.target.value)}
                    className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                  />
                </div>

                <textarea
                  rows={2}
                  placeholder="What should the church understand, believe, or do?"
                  value={sGoal}
                  onChange={e => setSGoal(e.target.value)}
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none resize-none"
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSaveSermon}
                    className="bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-2 px-3 rounded-xl font-serif-body font-bold text-xs sm:text-sm cursor-pointer transition-colors shadow-2xs"
                  >
                    Save plan
                  </button>
                  <button
                    onClick={handleBuildSermonNow}
                    className="bg-[#f5f7fa] hover:bg-[#e2e8f0] text-[#1e293b] border-2 border-[#e2e8f0] py-2 px-3 rounded-xl font-serif-body font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                  >
                    Build with MINOS
                  </button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="mt-4 pt-3 border-t border-[#e2e8f0] space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Saved Sermon Plans ({sermons.length})
              </div>
              {sermons.length === 0 ? (
                <div className="text-xs text-slate-400 py-2 text-center italic">
                  No sermon plans yet.
                </div>
              ) : (
                sermons.map(s => (
                  <div key={s.id} className="border border-[#e2e8f0] border-l-4 border-l-[#1e3a8a] rounded-xl p-3 bg-white text-xs">
                    <div className="font-bold text-sm text-black">{s.title}</div>
                    <div className="text-slate-500 mt-0.5">
                      {s.text || 'No scripture text'} {s.date && `· ${s.date}`} {s.goal && `· ${s.goal}`}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onBuildSermonWithMinos(s)}
                        className="bg-[#f5f7fa] hover:bg-slate-200 text-[#1e293b] font-semibold px-2 py-1 rounded-md border border-[#e2e8f0] cursor-pointer"
                      >
                        Build with MINOS
                      </button>
                      <button
                        onClick={() => onDeleteSermon(s.id)}
                        className="text-red-600 hover:text-red-700 font-semibold px-2 py-1 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Prayer & Care List */}
          <div className="bg-white border-2 border-[#e2e8f0] rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">&#128591;</span>
                <h3 className="font-serif-heading text-lg font-bold text-black">
                  Prayer &amp; Follow-up
                </h3>
              </div>
              <p className="text-xs text-[#475569] mb-3">
                Keep pastoral care notes, visitation, and member intercession organized.
              </p>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Person or family name"
                  value={cName}
                  onChange={e => setCName(e.target.value)}
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                />

                <textarea
                  rows={2}
                  placeholder="Prayer request, care note, or follow-up need"
                  value={cNeed}
                  onChange={e => setCNeed(e.target.value)}
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none resize-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={cType}
                    onChange={e => setCType(e.target.value as any)}
                    className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                  >
                    <option value="Prayer">Prayer</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Visit">Visit</option>
                    <option value="Counselling">Counselling</option>
                  </select>
                  <input
                    type="date"
                    value={cDue}
                    onChange={e => setCDue(e.target.value)}
                    className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                  />
                </div>

                <button
                  onClick={handleSaveCare}
                  className="w-full bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-2 px-3 rounded-xl font-serif-body font-bold text-xs sm:text-sm cursor-pointer transition-colors shadow-2xs mt-1"
                >
                  Add to care list
                </button>
              </div>
            </div>

            {/* List */}
            <div className="mt-4 pt-3 border-t border-[#e2e8f0] space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Care Items ({careItems.length})
              </div>
              {careItems.length === 0 ? (
                <div className="text-xs text-slate-400 py-2 text-center italic">
                  No care or prayer items yet.
                </div>
              ) : (
                careItems.map(c => (
                  <div
                    key={c.id}
                    className={`border border-[#e2e8f0] rounded-xl p-3 bg-white text-xs transition-opacity ${
                      c.done ? 'opacity-60 border-l-4 border-l-green-600' : 'border-l-4 border-l-[#1e3a8a]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-black">
                        {c.name} <span className="font-normal text-xs text-slate-500">&middot; {c.type}</span>
                      </div>
                      {c.done && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">DONE</span>}
                    </div>
                    <div className="text-slate-600 mt-1">{c.need}</div>
                    {c.due && <div className="text-slate-400 mt-0.5">Due: {c.due}</div>}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onToggleCareDone(c.id)}
                        className="bg-[#f5f7fa] hover:bg-slate-200 text-[#1e293b] font-semibold px-2 py-1 rounded-md border border-[#e2e8f0] cursor-pointer"
                      >
                        {c.done ? 'Reopen' : 'Mark complete'}
                      </button>
                      <button
                        onClick={() => onDeleteCareItem(c.id)}
                        className="text-red-600 hover:text-red-700 font-semibold px-2 py-1 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. Ministry Week */}
        <div className="bg-white border-2 border-[#e2e8f0] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">&#128197;</span>
            <h3 className="font-serif-heading text-lg font-bold text-black">
              Ministry Week &amp; Schedule
            </h3>
          </div>
          <p className="text-xs text-[#475569] mb-3">
            Light Assembly regular rhythms: Sunday 7am Workers Class &amp; Main Service | Wednesday Prayer Meeting | Thursday Midweek Word &amp; Communion | Friday Prayer | Saturday Outreach.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
            <input
              type="text"
              placeholder="Event or ministry commitment"
              value={eTitle}
              onChange={e => setETitle(e.target.value)}
              className="bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
            />
            <input
              type="date"
              value={eDate}
              onChange={e => setEDate(e.target.value)}
              className="bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
            />
            <div className="flex gap-2">
              <input
                type="time"
                value={eTime}
                onChange={e => setETime(e.target.value)}
                className="w-1/2 bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
              />
              <button
                onClick={handleSaveCalendarEvent}
                className="w-1/2 bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-2 px-2 rounded-xl font-serif-body font-bold text-xs sm:text-sm cursor-pointer transition-colors shadow-2xs"
              >
                Add event
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center justify-between border border-[#e2e8f0] rounded-xl p-2.5 bg-[#f5f7fa] text-xs">
                <div>
                  <span className="font-bold text-black text-sm">{ev.title}</span>
                  <span className="text-slate-500 ml-2">
                    {ev.date || 'No date'} {ev.time && `at ${ev.time}`}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteEvent(ev.id)}
                  className="text-red-600 hover:text-red-700 font-semibold px-2 py-1 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 4. House Memory */}
        <div className="bg-white border-2 border-[#e2e8f0] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">&#129504;</span>
            <h3 className="font-serif-heading text-lg font-bold text-black">
              House Memory
            </h3>
          </div>
          <p className="text-xs text-[#475569] mb-3">
            Give MINOS the permanent local church context so every sermon, devotional, and study sounds like Light Assembly, Ikot Ambon.
          </p>

          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wider mb-1">
                Church Vision, Mission &amp; Burden
              </label>
              <textarea
                rows={2}
                value={mVision}
                onChange={e => setMVision(e.target.value)}
                placeholder="Church vision, mission, and core apostolic burden..."
                className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wider mb-1">
                Doctrinal Convictions &amp; Theological Boundaries
              </label>
              <textarea
                rows={2}
                value={mDoctrine}
                onChange={e => setMDoctrine(e.target.value)}
                placeholder="Pentecostal holiness, sovereign grace, spiritual authority, etc..."
                className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wider mb-1">
                  Current Sermon Series / Theme
                </label>
                <input
                  type="text"
                  value={mSeries}
                  onChange={e => setMSeries(e.target.value)}
                  placeholder="e.g. Unshakable Foundations"
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wider mb-1">
                  Preaching &amp; Communication Style
                </label>
                <input
                  type="text"
                  value={mStyle}
                  onChange={e => setMStyle(e.target.value)}
                  placeholder="e.g. Expository, prophetic, fatherly"
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1e3a8a] uppercase tracking-wider mb-1">
                Current Pastoral Season / Church Goal
              </label>
              <textarea
                rows={2}
                value={mFocus}
                onChange={e => setMFocus(e.target.value)}
                placeholder="e.g. Discipleship growth from 20 to 40, youth mentoring, building project..."
                className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3 py-2 text-sm font-serif-body text-black outline-none resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
              <button
                onClick={handleSaveMemory}
                className="w-full sm:w-auto bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-2.5 px-6 rounded-xl font-serif-body font-bold text-sm cursor-pointer transition-colors shadow-2xs"
              >
                Save House Memory
              </button>

              <div className="text-xs text-slate-500">
                {activeMemoryCount > 0 ? (
                  <span className="text-green-700 font-semibold">
                    ✓ Active: MINOS will inject {activeMemoryCount} saved church context items into every generation.
                  </span>
                ) : (
                  <span>Add church context items above for MINOS to remember.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Content Studio */}
        <div className="bg-white border-2 border-[#e2e8f0] rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">&#10024;</span>
            <h3 className="font-serif-heading text-lg font-bold text-black">
              Content Studio
            </h3>
          </div>
          <p className="text-xs text-[#475569] mb-3">
            Turn one sermon, scripture, or theme into a complete ministry content pack in one coordinated generation.
          </p>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Sermon title, scripture, or topic (e.g. Walking in Divine Favour, Genesis 39)"
              value={studioTopic}
              onChange={e => setStudioTopic(e.target.value)}
              className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3.5 py-2.5 text-sm font-serif-body text-black outline-none"
            />

            <textarea
              rows={2}
              placeholder="Optional: key points, sermon notes, or core truths to preserve..."
              value={studioSource}
              onChange={e => setStudioSource(e.target.value)}
              className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl px-3.5 py-2 text-sm font-serif-body text-black outline-none resize-none"
            />

            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select formats to include:
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'WhatsApp devotional',
                  'Facebook post',
                  'Prayer guide',
                  'Partner devotional',
                  'Short video script'
                ].map(fmt => (
                  <label
                    key={fmt}
                    onClick={() => toggleFormat(fmt)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer select-none transition-colors border ${
                      selectedFormats.includes(fmt)
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                        : 'bg-[#f5f7fa] text-slate-600 border-[#e2e8f0] hover:bg-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFormats.includes(fmt)}
                      onChange={() => {}}
                      className="accent-[#1e3a8a] hidden"
                    />
                    <span>{selectedFormats.includes(fmt) ? '✓' : '+'}</span>
                    <span>{fmt}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleGeneratePack}
              className="w-full bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-3 px-4 rounded-xl font-serif-body font-bold text-sm sm:text-base cursor-pointer transition-colors shadow-md mt-1"
            >
              Generate Content Pack with MINOS &#9658;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
