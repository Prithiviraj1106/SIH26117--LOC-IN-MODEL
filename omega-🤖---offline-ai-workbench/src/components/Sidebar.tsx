import React, { useEffect, useState } from 'react';
import { 
  Home, 
  ChevronLeft
} from 'lucide-react';
import { NavigationPage, ActivityItem, OllamaStatus, AppTheme } from '../types';
import { THEMES } from '../utils/theme';
import { MemoryEntry, mrplApi } from '../services/mrplApi';

interface SidebarProps {
  currentPage: NavigationPage;
  onSelectPage: (page: NavigationPage) => void;
  onClose?: () => void;
  recentActivity: ActivityItem[];
  currentModel?: string;
  ollamaStatus: OllamaStatus;
  currentTheme: AppTheme;
  onSelectTheme?: (theme: AppTheme) => void;
  activeSessionId?: string;
  onSelectActivity?: (act: ActivityItem) => void;
  onNewChat?: () => void;
  employeeName: string;
  employeeEmail: string;
  onEmployeeNameChange: (value: string) => void;
  onEmployeeEmailChange: (value: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  onClose,
  recentActivity,
  ollamaStatus,
  currentTheme,
  activeSessionId,
  onSelectActivity,
  onNewChat,
  employeeName,
  employeeEmail,
  onEmployeeNameChange,
  onEmployeeEmailChange
}) => {
  const themeConfig = THEMES[currentTheme] || THEMES.slate;
  const [memories, setMemories] = useState<MemoryEntry[]>([]);

  useEffect(() => {
    void mrplApi.getMemories().then((result) => setMemories(result.memories)).catch(() => setMemories([]));
  }, []);

  const forgetMemory = async (memoryId: number) => {
    await mrplApi.deleteMemory(memoryId);
    setMemories((current) => current.filter((memory) => memory.id !== memoryId));
  };

  const navItems: { id: NavigationPage; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'MRPL Assistant', icon: <Home className="w-4 h-4 text-slate-400" /> },
  ];

  return (
    <aside 
      id="omega-sidebar"
      className={`w-72 ${themeConfig.sidebarBg} border-r border-slate-800/80 flex flex-col h-screen select-none shrink-0 z-20 transition-colors duration-300`}
    >
      {/* Navigation Header with Top-Right Close Arrow */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono px-1">
          Navigation
        </span>
        {onClose && (
          <button
            id="close-sidebar-arrow-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-500 transition flex items-center justify-center group shadow-sm"
            title="Close Navigation"
            aria-label="Close Navigation"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="p-3 space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Workspaces
        </div>
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => {
                onSelectPage(item.id);
                onClose?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                isActive
                  ? `${themeConfig.activeNavBg}`
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}

      </div>

      <div className="px-4 py-3 border-t border-slate-800/60 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee Identity</div>
        <input
          value={employeeName}
          onChange={(event) => onEmployeeNameChange(event.target.value)}
          placeholder="Employee name"
          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-2.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
        />
        <input
          type="email"
          value={employeeEmail}
          onChange={(event) => onEmployeeEmailChange(event.target.value)}
          placeholder="Employee email"
          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-2.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
        />
      </div>

      <div className="px-4 py-3 border-t border-slate-800/60">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Model Status</div>
        <div className={`text-xs ${ollamaStatus.online ? 'text-emerald-400' : 'text-rose-400'}`}>{ollamaStatus.statusText}</div>
        <div className="mt-2 space-y-1 text-[10px] text-slate-400 font-mono">
          {ollamaStatus.installedModels.map((model) => <div key={model}>{model}</div>)}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-800/60">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Saved Memories</div>
        {memories.length === 0 ? (
          <div className="text-xs text-slate-500">No saved memories.</div>
        ) : (
          <div className="space-y-2">
            {memories.slice(0, 8).map((memory) => (
              <div key={memory.id} className="rounded-lg bg-slate-900/70 border border-slate-800 p-2">
                <div className="text-[10px] text-cyan-400 uppercase">{memory.category}</div>
                <div className="text-[11px] text-slate-300 mt-1">{memory.content}</div>
                <button onClick={() => void forgetMemory(memory.id)} className="text-[10px] text-rose-400 hover:text-rose-300 mt-1">Forget memory</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity List */}
      <div className="flex-1 px-4 py-2 overflow-y-auto border-t border-slate-800/60">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">🕒 Chat History</span>
          {onNewChat && (
            <button
              onClick={() => {
                onNewChat();
                onSelectPage('home');
                onClose?.();
              }}
              className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 transition flex items-center gap-0.5"
              title="Start a new chat"
            >
              + New
            </button>
          )}
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No recent conversations yet.</p>
        ) : (
          <div className="space-y-1.5">
            {recentActivity.slice(0, 8).map((act) => {
              const isActive = act.id === activeSessionId && currentPage === 'home';
              const topicTitle = act.topic || act.query;
              return (
                <div
                  key={act.id}
                  onClick={() => {
                    if (onSelectActivity) {
                      onSelectActivity(act);
                    } else {
                      onSelectPage('home');
                    }
                    onClose?.();
                  }}
                  className={`p-2 rounded border text-[11px] leading-tight transition cursor-pointer ${
                    isActive
                      ? 'bg-cyan-950/40 border-cyan-500/50 text-white shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800/70'
                  }`}
                  title={topicTitle}
                >
                  <div className="font-medium truncate flex items-center justify-between gap-1.5">
                    <span className="truncate">{topicTitle}</span>
                    {act.messageCount && act.messageCount > 2 && (
                      <span className="shrink-0 text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1 py-0.2 rounded border border-slate-700/50">
                        {Math.floor(act.messageCount / 2)} chats
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>{act.time}</span>
                    <span className="font-mono text-slate-400">{act.model.split(':')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Sovereign Tag */}
      <div className="p-3 border-t border-slate-800/60 bg-[#070B14]/80 text-[10px] text-slate-400 text-center font-mono">
        {ollamaStatus.online ? 'Offline network • Backend connected' : 'Offline network • Backend unavailable'}
      </div>
    </aside>
  );
};
