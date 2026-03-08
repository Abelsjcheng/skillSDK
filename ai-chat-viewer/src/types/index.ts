export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AIProgressStatus {
  status: 'idle' | 'thinking' | 'processing' | 'completed' | 'error';
  step: number;
  totalSteps: number;
}

export interface ChatState {
  title: string;
  messages: ChatMessage[];
  progress: AIProgressStatus;
  isLoading: boolean;
  isMaximized: boolean;
}
