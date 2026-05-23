import type { Message, PendingAssistantPreview, QuestionAnswerSubmission, SessionStatus } from '../index';

export type ChatSessionMode = 'weAgentCUI' | 'skillCUI';

export interface UseChatSessionOptions {
  mode: ChatSessionMode;
  welinkSessionId: string;
  onSessionTitleChange?: (sessionId: string, title: string) => void;
}

export interface UseChatSessionResult {
  messages: Message[];
  pendingAssistantPreview: PendingAssistantPreview;
  welinkSessionId: string;
  sessionStatus: SessionStatus;
  isGenerating: boolean;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  scrollToBottomSignal: number;
  onLoadMoreHistory: () => void;
  onQuestionAnswered: (submission: QuestionAnswerSubmission) => Promise<void>;
  onSend: (content: string) => Promise<void>;
  onStop: () => Promise<void>;
  onSendToIM: () => Promise<void>;
  onCopy: (content: string) => Promise<void>;
  resetTransientState: () => void;
}
