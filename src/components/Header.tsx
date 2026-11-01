import React from 'react';
import { SyncStatus } from '../types/minos';

interface HeaderProps {
  syncStatus: SyncStatus;
  onOpenSettings: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ syncStatus, onOpenSettings, onGoHome }) => {
  return (
    <header className="bg-[#1e3a8a] text-white shrink-0 shadow-md border-b border-[#1a4fa8]/40 select-none">
      <div className="flex items-center justify-between px-3.5 py-2.5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-baseline gap-1.5 cursor-pointer" onClick={onGoHome}>
            <span className="font-serif-heading font-black text-xl sm:text-2xl tracking-[2px] text-white">
              MINOS
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold bg-amber-400/25 text-amber-300 px-1.5 py-0.5 rounded tracking-wider">
              DEEPSEEK
            </span>
          </div>

          <div className="w-[2px] h-7 bg-white/20 rounded-sm hidden sm:block" />

          <div className="text-[10px] sm:text-[11px] text-white/70 leading-tight hidden sm:block">
            <span className="font-semibold text-white/90">Light Assembly Bible Church</span>
            <br />
            Rev. Emmanuel Udoh &middot; Ikot Ambon
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={onGoHome}
            className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white/80 hover:text-white text-xs font-bold px-2.5 py-1.5 cursor-pointer transition-colors"
            title="Go to Door Landing"
          >
            &#8962; Home
          </button>

          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                syncStatus === 'live'
                  ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                  : syncStatus === 'busy'
                  ? 'bg-amber-400 pulse-dot'
                  : 'bg-white/40'
              }`}
            />
            <span className="text-[11px] font-medium text-white/70 capitalize">
              {syncStatus}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white/80 hover:text-white p-1.5 px-2 text-base cursor-pointer transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            &#9881;
          </button>
        </div>
      </div>
    </header>
  );
};
