import React from 'react';
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
  it('renders the streaming cursor inside the last paragraph', () => {
    const { container } = render(
      <MessageBubble message={createAssistantMessage('第一段\n\n第二段')} welinkSessionId="session-1" />,
    );

    const paragraphs = container.querySelectorAll('.message-content p');
    const rootCursor = container.querySelector('.message-content > .streaming-cursor');

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1]?.querySelector('.streaming-cursor')).toBeInTheDocument();
    expect(rootCursor).not.toBeInTheDocument();
  });

  it('renders the streaming cursor inside the last list item', () => {
    const { container } = render(
      <MessageBubble message={createAssistantMessage('- 条目一\n- 条目二')} welinkSessionId="session-1" />,
    );

    const listItems = container.querySelectorAll('.message-content li');
    const rootCursor = container.querySelector('.message-content > .streaming-cursor');

    expect(listItems).toHaveLength(2);
    expect(listItems[1]?.querySelector('.streaming-cursor')).toBeInTheDocument();
    expect(rootCursor).not.toBeInTheDocument();
  });
});
