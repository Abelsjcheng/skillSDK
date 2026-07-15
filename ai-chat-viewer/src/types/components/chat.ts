import type { ImgHTMLAttributes, ReactNode } from 'react';
import type {
  Message,
  MessagePart,
  PendingAssistantPreview,
  QuestionAnswerSubmission,
  SessionStatus,
} from '../index';
import type { WeAgentDetails } from '../bridge';

export interface AppProps {
  assistantAccount?: string;
}

export interface HarmonySplitLayoutState {
  enabled: boolean;
  statusBarHeight: number;
  safeAreaInsetBottom: number;
}

export interface ContentProps {
  messages: Message[];
  pendingAssistantPreview: PendingAssistantPreview;
  welinkSessionId: string;
  messageVariant?: 'weAgent' | 'plain';
  showMessageActions?: boolean;
  showWelcome?: boolean;
  scrollToBottomSignal?: number;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  onLoadMoreHistory: () => void;
  onQuestionAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
  onCopy?: (content: string) => Promise<void> | void;
  onSendToIM?: (content: string) => Promise<void> | void;
  weAgentUserName?: string;
  weAgentUserAvatar?: string;
  weAgentAssistantName?: string;
  weAgentAssistantDescription?: string;
  weAgentAssistantAvatar?: string;
}

export interface CodeBlockProps {
  code: string;
  language?: string;
}

export interface PermissionCardProps {
  part: MessagePart;
  welinkSessionId: string;
  page?: 'weAgentCUI' | 'skillCUI';
  onResolved?: () => void;
  readonly?: boolean;
}

export interface QuestionCardProps {
  part: MessagePart;
  messageId?: string;
  welinkSessionId?: string;
  page?: 'weAgentCUI' | 'skillCUI';
  onAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
  readonly?: boolean;
}

export interface ThinkingBlockProps {
  part: MessagePart;
}

export interface MessageBubbleProps {
  message: Message;
  welinkSessionId: string;
  variant?: 'weAgent' | 'plain';
  showActions?: boolean;
  onQuestionAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
  onCopy?: (content: string) => Promise<void> | void;
  onSendToIM?: (content: string) => Promise<void> | void;
  weAgentUserName?: string;
  weAgentUserAvatar?: string;
  weAgentAssistantName?: string;
  weAgentAssistantAvatar?: string;
}

export interface ToolCardProps {
  part: MessagePart;
}

export interface ErrorBlockProps {
  part: MessagePart;
}

export interface SubtaskBlockProps {
  part: MessagePart;
  children?: ReactNode;
}

export interface PendingAssistantBubbleProps {
  startedAt: number;
  weAgentAssistantName?: string;
  weAgentAssistantAvatar?: string;
  messageVariant?: 'weAgent' | 'plain';
}

export interface AvatarImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc: string;
}

export interface HiddenQuestionAnswerUserMessage {
  content: string;
  toolCallId?: string;
  questionId?: string;
  subagentSessionId?: string;
}

export interface SendUserMessageOptions {
  suppressUserBubble?: boolean;
}

export interface QuestionFieldSource {
  header?: unknown;
  question?: unknown;
  options?: unknown;
  multiSelect?: unknown;
  questions?: unknown;
  content?: unknown;
}

export interface MapRawPartOptions {
  allowInputQuestionsFallback?: boolean;
}

export interface QuestionAnswerDisplayLabels {
  unanswered?: string;
  questionPrefix?: string;
  answerSeparator?: string;
  questionTitle?: (index: number) => string;
  showQuestionTitle?: boolean;
}

export interface LegacyQuestionAnswerTranscriptItem {
  question: string;
  answer: string;
}

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
  onLoadMoreHistory: () => void;
  onQuestionAnswered: (submission: QuestionAnswerSubmission) => Promise<void>;
  onSend: (content: string) => Promise<void>;
  onStop: () => Promise<void>;
  onSendToIM: (content: string) => Promise<void>;
  onCopy: (content: string) => Promise<void>;
  resetTransientState: () => void;
}
