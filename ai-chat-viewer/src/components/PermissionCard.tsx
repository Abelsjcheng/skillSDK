import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isPcMiniApp } from '../constants';
import lockIcon from '../imgs/lock_icon.png';
import type { PermissionCardProps } from '../types/components';
import type { MessagePart, PermissionResponse } from '../types';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { replyPermission } from '../utils/hwext';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';

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
    if (resolved || isLocked || !part.permissionId) {
      return;
    }

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
    <Fragment>
      <div
        className={[
          'permission-card',
          resolved ? 'permission-card--resolved' : '',
          isPc ? 'permission-card--pc' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="permission-card__header">
          <img className="permission-card__icon" src={lockIcon} alt="" aria-hidden="true" draggable="false" />
          <span className="permission-card__type">{typeLabel}</span>
        </div>

        <div className="permission-card__info">
          {part.toolName ? <div className="permission-card__tool">{part.toolName}</div> : null}
          {part.content ? <div className="permission-card__desc">{part.content}</div> : null}
        </div>

        {resolved && permissionResponseText ? (
          <div className="permission-card__result">
            <span className="permission-card__result-label">已确认</span>
            <div className="permission-card__result-content">{permissionResponseText}</div>
          </div>
        ) : null}
      </div>

      {!resolved ? (
        <div className="permission-card__actions">
          <span className="permission-card__actions-label">edit</span>
          <div className="permission-card__actions-buttons">
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
              className="permission-card__btn permission-card__btn--allow"
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  void handleDecision('once');
                });
              }}
              disabled={isLocked}
            >
              允许一次
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
        </div>
      ) : !permissionResponseText ? (
        <div className="permission-card__status">{t('common.processed')}</div>
      ) : null}
    </Fragment>
  );
};
