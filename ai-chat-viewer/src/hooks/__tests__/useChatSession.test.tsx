import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useChatSession } from '../useChatSession';
import type { StreamMessage } from '../../types';
import {
  getSessionMessageHistory,
  registerSessionListener,
  sendMessage,
  sendMessageToIM,
  stopSkill,
  unregisterSessionListener,
} from '../../utils/hwext';

jest.mock('../../utils/hwext', () => ({
  getSessionMessageHistory: jest.fn(),
  registerSessionListener: jest.fn(),
  unregisterSessionListener: jest.fn(),
  sendMessage: jest.fn(),
  sendMessageToIM: jest.fn(),
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
const mockSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;
const mockSendMessageToIM = sendMessageToIM as jest.MockedFunction<typeof sendMessageToIM>;
const mockStopSkill = stopSkill as jest.MockedFunction<typeof stopSkill>;

function emitTextMessage(
  onMessage: ListenerParams['onMessage'],
  overrides: Partial<StreamMessage> & Pick<StreamMessage, 'type' | 'messageId'>,
): void {
  onMessage({
    type: overrides.type,
    messageId: overrides.messageId,
    welinkSessionId: 'session_1',
    seq: 1,
    role: 'assistant',
    emittedAt: '2026-05-25T10:00:00.000Z',
    ...overrides,
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
});
