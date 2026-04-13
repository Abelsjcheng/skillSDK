import i18n from '../i18n/config';
import type { Message, StreamMessage } from '../types';
import { genMessageId } from './message';

export function shouldCreatePendingAssistantMessage(msg: StreamMessage): boolean {
  return msg.type === 'step.start'
    || (msg.type === 'session.status' && msg.sessionStatus === 'busy');
}

export function createPendingAssistantMessage(): Message {
  return {
    id: genMessageId('assistant_pending'),
    role: 'assistant',
    content: i18n.t('pending.generating'),
    contentType: 'plain',
    timestamp: Date.now(),
    isStreaming: true,
    parts: [],
    meta: {
      pending: true,
    },
  };
}
