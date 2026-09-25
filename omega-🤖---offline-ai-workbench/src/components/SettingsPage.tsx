import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Cpu, 
  MessageSquare, 
  Volume2, 
  Palette, 
  ShieldCheck, 
  Database, 
  RotateCcw, 
  Download, 
  Upload, 
  Trash2, 
  Check, 
  Sparkles, 
  VolumeX,
  Languages,
  Layers,
  Save,
  Info,
  Waves,
  Type
} from 'lucide-react';
import { ChatbotSettings, AppTheme, ChatMessage, ProcessedDocument } from '../types';
import { THEMES } from '../utils/theme';
import { PERSONA_PRESETS, DEFAULT_SETTINGS } from '../utils/defaultSettings';
import { MODEL_CHAT, MODEL_CODER, MODEL_VISION, MODEL_EMBED } from '../services/ollamaService';

interface SettingsPageProps {
  settings: ChatbotSettings;
  onUpdateSettings: (newSettings: ChatbotSettings) => void;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  messages: ChatMessage[];
  onClearMessages: () => void;
  documents: ProcessedDocument[];
  onClearDocuments: () => void;
  onImportMessages?: (messages: ChatMessage[]) => void;
}

type SettingsTab = 'model' | 'chat' | 'voice' | 'appearance' | 'data';

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  currentTheme,
  onSelectTheme,
  messages,
  onClearMessages,
  documents,
  onClearDocuments,
  onImportMessages
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('model');
  const [localSettings, setLocalSettings] = useState<ChatbotSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [storageUsedKb, setStorageUsedKb] = useState<number>(0);
  const [ttsTesting, setTtsTesting] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const themeConfig = THEMES[currentTheme] || THEMES.slate;

  // Sync incoming settings
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Calculate local storage size
  useEffect(() => {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('omega_')) {
          totalBytes += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
        }
      }
      setStorageUsedKb(Math.round(totalBytes / 1024));
    } catch {
      setStorageUsedKb(0);
    }
  }, [messages, documents]);

  const handleChange = <K extends keyof ChatbotSettings>(key: K, value: ChatbotSettings[K]) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onUpdateSettings(updated);
    showSavedToast();
  };

  const showSavedToast = () => {
    setSaveStatus('Settings auto-saved');
    const timer = setTimeout(() => setSaveStatus(null), 2000);
    return () => clearTimeout(timer);
  };

  // Reset to default
  const handleResetToDefault = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    onUpdateSettings(DEFAULT_SETTINGS);
    onSelectTheme('slate');
    setSaveStatus('Reset to factory defaults');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  // Persona preset select
  const handleSelectPersona = (presetId: string) => {
    const preset = PERSONA_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const updated = {
        ...localSettings,
        systemPersona: presetId,
        systemPrompt: preset.prompt
      };
      setLocalSettings(updated);
      onUpdateSettings(updated);
      showSavedToast();
    }
  };

  // Test Speech Synthesis
  const handleTestTTS = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser environment.');
      return;
    }
    window.speechSynthesis.cancel();
    setTtsTesting(true);

    const utterance = new SpeechSynthesisUtterance(
      'Hello! This is a preview of OMEGA AI voice output settings.'
    );
    utterance.rate = localSettings.speechRate;
    utterance.pitch = localSettings.speechPitch;
    utterance.lang = localSettings.speechRecognitionLang || 'en-US';

    utterance.onend = () => setTtsTesting(false);
    utterance.onerror = () => setTtsTesting(false);

    window.speechSynthesis.speak(utterance);
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const backupData = {
      version: '2.4',
      exportDate: new Date().toISOString(),
      settings: localSettings,
      theme: currentTheme,
      messagesCount: messages.length,
      messages: messages,
      archivedChats: (() => {
        try {
          return JSON.parse(localStorage.getItem('omega_archived_chats') || '[]');
        } catch {
          return [];
        }
      })()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omega-chatbot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveStatus('Backup file exported');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  // Import JSON Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.settings) {
          setLocalSettings(parsed.settings);
          onUpdateSettings(parsed.settings);
        }
        if (parsed.theme && THEMES[parsed.theme as AppTheme]) {
          onSelectTheme(parsed.theme as AppTheme);
        }
        if (Array.isArray(parsed.messages) && onImportMessages) {
          onImportMessages(parsed.messages);
        }
        if (Array.isArray(parsed.archivedChats)) {
          localStorage.setItem('omega_archived_chats', JSON.stringify(parsed.archivedChats));
        }
        setSaveStatus('Backup restored successfully!');
        setTimeout(() => setSaveStatus(null), 2500);
      } catch (err) {
        alert('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const navTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'model', label: 'Model & AI', icon: <Cpu className="w-4 h-4" /> },
    { id: 'chat', label: 'Chat Behavior', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'voice', label: 'Voice & Audio', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'data', label: 'Privacy & Data', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-16 min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Chatbot Settings</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
              Sovereign Local
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure system persona, inference temperature, voice speech, keyboard shortcuts, and client storage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              {saveStatus}
            </span>
          )}
          <button
            id="reset-settings-defaults-btn"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 transition"
            title="Reset all settings to default values"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-800 overflow-x-auto no-scrollbar pb-px">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="mt-6 space-y-6">
        {/* 1. MODEL & INTELLIGENCE */}
        {activeTab === 'model' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Model Selection */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Default AI Model</h3>
                  <p className="text-xs text-slate-400">The primary local reasoning model used for new conversations.</p>
                </div>
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {[
                  { id: MODEL_CHAT, name: 'Qwen 2.5 7B', desc: 'General conversational, deep reasoning, multilingual' },
                  { id: MODEL_CODER, name: 'Qwen 2.5 Coder 7B', desc: 'Syntax generation, debugging, refactoring' },
                  { id: MODEL_VISION, name: 'Qwen 2.5 VL 7B', desc: 'Multimodal image analysis & OCR' },
                  { id: MODEL_EMBED, name: 'Nomic Embed Text', desc: 'Document retrieval & vector search' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleChange('defaultModel', m.id)}
                    className={`p-3 rounded-xl border text-left transition flex items-start justify-between ${
                      localSettings.defaultModel === m.id
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{m.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{m.desc}</div>
                    </div>
                    {localSettings.defaultModel === m.id && (
                      <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-2 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Persona Preset & Custom System Prompt */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Assistant Persona & System Instructions</h3>
                  <p className="text-xs text-slate-400">Define how the chatbot behaves, speaks, and structures answers.</p>
                </div>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 my-3">
                {PERSONA_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPersona(p.id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      localSettings.systemPersona === p.id
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{p.title}</div>
                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{p.description}</div>
                  </button>
                ))}
              </div>

              {/* Prompt Textarea */}
              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Custom System Prompt</label>
                <textarea
                  value={localSettings.systemPrompt}
                  onChange={(e) => handleChange('systemPrompt', e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-mono leading-relaxed"
                  placeholder="Enter custom instructions for the AI..."
                />
              </div>
            </div>

            {/* Temperature & Top-P & Max Tokens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Temperature */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Temperature (Creativity)</span>
                  <span className="font-mono text-xs font-semibold text-cyan-400">{localSettings.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={localSettings.temperature}
                  onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
                  <span>0.0 (Precise & Factual)</span>
                  <span>0.7 (Balanced)</span>
                  <span>1.0 (Creative)</span>
                </div>
              </div>

              {/* Max Output Tokens */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Max Response Tokens</span>
                  <span className="font-mono text-xs font-semibold text-cyan-400">{localSettings.maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="256"
                  max="4096"
                  step="256"
                  value={localSettings.maxTokens}
                  onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
                  <span>256 (Brief)</span>
                  <span>2048 (Standard)</span>
                  <span>4096 (Long form)</span>
                </div>
              </div>
            </div>

            {/* Context Memory & Realtime Stream */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Context History Window</div>
                  <div className="text-[11px] text-slate-400">Number of recent chat turns to retain in context</div>
                </div>
                <select
                  value={localSettings.contextTurnLimit}
                  onChange={(e) => handleChange('contextTurnLimit', parseInt(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
                >
                  <option value={5}>Last 5 messages</option>
                  <option value={10}>Last 10 messages</option>
                  <option value={20}>Last 20 messages</option>
                  <option value={50}>Last 50 messages</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Stream Responses Live</div>
                  <div className="text-[11px] text-slate-400">Stream tokens word-by-word as generated</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.streamResponse}
                  onChange={(e) => handleChange('streamResponse', e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. CHAT BEHAVIOR */}
        {activeTab === 'chat' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Key shortcuts */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">Message Input & Keys</h3>

              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Send on Enter</div>
                  <div className="text-[11px] text-slate-400">Press Enter to send message, Shift+Enter for a new line</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.sendOnEnter}
                  onChange={(e) => handleChange('sendOnEnter', e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Auto-scroll to bottom</div>
                  <div className="text-[11px] text-slate-400">Automatically scroll view as new messages stream in</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoScroll}
                  onChange={(e) => handleChange('autoScroll', e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Syntax & Code Block Highlighting</div>
                  <div className="text-[11px] text-slate-400">Render code blocks with dark syntax theme and copy buttons</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.codeHighlighting}
                  onChange={(e) => handleChange('codeHighlighting', e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Audio Chime on Response</div>
                  <div className="text-[11px] text-slate-400">Play a subtle sound when the assistant completes an answer</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.soundEffects}
                  onChange={(e) => handleChange('soundEffects', e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Font Size */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-1">Message Text Size</h3>
              <p className="text-xs text-slate-400 mb-3">Adjust readability of chat conversations.</p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'compact', label: 'Compact', size: '13px' },
                  { id: 'normal', label: 'Standard', size: '14px' },
                  { id: 'large', label: 'Large', size: '16px' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleChange('fontSize', f.id as any)}
                    className={`p-3 rounded-xl border text-center transition ${
                      localSettings.fontSize === f.id
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-semibold">{f.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{f.size}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. VOICE & AUDIO */}
        {activeTab === 'voice' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Voice Input (Speech to Text) */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Speech Recognition (Mic Input)</h3>
                  <p className="text-xs text-slate-400">Select language model for voice dictation.</p>
                </div>
                <Languages className="w-4 h-4 text-cyan-400" />
              </div>

              <div className="max-w-xs">
                <select
                  value={localSettings.speechRecognitionLang}
                  onChange={(e) => handleChange('speechRecognitionLang', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="en-US">English (United States)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="ta-IN">Tamil / தமிழ் (India)</option>
                  <option value="hi-IN">Hindi / हिन्दी (India)</option>
                  <option value="es-ES">Spanish (Español)</option>
                  <option value="fr-FR">French (Français)</option>
                  <option value="de-DE">German (Deutsch)</option>
                </select>
              </div>
            </div>

            {/* Text-to-Speech (TTS) */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Text-to-Speech (Voice Read Aloud)</h3>
                  <p className="text-xs text-slate-400">Speak AI assistant responses out loud.</p>
                </div>
                <Volume2 className="w-4 h-4 text-cyan-400" />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Auto-Read AI Responses</div>
                  <div className="text-[11px] text-slate-400">Automatically speak answers immediately after completion</div>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoReadTTS}
                  onChange={(e) => handleChange('autoReadTTS', e.target.checked)}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              {/* Rate & Pitch Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">Speech Rate (Speed)</span>
                    <span className="font-mono text-cyan-400">{localSettings.speechRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={localSettings.speechRate}
                    onChange={(e) => handleChange('speechRate', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>0.7x (Slow)</span>
                    <span>1.0x (Normal)</span>
                    <span>1.5x (Fast)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">Voice Pitch</span>
                    <span className="font-mono text-cyan-400">{localSettings.speechPitch.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.1"
                    value={localSettings.speechPitch}
                    onChange={(e) => handleChange('speechPitch', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>0.8 (Deep)</span>
                    <span>1.0 (Natural)</span>
                    <span>1.3 (High)</span>
                  </div>
                </div>
              </div>

              {/* Test Voice Button */}
              <div className="pt-2">
                <button
                  onClick={handleTestTTS}
                  disabled={ttsTesting}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{ttsTesting ? 'Speaking preview...' : 'Test Voice Audio'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. APPEARANCE */}
        {activeTab === 'appearance' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-1">Color Palette & Workspace Theme</h3>
              <p className="text-xs text-slate-400 mb-4">Choose from curated sovereign executive palettes.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { id: 'slate', name: 'Executive Slate', desc: 'Refined deep navy & cyan contrast' },
                  { id: 'obsidian', name: 'Obsidian Jet', desc: 'OLED pure black with subtle silver' },
                  { id: 'midnight', name: 'Midnight Violet', desc: 'Deep indigo with electric violet glow' },
                  { id: 'titanium', name: 'Titanium Frost', desc: 'Cool steel gray & minimalist matte' },
                  { id: 'sovereign', name: 'Sovereign Emerald', desc: 'Air-gapped secure terminal emerald' },
                ].map((t) => {
                  const isCur = currentTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelectTheme(t.id as AppTheme)}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        isCur
                          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                          : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{t.name}</span>
                        {isCur && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{t.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* 3D Background Engine Selector */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white">Interactive 3D Spatial Canvas</h4>
                    <p className="text-[11px] text-slate-400">Select ambient 3D procedural artwork rendered behind the workspace</p>
                  </div>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
                  {[
                    {
                      id: 'tesseract_4d' as const,
                      label: '3D Interactive Tesseract (Default)',
                      desc: '4D hypercube (32 edges, 24 translucent faces, 16 glowing vertices) rotating in 4D with 30 floating crystals & 80-star deep space backdrop'
                    },
                    {
                      id: 'obsidian_sculptural' as const,
                      label: 'Obsidian 3D Glossy',
                      desc: 'Glossy black sculptural forms with rich violet highlights, specular gleams & floating faceted shards'
                    },
                    {
                      id: 'local_ai_core' as const,
                      label: 'Local AI Core',
                      desc: 'Central glowing core with concentric data layers representing offline sovereign processing'
                    },
                    {
                      id: 'neural_mesh' as const,
                      label: 'Neural 3D Interconnect',
                      desc: 'Subtle grey synaptic wireframe with 3D parallax depth'
                    },
                    {
                      id: 'light_waves' as const,
                      label: 'Futuristic Light Waves',
                      desc: 'Harmonic photon ribbons with dynamic sine wave undulation'
                    }
                  ].map((bg) => {
                    const isSelected = (localSettings.backgroundStyle || 'tesseract_4d') === bg.id || (bg.id === 'tesseract_4d' && localSettings.backgroundStyle === 'obsidian_sculptural');
                    return (
                      <button
                        key={bg.id}
                        onClick={() => handleChange('backgroundStyle', bg.id)}
                        className={`p-3 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500/60 text-purple-200 shadow-sm ring-1 ring-purple-500/30'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>{bg.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">{bg.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Illumination Intensity */}
              <div className="mt-5 pt-4 border-t border-slate-800/70">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white">Illumination & Violet Highlight Intensity</h4>
                    <p className="text-[11px] text-slate-400">Control specular glow, ambient halo, and light reflectivity</p>
                  </div>
                  <Layers className="w-4 h-4 text-slate-400" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                  {[
                    { id: 'ambient' as const, label: 'Ambient (Default)', desc: 'Balanced obsidian sheen' },
                    { id: 'vibrant' as const, label: 'Vibrant Highlights', desc: 'Electric violet specularity' },
                    { id: 'subtle' as const, label: 'Subtle Matte', desc: 'Minimalist deep tones' },
                    { id: 'off' as const, label: 'Disable 3D Form', desc: 'Static canvas' }
                  ].map((lvl) => {
                    const isSelected = (localSettings.lightWavesIntensity || 'ambient') === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        onClick={() => handleChange('lightWavesIntensity', lvl.id)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-purple-950/30 border-purple-500/60 text-purple-200 shadow-sm ring-1 ring-purple-500/20'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-semibold">{lvl.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{lvl.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Brightness Control */}
              <div className="mt-5 pt-4 border-t border-slate-800/70">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-white">Background Brightness</h4>
                      <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                        {localSettings.backgroundBrightness ?? 15}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Controls overall luminescence of the 3D geometry and space cosmos</p>
                  </div>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={localSettings.backgroundBrightness ?? 15}
                    onChange={(e) => handleChange('backgroundBrightness', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[10, 15, 25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleChange('backgroundBrightness', pct)}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-mono border transition ${
                          (localSettings.backgroundBrightness ?? 15) === pct
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-semibold shadow-sm'
                            : 'bg-slate-800/60 text-slate-400 border-slate-750 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat Typography Size */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white">Chat Typography Scale</h4>
                    <p className="text-[11px] text-slate-400">Adjust message text size for optimal readability</p>
                  </div>
                  <Type className="w-4 h-4 text-cyan-400" />
                </div>

                <div className="grid grid-cols-3 gap-2.5 mt-3">
                  {[
                    { id: 'compact' as const, label: 'Compact', desc: '13px High-density' },
                    { id: 'normal' as const, label: 'Normal', desc: '14px Balanced' },
                    { id: 'large' as const, label: 'Large', desc: '16px Enhanced' }
                  ].map((fs) => {
                    const isSelected = localSettings.fontSize === fs.id;
                    return (
                      <button
                        key={fs.id}
                        onClick={() => handleChange('fontSize', fs.id)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200 shadow-sm'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xs font-semibold">{fs.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{fs.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. PRIVACY & DATA */}
        {activeTab === 'data' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Air-Gap Verification Status */}
            <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-300">100% Client-Side Air-Gapped Privacy</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    OMEGA AI does not transmit prompt contents, embeddings, images, or documents to any third-party cloud servers. All data resides securely in your local browser sandbox.
                  </p>
                </div>
              </div>
            </div>

            {/* Storage Meter */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">Local Browser Storage Quota</span>
                </div>
                <span className="font-mono text-xs text-cyan-300">{storageUsedKb} KB used</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-2">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(3, storageUsedKb / 50))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
                <span>{messages.length} active messages</span>
                <span>{documents.length} cached documents</span>
              </div>
            </div>

            {/* Backup & Restore */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h4 className="text-sm font-semibold text-white mb-1">Backup & Migration</h4>
              <p className="text-xs text-slate-400 mb-4">Export conversations, settings, and archives to JSON for offline backup.</p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExportBackup}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export Chat & Settings (.JSON)</span>
                </button>

                <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition shadow-sm cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Import Backup</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Clear Data Danger Zone */}
            <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
              <div className="flex items-center gap-2 text-rose-400">
                <Trash2 className="w-4 h-4" />
                <h4 className="text-sm font-semibold">Data Reset Zone</h4>
              </div>
              <p className="text-xs text-slate-400">
                Wipe active chat memory or delete stored indexed documents from browser cache.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={() => setClearConfirmOpen(true)}
                  disabled={messages.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition disabled:opacity-40"
                >
                  Clear Active Conversation ({messages.length})
                </button>

                <button
                  onClick={() => {
                    onClearDocuments();
                    setSaveStatus('Documents cleared from cache');
                    setTimeout(() => setSaveStatus(null), 2000);
                  }}
                  disabled={documents.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition disabled:opacity-40"
                >
                  Clear Cached Documents ({documents.length})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clear Confirmation Dialog */}
      {clearConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-rose-500/30 rounded-2xl p-5 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-rose-400 mb-2">
              <Trash2 className="w-5 h-5" />
              <h4 className="text-sm font-semibold text-white">Clear Active Messages?</h4>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              This will erase all {messages.length} messages in the current conversation.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setClearConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearMessages();
                  setClearConfirmOpen(false);
                  setSaveStatus('Conversation cleared');
                  setTimeout(() => setSaveStatus(null), 2000);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition shadow-sm"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
