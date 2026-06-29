import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import AvatarImage from './AvatarImage';
import { copyTextToClipboard } from '../utils/clipboard';
import copyIcon from '../imgs/icon-copy.svg';
import sendImIcon from '../imgs/send_icon.svg';
import docIcon from '../imgs/doc.png';
import excelIcon from '../imgs/excel.png';
import txtIcon from '../imgs/txt.png';
import videoIcon from '../imgs/video.png';
import unknownFileIcon from '../imgs/unknowFile.png';
import downloadFileIcon from '../imgs/downloadFile.png';
import { ToolCard } from './ToolCard';
import { ThinkingBlock } from './ThinkingBlock';
import { QuestionCard } from './QuestionCard';
import { PermissionCard } from './PermissionCard';
import { ErrorBlock } from './ErrorBlock';
import { SubtaskBlock } from './SubtaskBlock';
import { createMarkdownComponents, normalizeMarkdownHtml } from './markdownComponents';
import type { Message, MessagePart } from '../types';
import type { MessageBubbleProps } from '../types/components';
import {
  groupMessagePartsForDisplay,
  normalizeRole,
  shouldRenderMessagePart,
  syncToolCallIdForQuestionParts,
} from '../utils/message';
import defaultAvatar from '../imgs/defaultAvatar.png';
import 'katex/dist/katex.min.css';
import { showToast } from '../utils/toast';
import { WeLog } from '../utils/logger';
import {
  formatUMFileSize,
  getUMFileIconType,
  parseUMContent,
  type UMAsset,
  type UMContentSegment,
} from '../utils/umDecode';

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function hasMarkdownCodeBlock(content?: string): boolean {
  if (typeof content !== 'string' || content.length === 0) {
    return false;
  }
  return /(^|\n)```/.test(content);
}

function messageContainsCodeBlock(message: Message): boolean {
  if (message.parts?.some((part) => part.type === 'text' && hasMarkdownCodeBlock(part.content))) {
    return true;
  }
  return hasMarkdownCodeBlock(message.content);
}

function isQuestionPartReadonly(part: MessagePart, readonly: boolean): boolean {
  if (part.type !== 'question') {
    return readonly;
  }
  if (part.answered) {
    return readonly;
  }
  return false;
}

function isPermissionPartReadonly(part: MessagePart, readonly: boolean): boolean {
  if (part.type !== 'permission') {
    return readonly;
  }
  if (part.permResolved) {
    return readonly;
  }
  return false;
}

const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];
const MARKDOWN_REHYPE_PLUGINS = [rehypeRaw, rehypeKatex];

function getFileCardIconSrc(asset: UMAsset): string {
  switch (getUMFileIconType(asset.fileName, asset.fileType)) {
    case 'doc':
      return docIcon;
    case 'excel':
      return excelIcon;
    case 'txt':
      return txtIcon;
    case 'video':
      return videoIcon;
    case 'unknown':
    default:
      return unknownFileIcon;
  }
}

function getFileAccessUrl(asset: UMAsset): string {
  return asset.extProps.cdnUrl || asset.url;
}

function createUMAssetFromMessagePart(part: MessagePart): UMAsset {
  const fileMime = part.fileMime?.toLowerCase() ?? '';
  return {
    raw: '',
    url: part.fileUrl ?? '',
    fileType: fileMime.startsWith('video/') ? 'Video' : 'File',
    fileName: part.fileName || '\u6587\u4ef6',
    extProps: {},
  };
}

interface UMFileCardProps {
  asset: UMAsset;
}

const UMFileCard: React.FC<UMFileCardProps> = ({ asset }) => {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const accessUrl = getFileAccessUrl(asset);
  const canAccessFile = Boolean(accessUrl);
  const fileSizeText = asset.fileSize === undefined ? '\u672a\u77e5\u5927\u5c0f' : formatUMFileSize(asset.fileSize);

  useEffect(() => {
    if (!menuPosition) {
      return undefined;
    }

    const closeMenu = () => setMenuPosition(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [menuPosition]);

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleOpenFile = () => {
    if (!accessUrl) {
      showToast('\u6587\u4ef6\u5730\u5740\u4e0d\u53ef\u7528');
      return;
    }
    window.open(accessUrl, '_blank', 'noopener,noreferrer');
    setMenuPosition(null);
  };

  const handleDownloadFile = () => {
    if (!accessUrl) {
      showToast('\u6587\u4ef6\u5730\u5740\u4e0d\u53ef\u7528');
      return;
    }
    const link = document.createElement('a');
    link.href = accessUrl;
    link.download = asset.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMenuPosition(null);
  };

  const menuNode = menuPosition
    ? createPortal(
      <div
        className="um-file-card-menu"
        role="menu"
        style={{ left: menuPosition.x, top: menuPosition.y }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={handleOpenFile} disabled={!canAccessFile}>
          {'\u6253\u5f00\u6587\u4ef6'}
        </button>
        <button type="button" role="menuitem" disabled>
          {'\u6253\u5f00\u6587\u4ef6\u5939'}
        </button>
        <button type="button" role="menuitem" onClick={handleDownloadFile} disabled={!canAccessFile}>
          {'\u4e0b\u8f7d'}
        </button>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div className="um-file-card" onContextMenu={handleContextMenu} title={asset.fileName}>
        <img className="um-file-card__thumb" src={getFileCardIconSrc(asset)} alt="" aria-hidden="true" draggable="false" />
        <div className="um-file-card__info">
          <div className="um-file-card__name">{asset.fileName}</div>
          <div className="um-file-card__meta">
            <span className="um-file-card__size">{fileSizeText}</span>
            <button
              type="button"
              className="um-file-card__download"
              onClick={handleDownloadFile}
              disabled={!canAccessFile}
              aria-label={`\u4e0b\u8f7d${asset.fileName}`}
            >
              <img src={downloadFileIcon} alt="" aria-hidden="true" draggable="false" />
            </button>
          </div>
        </div>
      </div>
      {menuNode}
    </>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  welinkSessionId,
  variant = 'weAgent',
  showActions = false,
  onQuestionAnswered,
  onCopy,
  onSendToIM,
  weAgentUserName = '',
  weAgentUserAvatar = '',
  weAgentAssistantName = '',
  weAgentAssistantAvatar = '',
}) => {
  const normalizedRole = normalizeRole(message.role);
  const isUser = normalizedRole === 'user';
  const isHistoryAssistantReadonly = Boolean(message.isHistory && normalizedRole === 'assistant');
  const hasCodeBlock = !isUser && messageContainsCodeBlock(message);
  const isPlainVariant = variant === 'plain';
  const canRenderActions = showActions && !isUser;

  const markdownComponents: Components = useMemo(
    () => createMarkdownComponents(true),
    [],
  );

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={MARKDOWN_REMARK_PLUGINS}
      rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
      components={markdownComponents}
    >
      {normalizeMarkdownHtml(content)}
    </ReactMarkdown>
  );

  const shouldRenderUMAsset = (segment: UMContentSegment): boolean => (
    segment.type === 'asset' && (segment.asset.fileType === 'File' || segment.asset.fileType === 'Video')
  );

  const renderPlainText = (content: string, key?: string) => (
    <span key={key} style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
  );

  const renderContentWithUM = (content: string, keyPrefix: string, renderAsMarkdown: boolean) => {
    const segments = parseUMContent(content);
    if (!segments.some(shouldRenderUMAsset)) {
      return renderAsMarkdown ? renderMarkdown(content) : renderPlainText(content);
    }

    return (
      <div className="um-content">
        {segments.map((segment, index) => {
          const key = `${keyPrefix}-${index}`;
          if (segment.type === 'asset') {
            if (segment.asset.fileType !== 'File' && segment.asset.fileType !== 'Video') {
              return renderAsMarkdown
                ? <div key={key} className="um-content__text">{renderMarkdown(segment.asset.raw)}</div>
                : renderPlainText(segment.asset.raw, key);
            }
            return <UMFileCard key={key} asset={segment.asset} />;
          }

          return renderAsMarkdown
            ? <div key={key} className="um-content__text">{renderMarkdown(segment.content)}</div>
            : renderPlainText(segment.content, key);
        })}
      </div>
    );
  };

  const renderPart = (part: MessagePart, nested = false): React.ReactNode => {
    switch (part.type) {
      case 'thinking':
        return <ThinkingBlock key={part.partId} part={part} />;

      case 'tool':
        return <ToolCard key={part.partId} part={part} />;

      case 'question':
        return (
          <QuestionCard
            key={part.partId}
            part={part}
            messageId={message.id}
            onAnswered={onQuestionAnswered}
            readonly={isQuestionPartReadonly(part, isHistoryAssistantReadonly)}
          />
        );

      case 'permission':
        return (
          <PermissionCard
            key={part.partId}
            part={part}
            welinkSessionId={welinkSessionId}
            readonly={isPermissionPartReadonly(part, isHistoryAssistantReadonly)}
          />
        );

      case 'file':
        return <UMFileCard key={part.partId} asset={createUMAssetFromMessagePart(part)} />;
      case 'error':
        return <ErrorBlock key={part.partId} part={part} />;

      case 'subtask':
        return (
          <SubtaskBlock key={part.partId} part={part}>
            <div className="subtask-block__parts">
              {(part.subParts ?? [])
                .filter(shouldRenderMessagePart)
                .map((subPart) => renderPart(subPart, true))}
            </div>
          </SubtaskBlock>
        );

      case 'text':
      default:
        return (
          <div key={part.partId} className="text-part">
            {renderContentWithUM(part.content, part.partId, normalizedRole !== 'user')}
          </div>
        );
    }
  };

  const renderContent = () => {
    const normalizedParts = message.parts
      ? groupMessagePartsForDisplay(syncToolCallIdForQuestionParts(message.parts)).filter(shouldRenderMessagePart)
      : undefined;
    if (normalizedParts && normalizedParts.length > 0) {
      return (
        <div className="message-parts">
          {normalizedParts.map((part) => renderPart(part, false))}
        </div>
      );
    }

    if (!message.content.trim()) {
      return null;
    }

    if (normalizedRole === 'assistant' || normalizedRole === 'tool') {
      return renderContentWithUM(message.content, message.id, true);
    }
    return renderContentWithUM(message.content, message.id, false);
  };

  const handleCopy = () => {
    if (onCopy) {
      void onCopy(message.content);
      return;
    }

    void copyTextToClipboard(message.content)
      .then(() => {
        showToast('复制成功');
      })
      .catch((error) => {
        WeLog(`MessageBubble copy failed | error=${JSON.stringify(error)}`);
        showToast('复制失败');
      });
  };

  const handleSendToIM = () => {
    void onSendToIM?.(message.content);
  };

  const renderActions = () => {
    if (!canRenderActions || message.isStreaming || !message.content) {
      return null;
    }

    return (
      <div className="message-actions">
        {onCopy ? (
          <button
            type="button"
            className="action-btn copy-btn"
            onClick={handleCopy}
            title="复制内容"
          >
            <img className="action-btn__icon" src={copyIcon} alt="" aria-hidden="true" draggable="false" />
            <span className="action-btn__text">复制</span>
          </button>
        ) : null}
        {onSendToIM ? (
          <button
            type="button"
            className="action-btn send-btn"
            onClick={handleSendToIM}
            title="发送到聊天"
          >
            <img className="action-btn__icon" src={sendImIcon} alt="" aria-hidden="true" draggable="false" />
            <span className="action-btn__text">发送</span>
          </button>
        ) : null}
      </div>
    );
  };

  const messageContent = renderContent();
  if (messageContent === null) {
    return null;
  }
  const messageTimeText = formatMessageTime(message.timestamp || new Date().getTime());
  const userName = weAgentUserName.trim();
  const assistantName = weAgentAssistantName.trim();
  const messageMetaText = `${isUser ? userName : assistantName} ${messageTimeText}`.trim();

  if (isPlainVariant) {
    return (
      <div className={`message-block ${isUser ? 'message-user' : 'message-assistant'}`}>
        <div className="message-content">{messageContent}</div>
        {renderActions()}
      </div>
    );
  }

  return (
    <div className={`message-block message-we-agent ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className={`we-agent-message ${isUser ? 'we-agent-message--user' : 'we-agent-message--assistant'}`}>
        <div className={`we-agent-message__meta ${isUser ? 'is-user' : 'is-assistant'}`}>
          {isUser ? (
            <>
              <span className="we-agent-message__meta-text">{messageMetaText}</span>
              <AvatarImage
                className="we-agent-message__avatar"
                src={weAgentUserAvatar}
                fallbackSrc={defaultAvatar}
                alt=""
              />
            </>
          ) : (
            <>
              <AvatarImage
                className="we-agent-message__avatar"
                src={weAgentAssistantAvatar}
                fallbackSrc={defaultAvatar}
                alt=""
              />
              <span className="we-agent-message__meta-text">{messageMetaText}</span>
            </>
          )}
        </div>
        <div
          className={[
            'we-agent-message__bubble',
            isUser ? 'is-user' : 'is-assistant',
            hasCodeBlock ? 'has-code-block' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="message-content">{messageContent}</div>
        </div>
      </div>
    </div>
  );
};
