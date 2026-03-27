import React, { useEffect, useMemo, useState } from 'react';
import AssistantPageHeader from '../components/assistant/AssistantPageHeader';
import { resolveAssistantIconUrl } from '../components/createAssistant/constants';
import { dispatchAssistantCloseEvent } from '../utils/assistantHostBridge';
import { getQueryParam, getWeAgentDetails, isPcMiniApp, type WeAgentDetails } from '../utils/hwext';
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
        const nextDetail = result?.WeAgentDetailsArray?.[0] ?? null;
        if (!cancelled) {
          setDetail(nextDetail);
        }
      } catch (error) {
        console.error('getWeAgentDetails failed in AssistantDetail:', error);
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
  const displayCreator = detail?.creatorName ?? '';

  const isInternalAssistant = Boolean(detail?.bizRobotId?.trim());
  const secret = detail?.appSecret ?? '';
  const displaySecret = isSecretVisible ? secret : maskSecret(secret);

  const orgLabel = isInternalAssistant ? '部门' : 'APPID';
  const orgValue = isInternalAssistant ? (detail?.ownerDeptName ?? '') : (detail?.appKey ?? '');
  const ownerLabel = isInternalAssistant ? '责任人' : '密钥';
  const ownerValue = isInternalAssistant ? (detail?.ownerName ?? '') : displaySecret;

  const showSecret = () => {
    if (isInternalAssistant) return;
    setIsSecretVisible(true);
  };

  const hideSecret = () => {
    if (isInternalAssistant) return;
    setIsSecretVisible(false);
  };

  useEffect(() => {
    setIsSecretVisible(false);
  }, [isInternalAssistant, detail?.partnerAccount]);

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }

    dispatchAssistantCloseEvent();
  };

  return (
    <div className="assistant-detail" onClick={handleBackgroundClick}>
      <AssistantPageHeader title="助理详情" isPcMiniApp={isPc} />

      <main className="assistant-detail__content">
        <section className="assistant-detail__card assistant-detail__card--profile">
          <div className="assistant-detail__avatar">
            {displayIcon ? <img src={displayIcon} alt="助理头像" className="assistant-detail__avatar-img" /> : null}
          </div>
          <div className="assistant-detail__name-row">
            <span className="assistant-detail__name">{displayName}</span>
            {isInternalAssistant ? <span className="assistant-detail__tag">{displayTag}</span> : null}
          </div>
        </section>

        <section className="assistant-detail__card assistant-detail__card--intro">
          <h3 className="assistant-detail__section-title">助理简介</h3>
          <p className="assistant-detail__section-desc">{displayDescription}</p>
          <DetailInfoRow label="创建者" value={displayCreator} />
        </section>

        <section className="assistant-detail__card assistant-detail__card--org">
          <DetailInfoRow label={orgLabel} value={orgValue} />
          {isInternalAssistant ? (
            <DetailInfoRow label={ownerLabel} value={ownerValue} />
          ) : (
            <DetailInfoRow
              label={ownerLabel}
              valueNode={(
                <button
                  type="button"
                  className="assistant-detail__secret-btn"
                  onMouseDown={showSecret}
                  onMouseUp={hideSecret}
                  onMouseLeave={hideSecret}
                  onTouchStart={showSecret}
                  onTouchEnd={hideSecret}
                  onTouchCancel={hideSecret}
                  onBlur={hideSecret}
                >
                  {ownerValue}
                </button>
              )}
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default AssistantDetail;
