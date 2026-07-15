import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useChatSession } from '../useChatSession';
import type { StreamMessage } from '../../types';
import {
  getSessionMessageHistory,
  registerSessionListener,
  reportUemEvent,
  sendMessage,
  sendMessageToIM,
  sendWebSocketMessage,
  stopSkill,
  unregisterSessionListener,
} from '../../utils/hwext';

jest.mock('../../utils/hwext', () => ({
  getSessionMessageHistory: jest.fn(),
  registerSessionListener: jest.fn(),
  unregisterSessionListener: jest.fn(),
  reportUemEvent: jest.fn(),
  sendMessage: jest.fn(),
  sendMessageToIM: jest.fn(),
  sendWebSocketMessage: jest.fn(),
  stopSkill: jest.fn(),
}));

jest.mock('../../utils/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  WeLog: jest.fn(),
}));

type ListenerParams = {
  welinkSessionId: string;
  onMessage: (msg: StreamMessage) => void;
  onError?: (err: { code?: string; message?: string; errorCode?: number; errorMessage?: string }) => void;
  onClose?: (reason: string) => void;
};

const mockGetSessionMessageHistory = getSessionMessageHistory as jest.MockedFunction<typeof getSessionMessageHistory>;
const mockRegisterSessionListener = registerSessionListener as jest.MockedFunction<typeof registerSessionListener>;
const mockUnregisterSessionListener = unregisterSessionListener as jest.MockedFunction<typeof unregisterSessionListener>;
const mockReportUemEvent = reportUemEvent as jest.MockedFunction<typeof reportUemEvent>;
const mockSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;
const mockSendMessageToIM = sendMessageToIM as jest.MockedFunction<typeof sendMessageToIM>;
const mockSendWebSocketMessage = sendWebSocketMessage as jest.MockedFunction<typeof sendWebSocketMessage>;
const mockStopSkill = stopSkill as jest.MockedFunction<typeof stopSkill>;

function emitTextMessage(
  onMessage: ListenerParams['onMessage'],
  overrides: Partial<StreamMessage> & Pick<StreamMessage, 'type' | 'messageId'>,
): void {
  const { type, messageId, ...restOverrides } = overrides;

  onMessage({
    type,
    messageId,
    welinkSessionId: 'session_1',
    seq: 1,
    role: 'assistant',
    emittedAt: '2026-05-25T10:00:00.000Z',
    ...restOverrides,
  });
}

describe('useChatSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionMessageHistory.mockResolvedValue({
      content: [],
      size: 20,
      hasMore: false,
      nextBeforeSeq: null,
    });
    mockReportUemEvent.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue({
      id: 'user_msg_1',
      welinkSessionId: 'session_1',
      seq: 1,
      messageSeq: 1,
      role: 'user',
      content: 'hello',
      contentType: 'plain',
      createdAt: '2026-05-25T10:00:00.000Z',
      meta: null,
      parts: null,
    });
    mockSendMessageToIM.mockResolvedValue(undefined as never);
    mockSendWebSocketMessage.mockResolvedValue({ status: 'success' });
    mockStopSkill.mockResolvedValue(undefined as never);
  });

  it('keeps streaming content isolated when different messageIds interleave', async () => {
    const { result } = renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
    }));

    await waitFor(() => {
      expect(mockRegisterSessionListener).toHaveBeenCalledTimes(1);
    });

    const listener = mockRegisterSessionListener.mock.calls[0][0] as ListenerParams;

    act(() => {
      emitTextMessage(listener.onMessage, {
        type: 'text.delta',
        messageId: 'assistant_a',
        partId: 'part_a',
        content: 'Hel',
      });
      emitTextMessage(listener.onMessage, {
        type: 'text.delta',
        messageId: 'assistant_b',
        partId: 'part_b',
        content: 'Wor',
      });
      emitTextMessage(listener.onMessage, {
        type: 'text.done',
        messageId: 'assistant_a',
        partId: 'part_a',
        content: 'Hello',
      });
      emitTextMessage(listener.onMessage, {
        type: 'text.done',
        messageId: 'assistant_b',
        partId: 'part_b',
        content: 'World',
      });
      listener.onMessage({
        type: 'session.status',
        welinkSessionId: 'session_1',
        seq: 5,
        sessionStatus: 'idle',
      });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'assistant_a',
        content: 'Hello',
        isStreaming: false,
        parts: [expect.objectContaining({
          partId: 'part_a',
          type: 'text',
          content: 'Hello',
          isStreaming: false,
        })],
      }),
      expect.objectContaining({
        id: 'assistant_b',
        content: 'World',
        isStreaming: false,
        parts: [expect.objectContaining({
          partId: 'part_b',
          type: 'text',
          content: 'World',
          isStreaming: false,
        })],
      }),
    ]));

    expect(result.current.messages.find((message) => message.id === 'assistant_a')?.content).toBe('Hello');
    expect(result.current.messages.find((message) => message.id === 'assistant_b')?.content).toBe('World');
  });

  it('only finalizes the latest message when a later idle status arrives', async () => {
    const { result } = renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
    }));

    await waitFor(() => {
      expect(mockRegisterSessionListener).toHaveBeenCalledTimes(1);
    });

    const listener = mockRegisterSessionListener.mock.calls[0][0] as ListenerParams;

    act(() => {
      emitTextMessage(listener.onMessage, {
        type: 'text.delta',
        messageId: 'assistant_a',
        partId: 'part_a',
        content: 'Hello ',
      });
      emitTextMessage(listener.onMessage, {
        type: 'text.delta',
        messageId: 'assistant_b',
        partId: 'part_b',
        content: 'World',
      });
      listener.onMessage({
        type: 'session.status',
        welinkSessionId: 'session_1',
        seq: 3,
        sessionStatus: 'idle',
      });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages.find((message) => message.id === 'assistant_a')).toEqual(
      expect.objectContaining({
        content: 'Hello ',
        isStreaming: true,
        parts: [expect.objectContaining({
          partId: 'part_a',
          content: 'Hello ',
          isStreaming: true,
        })],
      }),
    );
    expect(result.current.messages.find((message) => message.id === 'assistant_b')).toEqual(
      expect.objectContaining({
        content: 'World',
        isStreaming: false,
        parts: [expect.objectContaining({
          partId: 'part_b',
          content: 'World',
          isStreaming: false,
        })],
      }),
    );
  });

  it('unregisters listener on cleanup', async () => {
    const { unmount } = renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
    }));

    await waitFor(() => {
      expect(mockRegisterSessionListener).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(mockUnregisterSessionListener).toHaveBeenCalledWith({
      welinkSessionId: 'session_1',
    });
  });

  it('passes content when sending message to IM', async () => {
    const { result } = renderHook(() => useChatSession({
      mode: 'skillCUI',
      welinkSessionId: 'session_1',
    }));

    await act(async () => {
      await result.current.onSendToIM('final answer content');
    });

    expect(mockSendMessageToIM).toHaveBeenCalledWith({
      welinkSessionId: 'session_1',
      content: 'final answer content',
    });
  });

  it('requests slash commands through websocket and stores slash command result events', async () => {
    const { result } = renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
    }));

    await waitFor(() => {
      expect(mockRegisterSessionListener).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.onRequestSlashCommands();
    });

    expect(mockSendWebSocketMessage).toHaveBeenCalledWith({
      message: JSON.stringify({
        action: 'query_slash_commands',
        welinkSessionId: 'session_1',
      }),
    });

    const listener = mockRegisterSessionListener.mock.calls[0][0] as ListenerParams;
    act(() => {
      listener.onMessage({
        type: 'slash_commands_result',
        welinkSessionId: 'session_1',
        seq: 135,
        emittedAt: '2026-06-15T10:00:00.000Z',
        messageId: 'message_1',
        messageSeq: 6,
        role: 'assistant',
        sourceMessageId: 'source_1',
        partId: 'part_1',
        partSeq: 4,
        status: 'running',
        slashCommands: [
          { command: '/new', description: '新建回话' },
          { command: 'delete', description: '删除' },
        ],
      });
    });

    await waitFor(() => expect(result.current.slashCommands).toEqual([
      { command: '/new', description: '新建回话' },
      { command: '/delete', description: '删除' },
    ]));
  });

  it('reports session activity after sending a message successfully', async () => {
    const onSessionActivity = jest.fn();
    const { result } = renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
      onSessionActivity,
    }));

    await act(async () => {
      await result.current.onSend('hello');
    });

    expect(onSessionActivity).toHaveBeenCalledWith('session_1', '2026-05-25T10:00:00.000Z');
  });

  it('notifies when the active session is deleted through websocket event', async () => {
    const onSessionDeleted = jest.fn();

    renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
      onSessionDeleted,
    }));

    await waitFor(() => {
      expect(mockRegisterSessionListener).toHaveBeenCalledTimes(1);
    });

    const listener = mockRegisterSessionListener.mock.calls[0][0] as ListenerParams;

    act(() => {
      listener.onMessage({
        type: 'session.deleted',
        welinkSessionId: 'session_1',
        content: '{"welinkSessionId":"session_1"}',
        seq: null,
      } as any);
    });

    expect(onSessionDeleted).toHaveBeenCalledWith('session_1');
  });

  it('ignores session.deleted events for a different registered session', async () => {
    const onSessionDeleted = jest.fn();

    renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
      onSessionDeleted,
    }));

    await waitFor(() => {
      expect(mockRegisterSessionListener).toHaveBeenCalledTimes(1);
    });

    const listener = mockRegisterSessionListener.mock.calls[0][0] as ListenerParams;

    act(() => {
      listener.onMessage({
        type: 'session.deleted',
        welinkSessionId: 'session_2',
        seq: null,
      } as any);
    });

    expect(onSessionDeleted).not.toHaveBeenCalled();
  });

  it('preserves questionId from question events when answering question cards', async () => {
    const { result } = renderHook(() => useChatSession({
      mode: 'weAgentCUI',
      welinkSessionId: 'session_1',
    }));

    await waitFor(() => {
      expect(mockRegisterSessionListener).toHaveBeenCalledTimes(1);
    });

    const listener = mockRegisterSessionListener.mock.calls[0][0] as ListenerParams;

    act(() => {
      listener.onMessage({
        type: 'question',
        messageId: 'assistant_question_1',
        welinkSessionId: 'session_1',
        seq: 1,
        role: 'assistant',
        emittedAt: '2026-05-25T10:00:00.000Z',
        partId: 'question_part_1',
        toolCallId: 'tool_call_1',
        questionId: 'question_1',
        header: 'Clarification',
        question: 'Which platform should we prioritize?',
        options: ['Android', 'iOS'],
        status: 'running',
      });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    const questionPart = result.current.messages[0].parts?.[0];
    expect(questionPart).toEqual(expect.objectContaining({
      type: 'question',
      toolCallId: 'tool_call_1',
      questionId: 'question_1',
    }));

    await act(async () => {
      await result.current.onQuestionAnswered({
        answer: 'Android',
        messageId: result.current.messages[0].id,
        toolCallId: questionPart?.toolCallId,
        questionId: questionPart?.questionId,
      });
    });

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      welinkSessionId: 'session_1',
      content: 'Android',
      toolCallId: 'tool_call_1',
      questionId: 'question_1',
    }));
  });
});
