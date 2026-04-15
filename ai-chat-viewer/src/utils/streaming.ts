import i18n from '../i18n/config';
import type { Message } from '../types';
import { genMessageId } from './message';

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
