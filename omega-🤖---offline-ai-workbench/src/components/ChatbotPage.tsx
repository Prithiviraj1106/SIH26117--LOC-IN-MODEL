import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Trash2, 
  Paperclip, 
  Camera, 
  Upload, 
  Bot, 
  User, 
  Cpu, 
  X, 
  Check, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { ChatMessage } from '../types';
import { chooseModel, askOllama, MODEL_VISION, MODEL_CODER, MODEL_CHAT } from '../services/ollamaService';

interface ChatbotPageProps {
  messages: ChatMessage[];
  onSendMessage: (userText: string, modelUsed: string, aiResponse: string, imageUrl?: string, docContext?: string) => void;
  onClearMessages: () => void;
}

export const ChatbotPage: React.FC<ChatbotPageProps> = ({
  messages,
  onSendMessage,
  onClearMessages
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  // Attached content states
  const [attachedImageB64, setAttachedImageB64] = useState<string | null>(null);
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null);
  const [attachedDocName, setAttachedDocName] = useState<string | null>(null);
  const [attachedDocText, setAttachedDocText] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle Camera initialization
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      alert('Camera access unavailable or blocked. You can upload an image file instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAttachedImagePreview(dataUrl);
        setAttachedImageB64(dataUrl.split(',')[1]);
        stopCamera();
        setAttachMenuOpen(false);
      }
    }
  };

  // Handle File Upload (Images, Text, PDF, DOCX)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setAttachedImagePreview(result);
        setAttachedImageB64(result.split(',')[1]);
      };
      reader.readAsDataURL(file);
    } else {
      // Document upload
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setAttachedDocName(file.name);
        setAttachedDocText(text);
      };
      reader.readAsText(file);
    }
    setAttachMenuOpen(false);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if ((!text && !attachedImageB64) || isLoading) return;

    // Automated Model Selection
    const hasImage = Boolean(attachedImageB64);
    const targetModel = chooseModel(text, hasImage);

    setIsLoading(true);
    setInputText('');

    const imgToSend = attachedImageB64;
    const previewToKeep = attachedImagePreview;
    const docContextToSend = attachedDocText;

    // Reset attachments
    setAttachedImageB64(null);
    setAttachedImagePreview(null);
    setAttachedDocName(null);
    setAttachedDocText(null);

    try {
      const result = await askOllama(
        targetModel,
        text || 'Analyze this attached content.',
        imgToSend ? [imgToSend] : undefined,
        docContextToSend || undefined
      );

      onSendMessage(
        text || 'Analyze this attached content.',
        targetModel,
        result.response,
        previewToKeep || undefined,
        docContextToSend || undefined
      );
    } catch {
      onSendMessage(
        text || 'Analyze this attached content.',
        targetModel,
        '❌ Ollama is offline. Please start Ollama locally.',
        previewToKeep || undefined
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto px-4 py-4">
      {/* Header bar with clear button */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>💬 Local Sovereign Chat</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-500/30">
              Offline History
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Multi-turn conversation with automated model dispatch and camera/file attachment.
          </p>
        </div>

        <button
          id="chat-clear-btn"
          onClick={onClearMessages}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-500/30 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Conversation</span>
        </button>
      </div>

      {/* Camera Live Modal Overlay if active */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-blue-500/40 rounded-2xl p-4 max-w-md w-full shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-400" />
                <span>Local Camera Snapshot</span>
              </h4>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black border border-slate-800 aspect-video object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-2 mt-4">
              <button
                onClick={capturePhoto}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_0_10px_rgba(59,130,246,0.3)]"
              >
                📸 Capture Snapshot
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-2xl text-blue-400 mb-3 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              🤖
            </div>
            <h3 className="text-lg font-bold text-slate-200">Start an Offline Conversation</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Ask coding questions to trigger <span className="text-emerald-400 font-mono">qwen2.5-coder</span>, upload images for <span className="text-purple-400 font-mono">qwen2.5-vl</span>, or general questions for <span className="text-blue-400 font-mono">qwen2.5</span>.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600/20 text-slate-100 border border-blue-500/30 rounded-tr-none'
                    : 'bg-[#0F172A] text-slate-200 border border-slate-800/80 rounded-tl-none shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                }`}
              >
                {/* Header inside bubble */}
                <div className="flex items-center justify-between gap-3 text-[11px] mb-2 pb-1.5 border-b border-white/10">
                  <div className="flex items-center gap-1.5 font-medium">
                    {msg.role === 'user' ? (
                      <span className="text-blue-300 flex items-center gap-1">
                        <User className="w-3 h-3" /> You
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Bot className="w-3 h-3" /> {msg.model}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[10px]">{msg.timestamp}</span>
                </div>

                {/* Attached Image if present */}
                {msg.imageUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-slate-700 max-w-xs">
                    <img src={msg.imageUrl} alt="Attached snapshot" className="w-full h-auto object-cover" />
                  </div>
                )}

                {/* Content */}
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-[#0F172A] border border-blue-500/30 rounded-2xl rounded-tl-none p-3.5 text-xs text-blue-300 flex items-center gap-2">
              <span className="animate-spin">⚙️</span>
              <span>Inference in progress with local model...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Previews if selected */}
      {(attachedImagePreview || attachedDocName) && (
        <div className="mt-2 p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {attachedImagePreview && (
              <img src={attachedImagePreview} alt="Preview" className="w-10 h-10 rounded object-cover border border-slate-700" />
            )}
            {attachedDocName && (
              <div className="flex items-center gap-1.5 text-xs text-cyan-300">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>{attachedDocName} (Loaded locally)</span>
              </div>
            )}
            <span className="text-xs text-slate-400">Attached to next message</span>
          </div>
          <button
            onClick={() => {
              setAttachedImagePreview(null);
              setAttachedImageB64(null);
              setAttachedDocName(null);
              setAttachedDocText(null);
            }}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="mt-3 pt-2 border-t border-slate-800/80">
        <form onSubmit={handleSend} className="relative flex items-center gap-2">
          {/* Attach Menu trigger */}
          <div className="relative">
            <button
              type="button"
              id="chat-attach-btn"
              onClick={() => setAttachMenuOpen(!attachMenuOpen)}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition"
              title="Attach Content"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {attachMenuOpen && (
              <div className="absolute bottom-12 left-0 w-48 bg-[#0F172A] border border-slate-700 rounded-xl p-2 shadow-xl space-y-1 z-30">
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 text-left"
                >
                  <Camera className="w-3.5 h-3.5 text-purple-400" />
                  <span>📸 Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 text-left"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>📁 Files (Img/Doc)</span>
                </button>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".png,.jpg,.jpeg,.txt,.pdf,.docx"
            className="hidden"
          />

          <input
            id="chat-text-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={attachedImagePreview ? 'Ask about this image...' : 'Type your message here...'}
            className="flex-1 bg-[#0F172A] text-slate-100 placeholder-slate-400 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm outline-none focus:outline-none focus:border-slate-500 focus:ring-0 transition"
          />

          <button
            type="submit"
            id="chat-send-btn"
            disabled={isLoading || (!inputText.trim() && !attachedImageB64)}
            className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(59,130,246,0.3)] transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
