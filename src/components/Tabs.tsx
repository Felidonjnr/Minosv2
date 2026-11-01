import React from 'react';

export type TabType = 'chat' | 'command' | 'lib';

interface TabsProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  libraryCount: number;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onChangeTab, libraryCount }) => {
  return (
    <div className="bg-[#1e3a8a] border-b-4 border-[#1a4fa8] shrink-0 select-none">
      <div className="flex max-w-5xl mx-auto">
        <button
          onClick={() => onChangeTab('chat')}
          className={`flex-1 py-3 px-2 text-center font-serif-heading text-xs sm:text-sm font-bold cursor-pointer transition-all border-b-4 -mb-[4px] flex items-center justify-center gap-1.5 ${
            activeTab === 'chat'
              ? 'text-white border-white bg-white/5'
              : 'text-white/40 border-transparent hover:text-white/70'
          }`}
        >
          <span>&#128172;</span>
          <span>Chat with MINOS</span>
        </button>

        <button
          onClick={() => onChangeTab('command')}
          className={`flex-1 py-3 px-2 text-center font-serif-heading text-xs sm:text-sm font-bold cursor-pointer transition-all border-b-4 -mb-[4px] flex items-center justify-center gap-1.5 ${
            activeTab === 'command'
              ? 'text-white border-white bg-white/5'
              : 'text-white/40 border-transparent hover:text-white/70'
          }`}
        >
          <span>&#128188;</span>
          <span>Pastor Hub</span>
        </button>

        <button
          onClick={() => onChangeTab('lib')}
          className={`flex-1 py-3 px-2 text-center font-serif-heading text-xs sm:text-sm font-bold cursor-pointer transition-all border-b-4 -mb-[4px] flex items-center justify-center gap-1.5 ${
            activeTab === 'lib'
              ? 'text-white border-white bg-white/5'
              : 'text-white/40 border-transparent hover:text-white/70'
          }`}
        >
          <span>&#128218;</span>
          <span>Library</span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-serif-body transition-colors ${
              activeTab === 'lib'
                ? 'bg-white/30 text-white'
                : 'bg-white/15 text-white/70'
            }`}
          >
            {libraryCount}
          </span>
        </button>
      </div>
    </div>
  );
};
