import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Content } from './components/Content';
import { Footer, FooterMode } from './components/Footer';
import { StreamAssembler } from './protocol/StreamAssembler';
import type {
  GetSessionMessageResponse,
  Message,
  RegenerateAnswerResponse,
  SendMessageResponse,
  StreamMessage,
  SessionStatus,
} from './types';
import {
  parseWelinkSessionId,
  isPcMiniApp,
  getSessionMessage,
  sendMessage as sendMessageApi,
  regenerateAnswer,
  stopSkill,
  sendMessageToIM,
  controlSkillWeCode,
  registerSessionListener,
  unregisterSessionListener,
} from './utils/hwext';
import { copyTextToClipboard } from './utils/clipboard';
import {
  genMessageId,
  getLatestUserContent,
  mapRawParts,
  messageOperationToMessage,
  normalizeRole,
  sessionMessageToMessage,
  snapshotMessageToMessage,
} from './utils/message';
import { showToast } from './utils/toast';
import iconWeAgentHistory from './imgs/icon-we-agent-history.svg';
import iconWeAgentNewSession from './imgs/icon-we-agent-new-session.svg';
import './styles/App.less';
import './styles/WeAgentCUI.less';

export interface AppProps {
  welinkSessionId?: string;
  variant?: AppVariant;
}

export type AppVariant = 'default' | 'weAgentCUI';

const HISTORY_PAGE_SIZE = 20;

function hasMoreHistoryByPage(result: GetSessionMessageResponse): boolean {
  if (typeof result.totalPages === 'number') {
    return result.page + 1 < result.totalPages;
  }
  return (result.page + 1) * result.size < result.total;
}

function App({
  welinkSessionId: welinkSessionIdProp,
  variant = 'default',
}: AppProps) {
  const isPc = isPcMiniApp();
  const isWeAgentCUI = variant === 'weAgentCUI';
  const [welinkSessionId, setWelinkSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [footerMode, setFooterMode] = useState<FooterMode>('generate');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);

  const assemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const shouldResetFooterOnCompletionRef = useRef(false);
  const suppressFooterAutoResetRef = useRef(false);
  const latestUserContentRef = useRef('');
  const historyPageRef = useRef(0);
  const hasMoreHistoryRef = useRef(false);
  const isLoadingHistoryRef = useRef(false);

  const onMessageRef = useRef<((msg: StreamMessage) => void) | null>(null);
  const onErrorRef = useRef<((err: {
    code?: string;
    message?: string;
    timestamp?: number;
    errorCode?: number;
    errorMessage?: string;
  }) => void) | null>(null);
  const onCloseRef = useRef<((reason: string) => void) | null>(null);

  const closeHwh5 = () => {
    const hwh5 = (window as unknown as { HWH5?: { close?: () => void } }).HWH5;
    if (typeof hwh5?.close === 'function') {
      hwh5.close();
    }
  };

  const finalizeStreamingMessage = useCallback(() => {
    assemblerRef.current.complete();

    if (streamingMsgIdRef.current) {
      const finalId = streamingMsgIdRef.current;
      const finalParts = assemblerRef.current.getParts();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === finalId
            ? { ...m, isStreaming: false, parts: [...finalParts] }
            : m,
        ),
      );
    }

    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
  }, []);

  const appendMessageFromOperation = useCallback(
    (messageOperation: SendMessageResponse | RegenerateAnswerResponse) => {
      const mappedMessage = messageOperationToMessage(messageOperation);
      if (mappedMessage.role === 'user' && mappedMessage.content.trim()) {
        latestUserContentRef.current = mappedMessage.content.trim();
      }

      setMessages((prev) => {
        const existingIndex = prev.findIndex((msg) => msg.id === mappedMessage.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            ...mappedMessage,
          };
          return next;
        }

        if (mappedMessage.role === 'user' && streamingMsgIdRef.current) {
          const streamingIndex = prev.findIndex((msg) => msg.id === streamingMsgIdRef.current);
          if (streamingIndex >= 0) {
            return [
              ...prev.slice(0, streamingIndex),
              mappedMessage,
              ...prev.slice(streamingIndex),
            ];
          }
        }

        return [...prev, mappedMessage];
      });
    },
    [],
  );

  const loadMoreHistory = useCallback(async () => {
    if (!welinkSessionId) return;
    if (isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;

    isLoadingHistoryRef.current = true;
    setIsLoadingHistory(true);

    try {
      const nextPage = historyPageRef.current + 1;
      const result = await getSessionMessage({
        welinkSessionId,
        page: nextPage,
        size: HISTORY_PAGE_SIZE,
        isFirst: false,
      });

      const olderMessages = result.content
        .map((message) => sessionMessageToMessage(message))
        .reverse();

      if (olderMessages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((msg) => msg.id));
          const prependMessages = olderMessages.filter((msg) => !existingIds.has(msg.id));
          if (prependMessages.length === 0) {
            return prev;
          }
          return [...prependMessages, ...prev];
        });
      }

      historyPageRef.current = result.page;
      const nextHasMoreHistory = hasMoreHistoryByPage(result);
      hasMoreHistoryRef.current = nextHasMoreHistory;
      setHasMoreHistory(nextHasMoreHistory);
    } catch (err) {
      console.error('Failed to load more history messages:', err);
    } finally {
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, [welinkSessionId]);

  useEffect(() => {
    if (typeof welinkSessionIdProp === 'string' && welinkSessionIdProp.trim()) {
      setIsLoading(true);
      setWelinkSessionId(welinkSessionIdProp.trim());
      return;
    }

    const sessionId = parseWelinkSessionId();
    if (sessionId) {
      setIsLoading(true);
      setWelinkSessionId(sessionId);
    } else {
      console.error('缺少 welinkSessionId 参数');
      setIsLoading(false);
    }
  }, [welinkSessionIdProp]);

  useEffect(() => {
    if (!welinkSessionId) return;

    historyPageRef.current = 0;
    hasMoreHistoryRef.current = false;
    isLoadingHistoryRef.current = false;
    setHasMoreHistory(false);
    setIsLoadingHistory(false);

    const loadMessages = async () => {
      try {
        const result = await getSessionMessage({
          welinkSessionId,
          page: 0,
          size: HISTORY_PAGE_SIZE,
          isFirst: true,
        });
        const mapped = result.content.map(sessionMessageToMessage).reverse();
        setMessages(mapped);
        latestUserContentRef.current = getLatestUserContent(mapped);

        historyPageRef.current = result.page;
        const nextHasMoreHistory = hasMoreHistoryByPage(result);
        hasMoreHistoryRef.current = nextHasMoreHistory;
        setHasMoreHistory(nextHasMoreHistory);
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    onMessageRef.current = (msg: StreamMessage) => {
      switch (msg.type) {
        case 'text.delta':
        case 'text.done':
        case 'thinking.delta':
        case 'thinking.done':
        case 'tool.update':
        case 'question':
        case 'permission.ask':
        case 'file': {
          setSessionStatus('busy');
          const assembler = assemblerRef.current;
          assembler.handleMessage(msg);

          const currentText = assembler.getText();
          const currentParts = assembler.getParts();

          setMessages((prev) => {
            if (streamingMsgIdRef.current) {
              return prev.map((m) =>
                m.id === streamingMsgIdRef.current
                  ? { ...m, content: currentText, parts: [...currentParts], isStreaming: true }
                  : m,
              );
            }
            const id = genMessageId();
            streamingMsgIdRef.current = id;
            return [
              ...prev,
              {
                id,
                role: 'assistant',
                content: currentText,
                timestamp: Date.now(),
                isStreaming: true,
                parts: [...currentParts],
              },
            ];
          });
          break;
        }

        case 'step.start':
          setSessionStatus('busy');
          break;

        case 'step.done':
          if (streamingMsgIdRef.current && msg.tokens) {
            const finalId = streamingMsgIdRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === finalId
                  ? {
                    ...m,
                    meta: {
                      ...m.meta,
                      tokens: msg.tokens ?? undefined,
                      cost: msg.cost ?? undefined,
                    },
                  }
                  : m,
              ),
            );
          }
          break;

        case 'session.status': {
          if (msg.sessionStatus === 'idle') {
            setSessionStatus('idle');
            finalizeStreamingMessage();

            if (shouldResetFooterOnCompletionRef.current && !suppressFooterAutoResetRef.current) {
              setFooterMode('generate');
            }
            shouldResetFooterOnCompletionRef.current = false;
          } else if (msg.sessionStatus === 'busy') {
            setSessionStatus('busy');
          } else if (msg.sessionStatus === 'retry') {
            setSessionStatus('retry');
          }
          break;
        }

        case 'session.error':
          setSessionStatus('error');
          console.error(msg.error ?? '会话错误');
          if (!suppressFooterAutoResetRef.current) {
            setFooterMode('generate');
          }
          shouldResetFooterOnCompletionRef.current = false;
          finalizeStreamingMessage();
          break;

        case 'error':
          console.error(msg.error ?? '未知错误');
          if (!suppressFooterAutoResetRef.current) {
            setFooterMode('generate');
          }
          shouldResetFooterOnCompletionRef.current = false;
          break;

        case 'snapshot':
          if (msg.messages && msg.messages.length > 0) {
            const snapshotMessages: Message[] = msg.messages
              .map((sm) => snapshotMessageToMessage(sm))
              .reverse();
            setMessages(snapshotMessages);
            latestUserContentRef.current = getLatestUserContent(snapshotMessages);
          }
          break;

        case 'streaming':
          if (msg.parts && msg.parts.length > 0) {
            setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
            const id = genMessageId();
            streamingMsgIdRef.current = id;
            const streamingMsg: Message = {
              id,
              role: normalizeRole(msg.role),
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
              parts: mapRawParts(msg.parts, true),
            };
            setMessages((prev) => [...prev, streamingMsg]);
          }
          break;

        default:
          break;
      }
    };

    onErrorRef.current = (err) => {
      const errorCode = err.code ?? (err.errorCode !== undefined ? String(err.errorCode) : 'unknown');
      const errorMessage = err.message ?? err.errorMessage ?? 'unknown error';
      console.error('Session listener error:', `${errorCode}: ${errorMessage}`);
    };

    onCloseRef.current = (reason) => {
      console.log('Session listener closed:', reason);
    };

    const initSession = async () => {
      await loadMessages();
      setIsLoading(false);

      if (!listenerRegisteredRef.current && welinkSessionId && onMessageRef.current) {
        registerSessionListener({
          welinkSessionId,
          onMessage: onMessageRef.current,
          onError: onErrorRef.current ?? undefined,
          onClose: onCloseRef.current ?? undefined,
        });
        listenerRegisteredRef.current = true;
      }
    };

    initSession();

    return () => {
      if (listenerRegisteredRef.current && welinkSessionId && onMessageRef.current) {
        unregisterSessionListener({
          welinkSessionId,
        });
        listenerRegisteredRef.current = false;
      }
    };
  }, [welinkSessionId, finalizeStreamingMessage]);

  const handleGenerate = useCallback(async (content: string) => {
    if (!welinkSessionId || !content.trim()) return;

    const trimmedContent = content.trim();
    setSessionStatus('busy');
    setFooterMode('generating');
    shouldResetFooterOnCompletionRef.current = true;
    suppressFooterAutoResetRef.current = false;

    try {
      const result = await sendMessageApi({
        welinkSessionId,
        content: trimmedContent,
      });
      appendMessageFromOperation(result);
    } catch (err) {
      shouldResetFooterOnCompletionRef.current = false;
      setSessionStatus('idle');
      setFooterMode('generate');
      console.error('发送消息失败:', err);
    }
  }, [welinkSessionId, appendMessageFromOperation]);

  const handleStop = useCallback(async () => {
    if (!welinkSessionId) return;
    suppressFooterAutoResetRef.current = true;

    try {
      await stopSkill({ welinkSessionId });
      shouldResetFooterOnCompletionRef.current = false;
      setFooterMode('regenerate');
      setSessionStatus('idle');
      finalizeStreamingMessage();
    } catch (err) {
      suppressFooterAutoResetRef.current = false;
      console.error('Failed to stop skill:', err);
      setFooterMode('generating');
    }
  }, [welinkSessionId, finalizeStreamingMessage]);

  const handleRegenerate = useCallback(async () => {
    if (!welinkSessionId) return;

    setSessionStatus('busy');
    setFooterMode('generating');
    shouldResetFooterOnCompletionRef.current = true;
    suppressFooterAutoResetRef.current = false;

    try {
      const result = await regenerateAnswer({ welinkSessionId });
      appendMessageFromOperation(result);
    } catch (err) {
      shouldResetFooterOnCompletionRef.current = false;
      setSessionStatus('idle');
      setFooterMode('regenerate');
      console.error('重新生成失败:', err);
    }
  }, [welinkSessionId, appendMessageFromOperation]);

  const handleSendToIM = useCallback(async (_content: string) => {
    if (!welinkSessionId) return;
    try {
      await sendMessageToIM({
        welinkSessionId,
      });
      showToast('已发送到IM');
    } catch (err) {
      console.error('Failed to send to IM:', err);
    }
  }, [welinkSessionId]);

  const handleMinimize = useCallback(async () => {
    try {
      await controlSkillWeCode({ action: 'minimize' });
    } catch (err) {
      console.error('Failed to minimize:', err);
    } finally {
      closeHwh5();
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await controlSkillWeCode({ action: 'close' });
    } catch (err) {
      console.error('Failed to close:', err);
    } finally {
      closeHwh5();
    }
  }, []);

  const handleCopy = useCallback((content: string) => {
    copyTextToClipboard(content)
      .then(() => {
        showToast('已复制到剪贴板');
      })
      .catch((err) => {
        console.error('复制失败:', err);
        showToast('复制失败');
      });
  }, []);

  const handleCreateSession = useCallback(() => {
    // WeAgentCUI 保留扩展点：新建会话
  }, []);

  const handleOpenHistory = useCallback(() => {
    // WeAgentCUI 保留扩展点：历史会话
  }, []);

  return (
    <div
      className={[
        'app-container',
        isPc ? 'pc-mode' : '',
        isWeAgentCUI ? 'app-container--we-agent-cui' : '',
      ].filter(Boolean).join(' ')}
    >
      {!isWeAgentCUI && (
        <div className="header-wrapper">
          <Header
            onMinimize={handleMinimize}
            onClose={handleClose}
          />
        </div>
      )}
      <div className="content-wrapper">
        <Content
          messages={messages}
          welinkSessionId={welinkSessionId ?? ''}
          isLoading={isLoading}
          isLoadingHistory={isLoadingHistory}
          hasMoreHistory={hasMoreHistory}
          onLoadMoreHistory={loadMoreHistory}
          onCopy={handleCopy}
          onSendToIM={handleSendToIM}
          variant={variant}
        />
      </div>
      {isWeAgentCUI && (
        <div className="we-agent-cui-actions" aria-label="多功能按钮区">
          <button
            type="button"
            className="we-agent-cui-actions__button"
            onClick={handleCreateSession}
            aria-label="新建会话"
          >
            <img
              className="we-agent-cui-actions__icon"
              src={iconWeAgentNewSession}
              alt=""
            />
          </button>
          <button
            type="button"
            className="we-agent-cui-actions__button"
            onClick={handleOpenHistory}
            aria-label="历史会话"
          >
            <img
              className="we-agent-cui-actions__icon"
              src={iconWeAgentHistory}
              alt=""
            />
          </button>
        </div>
      )}
      <div className="footer-wrapper">
        <Footer
          mode={footerMode}
          onGenerate={handleGenerate}
          onStop={handleStop}
          onRegenerate={handleRegenerate}
          isPc={isPc}
          variant={variant}
        />
      </div>
    </div>
  );
}

export default App;
