// Types pour les réponses RAG
export interface RagResponse {
  id: string;
  query: string;
  answer: string;
  sources: RagSource[];
  confidence: number;
  processingTimeMs: number;
  timestamp: string;
}

export interface RagSource {
  id: string;
  title: string;
  type: string;
  page?: number;
  spanStart: number;
  spanEnd: number;
  text: string;
  confidence: number;
  chunkId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: RagSource[];
  confidence?: number;
  processingTimeMs?: number;
}

// Types pour les documents
export interface Document {
  id: string;
  title: string;
  filename: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'processing' | 'ready' | 'error';
  pageCount?: number;
  chunkCount?: number;
}

export interface DocumentContent {
  id: string;
  title: string;
  content: string;
  pages: DocumentPage[];
}

export interface DocumentPage {
  number: number;
  content: string;
  spans: DocumentSpan[];
}

export interface DocumentSpan {
  start: number;
  end: number;
  text: string;
  chunkId?: string;
}

// Types pour l'upload
export interface UploadProgress {
  filename: string;
  progress: number; // 0-100
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// Types pour les filtres
export interface DocumentFilter {
  search?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

// Types pour la pagination
export interface PaginatedResponse<T> {
  items: T[]; total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Types pour le Magic Studio
export interface MindMapNode {
  id: string;
  label: string;
  type: 'concept' | 'document' | 'citation';
  weight: number;
  x?: number;
  y?: number;
  color?: string;
}

export interface MindMapEdge {
  source: string;
  target: string;
  weight: number;
  type: 'related' | 'cited' | 'contains';
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export interface FlashCard {
  id: string;
  question: string;
  answer: string;
  source: RagSource;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Types pour les actions
export interface ExportOptions {
  format: 'markdown' | 'pdf' | 'json';
  includeMetadata: boolean;
  includeSources: boolean;
  includeTimestamps: boolean;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  downloadUrl?: string;
}

// Types pour les thèmes
export type Theme = 'light' | 'dark';

export interface ThemeConfig {
  theme: Theme;
  primaryColor: string;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
}

// Types pour les raccourcis clavier
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: string;
  description: string;
}

// Types pour les notifications
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number; // en ms, 0 = permanent
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary';
}

// Types pour les événements SSE
export interface SSEEvent {
  type: 'token' | 'source' | 'complete' | 'error';
  data: unknown;
}

export interface SSETokenEvent extends SSEEvent {
  type: 'token';
  data: {
    token: string;
    position: number;
  };
}

export interface SSESourceEvent extends SSEEvent {
  type: 'source';
  data: RagSource;
}

export interface SSECompleteEvent extends SSEEvent {
  type: 'complete';
  data: {
    confidence: number;
    processingTimeMs: number;
    sources: RagSource[];
  };
}

export interface SSEErrorEvent extends SSEEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}
