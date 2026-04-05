import type { Message, StreamMessage } from '../types';
import { genMessageId } from './message';

export const PENDING_ASSISTANT_MESSAGE = '正在生成中，请稍等...';

export function shouldCreatePendingAssistantMessage(msg: StreamMessage): boolean {
  return msg.type === 'step.start'
    || (msg.type === 'session.status' && msg.sessionStatus === 'busy');
}

export function createPendingAssistantMessage(): Message {
  return {
    id: genMessageId('assistant_pending'),
    role: 'assistant',
    content: PENDING_ASSISTANT_MESSAGE,
    contentType: 'plain',
    timestamp: Date.now(),
    isStreaming: true,
    parts: [],
    meta: {
      pending: true,
    },
  };
}
