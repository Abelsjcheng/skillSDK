import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: string }) => {
    const React = require('react');
    const content = String(children ?? '');
    const lines = content.split(/\n/).filter(Boolean);
    if (lines.every((line) => line.startsWith('- '))) {
      return React.createElement(
        'ul',
        null,
        lines.map((line, index) => React.createElement('li', { key: index }, line.slice(2))),
      );
    }
    return React.createElement(
      React.Fragment,
      null,
      content.split(/\n\s*\n/).map((paragraph, index) => (
        React.createElement('p', { key: index }, paragraph)
      )),
    );
  },
}));

jest.mock('remark-gfm', () => jest.fn());
jest.mock('remark-breaks', () => jest.fn());
jest.mock('remark-math', () => jest.fn());
jest.mock('rehype-raw', () => jest.fn());
jest.mock('rehype-katex', () => jest.fn());
jest.mock('../markdownComponents', () => ({
  createMarkdownComponents: () => ({}),
  normalizeMarkdownHtml: (content: string) => content,
}));

import { MessageBubble } from '../MessageBubble';
import type { Message, MessagePart } from '../../types';

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

  it('renders File UM content as a file card without exposing raw UM text', () => {
    const umContent = 'before /:um_begin{https://origin.example/report.docx|File|2048|report.docx|||cdnUrl:https://cdn.example/report.docx}/:um_end after';
    const { container } = render(
      <MessageBubble message={createAssistantMessage(umContent)} welinkSessionId="session-1" />,
    );

    expect(screen.getByText('report.docx')).toBeInTheDocument();
    expect(screen.getByText('2KB')).toBeInTheDocument();
    const card = container.querySelector('.um-file-card');
    const meta = container.querySelector('.um-file-card__meta');
    expect(card).toBeInTheDocument();
    expect(meta?.querySelector('.um-file-card__download')).toBeInTheDocument();
    expect(container.textContent).not.toContain('/:um_begin');
  });

  it('renders multiple UM file cards from mixed content', () => {
    const umContent = [
      '/:um_begin{https://origin.example/a.doc|File|1024|a.doc||||}/:um_end',
      'text between',
      '/:um_begin{https://origin.example/b.mp4|Video|1048576|b.mp4|12|||}/:um_end',
    ].join(' ');
    const { container } = render(
      <MessageBubble message={createAssistantMessage(umContent)} welinkSessionId="session-1" />,
    );

    expect(container.querySelectorAll('.um-file-card')).toHaveLength(2);
    expect(screen.getByText('a.doc')).toBeInTheDocument();
    expect(screen.getByText('b.mp4')).toBeInTheDocument();
    expect(screen.getByText('1MB')).toBeInTheDocument();
  });

  it('shows the UM file card context menu on right click', () => {
    const umContent = '/:um_begin{https://origin.example/report.docx|File|2048|report.docx||||}/:um_end';
    const { container } = render(
      <MessageBubble message={createAssistantMessage(umContent)} welinkSessionId="session-1" />,
    );

    const card = container.querySelector('.um-file-card');
    expect(card).toBeInTheDocument();
    fireEvent.contextMenu(card as Element, { clientX: 24, clientY: 36 });

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('\u6253\u5f00\u6587\u4ef6')).toBeInTheDocument();
    expect(screen.getByText('\u6253\u5f00\u6587\u4ef6\u5939')).toBeInTheDocument();
    expect(screen.getByText('\u4e0b\u8f7d')).toBeInTheDocument();
  });

  it('uses the UM file card for structured file parts', () => {
    const filePart: MessagePart = {
      partId: 'file-part-1',
      type: 'file',
      content: '',
      isStreaming: false,
      fileName: 'existing.pdf',
      fileUrl: 'https://origin.example/existing.pdf',
      fileMime: 'application/pdf',
    };

    const { container } = render(
      <MessageBubble
        message={createHistoryAssistantMessage([filePart])}
        welinkSessionId="session-1"
      />,
    );

    expect(container.querySelector('.um-file-card')).toBeInTheDocument();
    expect(screen.getByText('existing.pdf')).toBeInTheDocument();
    expect(container.querySelector('.file-part')).not.toBeInTheDocument();
  });
});
