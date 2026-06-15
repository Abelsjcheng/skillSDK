import type { Message, MessagePart } from '../../types';
import { getAssistantMessageCopyText } from '../message';

function createAssistantMessage(overrides: Partial<Message>): Message {
  return {
    id: 'message-1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: false,
    ...overrides,
  };
}

function createTextPart(partId: string, content: string, overrides: Partial<MessagePart> = {}): MessagePart {
  return {
    partId,
    type: 'text',
    content,
    isStreaming: false,
    ...overrides,
  };
}

describe('getAssistantMessageCopyText', () => {
  it('prefers completed text parts over fallback message content', () => {
    const message = createAssistantMessage({
      content: 'fallback content',
      parts: [
        createTextPart('text-1', '第一段'),
        createTextPart('text-2', '第二段'),
      ],
    });

    expect(getAssistantMessageCopyText(message)).toBe('第一段\n\n第二段');
  });

  it('collects completed text from subtask parts and skips non-final interactive parts', () => {
    const message = createAssistantMessage({
      parts: [
        {
          partId: 'thinking-1',
          type: 'thinking',
          content: '内部思考',
          isStreaming: false,
        },
        {
          partId: 'subtask-1',
          type: 'subtask',
          content: '',
          isStreaming: false,
          subParts: [
            createTextPart('subtask-text-1', '子任务正文'),
            {
              partId: 'permission-1',
              type: 'permission',
              content: '授权卡片',
              isStreaming: false,
            },
          ],
        },
        createTextPart('text-2', '最终总结'),
      ],
    });

    expect(getAssistantMessageCopyText(message)).toBe('子任务正文\n\n最终总结');
  });

  it('falls back to completed assistant message content when no text parts exist', () => {
    const message = createAssistantMessage({
      content: '最终正文',
      parts: [
        {
          partId: 'file-1',
          type: 'file',
          content: '',
          isStreaming: false,
          fileName: 'report.md',
        },
      ],
    });

    expect(getAssistantMessageCopyText(message)).toBe('最终正文');
  });

  it('does not return copy text for users, streaming assistants, or empty assistant cards', () => {
    expect(getAssistantMessageCopyText(createAssistantMessage({ role: 'user', content: '用户问题' }))).toBe('');
    expect(getAssistantMessageCopyText(createAssistantMessage({ isStreaming: true, content: '未完成' }))).toBe('');
    expect(getAssistantMessageCopyText(createAssistantMessage({
      parts: [{
        partId: 'question-1',
        type: 'question',
        content: '问题卡片',
        isStreaming: false,
      }],
    }))).toBe('');
  });
});
