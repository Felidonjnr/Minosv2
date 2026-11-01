import React, { useState, useMemo } from 'react';
import { LibraryItem, LibraryCategory, CATEGORIES } from '../types/minos';

interface LibraryTabProps {
  items: Record<string, LibraryItem>;
  onOpenRead: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onShowToast: (msg: string) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  items,
  onOpenRead,
  onDeleteItem,
  onShowToast
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const allItemsList = useMemo(() => {
    return Object.values(items).sort((a, b) => (b.date || 0) - (a.date || 0));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allItemsList.filter(item => {
      const matchCat = selectedCat === 'all' || item.cat === selectedCat;
      const matchSearch =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.content || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allItemsList, selectedCat, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allItemsList.length };
    Object.keys(CATEGORIES).forEach(c => {
      counts[c] = allItemsList.filter(i => i.cat === c).length;
    });
    return counts;
  }, [allItemsList]);

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      onDeleteItem(itemToDelete);
      setItemToDelete(null);
      onShowToast('Removed from Library');
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#f5f7fa]">
      {/* Search and Category bar */}
      <div className="bg-white border-b-2 border-[#e2e8f0] px-3 sm:px-4 py-3 shrink-0 space-y-2.5 max-w-5xl mx-auto w-full">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search library by scripture, topic, word..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-full py-2 pl-4 pr-10 font-serif-body text-sm text-black outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer p-1"
            >
              &#10005;
            </button>
          )}
        </div>

        {/* Categories Bar */}
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-1.5 min-w-max pb-0.5">
            <button
              onClick={() => setSelectedCat('all')}
              className={`px-3 py-1 rounded-full text-xs font-serif-body font-bold cursor-pointer transition-colors border-2 ${
                selectedCat === 'all'
                  ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                  : 'bg-transparent text-[#475569] border-[#e2e8f0] hover:bg-slate-100'
              }`}
            >
              All <span className="text-[10px] ml-1 opacity-80">{categoryCounts.all || 0}</span>
            </button>

            {(Object.keys(CATEGORIES) as LibraryCategory[]).map(catKey => {
              const cfg = CATEGORIES[catKey];
              const count = categoryCounts[catKey] || 0;
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCat(catKey)}
                  className={`px-3 py-1 rounded-full text-xs font-serif-body font-bold cursor-pointer transition-colors border-2 ${
                    selectedCat === catKey
                      ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                      : 'bg-transparent text-[#475569] border-[#e2e8f0] hover:bg-slate-100'
                  }`}
                >
                  {cfg.label} <span className="text-[10px] ml-1 opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Library Grid / List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 max-w-5xl mx-auto w-full">
        {allItemsList.length === 0 ? (
          <div className="text-center py-16 px-4 text-[#475569]">
            <div className="text-5xl mb-3">&#128218;</div>
            <h3 className="font-serif-heading text-xl font-bold text-[#1e293b] mb-1">
              Library is empty
            </h3>
            <p className="text-sm max-w-sm mx-auto leading-relaxed text-slate-500">
              Chat with MINOS and tap <strong>Save</strong> on any sermon or devotional. It syncs to your church memory instantly.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 px-4 text-[#475569]">
            <div className="text-4xl mb-3">&#128269;</div>
            <h3 className="font-serif-heading text-xl font-bold text-[#1e293b] mb-1">
              No results found
            </h3>
            <p className="text-sm text-slate-500">
              Try a different keyword or choose another category filter above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredItems.map(item => {
              const cfg = CATEGORIES[item.cat] || CATEGORIES.other;
              const dateStr = new Date(item.date || Date.now()).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div
                  key={item.id}
                  onClick={() => onOpenRead(item.id)}
                  className="bg-white border-2 border-[#e2e8f0] hover:border-[#1e3a8a] rounded-2xl overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Stripe */}
                    <div className={`h-1.5 w-full ${cfg.stripe}`} />

                    <div className="p-4 pb-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.tag}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {dateStr}
                        </span>
                      </div>

                      <h4 className="font-serif-heading font-bold text-base text-black mb-1.5 line-clamp-1">
                        {item.title || 'Untitled'}
                      </h4>

                      <p className="text-xs text-[#475569] leading-relaxed line-clamp-3">
                        {(item.content || '').replace(/#{1,6}\s/g, '').replace(/[*_]/g, '')}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 border-t border-[#e2e8f0] flex justify-end items-center bg-[#fcfcfd]">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setItemToDelete(item.id);
                      }}
                      className="text-slate-400 hover:text-red-600 text-sm p-1 cursor-pointer transition-colors"
                      title="Delete item"
                    >
                      &#128465;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-xl">
            <h3 className="font-serif-heading text-lg font-bold text-black mb-2">
              Delete this item?
            </h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              This content will be permanently removed from your church library.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-serif-heading font-bold text-sm cursor-pointer transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 bg-transparent hover:bg-slate-100 border-2 border-[#e2e8f0] text-slate-700 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-colors"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
