import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvatarImage from '../components/AvatarImage';
import AssistantDetailActionSheet from '../components/assistant/AssistantDetailActionSheet';
import AssistantDetailDeleteModal from '../components/assistant/AssistantDetailDeleteModal';
import AssistantDetailPcMenu from '../components/assistant/AssistantDetailPcMenu';
import AssistantPageHeader from '../components/assistant/AssistantPageHeader';
import EditAssistantContent from '../components/assistant/EditAssistantContent';
import { resolveAssistantIconUrl } from '../components/createAssistant/constants';
import { APP_ID, isPcMiniApp } from '../constants';
import { ensureLanguageInitialized } from '../i18n/config';
import closeIcon from '../imgs/close_icon.svg';
import defaultAvatar from '../imgs/defaultAvatar.png';
import editIcon from '../imgs/edit_icon.png';
import iconCopy from '../imgs/icon-copy.svg';
import moreIcon from '../imgs/more_icon.png';
import serviceIcon from '../imgs/icon-service.svg';
import type { WeAgentDetails } from '../types/bridge';
import type { AssistantPageHeaderAction } from '../types/components';
import type { DigitalTwinBasicInfoPayload } from '../types/digitalTwin';
import type {
  AssistantDetailOverlay,
  AssistantDetailPcView,
  DetailInfoRowProps,
} from '../types/pages';
import { dispatchAssistantCloseEvent } from '../utils/assistantHostBridge';
import { runButtonClickWithDebounce } from '../utils/buttonDebounce';
import { copyTextToClipboard } from '../utils/clipboard';
import { WeLog } from '../utils/logger';
import {
  buildCustomerServiceWebviewUri,
  CUSTOMER_SERVICE_WEBVIEW_URI,
  getQueryParam,
  getUrlHost,
  getWeAgentDetails,
  openH5Webview,
} from '../utils/hwext';
import { showToast } from '../utils/toast';
import '../styles/AssistantDetail.less';

const DetailInfoRow: React.FC<DetailInfoRowProps> = ({ label, value = '', valueNode }) => (
  <div className="assistant-detail__info-row">
    <span className="assistant-detail__info-label">{label}</span>
    {valueNode ?? <span className="assistant-detail__info-value">{value}</span>}
  </div>
);

const maskSecret = (secret: string): string => (secret ? '*'.repeat(secret.length) : '');
const joinDisplayValue = (...values: Array<string | undefined | null>): string =>
  values
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' ');

const AssistantDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPc = isPcMiniApp();
  const [detail, setDetail] = useState<WeAgentDetails | null>(null);
  const [isSecretVisible, setIsSecretVisible] = useState<boolean>(false);
  const [overlay, setOverlay] = useState<AssistantDetailOverlay>('none');
  const [pcView, setPcView] = useState<AssistantDetailPcView>('detail');
  const [isPcMenuOpen, setIsPcMenuOpen] = useState<boolean>(false);
  const [pcMenuPosition, setPcMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const pageRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);

  const partnerAccount = useMemo(() => getQueryParam('partnerAccount') ?? '', []);

  useEffect(() => {
    void ensureLanguageInitialized();
  }, []);

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
        WeLog(`AssistantDetail getWeAgentDetails failed | extra=${JSON.stringify({ partnerAccount })} | error=${JSON.stringify(error)}`);
        showToast(t('assistantDetail.loadFailed'));
        if (!cancelled) {
          setDetail(null);
        }
      }
    };

    void fetchAssistantDetail();

    return () => {
      cancelled = true;
    };
  }, [partnerAccount, t]);

  const displayName = detail?.name ?? '';
  const displayIcon = resolveAssistantIconUrl(detail?.icon);
  const displayTag = detail?.bizRobotName || detail?.bizRobotNameEn || '';
  const displayDescription = detail?.desc ?? '';
  const creatorDisplayName = (i18n.resolvedLanguage ?? i18n.language) === 'en'
    ? detail?.creatorNameEn
    : detail?.creatorName;
  const displayCreator = joinDisplayValue(creatorDisplayName, detail?.createdBy);

  const isInternalAssistant = Boolean(detail?.bizRobotId?.trim());
  const secret = detail?.appSecret ?? '';
  const displaySecret = isSecretVisible ? secret : maskSecret(secret);

  const orgLabel = isInternalAssistant ? t('assistantDetail.capabilityProvider') : t('assistantDetail.appId');
  const orgValue = isInternalAssistant ? displayTag : (detail?.appKey ?? '');
  const ownerLabel = t('assistantDetail.secret');
  const ownerValue = displaySecret;

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
      WeLog(`AssistantDetail copyTextToClipboard failed | error=${JSON.stringify(error)}`);
      showToast(t('assistantDetail.copyFailed'));
    }
  };

  useEffect(() => {
    setIsSecretVisible(false);
  }, [isInternalAssistant, detail?.partnerAccount]);

  const handleServiceClick = useCallback(() => {
    const sourceUrl = detail?.weCodeUrl?.trim() ?? '';
    if (!sourceUrl) {
      showToast(t('assistantDetail.customerServiceUnavailable'));
      return;
    }

    openH5Webview({
      uri: getUrlHost(sourceUrl) === APP_ID
        ? CUSTOMER_SERVICE_WEBVIEW_URI
        : buildCustomerServiceWebviewUri(sourceUrl),
    });
  }, [detail?.weCodeUrl, t]);

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }

    dispatchAssistantCloseEvent();
  };

  const handleOpenActionSheet = useCallback(() => {
    if (isPc) {
      return;
    }
    setOverlay('action-sheet');
  }, [isPc]);

  const handleCloseOverlay = useCallback(() => {
    setOverlay('none');
  }, []);

  const handleEditAssistant = useCallback(() => {
    setIsPcMenuOpen(false);

    const targetPartnerAccount = (detail?.partnerAccount ?? partnerAccount).trim();

    if (isPc) {
      setPcView('edit');
      return;
    }

    setOverlay('none');
    const nextSearch = new URLSearchParams();
    if (targetPartnerAccount) {
      nextSearch.set('partnerAccount', targetPartnerAccount);
    }
    nextSearch.set('source', 'assistantDetail');
    window.location.hash = nextSearch.toString() ? `#/editAssistant?${nextSearch.toString()}` : '#/editAssistant';
  }, [detail, isPc, partnerAccount]);

  const handleRequestDeleteAssistant = useCallback(() => {
    setIsPcMenuOpen(false);

    if (isPc) {
      // Reserved for future implementation.
      return;
    }

    setOverlay('delete-modal');
  }, [isPc]);

  const handleConfirmDelete = useCallback(() => {
    // Reserved for future implementation.
  }, []);

  const handleTogglePcMenu = useCallback(() => {
    if (!pageRef.current || !moreButtonRef.current) {
      return;
    }

    const pageRect = pageRef.current.getBoundingClientRect();
    const buttonRect = moreButtonRef.current.getBoundingClientRect();

    setPcMenuPosition({
      top: buttonRect.bottom - pageRect.top + 4,
      left: buttonRect.left - pageRect.left,
    });
    setIsPcMenuOpen((previous) => !previous);
  }, []);

  const handleClosePcMenu = useCallback(() => {
    setIsPcMenuOpen(false);
  }, []);

  const handlePcEditSuccess = useCallback((payload: DigitalTwinBasicInfoPayload) => {
    setDetail((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        name: payload.name,
        icon: payload.icon,
        desc: payload.description,
      };
    });
  }, []);

  const pcLeftActions = useMemo<AssistantPageHeaderAction[]>(
    () => [
      {
        label: t('common.service'),
        icon: serviceIcon,
        onClick: handleServiceClick,
      },
      {
        label: t('assistantDetail.editAction'),
        icon: moreIcon,
        onClick: handleTogglePcMenu,
        buttonRef: moreButtonRef,
      },
    ],
    [handleServiceClick, handleTogglePcMenu, t],
  );

  const pcRightActions = useMemo<AssistantPageHeaderAction[]>(
    () => [
      {
        label: t('common.close'),
        icon: closeIcon,
        onClick: () => {
          dispatchAssistantCloseEvent();
        },
      },
    ],
    [t],
  );

  if (isPc && pcView === 'edit') {
    return (
      <EditAssistantContent
        isPcMiniApp
        source="assistantDetail"
        initialDetail={detail}
        partnerAccount={partnerAccount}
        onClose={() => {
          setPcView('detail');
        }}
        onSuccess={handlePcEditSuccess}
      />
    );
  }

  return (
    <div
      ref={pageRef}
      className={`assistant-detail${isPc ? ' assistant-detail--pc' : ''}`}
      onClick={handleBackgroundClick}
    >
      <AssistantPageHeader
        title={t('assistantDetail.title')}
        isPcMiniApp={isPc}
        onService={handleServiceClick}
        mobileRightActionIcon={!isPc ? editIcon : undefined}
        mobileRightActionLabel={!isPc ? t('assistantDetail.editAction') : undefined}
        onMobileRightAction={handleOpenActionSheet}
        pcLeftActions={isPc ? pcLeftActions : undefined}
        pcRightActions={isPc ? pcRightActions : undefined}
      />

      <main className="assistant-detail__content">
        <section className="assistant-detail__card assistant-detail__card--profile">
          <div className="assistant-detail__avatar">
            <AvatarImage
              src={displayIcon}
              fallbackSrc={defaultAvatar}
              alt={t('assistantDetail.avatarAlt')}
              className="assistant-detail__avatar-img"
            />
          </div>
          <div className="assistant-detail__name-row">
            <span className="assistant-detail__name">{displayName}</span>
            {isInternalAssistant && displayTag ? <span className="assistant-detail__tag">{displayTag}</span> : null}
          </div>
        </section>

        <section className="assistant-detail__card assistant-detail__card--intro">
          <h3 className="assistant-detail__section-title">{t('assistantDetail.introTitle')}</h3>
          <p className="assistant-detail__section-desc">{displayDescription}</p>
          <DetailInfoRow
            label={t('assistantDetail.creator')}
            valueNode={<span className="assistant-detail__org-value">{displayCreator}</span>}
          />
        </section>

        <section className="assistant-detail__card assistant-detail__card--org">
          <DetailInfoRow
            label={orgLabel}
            valueNode={
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
                        void handleCopy(orgValue, t('assistantDetail.appIdCopied'));
                      });
                    }}
                    aria-label={t('assistantDetail.copyAppId')}
                  >
                    <img src={iconCopy} alt="" className="assistant-detail__icon" />
                  </button>
                </div>
              )
            }
          />
          {!isInternalAssistant && !isPc ? (
            <DetailInfoRow
              label={ownerLabel}
              valueNode={<span className="assistant-detail__org-value">{ownerValue}</span>}
            />
          ) : !isInternalAssistant ? (
            <DetailInfoRow
              label={ownerLabel}
              valueNode={
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
                      aria-label={isSecretVisible ? t('assistantDetail.hideSecret') : t('assistantDetail.showSecret')}
                    >
                      <img src={iconCopy} alt="" className="assistant-detail__icon" />
                    </button>
                    <button
                      type="button"
                      className="assistant-detail__icon-btn"
                      onClick={(event) => {
                        runButtonClickWithDebounce(event, () => {
                          void handleCopy(secret, t('assistantDetail.secretCopied'));
                        });
                      }}
                      aria-label={t('assistantDetail.copySecret')}
                    >
                      <img src={iconCopy} alt="" className="assistant-detail__icon" />
                    </button>
                  </div>
                </div>
              }
            />
          ) : null}
        </section>
      </main>

      {isPc ? (
        <AssistantDetailPcMenu
          open={isPcMenuOpen}
          top={pcMenuPosition.top}
          left={pcMenuPosition.left}
          onClose={handleClosePcMenu}
          onEdit={handleEditAssistant}
          onDelete={handleRequestDeleteAssistant}
          editLabel={t('assistantDetail.editInfo')}
          deleteLabel={t('assistantDetail.deleteAssistant')}
        />
      ) : (
        <>
          <AssistantDetailActionSheet
            open={overlay === 'action-sheet'}
            onClose={handleCloseOverlay}
            onEdit={handleEditAssistant}
            onDelete={handleRequestDeleteAssistant}
          />
          <AssistantDetailDeleteModal
            open={overlay === 'delete-modal'}
            assistantName={displayName}
            onClose={handleCloseOverlay}
            onConfirm={handleConfirmDelete}
          />
        </>
      )}
    </div>
  );
};

export default AssistantDetail;
