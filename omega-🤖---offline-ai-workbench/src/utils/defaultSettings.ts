import { ChatbotSettings } from '../types';
import { MODEL_CHAT } from '../services/ollamaService';

export const DEFAULT_SETTINGS: ChatbotSettings = {
  defaultModel: MODEL_CHAT,
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  systemPrompt: 'You are LOC IN, an ultra-fast, sovereign local intelligence assistant. You provide clear, accurate, concise, and structured responses.',
  systemPersona: 'default',
  streamResponse: true,
  contextTurnLimit: 20,

  sendOnEnter: true,
  autoScroll: true,
  soundEffects: false,
  codeHighlighting: true,
  fontSize: 'normal',
  lightWavesIntensity: 'ambient',
  backgroundStyle: 'tesseract_4d',
  backgroundBrightness: 15,

  speechRecognitionLang: 'en-US',
  autoReadTTS: false,
  speechRate: 1.0,
  speechPitch: 1.0,

  incognitoMode: false
};

export const PERSONA_PRESETS = [
  {
    id: 'default',
    title: 'Balanced Assistant (Default)',
    description: 'Helpful, concise, friendly, and structured responses.',
    prompt: 'You are LOC IN, an ultra-fast, sovereign local intelligence assistant. You provide clear, accurate, concise, and structured responses.'
  },
  {
    id: 'developer',
    title: 'Senior Software Engineer',
    description: 'Focuses on production-grade, bug-free, commented code with architecture reasoning.',
    prompt: 'You are an elite Senior Full-Stack Software Engineer. Provide strictly tested, optimized, and cleanly structured code solutions. Include brief explanations and best practices.'
  },
  {
    id: 'academic',
    title: 'Academic Tutor & Researcher',
    description: 'Thorough, pedagogical explanations with scientific rigor and step-by-step proofs.',
    prompt: 'You are an empathetic, world-class academic tutor. Explain complex topics clearly from first principles using analogies, bullet points, and step-by-step logic.'
  },
  {
    id: 'executive',
    title: 'Executive Briefing',
    description: 'Ultra-concise, high-impact bullet points for rapid decision-making.',
    prompt: 'You are an executive Chief of Staff. Keep responses strictly concise, actionable, and formatted in high-impact bullet points with clear takeaways and zero fluff.'
  },
  {
    id: 'creative',
    title: 'Creative Writer & Brainstormer',
    description: 'Imaginative, engaging storytelling and lateral problem solving.',
    prompt: 'You are a creative writer, thinker, and copywriter. Think outside the box, propose diverse ideas, and use engaging, vibrant language.'
  }
];

export const STORAGE_KEY_SETTINGS = 'omega_chatbot_settings';

export function loadSettings(): ChatbotSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (parsed.backgroundBrightness === 10 || parsed.backgroundBrightness === 50 || parsed.backgroundBrightness === undefined) {
      parsed.backgroundBrightness = 15;
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ChatbotSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
}
