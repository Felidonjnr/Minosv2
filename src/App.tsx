import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LibraryItem, 
  LibraryCategory, 
  SermonPlan, 
  CareItem, 
  CalendarEvent, 
  HouseMemory, 
  ChatMessage, 
  AppSettings, 
  SyncStatus 
} from './types/minos';
import { 
  getStoredSettings, 
  saveSettings, 
  getStoredHouseMemory, 
  saveStoredHouseMemory, 
  getStoredPastorCommand, 
  saveStoredPastorCommand, 
  getLocalLibraryItems, 
  saveLocalLibraryItems, 
  syncWithSupabase, 
  saveItemToSupabase, 
  deleteItemFromSupabase 
} from './services/storage';
import { sendToDeepSeek } from './services/deepseek';
import { createTTSPlayer } from './services/tts';
import { Header } from './components/Header';
import { Tabs, TabType } from './components/Tabs';
import { ChatTab } from './components/ChatTab';
import { PastorHubTab } from './components/PastorHubTab';
import { LibraryTab } from './components/LibraryTab';
import { ReadViewModal } from './components/ReadViewModal';
import { SaveModal } from './components/SaveModal';
import { SettingsModal } from './components/SettingsModal';
import { SetupModal } from './components/SetupModal';
import { DoorLanding } from './components/DoorLanding';

export function App() {
  // Navigation
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Core Data
  const [settings, setSettings] = useState<AppSettings>(() => getStoredSettings());
  const [houseMemory, setHouseMemory] = useState<HouseMemory>(() => getStoredHouseMemory());
  const [pastorCommand, setPastorCommand] = useState(() => getStoredPastorCommand());
  const [libraryItems, setLibraryItems] = useState<Record<string, LibraryItem>>(() => getLocalLibraryItems());

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastCost, setLastCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [externalChatInput, setExternalChatInput] = useState<string>('');

  // Modals & Overlays
  const [saveModalContent, setSaveModalContent] = useState<string | null>(null);
  const [readItemId, setReadItemId] = useState<string | null>(null);

  // Sync & TTS
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('live');
  const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  };

  // TTS player
  const tts = useMemo(() => {
    return createTTSPlayer(st => setTtsState(st));
  }, []);

  // Supabase background sync on mount
  useEffect(() => {
    syncWithSupabase(
      status => setSyncStatus(status),
      items => setLibraryItems(items)
    );
  }, []);

  // Check if API key exists on launch
  const handleLaunchFromSetup = (apiKey: string) => {
    if (apiKey) {
      const updated = { ...settings, deepseekApiKey: apiKey };
      setSettings(updated);
      saveSettings(updated);
    }
    setIsSetupOpen(false);
    setViewMode('app');
    showToast('MINOS is live');
  };

  const handleDoorEnter = () => {
    if (!settings.deepseekApiKey) {
      setIsSetupOpen(true);
    } else {
      setViewMode('app');
      showToast('Welcome to MINOS');
    }
  };

  // Chat Handling
  const handleSendMessage = async (text: string) => {
    if (isGenerating || !text.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const response = await sendToDeepSeek(
        text,
        chatMessages,
        settings.deepseekApiKey,
        houseMemory,
        settings.customAddons,
        libraryItems
      );

      const assistantMsg: ChatMessage = {
        id: `msg_m_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        model: response.model,
        cost: response.cost
      };

      setChatMessages(prev => [...prev, assistantMsg]);
      setLastCost(response.cost);
      setTotalCost(prev => prev + response.cost);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `**Notice:** Unable to connect to DeepSeek API (${err.message || 'Check connection or key'}). Operating with offline pastoral intelligence.`,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Library actions
  const handleSaveToLibrary = (title: string, cat: LibraryCategory, content: string) => {
    const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem: LibraryItem = {
      id,
      title,
      cat,
      content,
      date: Date.now()
    };

    const updated = { ...libraryItems, [id]: newItem };
    setLibraryItems(updated);
    saveLocalLibraryItems(updated);
    saveItemToSupabase(newItem, setSyncStatus);
    setSaveModalContent(null);
    showToast('Saved to Library');
  };

  const handleDeleteLibraryItem = (id: string) => {
    const next = { ...libraryItems };
    delete next[id];
    setLibraryItems(next);
    saveLocalLibraryItems(next);
    deleteItemFromSupabase(id, setSyncStatus);
  };

  // Pastor Hub actions
  const handleSaveSermon = (plan: Omit<SermonPlan, 'id'>) => {
    const newPlan: SermonPlan = {
      ...plan,
      id: `s_${Date.now()}`
    };
    const updated = {
      ...pastorCommand,
      sermons: [...pastorCommand.sermons, newPlan]
    };
    setPastorCommand(updated);
    saveStoredPastorCommand(updated);
  };

  const handleDeleteSermon = (id: string) => {
    const updated = {
      ...pastorCommand,
      sermons: pastorCommand.sermons.filter(s => s.id !== id)
    };
    setPastorCommand(updated);
    saveStoredPastorCommand(updated);
  };

  const handleBuildSermonWithMinos = (plan: SermonPlan) => {
    const prompt = `Sunday Message: ${plan.title}${plan.text ? ` from ${plan.text}` : ''}${
      plan.goal ? `\nPastoral outcome: ${plan.goal}` : ''
    }`;
    setExternalChatInput(prompt);
    setActiveTab('chat');
  };

  const handleSaveCareItem = (item: Omit<CareItem, 'id' | 'done'>) => {
    const newItem: CareItem = {
      ...item,
      id: `c_${Date.now()}`,
      done: false
    };
    const updated = {
      ...pastorCommand,
      care: [...pastorCommand.care, newItem]
    };
    setPastorCommand(updated);
    saveStoredPastorCommand(updated);
  };

  const handleToggleCareDone = (id: string) => {
    const updated = {
      ...pastorCommand,
      care: pastorCommand.care.map(c => (c.id === id ? { ...c, done: !c.done } : c))
    };
    setPastorCommand(updated);
    saveStoredPastorCommand(updated);
  };

  const handleDeleteCareItem = (id: string) => {
    const updated = {
      ...pastorCommand,
      care: pastorCommand.care.filter(c => c.id !== id)
    };
    setPastorCommand(updated);
    saveStoredPastorCommand(updated);
  };

  const handleSaveEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: `e_${Date.now()}`
    };
    const updated = {
      ...pastorCommand,
      events: [...pastorCommand.events, newEvent]
    };
    setPastorCommand(updated);
    saveStoredPastorCommand(updated);
  };

  const handleDeleteEvent = (id: string) => {
    const updated = {
      ...pastorCommand,
      events: pastorCommand.events.filter(e => e.id !== id)
    };
    setPastorCommand(updated);
    saveStoredPastorCommand(updated);
  };

  const handleSaveHouseMemory = (memory: HouseMemory) => {
    setHouseMemory(memory);
    saveStoredHouseMemory(memory);
  };

  const handleGenerateContentPack = (topic: string, source: string, formats: string[]) => {
    const prompt = `CONTENT STUDIO PACK\nTopic: ${topic}\nCreate these ministry-ready items: ${formats.join(
      ', '
    )}.\nUse our House Memory and saved library where relevant. Keep every item faithful to Scripture, distinct for its channel, immediately usable, and clearly labelled with its format.${
      source ? `\n\nSOURCE NOTES TO PRESERVE:\n${source}` : ''
    }`;
    setActiveTab('chat');
    handleSendMessage(prompt);
  };

  // Settings update
  const handleSaveSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };

  const readItem = readItemId ? libraryItems[readItemId] : null;

  if (viewMode === 'landing') {
    return (
      <div className="h-full w-full">
        <DoorLanding onEnter={handleDoorEnter} />
        <SetupModal
          isOpen={isSetupOpen}
          onLaunch={handleLaunchFromSetup}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-white text-black overflow-hidden font-serif-body">
      {/* Header */}
      <Header
        syncStatus={syncStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onGoHome={() => setViewMode('landing')}
      />

      {/* Navigation Tabs */}
      <Tabs
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        libraryCount={Object.keys(libraryItems).length}
      />

      {/* Pages Container */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        {activeTab === 'chat' && (
          <ChatTab
            messages={chatMessages}
            isGenerating={isGenerating}
            onSendMessage={handleSendMessage}
            onOpenSaveModal={content => setSaveModalContent(content)}
            onShowToast={showToast}
            externalInputText={externalChatInput}
            onClearExternalInput={() => setExternalChatInput('')}
          />
        )}

        {activeTab === 'command' && (
          <PastorHubTab
            sermons={pastorCommand.sermons}
            careItems={pastorCommand.care}
            events={pastorCommand.events}
            houseMemory={houseMemory}
            onSaveSermon={handleSaveSermon}
            onDeleteSermon={handleDeleteSermon}
            onBuildSermonWithMinos={handleBuildSermonWithMinos}
            onSaveCareItem={handleSaveCareItem}
            onToggleCareDone={handleToggleCareDone}
            onDeleteCareItem={handleDeleteCareItem}
            onSaveEvent={handleSaveEvent}
            onDeleteEvent={handleDeleteEvent}
            onSaveHouseMemory={handleSaveHouseMemory}
            onGenerateContentPack={handleGenerateContentPack}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'lib' && (
          <LibraryTab
            items={libraryItems}
            onOpenRead={id => setReadItemId(id)}
            onDeleteItem={handleDeleteLibraryItem}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Read View Modal */}
      {readItem && (
        <ReadViewModal
          item={readItem}
          onClose={() => setReadItemId(null)}
          tts={tts}
          ttsState={ttsState}
          gcpKey={settings.googleTtsKey}
          onShowToast={showToast}
        />
      )}

      {/* Save Modal */}
      {saveModalContent && (
        <SaveModal
          content={saveModalContent}
          onClose={() => setSaveModalContent(null)}
          onSave={handleSaveToLibrary}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        lastCost={lastCost}
        totalCost={totalCost}
        onShowToast={showToast}
      />

      {/* Setup Modal */}
      <SetupModal
        isOpen={isSetupOpen}
        onLaunch={handleLaunchFromSetup}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1e293b] text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
