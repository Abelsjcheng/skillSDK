import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isPcMiniApp } from '../constants';
import type { MessagePart, PermissionResponse } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { replyPermission } from '../utils/hwext';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';

interface PermissionCardProps {
  part: MessagePart;
  welinkSessionId: string;
  onResolved?: () => void;
  readonly?: boolean;
}

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
  const { t } = useTranslation();
  const permTypeLabels = useMemo<Record<string, string>>(() => ({
    file_write: t('permission.fileWrite'),
    file_read: t('permission.fileRead'),
    command: t('permission.command'),
    bash: t('permission.command'),
    network: t('permission.network'),
    unknown: t('permission.unknown'),
  }), [t]);
  const permissionResponseLabels = useMemo<Record<PermissionResponse, string>>(() => ({
    once: t('common.allow'),
    always: t('common.allowAlways'),
    reject: t('common.reject'),
  }), [t]);
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
      WeLog(`PermissionCard replyPermission failed | extra=${JSON.stringify({
        welinkSessionId,
        permissionId: part.permissionId,
        response,
      })} | error=${JSON.stringify(err)}`);
      showToast(t('permission.processFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = permTypeLabels[part.permType ?? 'unknown'] ?? part.permType ?? t('permission.unknown');
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
        <span className="permission-card__icon">!</span>
        <span className="permission-card__type">{typeLabel}</span>
      </div>

      <div className="permission-card__info">
        {part.toolName && (
          <div className="permission-card__tool">
            {t('permission.toolLabel')}: <strong>{part.toolName}</strong>
          </div>
        )}
        {part.content && (
          <div className="permission-card__desc">{part.content}</div>
        )}
      </div>

      {resolved && permissionResponseText && (
        <div className="permission-card__result">
          <span className="permission-card__result-label">{t('common.confirmed')}</span>
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
            {t('common.allow')}
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
            {t('common.allowAlways')}
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
            {t('common.reject')}
          </button>
        </div>
      ) : !permissionResponseText ? (
        <div className="permission-card__status">
          {t('common.processed')}
        </div>
      ) : null}
    </div>
  );
};
