import React, { useState, useEffect } from 'react';
import { SmartContextConfig } from '../types/minos';

export const SMART_CONTEXT_CONFIGS: Record<string, SmartContextConfig> = {
  facebook: {
    title: 'Facebook Posts',
    fields: [
      { id: 'ctx_topic', label: 'Topic or Scripture', placeholder: 'e.g. Faith, John 3:16, Healing...' },
      { id: 'ctx_count', label: 'How many posts?', type: 'select', options: ['3 posts', '5 posts', '7 posts'] },
      { id: 'ctx_style', label: 'Style', type: 'select', options: ['Story-based', 'Teaching', 'Motivational', 'Evangelistic'] }
    ],
    build: v =>
      `Generate ${v.ctx_count || '3 posts'} Facebook posts for Light Assembly Bible Church. Topic: ${v.ctx_topic}. Style: ${v.ctx_style || 'Teaching'}. Follow the Facebook Posts format exactly -- hook opening, biblical truth, real story, application, engaging question. End each post with Light Assembly Bible Church | Ikot Ambon.`
  },
  whatsapp: {
    title: 'WhatsApp Devotional',
    fields: [
      { id: 'ctx_topic', label: 'Series theme or scripture', placeholder: 'e.g. Prayer, Isaiah 40, Healing...' },
      { id: 'ctx_days', label: 'How many days?', type: 'select', options: ['3 days', '5 days', '7 days'] },
      { id: 'ctx_audience', label: 'Who is this for?', type: 'select', options: ['Full congregation', 'Youth only', 'Partners only', 'Women'] }
    ],
    build: v =>
      `Generate a ${v.ctx_days || '7 days'} WhatsApp devotional series for Light Assembly Bible Church. Theme: ${v.ctx_topic}. Audience: ${v.ctx_audience || 'Full congregation'}. Follow the WhatsApp Devotional format exactly -- under 200 words per day, scripture, truth, illustration, action, declaration.`
  },
  sunday: {
    title: 'Sunday Message',
    fields: [
      { id: 'ctx_title', label: 'Sermon title or topic', placeholder: 'e.g. The Potter and the Clay, Faith that moves mountains...' },
      { id: 'ctx_text', label: 'Scripture text', placeholder: 'e.g. Jeremiah 18:1-6' },
      { id: 'ctx_type', label: 'Type', type: 'select', options: ['Standalone message', 'Special Sunday'] }
    ],
    build: v =>
      `Generate a complete Sunday Message. Title/Topic: ${v.ctx_title}. Text: ${v.ctx_text}. Type: ${v.ctx_type || 'Standalone message'}. Follow the Sunday Message format exactly -- full step-by-step preaching guide with Key Points, Backup Scriptures, Explanations, Word Studies, Illustrations, Demonstrations, Ibibio Moments, 5-Day Table, Altar Call, Power Points.`
  },
  notes: {
    title: 'Sermon Notes',
    fields: [
      { id: 'ctx_title', label: 'Which sermon are these notes for?', placeholder: 'e.g. The Potter and the Clay, or paste the title...' },
      { id: 'ctx_text', label: 'Scripture text', placeholder: 'e.g. Jeremiah 18:1-6' }
    ],
    build: v =>
      `Generate Sermon Notes for: ${v.ctx_title}. Scripture: ${v.ctx_text}. Follow the Sermon Notes format exactly -- compressed faithful mirror, Key Points, Backup Scriptures, 2-3 punchy lines per section, all markers, 5-day table, altar call two groups, closing prayer, Power Points.`
  },
  partner: {
    title: 'Partner Devotional',
    fields: [
      { id: 'ctx_topic', label: 'Theme or scripture', placeholder: 'e.g. Covenant faithfulness, Psalm 37...' },
      { id: 'ctx_tone', label: 'Tone', type: 'select', options: ['Prophetic and weighty', 'Encouraging and warm', 'Teaching and deep'] }
    ],
    build: v =>
      `Generate a Partner Devotional. Theme: ${v.ctx_topic}. Tone: ${v.ctx_tone || 'Prophetic and weighty'}. Follow the Partner Devotional format exactly -- rich, weighty, prophetic. Scripture quoted in full, revelation, word for the partner, declaration, activation. These are covenant partners not donors.`
  },
  prayer: {
    title: 'Prayer Guide',
    fields: [
      { id: 'ctx_theme', label: 'Prayer theme or focus', placeholder: 'e.g. Healing, Church growth, Sunday message...' },
      { id: 'ctx_service', label: 'Which service?', type: 'select', options: ['Sunday', 'Wednesday Prayer Meeting', 'Thursday Midweek', 'Friday Prayer', 'Tarry Night', 'Personal prayer'] }
    ],
    build: v =>
      `Generate a Prayer Guide for: ${v.ctx_service || 'Wednesday Prayer Meeting'}. Theme: ${v.ctx_theme}. Follow the Prayer Guide format exactly -- opening worship direction, themed prayer sections with scriptures, declaration points, closing prayer in full.`
  }
};

interface SmartContextModalProps {
  configKey: string | null;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
}

export const SmartContextModal: React.FC<SmartContextModalProps> = ({ configKey, onClose, onSubmit }) => {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const config = configKey ? SMART_CONTEXT_CONFIGS[configKey] : null;

  useEffect(() => {
    if (config) {
      const initial: Record<string, string> = {};
      config.fields.forEach(f => {
        if (f.type === 'select' && f.options && f.options.length > 0) {
          initial[f.id] = f.options[0];
        } else {
          initial[f.id] = '';
        }
      });
      setFormValues(initial);
      setErrorMsg('');
    }
  }, [config]);

  if (!config) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of config.fields) {
      if (f.type !== 'select' && (!formValues[f.id] || !formValues[f.id].trim())) {
        setErrorMsg(`Please fill in ${f.label}`);
        return;
      }
    }
    const prompt = config.build(formValues);
    onSubmit(prompt);
  };

  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif-heading text-xl font-bold text-black">
            {config.title}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg p-1 cursor-pointer"
          >
            &#10005;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {config.fields.map(field => (
            <div key={field.id}>
              <label className="block text-xs font-bold tracking-wider uppercase text-[#1e3a8a] mb-1.5">
                {field.label}
              </label>

              {field.type === 'select' ? (
                <select
                  value={formValues[field.id] || ''}
                  onChange={e => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-3 font-serif-body text-sm text-black outline-none transition-colors"
                >
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={field.placeholder || ''}
                  value={formValues[field.id] || ''}
                  onChange={e => {
                    setErrorMsg('');
                    setFormValues(prev => ({ ...prev, [field.id]: e.target.value }));
                  }}
                  className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-3 font-serif-body text-sm text-black outline-none transition-colors"
                  autoFocus={field === config.fields[0]}
                />
              )}
            </div>
          ))}

          {errorMsg && (
            <p className="text-red-600 text-xs font-semibold">{errorMsg}</p>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-3.5 px-4 rounded-xl font-serif-heading font-bold text-base cursor-pointer shadow-md transition-colors"
            >
              Generate &#9658;
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-slate-500 hover:text-slate-800 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
