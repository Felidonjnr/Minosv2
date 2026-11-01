import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types/minos';
import { MarkdownView } from './MarkdownView';
import { SmartContextModal } from './SmartContextModal';

const QUICK_ACTIONS = [
  { id: 'morning', label: '☀️ Morning Brief', prompt: 'Generate my Morning Brief for today', direct: true },
  { id: 'study', label: '🔍 Deep Study', prompt: 'Deep Study: ', contextKey: null },
  { id: 'sunday', label: '⛪ Sunday Message', prompt: 'Sunday Message: ', contextKey: 'sunday' },
  { id: 'notes', label: '📝 Sermon Notes', prompt: 'Sermon Notes: ', contextKey: 'notes' },
  { id: 'whatsapp', label: '📱 WhatsApp 7-Day', prompt: 'WhatsApp Devotional Series: ', contextKey: 'whatsapp' },
  { id: 'facebook', label: '📄 Facebook Posts', prompt: 'Facebook Posts: ', contextKey: 'facebook' },
  { id: 'partner', label: '🤝 Partner Devotional', prompt: 'Partner Devotional: ', contextKey: 'partner' },
  { id: 'prayer', label: '🙏 Prayer Guide', prompt: 'Prayer Guide: ', contextKey: 'prayer' },
  { id: 'greek', label: '⟨ Greek Study', prompt: 'Greek Word Study: ', direct: false },
  { id: 'hebrew', label: '⟨ Hebrew Study', prompt: 'Hebrew Word Study: ', direct: false },
  { id: 'scholars', label: '🎓 Scholars', prompt: 'Scholars Analysis: ', direct: false },
  { id: 'theology', label: '⚚ Theology', prompt: 'Theological Framework: ', direct: false }
];

const DAILY_RECOMMENDATIONS: Record<number, { text: string; action: string; prompt: string }> = {
  0: { text: 'It is Sunday. Workers Class starts at 7am and Main Service follows.', action: 'Generate Workers Class Notes', prompt: 'Generate Workers Class notes for today -- topic: The Need For Workers Commitment' },
  1: { text: 'It is Monday -- good day to review yesterday and plan the week ahead.', action: 'Generate Week Plan', prompt: 'Help me plan the ministry week ahead for Light Assembly Bible Church' },
  2: { text: 'It is Tuesday -- midweek preparation begins. What will you preach on Thursday?', action: 'Generate Midweek Outline', prompt: 'Generate a Midweek Word outline for Thursday service' },
  3: { text: 'It is Wednesday -- Prayer Meeting tonight. Prepare the prayer agenda.', action: 'Generate Prayer Guide', prompt: 'Generate a Prayer Guide for tonight Wednesday Prayer Meeting at Light Assembly Bible Church' },
  4: { text: 'It is Thursday -- Midweek Word and Communion tonight. Is your message ready?', action: 'Generate Midweek Message', prompt: 'Generate a Midweek Word message for tonight Thursday service at Light Assembly Bible Church' },
  5: { text: 'It is Friday -- Prayer Meeting tonight. The weekend is almost here.', action: 'Generate Prayer Guide', prompt: 'Generate a Prayer Guide for tonight Friday Prayer Meeting at Light Assembly Bible Church' },
  6: { text: 'It is Saturday -- Community Outreach day. Prepare the team and the message.', action: 'Generate Outreach Brief', prompt: 'Generate a Saturday Community Outreach brief and talking points for the team at Light Assembly Bible Church, Ikot Ambon' }
};

interface ChatTabProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSendMessage: (text: string) => void;
  onOpenSaveModal: (content: string) => void;
  onShowToast: (msg: string) => void;
  externalInputText?: string;
  onClearExternalInput?: () => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  isGenerating,
  onSendMessage,
  onOpenSaveModal,
  onShowToast,
  externalInputText,
  onClearExternalInput
}) => {
  const [inputText, setInputText] = useState('');
  const [activeContextKey, setActiveContextKey] = useState<string | null>(null);
  const [showRecCard, setShowRecCard] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external input from Pastor Hub (e.g., "Build with MINOS")
  useEffect(() => {
    if (externalInputText) {
      setInputText(externalInputText);
      onClearExternalInput?.();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [externalInputText, onClearExternalInput]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Adjust textarea height automatically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || isGenerating) return;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (qa: typeof QUICK_ACTIONS[0]) => {
    if (qa.contextKey) {
      setActiveContextKey(qa.contextKey);
    } else if (qa.direct) {
      onSendMessage(qa.prompt);
    } else {
      setInputText(qa.prompt);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(qa.prompt.length, qa.prompt.length);
        }
      }, 50);
    }
  };

  const handleCopy = (content: string) => {
    const plain = content
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

  const handleShare = (content: string) => {
    const plain = content.replace(/#{1,6}\s/g, '').replace(/\*{1,3}/g, '').trim();
    if (navigator.share) {
      navigator.share({ title: 'MINOS Ministry Content', text: plain })
        .catch(() => {});
    } else {
      handleCopy(content);
    }
  };

  const todayIndex = new Date().getDay();
  const todayRec = DAILY_RECOMMENDATIONS[todayIndex];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#f5f7fa]">
      {/* Quick Action Pills */}
      <div className="bg-white border-b-2 border-[#e2e8f0] px-3 py-2.5 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max max-w-5xl mx-auto">
          {QUICK_ACTIONS.map(qa => (
            <button
              key={qa.id}
              onClick={() => handleQuickAction(qa)}
              className="bg-[#f5f7fa] hover:bg-[#e2e8f0] active:bg-[#1e3a8a] active:text-white border-2 border-[#e2e8f0] rounded-full px-3.5 py-1.5 font-serif-body text-xs sm:text-[13px] font-semibold text-[#1e293b] cursor-pointer whitespace-nowrap transition-colors"
            >
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4 max-w-4xl mx-auto w-full">
        {/* Daily Recommendation Banner */}
        {showRecCard && todayRec && (
          <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1a4fa8] text-white rounded-2xl p-4 sm:p-5 shadow-md relative">
            <button
              onClick={() => setShowRecCard(false)}
              className="absolute top-2.5 right-3 text-white/50 hover:text-white text-lg cursor-pointer"
            >
              &#10005;
            </button>
            <div className="text-[10px] font-bold tracking-wider uppercase text-white/60 mb-1">
              Today's Pastoral Rhythm
            </div>
            <div className="text-sm sm:text-base font-semibold leading-relaxed mb-3">
              {todayRec.text}
            </div>
            <button
              onClick={() => {
                setShowRecCard(false);
                onSendMessage(todayRec.prompt);
              }}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/25 border border-white/30 text-white rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-sm"
            >
              <span>{todayRec.action}</span>
              <span>&rarr;</span>
            </button>
          </div>
        )}

        {/* Empty state when no messages */}
        {messages.length === 0 && (
          <div className="text-center py-12 px-4 text-[#475569]">
            <div className="text-4xl mb-3">&#128172;</div>
            <h3 className="font-serif-heading text-xl font-bold text-[#1e293b] mb-2">
              Good day, Pastor Emmanuel
            </h3>
            <p className="text-sm max-w-md mx-auto leading-relaxed">
              Ask MINOS anything or tap a quick button above to build sermons, study original Greek/Hebrew, prepare devotionals, or draft prayer guides.
            </p>
          </div>
        )}

        {/* Chat bubbles */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2.5 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1 shadow-sm">
                M
              </div>
            )}

            <div className={`max-w-[88%] sm:max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`p-3.5 sm:p-4 rounded-2xl text-[15px] sm:text-base leading-relaxed break-words shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#1e3a8a] text-white rounded-tr-sm'
                    : 'bg-white border-2 border-[#e2e8f0] text-black rounded-tl-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <MarkdownView content={msg.content} />
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-[11px] text-slate-400 font-medium">
                  {msg.timestamp}
                </span>
                {msg.model && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {msg.model}
                  </span>
                )}
              </div>

              {/* Action buttons on MINOS responses */}
              {msg.role === 'assistant' && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    onClick={() => onOpenSaveModal(msg.content)}
                    className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 border border-[#e2e8f0] rounded-full px-3 py-1 text-xs font-semibold text-[#1e293b] cursor-pointer shadow-2xs transition-colors"
                  >
                    <span>&#128218;</span>
                    <span>Save</span>
                  </button>

                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 border border-[#e2e8f0] rounded-full px-3 py-1 text-xs font-semibold text-[#1e293b] cursor-pointer shadow-2xs transition-colors"
                  >
                    <span>&#128203;</span>
                    <span>Copy</span>
                  </button>

                  <button
                    onClick={() => handleShare(msg.content)}
                    className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 border border-[#e2e8f0] rounded-full px-3 py-1 text-xs font-semibold text-[#1e293b] cursor-pointer shadow-2xs transition-colors"
                  >
                    <span>&#10548;</span>
                    <span>Share</span>
                  </button>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#1a4fa8] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1 shadow-sm">
                &#128100;
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isGenerating && (
          <div className="flex gap-2.5 sm:gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-1">
              M
            </div>
            <div className="bg-white border-2 border-[#e2e8f0] p-3.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="bg-white border-t-2 border-[#e2e8f0] p-2.5 sm:p-3 shrink-0">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask MINOS anything (sermon, study, devotional)..."
            className="flex-1 bg-[#f5f7fa] border-2 border-[#e2e8f0] focus:border-[#1e3a8a] rounded-2xl px-4 py-2.5 font-serif-body text-[15px] sm:text-base text-black outline-none resize-none min-h-[44px] max-h-[120px] transition-colors"
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isGenerating}
            className="w-11 h-11 rounded-full bg-[#1e3a8a] hover:bg-[#1a4fa8] disabled:bg-slate-300 text-white flex items-center justify-center text-lg cursor-pointer disabled:cursor-not-allowed shrink-0 transition-all shadow-md active:scale-95"
            aria-label="Send message"
          >
            &#9658;
          </button>
        </div>
      </div>

      {/* Smart Context Form Modal */}
      <SmartContextModal
        configKey={activeContextKey}
        onClose={() => setActiveContextKey(null)}
        onSubmit={prompt => {
          setActiveContextKey(null);
          onSendMessage(prompt);
        }}
      />
    </div>
  );
};
