import React from 'react';
import { Header } from '../components/Header';
import { Content } from '../components/Content';
import { Footer, FooterMode } from '../components/Footer';
import { StreamAssembler } from '../protocol/StreamAssembler';
import type { Message, StreamMessage, SessionMessage, SessionStatus } from '../types';
import { resolveJsApi } from '../utils/hwext';
import '../styles/App.less';

export interface AIChatViewerProps {
  welinkSessionId: number;
  onMinimize?: () => void;
  onClose?: () => void;
}

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

const AIChatViewer: React.FC<AIChatViewerProps> = ({
  welinkSessionId,
  onMinimize,
  onClose,
}) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [sessionStatus, setSessionStatus] = React.useState<SessionStatus>('idle');
  const [footerMode, setFooterMode] = React.useState<FooterMode>('generate');
  const [isLoading, setIsLoading] = React.useState(true);

  const assemblerRef = React.useRef(new StreamAssembler());
  const streamingMsgIdRef = React.useRef<string | null>(null);
  const listenerRegisteredRef = React.useRef(false);
  const awaitingFinalResultRef = React.useRef(false);

  const hw = React.useMemo(() => resolveJsApi(), []);
  const closeHwh5 = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const hwh5 = (window as unknown as { HWH5?: { close?: () => void } }).HWH5;
    if (typeof hwh5?.close === 'function') {
      try {
        hwh5.close();
      } catch (err) {
        console.error('window.HWH5.close failed:', err);
      }
    }
  }, []);

  const finalizeStreamingMessage = React.useCallback(() => {
    assemblerRef.current.complete();

    if (streamingMsgIdRef.current) {
      const finalId = streamingMsgIdRef.current;
      const finalParts = assemblerRef.current.getParts();
      setMessages((prev) =>
        prev.map((m) => (m.id === finalId ? { ...m, isStreaming: false, parts: [...finalParts] } : m)),
      );
    }

    assemblerRef.current.reset();
    streamingMsgIdRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!welinkSessionId || !hw) return;

    const loadMessages = async () => {
      try {
        const result = await hw.getSessionMessage({ welinkSessionId, page: 0, size: 50 });
        setMessages(result.content.map(sessionMessageToMessage));
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    const handleMessage = (msg: StreamMessage) => {
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
          assemblerRef.current.handleMessage(msg);
          const currentText = assemblerRef.current.getText();
          const currentParts = assemblerRef.current.getParts();

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
              { id, role: 'assistant', content: currentText, timestamp: Date.now(), isStreaming: true, parts: [...currentParts] },
            ];
          });
          break;
        }

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
            setMessages(msg.messages.map((sm) => ({
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
            })));
          }
          break;
      }
    };

    const init = async () => {
      await loadMessages();
      setIsLoading(false);
      if (!listenerRegisteredRef.current) {
        hw.registerSessionListener({
          welinkSessionId,
          onMessage: handleMessage,
          onError: (err: { errorCode: number; errorMessage: string }) => {
            console.error('Session listener error:', `${err.errorCode}: ${err.errorMessage}`);
          },
        });
        listenerRegisteredRef.current = true;
      }
    };

    init();

    return () => {
      if (listenerRegisteredRef.current && hw) {
        hw.unregisterSessionListener({ welinkSessionId, onMessage: handleMessage });
        listenerRegisteredRef.current = false;
      }
    };
  }, [welinkSessionId, hw, finalizeStreamingMessage]);

  const handleGenerate = React.useCallback(async (content: string) => {
    if (!welinkSessionId || !hw || !content.trim()) return;

    setSessionStatus('busy');
    setFooterMode('generating');
    awaitingFinalResultRef.current = true;

    setMessages((prev) => [...prev, { id: genId(), role: 'user', content: content.trim(), timestamp: Date.now() }]);

    try {
      await hw.sendMessage({ welinkSessionId, content: content.trim() });
    } catch (err) {
      awaitingFinalResultRef.current = false;
      setSessionStatus('idle');
      setFooterMode('generate');
      console.error('发送消息失败:', err);
    }
  }, [welinkSessionId, hw]);

  const handleStop = React.useCallback(async () => {
    if (!welinkSessionId || !hw) return;

    awaitingFinalResultRef.current = false;
    setFooterMode('regenerate');

    try {
      await hw.stopSkill({ welinkSessionId });
      setSessionStatus('idle');
      finalizeStreamingMessage();
    } catch (err) {
      console.error('Failed to stop skill:', err);
      setFooterMode('generating');
    }
  }, [welinkSessionId, hw, finalizeStreamingMessage]);

  const handleRegenerate = React.useCallback(async () => {
    if (!welinkSessionId || !hw) return;

    if (typeof hw.regenerateAnswer !== 'function') {
      console.error('当前环境不支持重新生成');
      return;
    }

    setSessionStatus('busy');
    setFooterMode('generating');
    awaitingFinalResultRef.current = true;

    try {
      await hw.regenerateAnswer({ welinkSessionId });
    } catch (err) {
      awaitingFinalResultRef.current = false;
      setSessionStatus('idle');
      setFooterMode('regenerate');
      console.error('重新生成失败:', err);
    }
  }, [welinkSessionId, hw]);

  const handleSendToIM = React.useCallback(async () => {
    if (!welinkSessionId || !hw) return;
    try {
      await hw.sendMessageToIM({ welinkSessionId });
    } catch (err) {
      console.error('发送到IM失败:', err);
    }
  }, [welinkSessionId, hw]);

  const handleCopy = React.useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  const handleMinimize = React.useCallback(async () => {
    if (hw) {
      try {
        await hw.controlSkillWeCode({ action: 'minimize' });
      } catch {
        // noop
      } finally {
        closeHwh5();
      }
    }
    onMinimize?.();
  }, [hw, onMinimize, closeHwh5]);

  const handleClose = React.useCallback(async () => {
    if (hw) {
      try {
        await hw.controlSkillWeCode({ action: 'close' });
      } catch {
        // noop
      } finally {
        closeHwh5();
      }
    }
    onClose?.();
  }, [hw, onClose, closeHwh5]);

  return (
    <div className="ai-chat-viewer-container">
      <Header onMinimize={handleMinimize} onClose={handleClose} />
      <Content
        messages={messages}
        welinkSessionId={welinkSessionId}
        isLoading={isLoading}
        onCopy={handleCopy}
        onSendToIM={handleSendToIM}
      />
      <Footer
        mode={footerMode}
        onGenerate={handleGenerate}
        onStop={handleStop}
        onRegenerate={handleRegenerate}
      />
    </div>
  );
};

export default AIChatViewer;
