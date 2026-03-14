import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Content } from './components/Content';
import { Footer, FooterMode } from './components/Footer';
import { StreamAssembler } from './protocol/StreamAssembler';
import type {
  Message,
  MessagePart,
  MessagePartSnapshot,
  SessionMessagePart,
  StreamMessage,
  SessionMessage,
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
import './styles/App.less';

export interface AppProps {
  welinkSessionId?: string;
}

let nextMsgId = 1;
function genId(): string {
  return `msg_${Date.now()}_${nextMsgId++}`;
}

function normalizeRole(role: unknown): Message['role'] {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (
    normalized === 'user' ||
    normalized === 'assistant' ||
    normalized === 'system' ||
    normalized === 'tool'
  ) {
    return normalized;
  }
  return 'assistant';
}

type RawPart = SessionMessagePart | MessagePartSnapshot;

function mapRawPartToMessagePart(rawPart: RawPart, isStreaming: boolean): MessagePart {
  return {
    partId: rawPart.partId,
    type: rawPart.type,
    content: rawPart.content ?? '',
    isStreaming,
    toolName: rawPart.toolName ?? undefined,
    toolCallId: rawPart.toolCallId ?? undefined,
    status: (rawPart.status as 'pending' | 'running' | 'completed' | 'error' | undefined) ?? undefined,
    input: rawPart.input ?? undefined,
    output: rawPart.output ?? undefined,
    title: rawPart.title ?? undefined,
    header: rawPart.header ?? undefined,
    question: rawPart.question ?? undefined,
    options: rawPart.options ?? undefined,
    permissionId: rawPart.permissionId ?? undefined,
    permType: rawPart.permType ?? undefined,
    fileName: rawPart.fileName ?? undefined,
    fileUrl: rawPart.fileUrl ?? undefined,
    fileMime: rawPart.fileMime ?? undefined,
  };
}

function mapRawParts(rawParts: RawPart[] | null | undefined, isStreaming: boolean): MessagePart[] | undefined {
  if (!rawParts || rawParts.length === 0) {
    return undefined;
  }
  return rawParts.map((part) => mapRawPartToMessagePart(part, isStreaming));
}

function sessionMessageToMessage(sm: SessionMessage): Message {
  return {
    id: String(sm.id),
    role: normalizeRole(sm.role),
    content: sm.content ?? '',
    timestamp: new Date(sm.createdAt).getTime(),
    isStreaming: false,
    parts: mapRawParts(sm.parts, false),
  };
}

function getLatestUserContent(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === 'user' && msg.content.trim()) {
      return msg.content.trim();
    }
  }
  return '';
}

function App({ welinkSessionId: welinkSessionIdProp }: AppProps) {
  const isPc = isPcMiniApp();
  const [welinkSessionId, setWelinkSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [footerMode, setFooterMode] = useState<FooterMode>('generate');
  const [isLoading, setIsLoading] = useState(true);

  const assemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const shouldResetFooterOnCompletionRef = useRef(false);
  const suppressFooterAutoResetRef = useRef(false);
  const latestUserContentRef = useRef('');

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

  const appendUserMessage = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    latestUserContentRef.current = trimmed;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'user' && last.content.trim() === trimmed) {
        return prev;
      }

      return [
        ...prev,
        {
          id: genId(),
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
        },
      ];
    });
  }, []);

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

    const loadMessages = async () => {
      try {
        const result = await getSessionMessage({
          welinkSessionId,
          page: 0,
          size: 50,
        });
        const mapped = result.content.map(sessionMessageToMessage);
        setMessages(mapped);
        latestUserContentRef.current = getLatestUserContent(mapped);
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
            const id = genId();
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
            const snapshotMessages: Message[] = msg.messages.map((sm) => ({
              id: sm.id,
              role: normalizeRole(sm.role),
              content: sm.content ?? '',
              timestamp: sm.createdAt ? new Date(sm.createdAt).getTime() : Date.now(),
              isStreaming: false,
              parts: mapRawParts(sm.parts, false),
            }));
            setMessages(snapshotMessages);
            latestUserContentRef.current = getLatestUserContent(snapshotMessages);
          }
          break;

        case 'streaming':
          if (msg.parts && msg.parts.length > 0) {
            setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
            const id = genId();
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
    appendUserMessage(trimmedContent);

    try {
      await sendMessageApi({
        welinkSessionId,
        content: trimmedContent,
      });
    } catch (err) {
      shouldResetFooterOnCompletionRef.current = false;
      setSessionStatus('idle');
      setFooterMode('generate');
      console.error('发送消息失败:', err);
    }
  }, [welinkSessionId, appendUserMessage]);

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
      await regenerateAnswer({ welinkSessionId });
      appendUserMessage(latestUserContentRef.current);
    } catch (err) {
      shouldResetFooterOnCompletionRef.current = false;
      setSessionStatus('idle');
      setFooterMode('regenerate');
      console.error('重新生成失败:', err);
    }
  }, [welinkSessionId, appendUserMessage]);

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
    navigator.clipboard.writeText(content).then(() => {
      showToast('已复制到剪贴板');
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('已复制到剪贴板');
    });
  }, []);

  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('copy-toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  };

  return (
    <div className={`app-container ${isPc ? 'pc-mode' : ''}`.trim()}>
      <div className="header-wrapper">
        <Header
          onMinimize={handleMinimize}
          onClose={handleClose}
        />
      </div>
      <div className="content-wrapper">
        <Content
          messages={messages}
          welinkSessionId={welinkSessionId ?? ''}
          isLoading={isLoading}
          onCopy={handleCopy}
          onSendToIM={handleSendToIM}
        />
      </div>
      <div className="footer-wrapper">
        <Footer
          mode={footerMode}
          onGenerate={handleGenerate}
          onStop={handleStop}
          onRegenerate={handleRegenerate}
          isPc={isPc}
        />
      </div>
    </div>
  );
}

export default App;
