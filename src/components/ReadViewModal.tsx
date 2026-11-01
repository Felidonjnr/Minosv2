import React, { useEffect } from 'react';
import { LibraryItem, CATEGORIES } from '../types/minos';
import { MarkdownView } from './MarkdownView';
import { TTSController } from '../services/tts';

interface ReadViewModalProps {
  item: LibraryItem | null;
  onClose: () => void;
  tts: TTSController;
  ttsState: 'idle' | 'loading' | 'playing' | 'paused';
  gcpKey?: string;
  onShowToast: (msg: string) => void;
}

export const ReadViewModal: React.FC<ReadViewModalProps> = ({
  item,
  onClose,
  tts,
  ttsState,
  gcpKey,
  onShowToast
}) => {
  useEffect(() => {
    return () => {
      tts.stop();
    };
  }, [tts]);

  if (!item) return null;

  const cfg = CATEGORIES[item.cat] || CATEGORIES.other;
  const dateStr = new Date(item.date || Date.now()).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleCopy = () => {
    const plain = (item.content || '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*{1,3}/g, '')
      .replace(/__/g, '')
      .replace(/_/g, '')
      .replace(/\|/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    navigator.clipboard.writeText(plain)
      .then(() => onShowToast('Copied to clipboard'))
      .catch(() => onShowToast('Copy failed'));
  };

  const handleShare = () => {
    const plain = (item.content || '').replace(/#{1,6}\s/g, '').replace(/[*_]/g, '').trim();
    if (navigator.share) {
      navigator.share({ title: item.title, text: plain }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handleToggleReadAloud = () => {
    if (ttsState === 'idle') {
      tts.play(item.content, gcpKey);
    } else if (ttsState === 'playing') {
      tts.pause();
    } else if (ttsState === 'paused') {
      tts.resume();
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="bg-[#1e3a8a] text-white p-3 sm:px-4 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => {
              tts.stop();
              onClose();
            }}
            className="bg-white/15 hover:bg-white/25 border border-white/20 rounded-lg text-white font-bold px-3 py-1.5 cursor-pointer text-sm shrink-0"
            title="Back to library"
          >
            &#8592; Back
          </button>

          <div className="min-w-0">
            <h2 className="font-serif-heading font-bold text-sm sm:text-base text-white truncate">
              {item.title || 'Untitled'}
            </h2>
            <div className="text-[11px] text-white/60 truncate">
              {cfg.label} &middot; {dateStr}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleToggleReadAloud}
            className={`border rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
              ttsState === 'playing' || ttsState === 'loading'
                ? 'bg-amber-400 text-[#1e3a8a] border-amber-300'
                : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
            }`}
          >
            {ttsState === 'loading' ? 'Loading...' : ttsState === 'playing' ? 'Pause' : ttsState === 'paused' ? 'Resume' : '🔊 Read'}
          </button>

          <button
            onClick={handleCopy}
            className="bg-white/15 hover:bg-white/25 border border-white/20 rounded-lg text-white font-bold px-2.5 py-1.5 text-xs cursor-pointer transition-colors"
          >
            📋 Copy
          </button>

          <button
            onClick={handleShare}
            className="bg-white/15 hover:bg-white/25 border border-white/20 rounded-lg text-white font-bold px-2.5 py-1.5 text-xs cursor-pointer transition-colors hidden sm:block"
          >
            ↗ Share
          </button>
        </div>
      </div>

      {/* Gold Accent Stripe */}
      <div className="h-1 bg-gradient-to-r from-[#b45309] via-amber-400 to-[#b45309] shrink-0" />

      {/* Audio Playback Controls bar if playing/paused */}
      {ttsState !== 'idle' && (
        <div className="bg-[#dbeafe] border-b border-[#cbd5e1] px-4 py-2 flex items-center justify-between shrink-0 text-xs">
          <div className="font-semibold text-[#1e3a8a] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1e3a8a] pulse-dot" />
            <span>
              {ttsState === 'loading'
                ? 'Synthesizing voice audio...'
                : ttsState === 'playing'
                ? 'Reading deliverable aloud...'
                : 'Audio paused'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleReadAloud}
              className="bg-[#1e3a8a] text-white px-2.5 py-1 rounded-md font-bold cursor-pointer"
            >
              {ttsState === 'playing' ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={() => tts.stop()}
              className="text-slate-600 hover:text-black font-semibold px-2 py-1 cursor-pointer"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Content scrollable reader */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:py-8 bg-white">
        <div className="max-w-2xl mx-auto pb-16">
          <MarkdownView content={item.content} />
        </div>
      </div>
    </div>
  );
};
