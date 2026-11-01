import React, { useState } from 'react';
import { AppSettings } from '../types/minos';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: Partial<AppSettings>) => void;
  lastCost: number;
  totalCost: number;
  onShowToast: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  lastCost,
  totalCost,
  onShowToast
}) => {
  const [deepseekKey, setDeepseekKey] = useState(settings.deepseekApiKey);
  const [gcpKey, setGcpKey] = useState(settings.googleTtsKey);
  const [braveKey, setBraveKey] = useState(settings.braveSearchKey);
  const [googleKey, setGoogleKey] = useState(settings.googleSearchKey);
  const [googleCx, setGoogleCx] = useState(settings.googleCx);
  const [promptDirective, setPromptDirective] = useState('');
  const [customDirectives, setCustomDirectives] = useState<string[]>(settings.customAddons || []);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      deepseekApiKey: deepseekKey.trim(),
      googleTtsKey: gcpKey.trim(),
      braveSearchKey: braveKey.trim(),
      googleSearchKey: googleKey.trim(),
      googleCx: googleCx.trim(),
      customAddons: customDirectives
    });
    onShowToast('Settings saved successfully');
    onClose();
  };

  const handleAddDirective = () => {
    if (!promptDirective.trim()) {
      onShowToast('Please type an instruction first');
      return;
    }
    const updated = [...customDirectives, promptDirective.trim()];
    setCustomDirectives(updated);
    setPromptDirective('');
    onSaveSettings({ customAddons: updated });
    onShowToast('Added custom MINOS directive');
  };

  const handleRemoveDirective = (idx: number) => {
    const updated = customDirectives.filter((_, i) => i !== idx);
    setCustomDirectives(updated);
    onSaveSettings({ customAddons: updated });
    onShowToast('Directive removed');
  };

  return (
    <div
      className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg p-6 max-h-[88vh] overflow-y-auto shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden" />

        <div className="flex items-center justify-between border-b pb-3 border-[#e2e8f0]">
          <h3 className="font-serif-heading text-xl font-bold text-black">
            Settings &amp; Model Credentials
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer p-1"
          >
            &#10005;
          </button>
        </div>

        {/* Cost Summary Box */}
        <div className="bg-[#f5f7fa] border border-[#e2e8f0] rounded-xl p-3.5 text-xs text-[#1e293b]">
          <div className="flex justify-between py-0.5">
            <span className="text-slate-500">Last generation cost:</span>
            <span className="font-mono font-bold text-black">${lastCost.toFixed(6)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-slate-500">Session total cost:</span>
            <span className="font-mono font-bold text-black">${totalCost.toFixed(6)}</span>
          </div>
        </div>

        {/* Credentials Form */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1e3a8a] mb-1">
              DeepSeek API Key
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={deepseekKey}
              onChange={e => setDeepseekKey(e.target.value)}
              className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-2.5 font-mono text-xs sm:text-sm text-black outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Get from platform.deepseek.com. Stored locally on this device only.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1e3a8a] mb-1">
              Google Cloud TTS Key (Read Aloud)
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={gcpKey}
              onChange={e => setGcpKey(e.target.value)}
              className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-2.5 font-mono text-xs sm:text-sm text-black outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Optional for high-definition neural voice. Falls back to standard browser speech synthesis.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1e3a8a] mb-1">
              Brave Search API Key (Live Web Search)
            </label>
            <input
              type="password"
              placeholder="BSA..."
              value={braveKey}
              onChange={e => setBraveKey(e.target.value)}
              className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-2.5 font-mono text-xs sm:text-sm text-black outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1e3a8a] mb-1">
              Google Programmable Search (Alternative)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="Google Search API key"
                value={googleKey}
                onChange={e => setGoogleKey(e.target.value)}
                className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-2.5 font-mono text-xs sm:text-sm text-black outline-none"
              />
              <input
                type="text"
                placeholder="Search engine CX ID"
                value={googleCx}
                onChange={e => setGoogleCx(e.target.value)}
                className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-xl p-2.5 font-mono text-xs sm:text-sm text-black outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-[#1e3a8a] hover:bg-[#1a4fa8] text-white py-3 px-4 rounded-xl font-serif-heading font-bold text-sm cursor-pointer shadow-md transition-colors"
          >
            Save Settings
          </button>
        </div>

        {/* AI Prompt Updater Section */}
        <div className="pt-4 border-t border-[#e2e8f0] space-y-2.5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#b45309]">
              AI Prompt Custom Directives
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Type an instruction to customize how MINOS generates (e.g. "Add a closing prayer to every WhatsApp devotional").
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={2}
              placeholder="Type your custom ministry rule..."
              value={promptDirective}
              onChange={e => setPromptDirective(e.target.value)}
              className="w-full bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#b45309] rounded-xl p-2.5 text-xs sm:text-sm font-serif-body text-black outline-none resize-none"
            />
            <button
              onClick={handleAddDirective}
              className="w-full bg-[#b45309] hover:bg-[#92400e] text-white py-2 px-3 rounded-xl font-serif-heading font-bold text-xs sm:text-sm cursor-pointer shadow-2xs transition-colors"
            >
              &#9889; Add Directive to MINOS
            </button>
          </div>

          {/* List of active custom directives */}
          {customDirectives.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Active Directives ({customDirectives.length})
              </div>
              {customDirectives.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#fef3c7] text-[#92400e] text-xs">
                  <span className="truncate pr-2 font-medium">{d}</span>
                  <button
                    onClick={() => handleRemoveDirective(idx)}
                    className="text-red-600 hover:text-red-800 font-bold px-1 cursor-pointer"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
