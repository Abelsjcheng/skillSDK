import type { ImgHTMLAttributes, ReactNode } from 'react';
import type { Message, MessagePart, PendingAssistantPreview, QuestionAnswerSubmission } from '../index';

export interface AppProps {
  assistantAccount?: string;
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
  defaultExpanded?: boolean;
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
