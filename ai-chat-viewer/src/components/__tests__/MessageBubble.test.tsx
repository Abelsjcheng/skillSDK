import { fireEvent, render } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { Message, MessagePart } from '../../types';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => {
    const React = require('react');
    const content = String(children ?? '');
    const listLines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '));
    if (listLines.length > 0) {
      return React.createElement(
        'ul',
        null,
        listLines.map((line, index) => React.createElement('li', { key: index }, line.slice(2))),
      );
    }
    return React.createElement(
      React.Fragment,
      null,
      content
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph, index) => React.createElement('p', { key: index }, paragraph)),
    );
  },
}));
jest.mock('remark-gfm', () => ({}));
jest.mock('remark-breaks', () => ({}));
jest.mock('remark-math', () => ({}));
jest.mock('rehype-raw', () => ({}));
jest.mock('rehype-katex', () => ({}));
jest.mock('../markdownComponents', () => ({
  createMarkdownComponents: () => ({}),
  normalizeMarkdownHtml: (content: string) => content,
}));

function createAssistantMessage(content: string): Message {
  return {
    id: 'message-1',
    role: 'assistant',
    content,
    timestamp: Date.now(),
    isStreaming: true,
  };
}

function createHistoryAssistantMessage(parts: MessagePart[]): Message {
  return {
    id: 'history-message-1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: false,
    isHistory: true,
    parts,
  };
}

function createCompletedAssistantMessage(overrides: Partial<Message>): Message {
  return {
    id: 'message-completed-1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: false,
    ...overrides,
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

  it('keeps unresolved history question interactive after reload', () => {
    const questionPart: MessagePart = {
      partId: 'question-part-1',
      type: 'question',
      content: '请选择处理方式',
      isStreaming: false,
      question: '请选择处理方式',
      options: [{ label: '继续执行' }],
    };

    const { container } = render(
      <MessageBubble
        message={createHistoryAssistantMessage([questionPart])}
        welinkSessionId="session-1"
      />,
    );

    const button = container.querySelector('.question-card__option') as HTMLButtonElement | null;
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('keeps unresolved history permission interactive after reload', () => {
    const permissionPart: MessagePart = {
      partId: 'permission-part-1',
      type: 'permission',
      content: 'Need permission to write a markdown file',
      isStreaming: false,
      permissionId: 'perm-1',
      permType: 'file_write',
      toolName: 'write_file',
    };

    const { container } = render(
      <MessageBubble
        message={createHistoryAssistantMessage([permissionPart])}
        welinkSessionId="session-1"
      />,
    );

    const allowButton = container.querySelector('.permission-card__btn--allow') as HTMLButtonElement | null;
    expect(allowButton).toBeInTheDocument();
    expect(allowButton).not.toBeDisabled();
  });

  it('keeps resolved history permission readonly after reload', () => {
    const permissionPart: MessagePart = {
      partId: 'permission-part-2',
      type: 'permission',
      content: 'Need permission to write a markdown file',
      isStreaming: false,
      permissionId: 'perm-2',
      permType: 'file_write',
      toolName: 'write_file',
      permResolved: true,
      response: 'once',
    };

    const { container } = render(
      <MessageBubble
        message={createHistoryAssistantMessage([permissionPart])}
        welinkSessionId="session-1"
      />,
    );

    expect(container.querySelector('.permission-card')).toBeInTheDocument();
    expect(container.querySelector('.permission-card__actions')).not.toBeInTheDocument();
  });

  it('renders weAgent copy action below assistant content and copies text parts', () => {
    const onCopy = jest.fn();
    const message = createCompletedAssistantMessage({
      content: '',
      parts: [
        {
          partId: 'text-1',
          type: 'text',
          content: '第一段',
          isStreaming: false,
        },
        {
          partId: 'text-2',
          type: 'text',
          content: '第二段',
          isStreaming: false,
        },
      ],
    });

    const { container } = render(
      <MessageBubble
        message={message}
        welinkSessionId="session-1"
        variant="weAgent"
        showActions
        onCopy={onCopy}
      />,
    );

    const actions = container.querySelector('.we-agent-message__bubble .message-actions');
    const copyButton = container.querySelector('.copy-btn') as HTMLButtonElement | null;

    expect(actions).toBeInTheDocument();
    expect(copyButton).toBeInTheDocument();

    fireEvent.click(copyButton!);

    expect(onCopy).toHaveBeenCalledWith('第一段\n\n第二段');
  });

  it('renders weAgent copy action as icon-only without skillCUI send action', () => {
    const message = createCompletedAssistantMessage({
      content: '可复制正文',
    });

    const { container } = render(
      <MessageBubble
        message={message}
        welinkSessionId="session-1"
        variant="weAgent"
        showActions
        onCopy={jest.fn()}
        onSendToIM={jest.fn()}
      />,
    );

    expect(container.querySelector('.message-actions--we-agent')).toBeInTheDocument();
    expect(container.querySelector('.copy-btn .action-btn__text')).not.toBeInTheDocument();
    expect(container.querySelector('.send-btn')).not.toBeInTheDocument();
  });

  it('keeps skillCUI plain actions separate with text copy and send buttons', () => {
    const message = createCompletedAssistantMessage({
      content: '可发送正文',
    });

    const { container } = render(
      <MessageBubble
        message={message}
        welinkSessionId="session-1"
        variant="plain"
        showActions
        onCopy={jest.fn()}
        onSendToIM={jest.fn()}
      />,
    );

    expect(container.querySelector('.message-actions--plain')).toBeInTheDocument();
    expect(container.querySelector('.copy-btn .action-btn__text')).toHaveTextContent('复制');
    expect(container.querySelector('.send-btn .action-btn__text')).toHaveTextContent('发送');
  });

  it('does not show skillCUI send action for parts-only messages without message content', () => {
    const message = createCompletedAssistantMessage({
      content: '',
      parts: [
        {
          partId: 'text-1',
          type: 'text',
          content: 'parts 正文',
          isStreaming: false,
        },
      ],
    });

    const { container } = render(
      <MessageBubble
        message={message}
        welinkSessionId="session-1"
        variant="plain"
        showActions
        onCopy={jest.fn()}
        onSendToIM={jest.fn()}
      />,
    );

    expect(container.querySelector('.copy-btn')).toBeInTheDocument();
    expect(container.querySelector('.send-btn')).not.toBeInTheDocument();
  });

  it('does not render copy action for streaming assistant messages or user messages', () => {
    const onCopy = jest.fn();
    const streamingAssistant = createCompletedAssistantMessage({
      content: '生成中',
      isStreaming: true,
    });
    const userMessage = createCompletedAssistantMessage({
      role: 'user',
      content: '用户问题',
    });

    const { container: streamingContainer } = render(
      <MessageBubble
        message={streamingAssistant}
        welinkSessionId="session-1"
        showActions
        onCopy={onCopy}
      />,
    );
    const { container: userContainer } = render(
      <MessageBubble
        message={userMessage}
        welinkSessionId="session-1"
        showActions
        onCopy={onCopy}
      />,
    );

    expect(streamingContainer.querySelector('.copy-btn')).not.toBeInTheDocument();
    expect(userContainer.querySelector('.copy-btn')).not.toBeInTheDocument();
  });
});
