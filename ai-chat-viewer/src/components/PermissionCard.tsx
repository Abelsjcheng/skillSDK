import React, { useEffect, useState } from 'react';
import { isPcMiniApp } from '../constants';
import type { MessagePart, PermissionResponse } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { replyPermission } from '../utils/hwext';
import { showToast } from '../utils/toast';

interface PermissionCardProps {
  part: MessagePart;
  welinkSessionId: string;
  onResolved?: () => void;
  readonly?: boolean;
}

const permTypeLabels: Record<string, string> = {
  file_write: '文件写入',
  file_read: '文件读取',
  command: '命令执行',
  bash: '命令执行',
  network: '网络访问',
  unknown: '操作授权',
};

const permissionResponseLabels: Record<PermissionResponse, string> = {
  once: '允许一次',
  always: '始终允许',
  reject: '拒绝',
};

function getPermissionResponse(part: MessagePart): PermissionResponse | string | undefined {
  if (typeof part.response !== 'string') {
    return undefined;
  }

  const normalized = part.response.trim();
  return normalized || undefined;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  part,
  welinkSessionId,
  onResolved,
  readonly = false,
}) => {
  const isPc = isPcMiniApp();
  const [resolved, setResolved] = useState(Boolean(part.permResolved || getPermissionResponse(part)));
  const [permissionResponse, setPermissionResponse] = useState<PermissionResponse | string | undefined>(
    getPermissionResponse(part),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const nextResponse = getPermissionResponse(part);
    setPermissionResponse(nextResponse);
    setResolved(Boolean(part.permResolved || nextResponse));
  }, [part.partId, part.permResolved, part.response]);

  const isLocked = submitting || readonly;

  const handleDecision = async (response: PermissionResponse) => {
    if (resolved || isLocked || !part.permissionId) return;

    setSubmitting(true);
    try {
      await replyPermission({
        welinkSessionId,
        permId: part.permissionId,
        response,
      });
      setResolved(true);
      setPermissionResponse(response);
      onResolved?.();
    } catch (err) {
      console.error('Failed to reply permission:', err);
      showToast('权限处理失败');
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = permTypeLabels[part.permType ?? 'unknown'] ?? part.permType ?? '操作授权';
  const permissionResponseText = permissionResponse && permissionResponse in permissionResponseLabels
    ? permissionResponseLabels[permissionResponse as PermissionResponse]
    : permissionResponse;

  return (
    <div
      className={[
        'permission-card',
        resolved ? 'permission-card--resolved' : '',
        isPc ? 'permission-card--pc' : '',
      ].filter(Boolean).join(' ')}
    >
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

      {resolved && permissionResponseText && (
        <div className="permission-card__result">
          <span className="permission-card__result-label">已确认</span>
          <div className="permission-card__result-content">{permissionResponseText}</div>
        </div>
      )}

      {!resolved ? (
        <div className="permission-card__actions">
          <button
            className="permission-card__btn permission-card__btn--allow"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleDecision('once');
              });
            }}
            disabled={isLocked}
          >
            允许
          </button>
          <button
            className="permission-card__btn permission-card__btn--always"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleDecision('always');
              });
            }}
            disabled={isLocked}
          >
            始终允许
          </button>
          <button
            className="permission-card__btn permission-card__btn--deny"
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                void handleDecision('reject');
              });
            }}
            disabled={isLocked}
          >
            拒绝
          </button>
        </div>
      ) : !permissionResponseText ? (
        <div className="permission-card__status">
          已处理
        </div>
      ) : null}
    </div>
  );
};
