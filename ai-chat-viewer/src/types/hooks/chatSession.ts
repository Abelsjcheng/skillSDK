export type {
  HiddenQuestionAnswerUserMessage,
  SendUserMessageOptions,
} from '../components/chat';
import type { Message, PendingAssistantPreview, QuestionAnswerSubmission, SessionStatus } from '../index';
import type { WeAgentDetails } from '../bridge';
import type { SlashCommandItem } from '../slashCommand';

export type ChatSessionMode = 'weAgentCUI' | 'skillCUI';

export interface UseChatSessionOptions {
  mode: ChatSessionMode;
  welinkSessionId: string;
  assistantDetail?: WeAgentDetails | null;
  onSessionTitleChange?: (sessionId: string, title: string) => void;
  onSessionActivity?: (sessionId: string, updatedAt: string) => void;
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
  slashCommands: SlashCommandItem[];
  onLoadMoreHistory: () => void;
  onRequestSlashCommands: () => Promise<void>;
  onQuestionAnswered: (submission: QuestionAnswerSubmission) => Promise<void>;
  onSend: (content: string) => Promise<void>;
  onStop: () => Promise<void>;
  onSendToIM: (content: string) => Promise<void>;
  onCopy: (content: string) => Promise<void>;
  resetTransientState: () => void;
}
