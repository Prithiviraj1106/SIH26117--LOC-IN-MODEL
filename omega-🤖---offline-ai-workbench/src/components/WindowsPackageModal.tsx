import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  FolderTree, 
  Terminal, 
  PackageCheck,
  ExternalLink
} from 'lucide-react';
import { OMEGA_PROJECT_FILES, downloadProjectZip, CodeFile } from '../services/codeArchive';

interface WindowsPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsPackageModal: React.FC<WindowsPackageModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(OMEGA_PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      await downloadProjectZip();
    } catch {
      alert('Error bundling ZIP package. You can copy the files directly from the viewer.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B1120] border border-blue-500/40 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.25)] overflow-hidden">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-[#0F172A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>OMEGA 🤖 Source Code & Windows Standalone .EXE Packager</span>
              </h3>
              <p className="text-xs text-slate-400">
                Complete Python 3.11+ source tree • 100% Offline • Ready to run or compile to .exe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="download-zip-btn"
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Generating ZIP...' : 'Download Complete ZIP (.zip)'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Setup Instructions Bar */}
        <div className="bg-slate-950 px-6 py-2.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <span>🚀 Run: <code className="text-blue-300">streamlit run app.py</code></span>
            <span>📦 Compile .EXE: <code className="text-cyan-300">python build_exe.py</code></span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Double-click <code className="text-slate-300">build_windows_exe.bat</code> on your PC
          </div>
        </div>

        {/* Body: Left File Tree, Right Code Viewer */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer Sidebar */}
          <div className="w-72 bg-[#070B14] border-r border-slate-800/80 p-3 overflow-y-auto space-y-1">
            <div className="text-[10px] font-mono uppercase text-slate-400 px-2 py-1 flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-blue-400" />
              <span>omega/ Source Tree</span>
            </div>

            {OMEGA_PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.name === file.name;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-blue-950/50 text-blue-300 border border-blue-500/40 font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans">{file.category}</span>
                </button>
              );
            })}
          </div>

          {/* Code Viewer Panel */}
          <div className="flex-1 flex flex-col bg-[#0A0F1D] overflow-hidden">
            {/* Viewer Header */}
            <div className="p-3 px-5 border-b border-slate-800/80 bg-[#0F172A]/70 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-slate-200">{selectedFile.path}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedFile.description}</p>
              </div>

              <button
                id="copy-code-btn"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:border-blue-500 hover:text-white transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy File'}</span>
              </button>
            </div>

            {/* Code Content */}
            <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-200 leading-relaxed bg-[#070B14]">
              <pre className="whitespace-pre">{selectedFile.content}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
