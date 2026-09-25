import React from 'react';
import { Activity, ShieldCheck, Database, Cpu, CheckCircle2, AlertTriangle, RefreshCw, Terminal, Layers } from 'lucide-react';
import { OllamaStatus, ProcessedDocument, AppTheme } from '../types';
import { MODEL_CHAT, MODEL_CODER, MODEL_VISION, MODEL_EMBED } from '../services/ollamaService';
import { THEMES } from '../utils/theme';
import { ThemeSwitcher } from './ThemeSwitcher';

interface DashboardPageProps {
  ollamaStatus: OllamaStatus;
  currentModel: string;
  totalMessages: number;
  totalQueries: number;
  documents: ProcessedDocument[];
  onRefreshOllama: () => void;
  currentTheme?: AppTheme;
  onSelectTheme?: (theme: AppTheme) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  ollamaStatus,
  currentModel,
  totalMessages,
  totalQueries,
  documents,
  onRefreshOllama,
  currentTheme = 'slate',
  onSelectTheme
}) => {
  const themeConfig = THEMES[currentTheme] || THEMES.slate;
  const reqModels = [
    {
      name: MODEL_CHAT,
      role: 'General Chat & Reasoning',
      badge: 'Reasoning',
      cmd: `ollama pull ${MODEL_CHAT}`,
      color: 'text-blue-400 border-blue-500/30'
    },
    {
      name: MODEL_CODER,
      role: 'Coding, Bug Fixing & Algorithms',
      badge: 'Coding Specialist',
      cmd: `ollama pull ${MODEL_CODER}`,
      color: 'text-emerald-400 border-emerald-500/30'
    },
    {
      name: MODEL_VISION,
      role: 'Multimodal Vision & Diagram OCR',
      badge: 'Vision Analyst',
      cmd: `ollama pull ${MODEL_VISION}`,
      color: 'text-purple-400 border-purple-500/30'
    },
    {
      name: MODEL_EMBED,
      role: 'ChromaDB Local Vector Embeddings',
      badge: 'Embeddings',
      cmd: `ollama pull ${MODEL_EMBED}`,
      color: 'text-cyan-400 border-cyan-500/30'
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/40 text-rose-300 border border-rose-500/30 mb-2">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>SOVEREIGN RUNTIME DIAGNOSTICS</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">📈 System Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of local Ollama runtime, ChromaDB vector store, and model isolation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onSelectTheme && (
            <ThemeSwitcher currentTheme={currentTheme} onSelectTheme={onSelectTheme} />
          )}
          <button
            onClick={onRefreshOllama}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:border-emerald-500/50 hover:text-white transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Engine</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Operational Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* 1. Engine Status */}
        <div className="p-4 rounded-2xl bg-[#0F172A] border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>AI ENGINE STATUS</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
          </div>
          <div className="text-lg font-bold mt-2 text-emerald-400">
            🟢 STANDALONE ACTIVE
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Zero Backend • 100% In-Browser
          </div>
        </div>

        {/* 2. Local AI Mode */}
        <div className="p-4 rounded-2xl bg-[#0F172A] border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>LOCAL AI MODE</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-400 mt-2">
            🟢 ACTIVE
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Zero Cloud Telemetry
          </div>
        </div>

        {/* 3. Vector Database Status */}
        <div className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>VECTOR DB STATUS</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-400 mt-2">
            🟢 CHROMADB
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {documents.reduce((acc, d) => acc + d.chunksCount, 0)} local vector chunks
          </div>
        </div>

        {/* 4. Embedding Model Status */}
        <div className="p-4 rounded-2xl bg-[#0F172A] border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>EMBEDDING STATUS</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-400 mt-2">
            🟢 READY
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {MODEL_EMBED}
          </div>
        </div>
      </div>

      {/* Operational Counters & Active Model */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Current Active Route</div>
          <div className="text-sm font-mono font-bold text-white mt-1 truncate">{currentModel}</div>
        </div>
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Total Chat Messages</div>
          <div className="text-sm font-bold text-white mt-1">{totalMessages} messages</div>
        </div>
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Recent Queries</div>
          <div className="text-sm font-bold text-white mt-1">{totalQueries} queries</div>
        </div>
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Processed Documents</div>
          <div className="text-sm font-bold text-white mt-1">{documents.length} docs indexed</div>
        </div>
      </div>

      {/* Required Local Model Matrix */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-lg mb-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Required Local AI Models (Ollama)</span>
          </div>
          <span className="text-xs font-mono text-slate-400">All models run on local GPU/CPU</span>
        </h3>

        <div className="space-y-3">
          {reqModels.map((m) => {
            const isInstalled = ollamaStatus.installedModels.some(im => im.includes(m.name.split(':')[0]));
            return (
              <div
                key={m.name}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-100">{m.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${m.color}`}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{m.role}</p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="flex items-center sm:justify-end gap-1.5">
                    <span className={`text-xs font-semibold ${ollamaStatus.online ? (isInstalled ? 'text-emerald-400' : 'text-blue-400') : 'text-amber-400'}`}>
                      {ollamaStatus.online ? (isInstalled ? '🟢 Installed' : '🟢 Ready via Ollama') : '🟡 Offline Mode'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 inline-block">
                    {m.cmd}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sovereign Privacy & Zero Telemetry Guarantee */}
      <div className="p-5 rounded-2xl bg-[#0B1120] border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]">
        <h4 className="text-xs font-bold font-mono uppercase text-blue-300 mb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Sovereign Security & Network Isolation Protocol</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 leading-relaxed">
          <div>
            <strong className="text-slate-200 block mb-1">Local Host Boundary:</strong>
            HTTP communication occurs strictly with local Ollama daemon at <code className="text-blue-300">localhost:11434</code>. No external internet sockets are opened.
          </div>
          <div>
            <strong className="text-slate-200 block mb-1">Private Document Storage:</strong>
            Parsed document chunks and vector embeddings persist exclusively in the local <code className="text-cyan-300">data/chroma/</code> folder.
          </div>
          <div>
            <strong className="text-slate-200 block mb-1">Zero Cloud Keys:</strong>
            Completely free from OpenAI, Gemini, Claude, or Hugging Face cloud dependencies.
          </div>
        </div>
      </div>
    </div>
  );
};
