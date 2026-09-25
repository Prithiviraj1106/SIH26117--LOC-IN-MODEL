import React from 'react';
import { BarChart3, Activity, MessageSquare, FileText, Cpu, Clock } from 'lucide-react';
import { ActivityItem, ProcessedDocument } from '../types';
import { MODEL_CHAT, MODEL_CODER, MODEL_VISION, MODEL_EMBED } from '../services/ollamaService';

interface InsightsPageProps {
  activityLog: ActivityItem[];
  documents: ProcessedDocument[];
  totalMessages: number;
}

export const InsightsPage: React.FC<InsightsPageProps> = ({
  activityLog,
  documents,
  totalMessages
}) => {
  // Compute model stats
  const modelCounts: Record<string, number> = {
    [MODEL_CHAT]: 0,
    [MODEL_CODER]: 0,
    [MODEL_VISION]: 0,
    [MODEL_EMBED]: documents.reduce((acc, d) => acc + d.chunksCount, 0)
  };

  activityLog.forEach((a) => {
    if (modelCounts[a.model] !== undefined) {
      modelCounts[a.model]++;
    } else {
      modelCounts[a.model] = 1;
    }
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/40 text-amber-300 border border-amber-500/30 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          <span>OFFLINE TELEMETRY • LOCAL AGGREGATIONS</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">📊 Output Insights</h2>
        <p className="text-xs text-slate-400 mt-1">
          Synthesized records and analytics from local interactions. Persisted solely in local memory.
        </p>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Total Queries</div>
          <div className="text-2xl font-extrabold text-blue-400 mt-1">{activityLog.length}</div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <Activity className="w-3 h-3 text-blue-400" /> In session
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Chat Exchanges</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{totalMessages}</div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-emerald-400" /> User & AI
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Indexed Docs</div>
          <div className="text-2xl font-extrabold text-cyan-400 mt-1">{documents.length}</div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <FileText className="w-3 h-3 text-cyan-400" /> In ChromaDB
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Vector Chunks</div>
          <div className="text-2xl font-extrabold text-purple-400 mt-1">
            {documents.reduce((acc, d) => acc + d.chunksCount, 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-purple-400" /> nomic-embed
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Usage Breakdown */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>Local Model Utilization</span>
          </h3>

          <div className="space-y-3">
            {[
              { name: MODEL_CHAT, role: 'General Reasoning', count: modelCounts[MODEL_CHAT], color: 'bg-blue-500', text: 'text-blue-400' },
              { name: MODEL_CODER, role: 'Code & Debugging', count: modelCounts[MODEL_CODER], color: 'bg-emerald-500', text: 'text-emerald-400' },
              { name: MODEL_VISION, role: 'Multimodal Vision', count: modelCounts[MODEL_VISION], color: 'bg-purple-500', text: 'text-purple-400' },
              { name: MODEL_EMBED, role: 'Document Vectors', count: modelCounts[MODEL_EMBED], color: 'bg-cyan-500', text: 'text-cyan-400' },
            ].map((m) => (
              <div key={m.name} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <div>
                    <span className={`font-mono font-bold ${m.text}`}>{m.name}</span>
                    <span className="text-slate-400 ml-2">({m.role})</span>
                  </div>
                  <span className="text-slate-200 font-semibold">{m.count} operations</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`${m.color} h-full rounded-full transition-all`}
                    style={{ width: `${Math.min(100, (m.count / Math.max(1, activityLog.length)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Session Query Log */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Recent Query Logs</span>
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-72">
            {activityLog.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">
                No activity recorded yet. Run a prompt in Home, Chatbot, or Vision to populate logs.
              </p>
            ) : (
              activityLog.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div className="truncate max-w-[260px]">
                    <div className="text-slate-200 font-medium truncate">{act.query}</div>
                    <div className="text-[10px] text-slate-400">{act.category}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[10px] text-blue-400 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-500/20">
                      {act.model.split(':')[0]}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{act.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
