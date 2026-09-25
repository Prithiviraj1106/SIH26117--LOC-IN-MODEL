import React, { useState } from 'react';
import { Eye, Upload, Send, Sparkles, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { askOllama, MODEL_VISION } from '../services/ollamaService';

interface VisionPageProps {
  onRecordActivity: (query: string, model: string, category: 'Vision') => void;
}

export const VisionPage: React.FC<VisionPageProps> = ({ onRecordActivity }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [question, setQuestion] = useState('What is in this image?');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const presetQuestions = [
    'What is in this image?',
    'Read the text in this image.',
    'Explain this diagram.',
    'Describe the objects.'
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setAnalysisResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      const b64 = dataUrl.split(',')[1];
      setImageBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (presetQ?: string) => {
    const q = presetQ || question;
    if (!imageBase64 || !q.trim() || isLoading) return;

    setIsLoading(true);
    setAnalysisResult(null);
    onRecordActivity(q, MODEL_VISION, 'Vision');

    try {
      const res = await askOllama(MODEL_VISION, q, [imageBase64]);
      setAnalysisResult(res.response);
    } catch {
      setAnalysisResult(`❌ Ollama is offline or model ${MODEL_VISION} is missing. Run \`ollama pull ${MODEL_VISION}\` to install.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-950/40 text-purple-300 border border-purple-500/30 mb-2">
          <Eye className="w-3.5 h-3.5 text-purple-400" />
          <span>OFFLINE MULTIMODAL VISION • {MODEL_VISION}</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">👁️ Vision Analysis</h2>
        <p className="text-xs text-slate-400 mt-1">
          Upload local images (PNG, JPG, JPEG). Visual reasoning and OCR execute entirely on your machine.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Image Upload & Preview */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
            <span>1. Upload Local Image</span>
            {fileName && <span className="text-xs font-mono text-purple-400 truncate max-w-[160px]">{fileName}</span>}
          </h3>

          <label
            id="vision-dropzone"
            className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-xl p-6 cursor-pointer bg-slate-900/50 hover:bg-slate-900/80 transition min-h-[260px] relative overflow-hidden group"
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={handleImageUpload}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Uploaded preview"
                  className="max-h-64 max-w-full rounded-lg object-contain shadow-md"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white font-semibold">
                  Click to replace image
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-3 shadow-[0_0_12px_rgba(168,85,247,0.2)]">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Click to browse or drop an image</p>
                <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, JPEG</p>
              </div>
            )}
          </label>
        </div>

        {/* Right Column: Question & Local Analysis */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">2. Ask About This Image</h3>

          {/* Quick preset suggestions */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {presetQuestions.map((q, idx) => (
              <button
                key={idx}
                id={`vision-preset-${idx}`}
                onClick={() => {
                  setQuestion(q);
                  if (imageBase64) handleAnalyze(q);
                }}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:border-purple-500/50 hover:text-purple-300 transition"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <textarea
              id="vision-query-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this image..."
              rows={3}
              className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-400 border border-slate-700/80 rounded-xl p-3 text-sm outline-none focus:border-purple-500 focus:shadow-[0_0_12px_rgba(168,85,247,0.3)] transition resize-none"
            />

            <button
              id="vision-submit-btn"
              onClick={() => handleAnalyze()}
              disabled={isLoading || !imageBase64 || !question.trim()}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(168,85,247,0.3)] transition flex items-center justify-center gap-2"
            >
              <span>{isLoading ? `Analyzing Locally with ${MODEL_VISION}...` : 'Run Vision Analysis ➔'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Analysis output area */}
          <div className="mt-4 flex-1 overflow-y-auto">
            <div className="text-xs font-mono uppercase text-slate-400 mb-1">Analysis Output:</div>
            {analysisResult ? (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-purple-500/30 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap shadow-inner">
                {analysisResult}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-center text-xs text-slate-400">
                Upload an image and run analysis to view local visual breakdown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
