import type { ImgHTMLAttributes } from 'react';
import type { Message, MessagePart, PendingAssistantPreview, QuestionAnswerSubmission } from '../index';

export interface AppProps {
  assistantAccount?: string;
}

export interface ContentProps {
  messages: Message[];
  pendingAssistantPreview: PendingAssistantPreview;
  welinkSessionId: string;
  scrollToBottomSignal?: number;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  onLoadMoreHistory: () => void;
  onQuestionAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
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
  onResolved?: () => void;
  readonly?: boolean;
}

export interface QuestionCardProps {
  part: MessagePart;
  onAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
  readonly?: boolean;
}

export interface ThinkingBlockProps {
  part: MessagePart;
}

export interface MessageBubbleProps {
  message: Message;
  welinkSessionId: string;
  onQuestionAnswered?: (submission: QuestionAnswerSubmission) => Promise<void> | void;
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

export interface PendingAssistantBubbleProps {
  startedAt: number;
  weAgentAssistantName?: string;
  weAgentAssistantAvatar?: string;
}

export interface AvatarImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc: string;
}
