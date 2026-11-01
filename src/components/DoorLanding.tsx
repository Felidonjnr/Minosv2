import React from 'react';

interface DoorLandingProps {
  onEnter: () => void;
}

export const DoorLanding: React.FC<DoorLandingProps> = ({ onEnter }) => {
  return (
    <div className="min-h-full w-full bg-[#1e3a8a] flex flex-col items-center justify-center p-5 select-none overflow-y-auto">
      <div className="w-full max-w-md flex flex-col items-center py-8">
        {/* LOGO */}
        <h1 className="font-serif-heading text-4xl sm:text-5xl font-black text-white tracking-[5px] text-center mb-1">
          MINOS
        </h1>
        <div className="text-xs text-white/55 text-center tracking-wide mb-1.5">
          Ministry Intelligence &amp; Operational System
        </div>
        <div className="text-sm text-white/90 font-bold text-center mb-1 leading-snug">
          Light Assembly Bible Church
        </div>
        <div className="text-xs text-white/55 text-center mb-6">
          Rev. Emmanuel Udoh &middot; Ikot Ambon, Akwa Ibom
        </div>

        {/* DIVIDER */}
        <div className="w-16 h-1 bg-gradient-to-r from-[#b45309] via-amber-400 to-[#b45309] rounded-full mb-7" />

        {/* LABEL */}
        <div className="text-[11px] font-bold tracking-wider uppercase text-white/40 mb-3 text-center">
          Launch your dashboard
        </div>

        {/* DOOR CARD */}
        <div
          onClick={onEnter}
          className="w-full bg-white/[0.08] hover:bg-white/[0.13] active:scale-[0.98] border-2 border-white/25 rounded-2xl p-5 sm:p-6 cursor-pointer transition-all shadow-xl group"
        >
          <div className="flex items-center gap-3.5 mb-2.5">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl font-bold font-serif-heading text-white shrink-0 group-hover:scale-105 transition-transform">
              M
            </div>
            <div>
              <div className="font-serif-heading text-xl font-bold text-white tracking-wide">
                MINOS
              </div>
              <div className="text-xs text-white/50 font-semibold tracking-wide mt-0.5">
                Powered by DeepSeek AI
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-[13px] text-white/70 leading-relaxed mb-4">
            Sermons, deep study, WhatsApp devotionals, Facebook posts, partner content, prayer guides, and all pastoral ministry — one unified assistant with library memory.
          </p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {[
              'Sunday Message',
              'Deep Study',
              'WhatsApp',
              'Devotionals',
              'Prayer Guide',
              'Theology'
            ].map(tag => (
              <span
                key={tag}
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/12 text-white/80"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-end">
            <span className="bg-white/15 border border-white/20 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white/90 tracking-wide group-hover:bg-white/25 transition-colors">
              Enter &rarr;
            </span>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-8 text-xs text-white/40 text-center leading-relaxed max-w-xs">
          Unified assistant — sermons, deep study, devotionals, and more in one place.
        </div>
      </div>
    </div>
  );
};
