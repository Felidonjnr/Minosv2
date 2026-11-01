import React, { useState } from 'react';

interface SetupModalProps {
  isOpen: boolean;
  onLaunch: (apiKey: string) => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onLaunch }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLaunch = (keyToUse: string) => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      onLaunch(keyToUse);
    }, 1000);
  };

  const handleManualLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key || key.length < 15) {
      setErrorMsg('Please paste a valid DeepSeek API key or click Quick Launch');
      return;
    }
    handleLaunch(key);
  };

  return (
    <div className="fixed inset-0 bg-[#1e3a8a] z-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {isConnecting ? (
        <div className="flex flex-col items-center justify-center gap-4 text-white text-center animate-in fade-in duration-200">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <div className="font-serif-heading text-2xl font-black tracking-[3px]">
            MINOS
          </div>
          <div className="text-sm text-white/60">
            Connecting to church library &amp; intelligence...
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md py-6">
          <div className="font-serif-heading text-3xl sm:text-4xl font-black text-white tracking-[4px] text-center mb-1">
            MINOS
          </div>
          <div className="text-xs text-white/60 text-center mb-1">
            Ministry Intelligence &amp; Operational System
          </div>
          <div className="text-xs sm:text-sm text-white/90 text-center font-bold mb-6 leading-relaxed">
            Light Assembly Bible Church
            <br />
            Rev. Emmanuel Udoh &middot; Ikot Ambon
          </div>

          <div className="bg-white/10 border-2 border-green-400/40 rounded-2xl p-4 mb-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-white text-sm">Supabase Library</span>
              <span className="text-[10px] font-bold bg-green-700 text-white px-2 py-0.5 rounded-full">
                CONNECTED
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Library pre-configured with PostgreSQL synchronization &amp; offline local storage. Both phones and devices sync automatically in real time.
            </p>
          </div>

          <form onSubmit={handleManualLaunch} className="bg-white/10 border-2 border-white/20 rounded-2xl p-4 sm:p-5 mb-3.5 shadow-sm space-y-3">
            <div>
              <div className="font-bold text-white text-sm">DeepSeek API Key</div>
              <p className="text-xs text-white/60 leading-relaxed mt-0.5">
                Stored on this device only. Get it from platform.deepseek.com
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-white/50 mb-1.5">
                Paste your key below (optional for quick preview)
              </label>
              <input
                type="text"
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={e => {
                  setErrorMsg('');
                  setApiKeyInput(e.target.value);
                }}
                className="w-full bg-white/12 border-2 border-white/25 focus:border-white/70 rounded-xl p-3 font-mono text-xs sm:text-sm text-white placeholder-white/30 outline-none transition-colors"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {errorMsg && (
              <p className="text-red-300 text-xs font-semibold text-center">{errorMsg}</p>
            )}

            <button
              type="submit"
              className="w-full bg-white hover:bg-white/95 text-[#1e3a8a] py-3.5 px-4 rounded-xl font-serif-heading font-bold text-base cursor-pointer shadow-lg transition-transform active:scale-[0.99]"
            >
              &#9889; Launch MINOS DeepSeek
            </button>
          </form>

          <button
            type="button"
            onClick={() => handleLaunch('demo-offline-mode')}
            className="w-full py-2.5 text-xs text-white/75 hover:text-white underline text-center cursor-pointer transition-colors"
          >
            Or launch directly with Local Pastoral Intelligence &rarr;
          </button>
        </div>
      )}
    </div>
  );
};
