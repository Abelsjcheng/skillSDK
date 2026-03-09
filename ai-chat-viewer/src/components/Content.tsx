import React, { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatMessage,
  ChatMessagePart,
  PermissionResponse,
} from '../types';
import '../styles/Content.less';

interface QuestionAnswerPayload {
  messageLocalId: string;
  partId: string;
  answer: string;
  toolCallId?: string;
}

interface PermissionReplyPayload {
  messageLocalId: string;
  partId: string;
  permissionId: string;
  response: PermissionResponse;
}

interface ContentProps {
  messages: ChatMessage[];
  sendingToIMMessageId?: string | null;
  answeringQuestionPartId?: string | null;
  replyingPermissionPartId?: string | null;
  onSendToIM: (message: ChatMessage) => void;
  onAnswerQuestion: (payload: QuestionAnswerPayload) => void;
  onReplyPermission: (payload: PermissionReplyPayload) => void;
  onFeedback: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface QuestionPartViewProps {
  part: ChatMessagePart;
  messageLocalId: string;
  answeringQuestionPartId?: string | null;
  onAnswerQuestion: (payload: QuestionAnswerPayload) => void;
}

interface PermissionPartViewProps {
  part: ChatMessagePart;
  messageLocalId: string;
  replyingPermissionPartId?: string | null;
  onReplyPermission: (payload: PermissionReplyPayload) => void;
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const codeText = String(children).replace(/\n$/, '');
    const isBlock = Boolean(className) || codeText.includes('\n');

    if (isBlock) {
      return (
        <pre className="markdown-code-block">
          <code className={className} {...props}>{codeText}</code>
        </pre>
      );
    }

    return (
      <code className="markdown-inline-code" {...props}>
        {children}
      </code>
    );
  },
};

const statusTextMap: Record<string, string> = {
  pending: '等待中',
  running: '执行中',
  completed: '已完成',
  error: '执行失败',
};

const PermissionPartView: React.FC<PermissionPartViewProps> = ({
  part,
  messageLocalId,
  replyingPermissionPartId,
  onReplyPermission,
}) => {
  const isProcessing = replyingPermissionPartId === part.partId;
  const resolved = Boolean(part.permResolved);

  const handleClick = useCallback((response: PermissionResponse) => {
    if (!part.permissionId || resolved || isProcessing) return;
    onReplyPermission({
      messageLocalId,
      partId: part.partId,
      permissionId: part.permissionId,
      response,
    });
  }, [part, resolved, isProcessing, onReplyPermission, messageLocalId]);

  return (
    <div className={`permission-card ${resolved ? 'resolved' : ''}`}>
      <div className="permission-header">
        <span className="permission-title">权限确认</span>
        {part.permType && <span className="permission-type">{part.permType}</span>}
      </div>
      {part.content && <div className="permission-desc">{part.content}</div>}
      {part.metadata && (
        <pre className="permission-meta">
          {JSON.stringify(part.metadata, null, 2)}
        </pre>
      )}
      {!resolved ? (
        <div className="permission-actions">
          <button
            className="permission-btn allow"
            onClick={() => handleClick('once')}
            type="button"
            disabled={isProcessing}
          >
            允许一次
          </button>
          <button
            className="permission-btn always"
            onClick={() => handleClick('always')}
            type="button"
            disabled={isProcessing}
          >
            始终允许
          </button>
          <button
            className="permission-btn reject"
            onClick={() => handleClick('reject')}
            type="button"
            disabled={isProcessing}
          >
            拒绝
          </button>
        </div>
      ) : (
        <div className="permission-resolved">已处理: {part.response ?? '已确认'}</div>
      )}
    </div>
  );
};

const QuestionPartView: React.FC<QuestionPartViewProps> = ({
  part,
  messageLocalId,
  answeringQuestionPartId,
  onAnswerQuestion,
}) => {
  const [customAnswer, setCustomAnswer] = useState('');
  const answered = Boolean(part.answered);
  const isSubmitting = answeringQuestionPartId === part.partId;

  const submitAnswer = useCallback((answer: string) => {
    if (!answer.trim() || answered || isSubmitting) return;
    onAnswerQuestion({
      messageLocalId,
      partId: part.partId,
      answer: answer.trim(),
      toolCallId: part.toolCallId,
    });
    setCustomAnswer('');
  }, [answered, isSubmitting, messageLocalId, onAnswerQuestion, part.partId, part.toolCallId]);

  return (
    <div className={`question-card ${answered ? 'answered' : ''}`}>
      {part.header && <div className="question-header">{part.header}</div>}
      <div className="question-text">{part.question ?? part.content}</div>
      {part.options && part.options.length > 0 && (
        <div className="question-options">
          {part.options.map((option) => (
            <button
              className="question-option-btn"
              key={option}
              type="button"
              disabled={answered || isSubmitting}
              onClick={() => submitAnswer(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      <div className="question-custom-row">
        <input
          className="question-custom-input"
          value={customAnswer}
          onChange={(event) => setCustomAnswer(event.target.value)}
          disabled={answered || isSubmitting}
          placeholder="输入自定义回答..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitAnswer(customAnswer);
            }
          }}
        />
        <button
          className="question-submit-btn"
          type="button"
          disabled={answered || isSubmitting || !customAnswer.trim()}
          onClick={() => submitAnswer(customAnswer)}
        >
          {isSubmitting ? '提交中...' : '提交'}
        </button>
      </div>
      {answered && <div className="question-answered">已提交回答</div>}
    </div>
  );
};

const ToolPartView: React.FC<{ part: ChatMessagePart }> = ({ part }) => {
  const [expanded, setExpanded] = useState(false);
  const statusText = statusTextMap[part.toolStatus ?? 'pending'] ?? part.toolStatus;

  return (
    <div className={`tool-card tool-${part.toolStatus ?? 'pending'}`}>
      <button
        type="button"
        className="tool-header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="tool-name">{part.toolName ?? '工具执行'}</span>
        <span className="tool-status">{statusText}</span>
      </button>
      {expanded && (
        <div className="tool-body">
          {part.toolTitle && <div className="tool-section-title">{part.toolTitle}</div>}
          {part.toolInput && (
            <div className="tool-section">
              <div className="tool-section-label">输入</div>
              <pre className="tool-section-code">{JSON.stringify(part.toolInput, null, 2)}</pre>
            </div>
          )}
          {part.toolOutput && (
            <div className="tool-section">
              <div className="tool-section-label">输出</div>
              <pre className="tool-section-code">{part.toolOutput}</pre>
            </div>
          )}
          {part.content && (
            <div className="tool-section">
              <div className="tool-section-label">详情</div>
              <pre className="tool-section-code">{part.content}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ThinkingPartView: React.FC<{ part: ChatMessagePart }> = ({ part }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`thinking-card ${part.isStreaming ? 'streaming' : ''}`}>
      <button
        type="button"
        className="thinking-header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span>思考过程</span>
        {part.isStreaming && <span className="thinking-status">思考中...</span>}
      </button>
      {expanded && (
        <div className="thinking-body markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {part.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

const Content: React.FC<ContentProps> = ({
  messages,
  sendingToIMMessageId,
  answeringQuestionPartId,
  replyingPermissionPartId,
  onSendToIM,
  onAnswerQuestion,
  onReplyPermission,
  onFeedback,
}) => {
  const hasMessages = messages.length > 0;

  const handleCopy = useCallback(async (content: string) => {
    const text = content.trim();
    if (!text) {
      onFeedback('该消息没有可复制的文本', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      onFeedback('已复制到剪贴板', 'success');
      return;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onFeedback('已复制到剪贴板', 'success');
    }
  }, [onFeedback]);

  const renderPart = useCallback((message: ChatMessage, part: ChatMessagePart) => {
    switch (part.type) {
      case 'thinking':
        return <ThinkingPartView key={part.partId} part={part} />;
      case 'tool':
        return <ToolPartView key={part.partId} part={part} />;
      case 'question':
        return (
          <QuestionPartView
            key={part.partId}
            part={part}
            messageLocalId={message.localId}
            answeringQuestionPartId={answeringQuestionPartId}
            onAnswerQuestion={onAnswerQuestion}
          />
        );
      case 'permission':
        return (
          <PermissionPartView
            key={part.partId}
            part={part}
            messageLocalId={message.localId}
            onReplyPermission={onReplyPermission}
            replyingPermissionPartId={replyingPermissionPartId}
          />
        );
      case 'file':
        return (
          <div className="file-card" key={part.partId}>
            <span className="file-name">{part.fileName ?? '文件'}</span>
            {part.fileUrl ? (
              <a href={part.fileUrl} target="_blank" rel="noreferrer" className="file-link">
                打开
              </a>
            ) : null}
          </div>
        );
      case 'text':
      default:
        return (
          <div className="markdown-body" key={part.partId}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {part.content}
            </ReactMarkdown>
            {part.isStreaming && <span className="streaming-cursor" />}
          </div>
        );
    }
  }, [answeringQuestionPartId, onAnswerQuestion, onReplyPermission, replyingPermissionPartId]);

  const renderMessageBody = useCallback((message: ChatMessage) => {
    if (message.parts.length > 0) {
      return <div className="message-parts">{message.parts.map((part) => renderPart(message, part))}</div>;
    }

    if (message.role === 'assistant' || message.role === 'tool' || message.role === 'system') {
      return (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
          {message.isStreaming && <span className="streaming-cursor" />}
        </div>
      );
    }

    return <div className="plain-text">{message.content}</div>;
  }, [renderPart]);

  const roleLabel = useMemo(() => ({
    user: '你',
    assistant: 'OpenCode',
    system: '系统',
    tool: '工具',
  }), []);

  return (
    <div className="content">
      {!hasMessages && (
        <div className="empty-state">请先发送一条消息开始对话</div>
      )}
      {hasMessages && (
        <div className="messages-container">
          {messages.map((message) => {
            const isAssistant = message.role === 'assistant';
            const showActions = isAssistant && message.completed && Boolean(message.content.trim());
            const isSendingToIM = sendingToIMMessageId === message.localId;

            return (
              <div
                key={message.localId}
                className={`message-block role-${message.role}`}
              >
                <div className="message-meta">{roleLabel[message.role]}</div>
                <div className="message-content">{renderMessageBody(message)}</div>
                {showActions && (
                  <div className="message-actions">
                    <button
                      className="action-btn copy-btn"
                      type="button"
                      onClick={() => handleCopy(message.content)}
                    >
                      复制
                    </button>
                    <button
                      className="action-btn send-btn"
                      type="button"
                      disabled={isSendingToIM}
                      onClick={() => onSendToIM(message)}
                    >
                      {isSendingToIM ? '发送中...' : '发送'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Content;
