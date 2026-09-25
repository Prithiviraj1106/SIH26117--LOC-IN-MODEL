import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { NavigationPage, ChatMessage, ActivityItem, ProcessedDocument, OllamaStatus, RagSource, AppTheme, ChatbotSettings } from './types';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './components/HomePage';
import { Tesseract4DBackground } from './components/Tesseract4DBackground';
import { checkOllamaStatus, MODEL_CHAT, MODEL_CODER, MODEL_VISION, MODEL_EMBED } from './services/ollamaService';
import { THEMES } from './utils/theme';
import { loadSettings } from './utils/defaultSettings';
import { extractConversationTopic } from './utils/topicExtractor';

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('home');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Active conversation session identifier for topic grouping
  const [activeSessionId, setActiveSessionId] = useState<string>(() => Math.random().toString(36).substring(2, 9));
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [currentModel, setCurrentModel] = useState<string>(MODEL_CHAT);
  const [settings, setSettings] = useState<ChatbotSettings>(loadSettings);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  // Navigation sidebar closed by default on initial application load
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Theme state persisted in localStorage (defaults to Executive Slate theme)
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('omega_app_theme') as AppTheme;
    if (saved && THEMES[saved]) {
      return saved;
    }
    return 'slate';
  });

  const handleSelectTheme = (newTheme: AppTheme) => {
    setTheme(newTheme);
    localStorage.setItem('omega_app_theme', newTheme);
  };

  const activeTheme = THEMES[theme] || THEMES.slate;

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    online: true,
    statusText: '🟢 100% In-Browser Engine Active (Zero Backend)',
    installedModels: [MODEL_CHAT, MODEL_CODER, MODEL_VISION, MODEL_EMBED],
    lastChecked: new Date().toLocaleTimeString()
  });

  // Client-side engine status
  const refreshOllama = async () => {
    const status = await checkOllamaStatus();
    setOllamaStatus(status);
  };

  useEffect(() => {
    refreshOllama();
  }, []);

  const handleSendMessage = (
    userText: string,
    modelUsed: string,
    aiResponse: string,
    imageUrl?: string,
    docContext?: string,
    docName?: string,
    sources?: RagSource[],
    activeMode?: 'chatbot' | 'vision' | 'document'
  ) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCurrentModel(modelUsed);

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: userText,
      model: modelUsed,
      timestamp: now,
      imageUrl,
      docContext,
      docName,
      activeMode
    };

    const aiMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'assistant',
      content: aiResponse,
      model: modelUsed,
      timestamp: now,
      sources,
      activeMode
    };

    const updatedMessages = [...messages, userMsg, aiMsg];
    setMessages(updatedMessages);

    const category = imageUrl ? 'Vision' : docContext ? 'Document RAG' : modelUsed === MODEL_CODER ? 'Coding' : 'General';

    // Topic-based conversation grouping: update existing session or create single topic entry
    setActivityLog((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === activeSessionId);
      if (existingIndex !== -1) {
        // Same conversation topic! Keep existing topic name, update timestamp and messages
        const existing = prev[existingIndex];
        const updatedItem: ActivityItem = {
          ...existing,
          model: modelUsed,
          time: now,
          messages: updatedMessages,
          messageCount: updatedMessages.length
        };
        const remaining = prev.filter((item) => item.id !== activeSessionId);
        return [updatedItem, ...remaining];
      } else {
        // First message of this conversation topic! Generate topic title
        const topicTitle = extractConversationTopic(userText, category, docName);
        const newItem: ActivityItem = {
          id: activeSessionId,
          query: topicTitle,
          topic: topicTitle,
          model: modelUsed,
          category,
          time: now,
          messages: updatedMessages,
          messageCount: updatedMessages.length
        };
        return [newItem, ...prev];
      }
    });
  };

  const handleStartNewChat = () => {
    setMessages([]);
    // Generate new session ID so the subsequent conversation creates a new topic in Recent Activity
    setActiveSessionId(Math.random().toString(36).substring(2, 9));
  };

  const handleSelectPage = (page: NavigationPage) => {
    if (page !== currentPage) {
      // Switching pages initializes a fresh session so queries on other pages or next chats are recorded cleanly
      setActiveSessionId(Math.random().toString(36).substring(2, 9));
      setCurrentPage(page);
    }
    setIsSidebarOpen(false);
  };

  const handleSelectActivity = (act: ActivityItem) => {
    if (act.messages && act.messages.length > 0) {
      setMessages(act.messages);
    }
    setActiveSessionId(act.id);
    setCurrentPage('home');
    setIsSidebarOpen(false);
  };

  const handleRecordActivity = (query: string, model: string, category: 'Vision' | 'Document RAG') => {
    setCurrentModel(model);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setActivityLog((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        query,
        topic: query,
        model,
        category,
        time: now
      },
      ...prev
    ]);
  };

  const handleAddDocument = (doc: ProcessedDocument) => {
    setDocuments((prev) => [doc, ...prev]);
    setCurrentModel(MODEL_EMBED);
  };

  const handleClearDocuments = () => {
    setDocuments([]);
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${activeTheme.rootBg} text-slate-100 antialiased font-sans transition-colors duration-300 relative`}>
      {/* Floating Arrow Trigger to Open Navigation (visible when sidebar is closed) */}
      {!isSidebarOpen && (
        <button
          id="open-navigation-arrow-btn"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-3.5 left-3.5 z-30 flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-lg backdrop-blur-md transition-all group animate-in fade-in duration-200"
          title="Open Navigation"
          aria-label="Open Navigation"
        >
          <ChevronRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Backdrop Overlay when Navigation is Open */}
      {isSidebarOpen && (
        <div
          id="navigation-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 transition-opacity duration-300 animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* Slide-out Navigation Sidebar Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <Sidebar
          currentPage={currentPage}
          onSelectPage={handleSelectPage}
          onClose={() => setIsSidebarOpen(false)}
          recentActivity={activityLog}
          currentModel={currentModel}
          ollamaStatus={ollamaStatus}
          currentTheme={theme}
          onSelectTheme={handleSelectTheme}
          activeSessionId={activeSessionId}
          onSelectActivity={handleSelectActivity}
          onNewChat={handleStartNewChat}
          employeeName={employeeName}
          employeeEmail={employeeEmail}
          onEmployeeNameChange={setEmployeeName}
          onEmployeeEmailChange={setEmployeeEmail}
        />
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col h-full w-full overflow-hidden ${activeTheme.mainGradient} relative transition-all duration-300`}>
        <Tesseract4DBackground
          theme={theme}
          intensity="ambient"
          interactive={true}
          brightness={15}
        />

        {/* Dynamic Page Rendering with z-10 for pristine legibility */}
        <div className="flex-1 overflow-y-auto relative z-10">
          {currentPage === 'home' && (
            <HomePage
              messages={messages}
              onSendMessage={handleSendMessage}
              onClearMessages={handleStartNewChat}
              onNewChat={handleStartNewChat}
              onSetMessages={setMessages}
              ollamaOnline={ollamaStatus.online}
              onRefreshOllama={refreshOllama}
              documents={documents}
              onAddDocument={handleAddDocument}
              onClearDocuments={handleClearDocuments}
              currentTheme={theme}
              onSelectTheme={handleSelectTheme}
              settings={settings}
              employeeName={employeeName}
              employeeEmail={employeeEmail}
            />
          )}

        </div>
      </main>
    </div>
  );
}
