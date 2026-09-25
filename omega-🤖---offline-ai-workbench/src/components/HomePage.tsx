import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Send, 
  Bot, 
  User, 
  Shield, 
  Cpu, 
  MessageSquare, 
  Eye, 
  FileText, 
  Camera, 
  Upload, 
  X, 
  Check, 
  Trash2, 
  BookOpen, 
  Sparkles,
  ChevronRight,
  Mic,
  MicOff,
  AudioLines,
  Square,
  MoreVertical,
  Share2,
  Pin,
  PinOff,
  Search,
  Archive,
  ChevronUp,
  ChevronDown,
  Download
} from 'lucide-react';
import { ChatMessage, ProcessedDocument, RagSource, AppTheme, ChatbotSettings } from '../types';
import { 
  chooseModel, 
  MODEL_CODER, 
  MODEL_CHAT, 
  MODEL_VISION, 
  MODEL_EMBED 
} from '../services/ollamaService';
import { GeneratedArtifact, mrplApi } from '../services/mrplApi';
import { THEMES } from '../utils/theme';

type ActiveCapability = 'chatbot' | 'vision' | 'document';

type PendingApproval = {
  message: string;
  tool: string;
  chatId: string;
  fileId?: string;
  activeMode: ActiveCapability;
  imagePreview?: string;
  docName?: string;
};

interface HomePageProps {
  messages: ChatMessage[];
  onSendMessage: (
    userText: string, 
    modelUsed: string, 
    aiResponse: string, 
    imageUrl?: string, 
    docContext?: string,
    docName?: string,
    sources?: RagSource[],
    activeMode?: ActiveCapability
  ) => void;
  onClearMessages: () => void;
  onSetMessages?: (msgs: ChatMessage[]) => void;
  ollamaOnline: boolean;
  onRefreshOllama: () => void;
  documents: ProcessedDocument[];
  onAddDocument: (doc: ProcessedDocument) => void;
  onClearDocuments: () => void;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  settings?: ChatbotSettings;
  onNewChat?: () => void;
  employeeName: string;
  employeeEmail: string;
}

export const HomePage: React.FC<HomePageProps> = ({
  messages,
  onSendMessage,
  onClearMessages,
  onSetMessages,
  ollamaOnline,
  onRefreshOllama,
  documents,
  onAddDocument,
  onClearDocuments,
  currentTheme,
  onSelectTheme,
  settings,
  onNewChat,
  employeeName,
  employeeEmail,
}) => {
  const themeConfig = THEMES[currentTheme] || THEMES.slate;
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendSessionId, setBackendSessionId] = useState<string>();
  const [backendChatId, setBackendChatId] = useState<string>();
  const [generatedArtifact, setGeneratedArtifact] = useState<GeneratedArtifact | null>(null);
  const [isDownloadingArtifact, setIsDownloadingArtifact] = useState(false);
  const [artifactDownloadError, setArtifactDownloadError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [activeCapability, setActiveCapability] = useState<ActiveCapability>('chatbot');
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  
  // Vision states
  const [attachedImageB64, setAttachedImageB64] = useState<string | null>(null);
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null);
  const [attachedFileId, setAttachedFileId] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Document states
  const [attachedDoc, setAttachedDoc] = useState<ProcessedDocument | null>(null);

  // Voice Recording / Voice Mail states
  const [isListening, setIsListening] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Corner Three-Dots Menu state
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [isChatPinned, setIsChatPinned] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<{ text: string; undoAction?: () => void } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);
  const [archivedChats, setArchivedChats] = useState<{ id: string; title: string; date: string; messageCount: number; messages: ChatMessage[] }[]>([]);

  const chatMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close chat options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
        setChatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-dismiss toast message
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Chat Options Actions
  const handleShareChat = async () => {
    setChatMenuOpen(false);
    if (messages.length === 0) return;

    const transcript = messages
      .map((m) => `[${m.role === 'user' ? 'User' : 'OMEGA AI'} - ${m.timestamp}]\n${m.content}\n`)
      .join('\n---\n\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OMEGA AI Chat Conversation',
          text: transcript
        });
        setToastMessage({ text: 'Chat conversation shared!' });
        return;
      } catch (err) {
        // Fallback to clipboard if share was dismissed
      }
    }

    try {
      await navigator.clipboard.writeText(transcript);
      setToastMessage({ text: '✓ Chat transcript copied to clipboard!' });
    } catch (e) {
      setToastMessage({ text: 'Could not copy to clipboard.' });
    }
  };

  const handleTogglePin = () => {
    setChatMenuOpen(false);
    setIsChatPinned((prev) => {
      const next = !prev;
      setToastMessage({ text: next ? '📌 Chat pinned to top' : 'Chat unpinned' });
      return next;
    });
  };

  const handleOpenFindInChat = () => {
    setChatMenuOpen(false);
    setIsSearchOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleArchiveChat = () => {
    setChatMenuOpen(false);
    if (messages.length === 0) return;

    const archivedItem = {
      id: Math.random().toString(36).substring(2, 9),
      title: messages[0]?.content.slice(0, 45) || 'Archived Conversation',
      messageCount: messages.length,
      date: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      messages: [...messages]
    };

    const updated = [archivedItem, ...archivedChats];
    setArchivedChats(updated);
    const prevMessages = [...messages];
    onClearMessages();
    setIsSearchOpen(false);
    setSearchQuery('');
    setToastMessage({
      text: '📦 Chat archived successfully.',
      undoAction: () => {
        if (onSetMessages) {
          onSetMessages(prevMessages);
        }
      }
    });
  };

  const handleNewChat = () => {
    setChatMenuOpen(false);
    setBackendChatId(undefined);
    setGeneratedArtifact(null);
    setArtifactDownloadError(null);
    setPendingApproval(null);
    setApprovalError(null);
    if (onNewChat) {
      onNewChat();
    } else {
      onClearMessages();
    }
    setAttachedImageB64(null);
    setAttachedImagePreview(null);
    setAttachedFileId(null);
    setAttachedFileName(null);
    setUploadStatus('idle');
    setUploadError(null);
    setAttachedDoc(null);
    setInputText('');
    setIsSearchOpen(false);
    setSearchQuery('');
    setToastMessage({ text: '✨ Started new conversation' });
  };

  const handleClearChat = () => {
    setChatMenuOpen(false);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteChat = () => {
    setChatMenuOpen(false);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    setDeleteConfirmOpen(false);
    if (onNewChat) {
      onNewChat();
    } else {
      onClearMessages();
    }
    setIsSearchOpen(false);
    setSearchQuery('');
    setToastMessage({ text: 'Chat conversation deleted.' });
  };

  const handleRestoreArchived = (archivedId: string) => {
    const item = archivedChats.find((c) => c.id === archivedId);
    if (item && onSetMessages) {
      onSetMessages(item.messages);
      setArchivedModalOpen(false);
      setToastMessage({ text: `Restored "${item.title}" (${item.messageCount} msgs)` });
    }
  };

  const handleDeleteArchived = (archivedId: string) => {
    const updated = archivedChats.filter((c) => c.id !== archivedId);
    setArchivedChats(updated);
  };

  // Find in Chat navigation helpers
  const matchedMessageIds = searchQuery.trim()
    ? messages
        .filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
        .map((m) => m.id)
    : [];

  const handleNextMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchedMessageIds.length;
    setCurrentMatchIndex(nextIdx);
    const targetId = matchedMessageIds[nextIdx];
    document.getElementById(`msg-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePrevMatch = () => {
    if (matchedMessageIds.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matchedMessageIds.length) % matchedMessageIds.length;
    setCurrentMatchIndex(prevIdx);
    const targetId = matchedMessageIds[prevIdx];
    document.getElementById(`msg-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderMessageContent = (text: string) => {
    if (!searchQuery.trim()) {
      return <div className="whitespace-pre-wrap font-sans text-slate-200 leading-relaxed">{text}</div>;
    }
    const escapedQuery = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return (
      <div className="whitespace-pre-wrap font-sans text-slate-200 leading-relaxed">
        {parts.map((part, idx) =>
          part.toLowerCase() === searchQuery.trim().toLowerCase() ? (
            <mark key={idx} className="bg-amber-400 text-slate-950 font-semibold px-0.5 rounded shadow-sm">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </div>
    );
  };

  // Stop Voice Recording
  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}
      mediaRecorderRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsListening(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Start Voice Recording / Dictation
  const startVoiceRecording = async () => {
    setVoiceError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVoiceError('Voice recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = settings?.speechRecognitionLang || navigator.language || 'en-US';

          let initialText = inputText;
          recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
            }
            if (transcript) {
              setInputText(initialText ? `${initialText.trim()} ${transcript.trim()}` : transcript.trim());
            }
          };

          recognition.onerror = (event: any) => {
            console.warn('Speech recognition warning:', event.error);
            if (event.error === 'not-allowed') {
              setVoiceError('Microphone permission denied. Please allow microphone in browser.');
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (recErr) {
          console.warn('SpeechRecognition start warning:', recErr);
        }
      }

      try {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.start();
      } catch (recErr) {
        console.warn('MediaRecorder error:', recErr);
      }

      setIsListening(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Microphone error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setVoiceError('Microphone access was denied. Please allow microphone permission.');
      } else {
        setVoiceError(err?.message || 'Could not access microphone.');
      }
      setIsListening(false);
    }
  };

  const toggleVoiceRecording = () => {
    if (isListening) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  // Cleanup voice stream and timer on unmount
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    void mrplApi.createSession({ employee_name: employeeName, employee_email: employeeEmail }).then((session) => {
      setBackendSessionId(session.session_id);
    }).catch(() => {
      setToastMessage({ text: 'MRPL API is unavailable. Chat requests will fail until it is started.' });
    });
  }, [employeeEmail, employeeName]);

  // Click outside to close plus menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    if (plusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [plusMenuOpen]);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle Camera Start
  const startCamera = async () => {
    setPlusMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setActiveCapability('vision');
    } catch {
      alert('Camera access unavailable or blocked. Please upload an image file instead.');
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
        setActiveCapability('vision');
        stopCamera();
        textareaRef.current?.focus();
      }
    }
  };

  // Handle Image Upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileId(null);
    setAttachedFileName(file.name);
    setUploadStatus('uploading');
    setUploadError(null);
    void mrplApi.uploadFile(file).then((upload) => {
      setAttachedFileId(upload.file_id);
      setAttachedFileName(upload.filename);
      setUploadStatus('uploaded');
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Image upload failed.';
      setAttachedFileId(null);
      setUploadStatus('error');
      setUploadError(message);
      setToastMessage({ text: `Image upload failed: ${message}` });
    });

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAttachedImagePreview(result);
      setAttachedImageB64(result.split(',')[1]);
      setActiveCapability('vision');
      setPlusMenuOpen(false);
      textareaRef.current?.focus();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Document Upload
  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileId(null);
    setAttachedFileName(file.name);
    setUploadStatus('uploading');
    setUploadError(null);
    setPlusMenuOpen(false);
    void mrplApi.uploadFile(file).then((upload) => {
      const uploadedDocument: ProcessedDocument = {
        id: upload.file_id,
        name: upload.filename,
        size: upload.size_bytes,
        type: upload.filename.split('.').pop()?.toUpperCase() || 'FILE',
        chunksCount: 0,
        processedAt: new Date().toLocaleTimeString(),
        text: '',
        chunks: []
      };
      setAttachedFileId(upload.file_id);
      setAttachedFileName(upload.filename);
      setAttachedDoc(uploadedDocument);
      setUploadStatus('uploaded');
      setActiveCapability('document');
      onAddDocument(uploadedDocument);
      textareaRef.current?.focus();
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Document upload failed.';
      setAttachedFileId(null);
      setUploadStatus('error');
      setUploadError(message);
      setToastMessage({ text: `Document upload failed: ${message}` });
    });
    e.target.value = '';
  };

  // Submit query
  const handleSubmit = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery || inputText).trim();
    if ((!query && !attachedImageB64) || isLoading) return;
    if (activeCapability === 'document' && (!attachedFileId || uploadStatus === 'uploading')) {
      setToastMessage({
        text: uploadStatus === 'uploading'
          ? 'Please wait for the document upload to finish before sending.'
          : 'Document upload is not complete. Please re-upload the document.'
      });
      return;
    }
    if (attachedFileName && uploadStatus === 'uploading') {
      setToastMessage({ text: 'Please wait for the file upload to finish.' });
      return;
    }
    if (attachedFileName && !attachedFileId) {
      setToastMessage({ text: uploadError || 'The file was not uploaded. Remove it and try again.' });
      return;
    }

    setIsLoading(true);
    setInputText('');
    setGeneratedArtifact(null);
    setArtifactDownloadError(null);
    setApprovalError(null);

    const imgToSend = attachedImageB64;
    const previewToKeep = attachedImagePreview;
    const currentDoc = attachedDoc || (documents.length > 0 ? documents[0] : null);
    const modeUsed = activeCapability;

    // Keep the existing mode and attachment presentation, while the backend owns routing and retrieval.
    let targetModel = MODEL_CHAT;
    let contextStr: string | undefined = undefined;
    let topSources: RagSource[] | undefined = undefined;

    if (modeUsed === 'vision' || imgToSend) {
      targetModel = MODEL_VISION;
    } else if (modeUsed === 'document' && currentDoc) {
      targetModel = MODEL_CHAT;
    } else {
      targetModel = chooseModel(query, false);
    }

    try {
      const finalPrompt = query || (imgToSend ? 'Analyze this image in detail.' : 'Please process this request.');
      const chat = backendChatId
        ? { chat_id: backendChatId }
        : await mrplApi.createChat(finalPrompt.slice(0, 60));
      if (!backendChatId) {
        setBackendChatId(chat.chat_id);
      }
      const result = await mrplApi.chat({
        message: finalPrompt,
        session_id: backendSessionId,
        chat_id: chat.chat_id,
        file_id: attachedFileId || undefined,
        active_mode: modeUsed,
        sender_name: employeeName || undefined,
        sender_email: employeeEmail || undefined,
      });
      targetModel = result.route?.primary_model || targetModel;
      setGeneratedArtifact(result.artifact || null);

      if (result.requires_approval === true && result.tool) {
        setPendingApproval({
          message: finalPrompt,
          tool: result.tool,
          chatId: chat.chat_id,
          fileId: attachedFileId || undefined,
          activeMode: modeUsed,
          imagePreview: previewToKeep || undefined,
          docName: currentDoc?.name,
        });
      } else {
        setPendingApproval(null);
      }

      onSendMessage(
        finalPrompt,
        targetModel,
        result.response || result.reason || 'The MRPL backend returned no response.',
        previewToKeep || undefined,
        contextStr,
        currentDoc?.name,
        topSources,
        modeUsed
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach the MRPL backend.';
      setToastMessage({ text: `MRPL backend error: ${message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingApproval || !backendSessionId || isApproving) return;

    setIsApproving(true);
    setApprovalError(null);
    try {
      const approval = await mrplApi.approve({
        session_id: backendSessionId,
        tool: pendingApproval.tool,
      });
      if (!approval.approved || !approval.approved_actions.includes(pendingApproval.tool)) {
        throw new Error(`Approval for ${pendingApproval.tool} was not confirmed by the backend.`);
      }

      const result = await mrplApi.chat({
        message: pendingApproval.message,
        session_id: backendSessionId,
        chat_id: pendingApproval.chatId,
        file_id: pendingApproval.fileId,
        active_mode: pendingApproval.activeMode,
        sender_name: employeeName || undefined,
        sender_email: employeeEmail || undefined,
      });
      if (result.requires_approval === true) {
        throw new Error(result.reason || `Approval is still required for ${pendingApproval.tool}.`);
      }

      const retryModel = result.route?.primary_model || MODEL_CHAT;
      setGeneratedArtifact(result.artifact || null);
      setPendingApproval(null);
      onSendMessage(
        pendingApproval.message,
        retryModel,
        result.response || result.reason || 'The MRPL backend returned no response.',
        pendingApproval.imagePreview,
        undefined,
        pendingApproval.docName,
        undefined,
        pendingApproval.activeMode,
      );
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Approval failed.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDownloadArtifact = async () => {
    if (!generatedArtifact || !backendSessionId || isDownloadingArtifact) return;
    setIsDownloadingArtifact(true);
    setArtifactDownloadError(null);
    try {
      await mrplApi.downloadGeneratedFile(
        generatedArtifact.url,
        backendSessionId,
        generatedArtifact.filename,
      );
    } catch (error) {
      setArtifactDownloadError(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      setIsDownloadingArtifact(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 flex flex-col min-h-full justify-between">
      {/* Main Page Top Right Corner: New Chat & 3-Dot Options Menu */}
      <div className="fixed top-3.5 right-4 z-30 flex items-center gap-2">
        {/* New Chat Option */}
        <button
          id="top-new-chat-btn"
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-medium shadow-lg backdrop-blur-md transition-all group"
          title="Start a new chat"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-90 transition-transform duration-200" />
          <span>New Chat</span>
        </button>

        {/* 3-Dot Options Button */}
        <div className="relative" ref={chatMenuRef}>
          <button
            id="chat-corner-menu-btn"
            onClick={() => setChatMenuOpen((prev) => !prev)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border shadow-lg backdrop-blur-md ${
              chatMenuOpen
                ? 'bg-slate-800 text-white border-slate-600 shadow-md'
                : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
            }`}
            title="Chat options"
            aria-label="Chat options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu: share, pin, find in chat, archive, delete */}
          {chatMenuOpen && (
            <div
              id="chat-corner-dropdown-menu"
              className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#0F172A] border border-slate-700/90 shadow-[0_10px_35px_rgba(0,0,0,0.65)] py-1.5 z-50 text-xs backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-800/80"
            >
              <div className="py-1">
                {/* 1. Share */}
                <button
                  id="menu-opt-share"
                  onClick={handleShareChat}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800/90 flex items-center gap-2.5 transition"
                >
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Share</span>
                </button>

                {/* 2. Pin */}
                <button
                  id="menu-opt-pin"
                  onClick={handleTogglePin}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800/90 flex items-center gap-2.5 transition"
                >
                  {isChatPinned ? (
                    <>
                      <PinOff className="w-3.5 h-3.5 text-amber-400" />
                      <span>Unpin</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pin</span>
                    </>
                  )}
                </button>

                {/* 3. Find in chat */}
                <button
                  id="menu-opt-find"
                  onClick={handleOpenFindInChat}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800/90 flex items-center gap-2.5 transition"
                >
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Find in chat</span>
                </button>

                {/* 4. Archive */}
                <button
                  id="menu-opt-archive"
                  onClick={handleArchiveChat}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800/90 flex items-center gap-2.5 transition"
                >
                  <Archive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Archive</span>
                </button>
              </div>

              <div className="py-1">
                {/* 5. Delete */}
                <button
                  id="menu-opt-delete"
                  onClick={handleDeleteChat}
                  className="w-full px-3.5 py-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept=".png,.jpg,.jpeg"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocFileChange}
        accept=".pdf,.txt,.docx,.xlsx,.pptx"
        className="hidden"
      />

      {/* Live Camera Snapshot Modal if active */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-purple-500/40 rounded-2xl p-5 max-w-md w-full shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <span>Local Camera Snapshot (qwen2.5-vl:7b)</span>
              </h4>
              <button onClick={stopCamera} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl bg-black border border-slate-800 aspect-video object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-2 mt-4">
              <button
                onClick={capturePhoto}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-[0_0_12px_rgba(168,85,247,0.4)] flex items-center justify-center gap-1.5"
              >
                <span>📸 Capture Snapshot</span>
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP & MIDDLE CONTENT AREA */}
      {messages.length === 0 ? (
        /* Empty State: Center Hero Banner and Quick Suggestions */
        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium bg-slate-900/80 backdrop-blur-sm text-slate-300 border border-slate-700/70 mb-4 shadow-md">
            <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-mono uppercase tracking-wider text-[11px]">Sovereign Local Intelligence</span>
          </div>

          <div className="flex items-center justify-center mb-2.5">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
              LOC IN WORKSPACE
            </h1>
          </div>
          <p className="text-sm text-slate-300/90 max-w-xl mx-auto font-normal drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
            Secure, private, and offline AI workspace.
          </p>

          {/* Reserved space for name tag between the 'Secure...' description and the type bar */}
          <div 
            id="reserved-name-tag-slot" 
            className="w-full max-w-sm h-16 sm:h-20 my-4 sm:my-6 pointer-events-none"
            aria-hidden="true"
          />
        </div>
      ) : (
        /* Active Conversation Area */
        <div className="flex-1 flex flex-col pt-1 pb-6">
          {/* Header Bar with Corner Three-Dots Menu */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/80 sticky top-0 bg-[#0B1120]/95 backdrop-blur-md z-10">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-semibold text-white tracking-tight">LOC IN WORKSPACE</span>
              <span className="text-xs font-mono text-slate-400">({messages.length} messages)</span>
              {isChatPinned && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Pin className="w-2.5 h-2.5 fill-amber-400" />
                  <span>Pinned</span>
                </span>
              )}
            </div>

            {/* Main Page Corner: View Archived Chats if any */}
            {archivedChats.length > 0 && (
              <button
                id="view-archived-btn"
                onClick={() => setArchivedModalOpen(true)}
                className="text-slate-400 hover:text-emerald-400 text-xs flex items-center gap-1.5 transition px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 border border-slate-800"
                title="View Archived Conversations"
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Archived ({archivedChats.length})</span>
              </button>
            )}
          </div>

          {/* Inline Find in Chat Search Bar */}
          {isSearchOpen && (
            <div className="mb-3 p-2.5 rounded-xl bg-slate-900/95 border border-indigo-500/40 backdrop-blur-md flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-1">
              <Search className="w-4 h-4 text-indigo-400 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentMatchIndex(0);
                }}
                placeholder="Find in chat messages..."
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
              />
              {searchQuery.trim() && (
                <span className="text-[11px] font-mono text-slate-400 px-1.5 shrink-0">
                  {matchedMessageIds.length > 0
                    ? `${currentMatchIndex + 1} of ${matchedMessageIds.length}`
                    : 'No matches'}
                </span>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMatch}
                  disabled={matchedMessageIds.length === 0}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition"
                  title="Previous match"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextMatch}
                  disabled={matchedMessageIds.length === 0}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition"
                  title="Next match"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white ml-1 transition"
                  title="Close search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Messages Stream */}
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`p-4 rounded-xl text-sm leading-relaxed transition-all ${
                  msg.role === 'user'
                    ? `${themeConfig.userBubbleBg} ml-8 shadow-sm`
                    : `${themeConfig.cardBg} border text-slate-200 mr-8 shadow-[0_2px_15px_rgba(0,0,0,0.3)]`
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {msg.role === 'user' ? (
                      <div className="w-5 h-5 rounded bg-blue-600/30 flex items-center justify-center text-blue-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded bg-emerald-600/30 flex items-center justify-center text-emerald-400">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="font-semibold text-xs text-slate-300">
                      {msg.role === 'user' ? 'YOU' : 'OMEGA ASSISTANT'}
                    </span>
                    {msg.role === 'assistant' && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        {msg.model}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">{msg.timestamp}</span>
                </div>

                {/* If image attached to user query */}
                {msg.imageUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-slate-700 max-w-xs shadow-md">
                    <img src={msg.imageUrl} alt="Attached snapshot" className="w-full h-auto object-cover" />
                  </div>
                )}

                {/* If document attached to user query */}
                {msg.docName && (
                  <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attached Document: {msg.docName}</span>
                  </div>
                )}

                {/* Content */}
                {renderMessageContent(msg.content)}

                {/* Document RAG Citations/Sources if present */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <div className="text-[11px] font-mono text-cyan-400 mb-1.5 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Retrieved Document Grounding Excerpts:</span>
                    </div>
                    <div className="space-y-1.5">
                      {msg.sources.map((s, idx) => (
                        <div key={idx} className="p-2 rounded bg-slate-950/60 border border-slate-800 text-[11px]">
                          <div className="flex justify-between items-center text-slate-300 mb-0.5 font-semibold">
                            <span>{s.source} (Chunk #{s.chunkIndex + 1})</span>
                            <span className="font-mono text-cyan-400 text-[10px]">{Math.round(s.similarity * 100)}% match</span>
                          </div>
                          <p className="text-slate-400 italic line-clamp-2">{s.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {pendingApproval && (
              <div className="mr-8 p-4 rounded-xl bg-[#0B1120] border border-amber-500/30 text-sm text-slate-200 shadow-sm">
                <div className="text-amber-300 mb-2">Approval required for {pendingApproval.tool}</div>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isApproving ? 'Approving...' : 'Approve'}</span>
                </button>
                {approvalError && (
                  <div className="mt-2 text-xs text-rose-300">{approvalError}</div>
                )}
              </div>
            )}

            {generatedArtifact && generatedArtifact.filename.toLowerCase().endsWith('.docx') && (
              <div className="mr-8 p-4 rounded-xl bg-[#0B1120] border border-emerald-500/30 text-sm text-slate-200 shadow-sm">
                <div className="text-emerald-300 mb-2">Word document generated.</div>
                <button
                  type="button"
                  onClick={handleDownloadArtifact}
                  disabled={isDownloadingArtifact}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingArtifact ? 'Downloading...' : 'Download Word document'}</span>
                </button>
                {artifactDownloadError && (
                  <div className="mt-2 text-xs text-rose-300">{artifactDownloadError}</div>
                )}
              </div>
            )}

            {isLoading && (
              <div className="p-4 rounded-xl bg-[#0B1120] border border-blue-500/30 mr-8 text-xs text-blue-300 flex items-center gap-2.5 shadow-sm">
                <span className="animate-spin">⚙️</span>
                <span>Inferencing locally with {activeCapability === 'vision' ? MODEL_VISION : MODEL_CHAT}...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* DOCKED BOTTOM TYPE BAR SECTION */}
      <div className="sticky bottom-0 bg-transparent pt-2 pb-4 mt-auto z-20">
        {/* Attachment Preview Strip (Image or Document) */}
        {(attachedImagePreview || attachedFileName || attachedDoc) && (
          <div className="mb-2 p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              {attachedImagePreview && (
                <div className="relative group">
                  <img
                    src={attachedImagePreview}
                    alt="Attached preview"
                    className="w-12 h-12 rounded-lg object-cover border border-purple-500/50 shadow-sm"
                  />
                  <span className="text-[10px] font-mono text-purple-300 block mt-0.5">👁️ Image Attached</span>
                </div>
              )}

              {attachedFileName && !attachedImagePreview && (
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-cyan-300 truncate max-w-xs">{attachedFileName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {uploadStatus === 'uploading' ? 'Uploading to MRPL backend...' : uploadStatus === 'uploaded' ? 'Uploaded to MRPL backend' : uploadError || 'Upload failed'}
                    </div>
                  </div>
                </div>
              )}

              {attachedImagePreview && attachedFileName && (
                <div className="text-[10px] text-slate-400 font-mono">
                  {uploadStatus === 'uploading' ? 'Uploading to MRPL backend...' : uploadStatus === 'uploaded' ? attachedFileName : uploadError || 'Upload failed'}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setAttachedImagePreview(null);
                setAttachedImageB64(null);
                setAttachedFileId(null);
                setAttachedFileName(null);
                setUploadStatus('idle');
                setUploadError(null);
                setAttachedDoc(null);
                setActiveCapability('chatbot');
              }}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* The Unified Type Bar Container */}
        <form
          onSubmit={(e) => handleSubmit(e)}
          className="relative bg-black/90 border border-zinc-800/80 focus-within:border-zinc-700/80 rounded-2xl transition-all p-3 shadow-[0_10px_35px_rgba(0,0,0,0.95)] outline-none ring-0 focus-within:ring-0"
        >
          <div className="flex items-start gap-2.5">
            {/* THE PROMINENT "+" BUTTON */}
            <div className="relative pt-1" ref={plusMenuRef}>
              <button
                type="button"
                id="typebar-plus-btn"
                onClick={() => setPlusMenuOpen(!plusMenuOpen)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  plusMenuOpen
                    ? 'bg-cyan-500 text-slate-950 font-bold rotate-45 shadow-sm'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800 shadow-sm'
                }`}
                title="Select capability (+ Chatbot, Vision, Document Analysis)"
              >
                <Plus className="w-5 h-5 transition-transform duration-200" />
              </button>

              {/* PLUS DROPDOWN MENU POPOVER - EXACTLY 3 CLEAN OPTIONS, NO DESCRIPTIONS */}
              {plusMenuOpen && (
                <div 
                  id="plus-options-popover"
                  className="absolute bottom-12 left-0 w-48 bg-black border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-40 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 space-y-1"
                >
                  {/* 1. CHATBOT */}
                  <button
                    type="button"
                    id="opt-chatbot"
                    onClick={() => {
                      setActiveCapability('chatbot');
                      setAttachedImagePreview(null);
                      setAttachedImageB64(null);
                      setAttachedFileId(null);
                      setAttachedFileName(null);
                      setUploadStatus('idle');
                      setUploadError(null);
                      setAttachedDoc(null);
                      setPlusMenuOpen(false);
                      textareaRef.current?.focus();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition font-medium text-xs ${
                      activeCapability === 'chatbot' && !attachedImagePreview && !attachedDoc
                        ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                        : 'hover:bg-zinc-900 text-zinc-200'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Chatbot</span>
                  </button>

                  {/* 2. VISION */}
                  <button
                    type="button"
                    id="opt-vision"
                    onClick={() => {
                      setActiveCapability('vision');
                      setAttachedFileId(null);
                      setAttachedFileName(null);
                      setUploadStatus('idle');
                      setUploadError(null);
                      setAttachedDoc(null);
                      setPlusMenuOpen(false);
                      imageInputRef.current?.click();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition font-medium text-xs ${
                      activeCapability === 'vision' || attachedImagePreview
                        ? 'bg-purple-950/80 border border-purple-500/40 text-purple-300'
                        : 'hover:bg-zinc-900 text-zinc-200'
                    }`}
                  >
                    <Eye className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Vision</span>
                  </button>

                  {/* 3. DOC ANALYSIS */}
                  <button
                    type="button"
                    id="opt-doc"
                    onClick={() => {
                      setActiveCapability('document');
                      setAttachedImagePreview(null);
                      setAttachedImageB64(null);
                      setAttachedFileId(null);
                      setAttachedFileName(null);
                      setUploadStatus('idle');
                      setUploadError(null);
                      setPlusMenuOpen(false);
                      docInputRef.current?.click();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition font-medium text-xs ${
                      activeCapability === 'document' || attachedDoc
                        ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
                        : 'hover:bg-zinc-900 text-zinc-200'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Doc Analysis</span>
                  </button>
                </div>
              )}
            </div>

            {/* Main Textarea */}
            <textarea
              id="home-large-chat-input"
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (settings?.sendOnEnter !== false) {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  } else {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }
                }
              }}
              placeholder={
                activeCapability === 'vision' || attachedImagePreview
                  ? 'Ask about this image (e.g., "Describe what you see", "Read text")...'
                  : activeCapability === 'document' || attachedDoc
                  ? 'Ask a question about the uploaded document...'
                  : 'Ask LOC IN anything, or write code...'
              }
              rows={2}
              className="flex-1 bg-transparent text-slate-100 placeholder-zinc-500 resize-none outline-none focus:outline-none focus:ring-0 text-sm sm:text-base px-1 py-1"
            />
          </div>

          {/* Bottom Toolbar of the Input Box */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 mt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                <Cpu className="w-3 h-3" />
                Auto-Route: {activeCapability === 'vision' || attachedImageB64 ? MODEL_VISION : activeCapability === 'document' && attachedDoc ? `${MODEL_CHAT} (RAG)` : inputText ? chooseModel(inputText, false) : MODEL_CHAT}
              </span>
              <span className="hidden sm:inline text-zinc-500 text-[11px]">
                {settings?.sendOnEnter !== false ? 'Enter to send, Shift+Enter for newline' : 'Ctrl+Enter to send'}
              </span>
            </div>

            {/* Submit control */}
            <div className="flex items-center gap-2">
              <button
                id="home-submit-btn"
                type="submit"
                disabled={
                  isLoading ||
                  uploadStatus === 'uploading' ||
                  (!inputText.trim() && !attachedImageB64) ||
                  (activeCapability === 'document' && !attachedFileId)
                }
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all select-none shadow-sm ${
                  isLoading
                    ? 'bg-slate-800 text-slate-200 border border-slate-700 cursor-wait'
                    : !inputText.trim() && !attachedImageB64
                    ? 'bg-slate-800/90 text-slate-200 border border-slate-700 hover:border-slate-600 cursor-not-allowed'
                    : `${themeConfig.sendBtnBg} cursor-pointer hover:scale-[1.02] active:scale-[0.98]`
                }`}
              >
                <span className="font-bold tracking-wide">{isLoading ? 'Thinking Locally...' : 'Ask LOC IN'}</span>
                <Send className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-rose-500/30 rounded-2xl p-5 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-rose-400 mb-2">
              <Trash2 className="w-5 h-5" />
              <h4 className="text-sm font-semibold text-white">Clear Chat Conversation?</h4>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              This will clear all {messages.length} messages in this conversation.
            </p>
            <div className="flex justify-end gap-2">
              <button
                id="cancel-delete-chat-btn"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-chat-btn"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition shadow-sm"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Chats Modal */}
      {archivedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl p-5 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-white">
                <Archive className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold">Archived Conversations ({archivedChats.length})</h4>
              </div>
              <button onClick={() => setArchivedModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {archivedChats.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No archived chats yet.
                </div>
              ) : (
                archivedChats.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-semibold text-slate-200 truncate">{c.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.date} • {c.messageCount} messages</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRestoreArchived(c.id)}
                        className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-medium transition"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteArchived(c.id)}
                        className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                        title="Delete archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 text-slate-200 text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage.text}</span>
          {toastMessage.undoAction && (
            <button
              onClick={() => {
                toastMessage.undoAction?.();
                setToastMessage(null);
              }}
              className="ml-2 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[11px] font-semibold border border-cyan-500/40 transition"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
};
