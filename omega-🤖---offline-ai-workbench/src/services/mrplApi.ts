function normalizeLocalApiHost(hostname: string): string {
  const normalized = (hostname || 'localhost').trim();
  if (!normalized || normalized === '0.0.0.0' || normalized === '::' || normalized === '[::]' || normalized === '::1') {
    return '127.0.0.1';
  }
  return normalized;
}

const DEFAULT_API_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${normalizeLocalApiHost(window.location.hostname)}:8000`
  : 'http://127.0.0.1:8000';

const configuredApiUrl = (import.meta.env.VITE_MRPL_API_URL as string | undefined)?.trim();
const API_URL = (configuredApiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
let activeSessionId: string | null = null;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sessionHeader = activeSessionId && path !== '/api/session'
    ? { 'X-Session-ID': activeSessionId }
    : {};
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...sessionHeader,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      detail = payload?.detail ?? payload?.error ?? detail;
    } catch {
      try {
        detail = await response.text();
      } catch {
        detail = detail;
      }
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export type HealthResponse = {
  status: string;
  service?: string;
};

export type StatusResponse = {
  status: string;
  generated_files_dir?: string;
  upload_dir?: string;
  chats?: number;
  memories?: number;
};

export type ModelsResponse = {
  models: Record<string, Record<string, any>>;
  ollama_host: string;
};

export type SessionResponse = {
  session_id: string;
  employee_name: string;
  employee_email: string;
  approved_actions: string[];
};

export type UploadResponse = {
  file_id: string;
  filename: string;
  size_bytes: number;
  content_type: string;
};

export type ChatResponse = {
  chat_id?: string;
  message?: string;
  response?: string;
  status?: string;
  task?: string | null;
  route?: { task_type?: string; primary_model?: string; needs_tools?: boolean };
  file_name?: string | null;
  artifact?: GeneratedArtifact | null;
  session_id?: string;
  requires_approval?: boolean;
  tool?: string;
  reason?: string;
  citations?: Citation[];
};

export type GeneratedArtifact = {
  filename: string;
  url: string;
  mime_type: string;
  size_bytes: number;
};

export type Citation = {
  source_label: string;
  chunk_number?: number | null;
  page_number?: number | null;
  evidence_excerpt?: string;
};

export type ChatListResponse = {
  chats: Array<{ chat_id: string; title: string; created_at?: string; updated_at?: string }>;
};

export type MemoryEntry = {
  id: number;
  content: string;
  category: string;
  source: string;
  created_at: string;
};

export type MemoriesResponse = {
  memories: MemoryEntry[];
};

export type GeneratedFileEntry = {
  filename: string;
  size_bytes: number;
  url: string;
};

export type GeneratedFilesResponse = {
  files: GeneratedFileEntry[];
};

export const mrplApi = {
  health: () => request<HealthResponse>('/api/health'),
  status: () => request<StatusResponse>('/api/status'),
  models: () => request<ModelsResponse>('/api/models'),

  createSession: async (payload: { employee_name?: string; employee_email?: string }) => {
    const session = await request<SessionResponse>('/api/session', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    activeSessionId = session.session_id;
    return session;
  },

  chat: (payload: {
    message: string;
    session_id?: string;
    chat_id?: string;
    file_id?: string;
    active_mode?: 'chatbot' | 'vision' | 'document';
    sender_name?: string;
    sender_email?: string;
    memory_context?: string;
  }) =>
    request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<UploadResponse>('/api/upload', {
      method: 'POST',
      body: formData,
    });
  },

  listChats: () => request<ChatListResponse>('/api/chats'),
  createChat: (title?: string) =>
    request<{ chat_id: string; title: string }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    }),
  getChat: (chatId: string) => request<{ chat: any; messages: any[] }>(`/api/chats/${chatId}`),
  renameChat: (chatId: string, title: string) =>
    request<{ chat_id: string; title: string }>(`/api/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteChat: (chatId: string) =>
    request<{ deleted: boolean; chat_id: string }>(`/api/chats/${chatId}`, {
      method: 'DELETE',
    }),

  getMemories: () => request<MemoriesResponse>('/api/memories'),
  deleteMemory: (memoryId: number) =>
    request<{ deleted: boolean; memory_id: number }>(`/api/memories/${memoryId}`, {
      method: 'DELETE',
    }),

  approve: (payload: { session_id: string; tool: string }) =>
    request<{ session_id: string; tool: string; approved: boolean; approved_actions: string[] }>('/api/approve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listGeneratedFiles: () => request<GeneratedFilesResponse>('/api/generated-files'),
  generatedFileUrl: (filename: string) => `${API_URL}/api/generated-files/${encodeURIComponent(filename)}`,
  downloadGeneratedFile: async (url: string, sessionId: string, filename: string) => {
    const resolvedUrl = url.startsWith('http') ? url : `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    const response = await fetch(resolvedUrl, {
      headers: { 'X-Session-ID': sessionId },
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  },
};

export const API_BASE_URL = API_URL;
