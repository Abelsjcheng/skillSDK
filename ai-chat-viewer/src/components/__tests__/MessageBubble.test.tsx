import { render } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '../../types';

function createAssistantMessage(content: string): Message {
  return {
    id: 'message-1',
    role: 'assistant',
    content,
    timestamp: Date.now(),
    isStreaming: true,
  };
}

describe('MessageBubble', () => {
  it('renders paragraph markdown content without streaming cursor', () => {
    const { container } = render(
      <MessageBubble message={createAssistantMessage('第一段\n\n第二段')} welinkSessionId="session-1" />,
    );

    const paragraphs = container.querySelectorAll('.message-content p');
    const cursor = container.querySelector('.streaming-cursor');

    expect(paragraphs).toHaveLength(2);
    expect(cursor).not.toBeInTheDocument();
  });

  it('renders list markdown content without streaming cursor', () => {
    const { container } = render(
      <MessageBubble message={createAssistantMessage('- 条目一\n- 条目二')} welinkSessionId="session-1" />,
    );

    const listItems = container.querySelectorAll('.message-content li');
    const cursor = container.querySelector('.streaming-cursor');

    expect(listItems).toHaveLength(2);
    expect(cursor).not.toBeInTheDocument();
  });
});
