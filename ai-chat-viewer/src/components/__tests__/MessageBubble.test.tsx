import { render } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import type { Message, MessagePart } from '../../types';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => {
    const React = require('react');
    const content = String(children ?? '');
    if (content.trim().startsWith('- ')) {
      return React.createElement(
        'ul',
        null,
        content.split('\n').filter(Boolean).map((item, index) =>
          React.createElement('li', { key: index }, item.replace(/^- /, '')),
        ),
      );
    }
    return React.createElement(
      React.Fragment,
      null,
      content.split(/\n\n+/).filter(Boolean).map((paragraph, index) =>
        React.createElement('p', { key: index }, paragraph),
      ),
    );
  },
}));
jest.mock('remark-gfm', () => () => undefined);
jest.mock('remark-breaks', () => () => undefined);
jest.mock('remark-math', () => () => undefined);
jest.mock('rehype-raw', () => () => undefined);
jest.mock('rehype-katex', () => () => undefined);
jest.mock('../markdownComponents', () => ({
  createMarkdownComponents: () => ({}),
  normalizeMarkdownHtml: (content: string) => content,
}));
jest.mock('../ToolCard', () => ({
  ToolCard: () => {
    const React = require('react');
    return React.createElement('div', null, 'ToolCard');
  },
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

  it('renders question answer arrays as a question and answer table for user messages', () => {
    const answerMessage = {
      id: 'user-answer-1',
      role: 'user',
      content: [['Android'], ['HarmonyOS', 'Web'], []],
      contentType: 'plain',
      timestamp: Date.now(),
      isStreaming: false,
      meta: {
        questionAnswers: [
          { question: 'Choose the first platform', answers: ['Android'] },
          { question: 'Choose secondary platforms', answers: ['HarmonyOS', 'Web'] },
          { question: 'Optional note', answers: [] },
        ],
      },
    } as unknown as Message;

    const { container } = render(
      <MessageBubble message={answerMessage} welinkSessionId="session-1" />,
    );

    expect(container.querySelector('.question-answer-table')).toBeInTheDocument();
    expect(container.querySelector('.question-answer-table__question')).toHaveTextContent('Choose the first platform');
    expect(container.querySelector('.question-answer-table__answer')).toHaveTextContent('Android');
    expect(container).toHaveTextContent('Choose secondary platforms');
    expect(container).toHaveTextContent('HarmonyOS、Web');
    expect(container).toHaveTextContent('Optional note');
  });
});
