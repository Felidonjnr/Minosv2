import React, { useState, useEffect } from 'react';
import { LibraryCategory, CATEGORIES } from '../types/minos';

interface SaveModalProps {
  content: string | null;
  onClose: () => void;
  onSave: (title: string, category: LibraryCategory, content: string) => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({ content, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LibraryCategory>('sermon');

  useEffect(() => {
    if (content) {
      // Auto-extract first title line
      const firstLine = content
        .replace(/[#*_]/g, '')
        .split('\n')[0]
        .slice(0, 60)
        .trim();
      setTitle(firstLine || 'Ministry Content');

      // Detect category hint from text
      const lower = content.toLowerCase();
      if (lower.includes('whatsapp')) setCategory('whatsapp');
      else if (lower.includes('facebook')) setCategory('facebook');
      else if (lower.includes('partner')) setCategory('partner');
      else if (lower.includes('prayer')) setCategory('prayer');
      else if (lower.includes('deep study')) setCategory('study');
      else if (lower.includes('notes')) setCategory('notes');
      else setCategory('sermon');
    }
  }, [content]);

  if (!content) return null;

  const handleConfirm = () => {
    onSave(title.trim() || 'Ministry Content', category, content);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif-heading text-xl font-bold text-black">
            Save to Library
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer p-1"
          >
            &#10005;
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1e3a8a] mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter title for church archive..."
              className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-3 font-serif-body text-sm text-black outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1e3a8a] mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORIES) as LibraryCategory[]).map(catKey => {
                const cfg = CATEGORIES[catKey];
                const active = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategory(catKey)}
                    className={`px-3 py-1.5 rounded-full text-xs font-serif-body font-bold cursor-pointer transition-colors border-2 ${
                      active
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                        : 'bg-[#f5f7fa] text-slate-700 border-[#e2e8f0] hover:bg-slate-200'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleConfirm}
              className="w-full bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-3.5 px-4 rounded-xl font-serif-heading font-bold text-base cursor-pointer shadow-md transition-colors"
            >
              &#128218; Save to Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
