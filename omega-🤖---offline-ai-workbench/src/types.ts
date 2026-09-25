export type NavigationPage = 
  | 'home';

export type AppTheme = 'slate' | 'obsidian' | 'midnight' | 'titanium' | 'sovereign';

export interface ChatbotSettings {
  // Model & Intelligence
  defaultModel: string;
  temperature: number; // 0.0 - 1.0
  maxTokens: number; // 256 - 4096
  topP: number; // 0.1 - 1.0
  systemPrompt: string;
  systemPersona: string;
  streamResponse: boolean;
  contextTurnLimit: number;

  // Chat Behavior
  sendOnEnter: boolean;
  autoScroll: boolean;
  soundEffects: boolean;
  codeHighlighting: boolean;
  fontSize: 'compact' | 'normal' | 'large';
  lightWavesIntensity: 'ambient' | 'vibrant' | 'subtle' | 'off';
  backgroundStyle: 'tesseract_4d' | 'obsidian_sculptural' | 'local_ai_core' | 'neural_mesh' | 'light_waves' | 'none';
  backgroundBrightness: number; // Percentage, 0 - 100 (default 50)

  // Voice & Audio
  speechRecognitionLang: string;
  autoReadTTS: boolean;
  speechRate: number;
  speechPitch: number;

  // Privacy & Data
  incognitoMode: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string;
  timestamp: string;
  imageUrl?: string;
  docContext?: string;
  docName?: string;
  sources?: RagSource[];
  activeMode?: 'chatbot' | 'vision' | 'document';
}

export interface ActivityItem {
  id: string;
  query: string;
  topic?: string;
  model: string;
  category: 'General' | 'Coding' | 'Vision' | 'Document RAG' | 'Chatbot';
  time: string;
  messages?: ChatMessage[];
  messageCount?: number;
}

export interface ProcessedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  chunksCount: number;
  processedAt: string;
  text: string;
  chunks: { id: string; text: string; chunkIndex: number }[];
}

export interface RagSource {
  source: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

export interface OllamaStatus {
  online: boolean;
  statusText: string;
  installedModels: string[];
  lastChecked: string;
}
