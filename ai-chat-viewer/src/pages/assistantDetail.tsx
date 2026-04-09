import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AssistantPageHeader from '../components/assistant/AssistantPageHeader';
import { resolveAssistantIconUrl } from '../components/createAssistant/constants';
import { isPcMiniApp } from '../constants';
import iconCopy from '../imgs/icon-copy.svg';
import { dispatchAssistantCloseEvent } from '../utils/assistantHostBridge';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  buildCustomerServiceWebviewUri,
  getQueryParam,
  getWeAgentDetails,
  openH5Webview,
  type WeAgentDetails,
} from '../utils/hwext';
import { showToast } from '../utils/toast';
import '../styles/AssistantDetail.less';

interface DetailInfoRowProps {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}

const DetailInfoRow: React.FC<DetailInfoRowProps> = ({ label, value = '', valueNode }) => (
  <div className="assistant-detail__info-row">
    <span className="assistant-detail__info-label">{label}</span>
    {valueNode ?? <span className="assistant-detail__info-value">{value}</span>}
  </div>
);

const maskSecret = (secret: string): string => (secret ? '*'.repeat(secret.length) : '');
const joinDisplayValue = (...values: Array<string | undefined | null>): string => values
  .map((value) => (value ?? '').trim())
  .filter(Boolean)
  .join(' ');

const AssistantDetail: React.FC = () => {
  const isPc = isPcMiniApp();
  const [detail, setDetail] = useState<WeAgentDetails | null>(null);
  const [isSecretVisible, setIsSecretVisible] = useState<boolean>(false);

  const partnerAccount = useMemo(() => getQueryParam('partnerAccount') ?? '', []);

  useEffect(() => {
    if (!partnerAccount) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    const fetchAssistantDetail = async () => {
      try {
        const result = await getWeAgentDetails({ partnerAccount });
        const nextDetail = result?.weAgentDetailsArray?.[0] ?? null;
        if (!cancelled) {
          setDetail(nextDetail);
        }
      } catch (error) {
        console.error('getWeAgentDetails failed in AssistantDetail:', error);
        showToast('获取助理详情失败');
        if (!cancelled) {
          setDetail(null);
        }
      }
    };

    void fetchAssistantDetail();

    return () => {
      cancelled = true;
    };
  }, [partnerAccount]);

  const displayName = detail?.name ?? '';
  const displayIcon = resolveAssistantIconUrl(detail?.icon);
  const displayTag = detail?.bizRobotName || detail?.bizRobotNameEn || '';
  const displayDescription = detail?.desc ?? '';
  const displayCreator = joinDisplayValue(detail?.creatorName, detail?.createdBy);

  const isInternalAssistant = Boolean(detail?.bizRobotId?.trim());
  const secret = detail?.appSecret ?? '';
  const displaySecret = isSecretVisible ? secret : maskSecret(secret);

  const orgLabel = isInternalAssistant ? '部门' : 'APPID';
  const orgValue = isInternalAssistant ? (detail?.ownerDeptName ?? '') : (detail?.appKey ?? '');
  const ownerLabel = isInternalAssistant ? '责任人' : '密钥';
  const ownerValue = isInternalAssistant
    ? joinDisplayValue(detail?.ownerName, detail?.ownerWelinkId)
    : displaySecret;

  const toggleSecretVisible = () => {
    if (isInternalAssistant) return;
    setIsSecretVisible((previous) => !previous);
  };

  const handleCopy = async (content: string, successMessage: string) => {
    if (!content) {
      return;
    }
    try {
      await copyTextToClipboard(content);
      showToast(successMessage);
    } catch (error) {
      console.error('Copy failed in AssistantDetail:', error);
      showToast('复制失败');
    }
  };

  useEffect(() => {
    setIsSecretVisible(false);
  }, [isInternalAssistant, detail?.partnerAccount]);

  const handleServiceClick = useCallback(() => {
    const sourceUrl = detail?.weCodeUrl?.trim() ?? '';
    if (!sourceUrl) {
      showToast('客服链接不存在');
      return;
    }

    openH5Webview({
      uri: buildCustomerServiceWebviewUri(sourceUrl),
    });
  }, [detail?.weCodeUrl]);

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }

    dispatchAssistantCloseEvent();
  };

  return (
    <div className="assistant-detail" onClick={handleBackgroundClick}>
      <AssistantPageHeader title="助理详情" isPcMiniApp={isPc} onService={handleServiceClick} />

      <main className="assistant-detail__content">
        <section className="assistant-detail__card assistant-detail__card--profile">
          <div className="assistant-detail__avatar">
            {displayIcon ? <img src={displayIcon} alt="助理头像" className="assistant-detail__avatar-img" /> : null}
          </div>
          <div className="assistant-detail__name-row">
            <span className="assistant-detail__name">{displayName}</span>
            {isInternalAssistant && displayTag ? <span className="assistant-detail__tag">{displayTag}</span> : null}
          </div>
        </section>

        <section className="assistant-detail__card assistant-detail__card--intro">
          <h3 className="assistant-detail__section-title">助理简介</h3>
          <p className="assistant-detail__section-desc">{displayDescription}</p>
          <DetailInfoRow
            label="创建者"
            valueNode={<span className="assistant-detail__org-value">{displayCreator}</span>}
          />
        </section>

        <section className="assistant-detail__card assistant-detail__card--org">
          <DetailInfoRow
            label={orgLabel}
            valueNode={(
              isInternalAssistant ? (
                <span className="assistant-detail__org-value">{orgValue}</span>
              ) : !isPc ? (
                <span className="assistant-detail__org-value">{orgValue}</span>
              ) : (
                <div className="assistant-detail__value-with-actions">
                  <span className="assistant-detail__org-value">{orgValue}</span>
                  <button
                    type="button"
                    className="assistant-detail__icon-btn"
                    onClick={(event) => {
                      runButtonClickWithDebounce(event, () => {
                        void handleCopy(orgValue, 'APPID已复制');
                      });
                    }}
                    aria-label="复制APPID"
                  >
                    <img src={iconCopy} alt="" className="assistant-detail__icon" />
                  </button>
                </div>
              )
            )}
          />
          {isInternalAssistant ? (
            <DetailInfoRow
              label={ownerLabel}
              valueNode={<span className="assistant-detail__org-value">{ownerValue}</span>}
            />
          ) : !isPc ? (
            <DetailInfoRow
              label={ownerLabel}
              valueNode={<span className="assistant-detail__org-value">{ownerValue}</span>}
            />
          ) : (
            <DetailInfoRow
              label={ownerLabel}
              valueNode={(
                <div className="assistant-detail__value-with-actions">
                  <span className="assistant-detail__org-value">{ownerValue}</span>
                  <div className="assistant-detail__action-group">
                    <button
                      type="button"
                      className="assistant-detail__icon-btn"
                      onClick={(event) => {
                        runButtonClickWithDebounce(event, () => {
                          toggleSecretVisible();
                        });
                      }}
                      aria-label={isSecretVisible ? '隐藏密钥' : '查看密钥'}
                    >
                      <img src={iconCopy} alt="" className="assistant-detail__icon" />
                    </button>
                    <button
                      type="button"
                      className="assistant-detail__icon-btn"
                      onClick={(event) => {
                        runButtonClickWithDebounce(event, () => {
                          void handleCopy(secret, '密钥已复制');
                        });
                      }}
                      aria-label="复制密钥"
                    >
                      <img src={iconCopy} alt="" className="assistant-detail__icon" />
                    </button>
                  </div>
                </div>
              )}
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default AssistantDetail;
