import React, { useState } from 'react';
import type { MessagePart } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { replyPermission } from '../utils/hwext';

interface PermissionCardProps {
  part: MessagePart;
  welinkSessionId: string;
  onResolved?: () => void;
}

const permTypeLabels: Record<string, string> = {
  file_write: '文件写入',
  file_read: '文件读取',
  command: '命令执行',
  bash: '命令执行',
  network: '网络访问',
  unknown: '操作授权',
};

export const PermissionCard: React.FC<PermissionCardProps> = ({
  part,
  welinkSessionId,
  onResolved,
}) => {
  const [resolved, setResolved] = useState(part.permResolved ?? false);
  const [submitting, setSubmitting] = useState(false);

  const handleDecision = async (response: 'once' | 'always' | 'reject') => {
    if (resolved || submitting || !part.permissionId) return;
    setSubmitting(true);
    try {
      await replyPermission({
        welinkSessionId,
        permId: part.permissionId,
        response,
      });
      setResolved(true);
      onResolved?.();
    } catch (err) {
      console.error('Failed to reply permission:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = permTypeLabels[part.permType ?? 'unknown'] ?? part.permType ?? '操作授权';

  return (
    <div className={`permission-card ${resolved ? 'permission-card--resolved' : ''}`}>
      <div className="permission-card__header">
        <span className="permission-card__icon">🔐</span>
        <span className="permission-card__type">{typeLabel}</span>
      </div>

      <div className="permission-card__info">
        {part.toolName && (
          <div className="permission-card__tool">
            工具: <strong>{part.toolName}</strong>
          </div>
        )}
        {part.content && (
          <div className="permission-card__desc">{part.content}</div>
        )}
      </div>

      {!resolved ? (
        <div className="permission-card__actions">
          <button
            className="permission-card__btn permission-card__btn--allow"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleDecision('once');
              });
            }}
            disabled={submitting}
          >
            ✅ 允许
          </button>
          <button
            className="permission-card__btn permission-card__btn--always"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleDecision('always');
              });
            }}
            disabled={submitting}
          >
            ✅ 始终允许
          </button>
          <button
            className="permission-card__btn permission-card__btn--deny"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleDecision('reject');
              });
            }}
            disabled={submitting}
          >
            ❌ 拒绝
          </button>
        </div>
      ) : (
        <div className="permission-card__status">已处理</div>
      )}
    </div>
  );
};
