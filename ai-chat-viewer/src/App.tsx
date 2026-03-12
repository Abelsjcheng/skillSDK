import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { Content } from './components/Content';
import { Footer, FooterMode } from './components/Footer';
import { StreamAssembler } from './protocol/StreamAssembler';
import type {
  Message,
  StreamMessage,
  SessionMessage,
  SessionStatus,
} from './types';
import {
  parseWelinkSessionId,
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

let nextMsgId = 1;
function genId(): string {
  return `msg_${Date.now()}_${nextMsgId++}`;
}

function sessionMessageToMessage(sm: SessionMessage): Message {
  return {
    id: String(sm.id),
    role: sm.role,
    content: sm.content,
    timestamp: new Date(sm.createdAt).getTime(),
    isStreaming: false,
    parts: sm.parts?.map((p) => ({
      partId: p.partId,
      type: p.type,
      content: p.content ?? '',
      isStreaming: false,
      toolName: p.toolName,
      toolCallId: p.toolCallId,
      toolStatus: p.toolStatus,
      toolInput: p.toolInput,
      toolOutput: p.toolOutput,
      header: p.header,
      question: p.question,
      options: p.options,
      permissionId: p.permissionId,
      fileName: p.fileName,
      fileUrl: p.fileUrl,
      fileMime: p.fileMime,
    })),
  };
}

function App() {
  const [welinkSessionId, setWelinkSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [footerMode, setFooterMode] = useState<FooterMode>('generate');
  const [isLoading, setIsLoading] = useState(true);

  const assemblerRef = useRef(new StreamAssembler());
  const streamingMsgIdRef = useRef<string | null>(null);
  const listenerRegisteredRef = useRef(false);
  const awaitingFinalResultRef = useRef(false);

  const onMessageRef = useRef<((msg: StreamMessage) => void) | null>(null);
  const onErrorRef = useRef<((err: { errorCode: number; errorMessage: string }) => void) | null>(null);
  const onCloseRef = useRef<((reason: string) => void) | null>(null);

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

  useEffect(() => {
    const sessionId = parseWelinkSessionId();
    if (sessionId) {
      setWelinkSessionId(sessionId);
    } else {
      console.error('缺少 welinkSessionId 参数');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!welinkSessionId) return;

    const loadMessages = async () => {
      try {
        const result = await getSessionMessage({
          welinkSessionId,
          page: 0,
          size: 50,
        });
        setMessages(result.content.map(sessionMessageToMessage));
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
                  ? { ...m, meta: { ...m.meta, tokens: msg.tokens, cost: msg.cost } }
                  : m,
              ),
            );
          }
          break;

        case 'session.status': {
          if (msg.sessionStatus === 'idle') {
            setSessionStatus('idle');
            finalizeStreamingMessage();

            if (awaitingFinalResultRef.current) {
              setFooterMode('generate');
            }
            awaitingFinalResultRef.current = false;
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
          setFooterMode('generate');
          awaitingFinalResultRef.current = false;
          finalizeStreamingMessage();
          break;

        case 'error':
          console.error(msg.error ?? '未知错误');
          setFooterMode('generate');
          awaitingFinalResultRef.current = false;
          break;

        case 'snapshot':
          if (msg.messages && msg.messages.length > 0) {
            const snapshotMessages: Message[] = msg.messages.map((sm) => ({
              id: sm.id,
              role: sm.role as Message['role'],
              content: sm.content,
              timestamp: sm.createdAt ? new Date(sm.createdAt).getTime() : Date.now(),
              isStreaming: false,
              parts: sm.parts?.map((p) => ({
                partId: p.partId,
                type: p.type,
                content: p.content ?? '',
                isStreaming: false,
                toolName: p.toolName,
                toolCallId: p.toolCallId,
                toolStatus: p.status as 'pending' | 'running' | 'completed' | 'error' | undefined,
                header: p.header,
                question: p.question,
                options: p.options,
                fileName: p.fileName,
                fileUrl: p.fileUrl,
                fileMime: p.fileMime,
              })),
            }));
            setMessages(snapshotMessages);
          }
          break;

        case 'streaming':
          if (msg.parts && msg.parts.length > 0) {
            setSessionStatus(msg.sessionStatus === 'busy' ? 'busy' : 'idle');
            const id = genId();
            streamingMsgIdRef.current = id;
            const streamingMsg: Message = {
              id,
              role: (msg.role as Message['role']) ?? 'assistant',
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
              parts: msg.parts.map((p) => ({
                partId: p.partId,
                type: p.type,
                content: p.content ?? '',
                isStreaming: true,
                toolName: p.toolName,
                toolCallId: p.toolCallId,
                toolStatus: p.status as 'pending' | 'running' | 'completed' | 'error' | undefined,
                header: p.header,
                question: p.question,
                options: p.options,
                fileName: p.fileName,
                fileUrl: p.fileUrl,
                fileMime: p.fileMime,
              })),
            };
            setMessages((prev) => [...prev, streamingMsg]);
          }
          break;

        default:
          break;
      }
    };

    onErrorRef.current = (err) => {
      console.error('Session listener error:', `${err.errorCode}: ${err.errorMessage}`);
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
          onMessage: onMessageRef.current,
          onError: onErrorRef.current ?? undefined,
          onClose: onCloseRef.current ?? undefined,
        });
        listenerRegisteredRef.current = false;
      }
    };
  }, [welinkSessionId, finalizeStreamingMessage]);

  const handleGenerate = useCallback(async (content: string) => {
    if (!welinkSessionId || !content.trim()) return;

    setSessionStatus('busy');
    setFooterMode('generating');
    awaitingFinalResultRef.current = true;

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      await sendMessageApi({
        welinkSessionId,
        content: content.trim(),
      });
    } catch (err) {
      awaitingFinalResultRef.current = false;
      setSessionStatus('idle');
      setFooterMode('generate');
      console.error('发送消息失败:', err);
    }
  }, [welinkSessionId]);

  const handleStop = useCallback(async () => {
    if (!welinkSessionId) return;

    awaitingFinalResultRef.current = false;
    setFooterMode('regenerate');

    try {
      await stopSkill({ welinkSessionId });
      setSessionStatus('idle');
      finalizeStreamingMessage();
    } catch (err) {
      console.error('Failed to stop skill:', err);
      setFooterMode('generating');
    }
  }, [welinkSessionId, finalizeStreamingMessage]);

  const handleRegenerate = useCallback(async () => {
    if (!welinkSessionId) return;

    setSessionStatus('busy');
    setFooterMode('generating');
    awaitingFinalResultRef.current = true;

    try {
      await regenerateAnswer({ welinkSessionId });
    } catch (err) {
      awaitingFinalResultRef.current = false;
      setSessionStatus('idle');
      setFooterMode('regenerate');
      console.error('重新生成失败:', err);
    }
  }, [welinkSessionId]);

  const handleSendToIM = useCallback(async (content: string) => {
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
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await controlSkillWeCode({ action: 'close' });
    } catch (err) {
      console.error('Failed to close:', err);
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
    <div className="app-container">
      <div className="header-wrapper">
        <Header
          onMinimize={handleMinimize}
          onClose={handleClose}
        />
      </div>
      <div className="content-wrapper">
        <Content
          messages={messages}
          welinkSessionId={welinkSessionId ?? 0}
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
        />
      </div>
    </div>
  );
}

export default App;
