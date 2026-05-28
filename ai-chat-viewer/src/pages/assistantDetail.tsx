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
import closeEyeIcon from '../imgs/close_eye_icon.svg';
import openEyeIcon from '../imgs/open_eye_icon.svg';
import serviceIcon from '../imgs/icon-service.svg';
import type { WeAgentDetails, WeAgentListItem } from '../types/bridge';
import type { AssistantPageHeaderAction } from '../types/components';
import type { DigitalTwinBasicInfoPayload } from '../types/digitalTwin';
import type {
  AssistantDetailProps,
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
  deleteWeAgent,
  getQueryParam,
  getUrlHost,
  getWeAgentDetails,
  openH5Webview,
} from '../utils/hwext';
import {
  EXCLUSIVE_ASSISTANT_BIZ_TAG,
  resolveAssistantTag,
} from '../utils/assistantTag';
import { showToast } from '../utils/toast';
import '../styles/AssistantDetail.less';
import { handleServiceClickPc } from '../utils/assistantPcHandle';

const DetailInfoRow: React.FC<DetailInfoRowProps> = ({ label, value = '', valueNode }) => (
  <div className='assistant-detail__info-row'>
    <span className='assistant-detail__info-label'>{label}</span>
    {valueNode ?? <span className='assistant-detail__info-value'>{value}</span>}
  </div>
);

const maskSecret = (secret: string): string => (secret ? '*'.repeat(secret.length) : '');
const joinDisplayValue = (...values: Array<string | undefined | null>): string =>
  values
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' ');

const AssistantDetail: React.FC<AssistantDetailProps> = ({ partnerAccount }) => {
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

  const resolvedPartnerAccount = isPc
    ? (partnerAccount?.trim() ?? '')
    : useMemo(() => getQueryParam('partnerAccount') ?? '', []);

  useEffect(() => {
    void ensureLanguageInitialized();
  }, []);

  useEffect(() => {
    if (!resolvedPartnerAccount) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    const fetchAssistantDetail = async () => {
      try {
        const result = await getWeAgentDetails({ partnerAccount: resolvedPartnerAccount });
        const nextDetail = result?.weAgentDetailsArray?.[0] ?? null;
        if (!cancelled) {
          setDetail(nextDetail);
        }
      } catch (error) {
        WeLog(`AssistantDetail getWeAgentDetails failed | extra=${JSON.stringify({ resolvedPartnerAccount })} | error=${JSON.stringify(error)}`);
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
  }, [resolvedPartnerAccount, t]);

  const displayName = detail?.name ?? '';
  const displayIcon = resolveAssistantIconUrl(detail?.icon);
  const bizRobotTag = detail?.bizRobotTag?.trim() ?? '';
  const displayTag = resolveAssistantTag(detail);
  const displayDescription = detail?.desc ?? '';
  const creatorDisplayName = (i18n.resolvedLanguage ?? i18n.language) === 'en'
    ? detail?.creatorNameEn
    : detail?.creatorName;
  const displayCreator = joinDisplayValue(creatorDisplayName, detail?.creatorW3Account);

  const isInternalAssistant = Boolean(detail?.bizRobotId?.trim());
  const isExclusiveAssistant = isInternalAssistant && bizRobotTag === EXCLUSIVE_ASSISTANT_BIZ_TAG;
  const secret = detail?.appSecret ?? '';
  const displaySecret = isSecretVisible ? secret : maskSecret(secret);

  const orgLabel = isInternalAssistant ? t('assistantDetail.capabilityProvider') : t('assistantDetail.appId');
  const orgValue = isInternalAssistant ? displayTag : (detail?.appKey ?? '');
  const ownerLabel = t('assistantDetail.secret');
  const ownerValue = displaySecret;
  const hasDescription = Boolean(displayDescription.trim());
  const hasCreator = Boolean(displayCreator.trim());
  const hasOrgValue = Boolean(orgValue.trim());
  const hasSecretValue = Boolean(secret.trim());
  const showCreatorRow = !isExclusiveAssistant && hasCreator;
  const showOrgRow = !isExclusiveAssistant && hasOrgValue;
  const showSecretRow = !isInternalAssistant && hasSecretValue;
  const showIntroCard = hasDescription || showCreatorRow;
  const showOrgCard = showOrgRow || showSecretRow;

  const toggleSecretVisible = useCallback(() => {
    if (isInternalAssistant) return;
    setIsSecretVisible((previous) => !previous);
  }, [isInternalAssistant]);

  const handleCopy = useCallback(async (content: string, successMessage: string) => {
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
  }, [t]);

  useEffect(() => {
    setIsSecretVisible(false);
  }, [isInternalAssistant, detail?.partnerAccount]);

  const handleClosePage = useCallback(() => {
    dispatchAssistantCloseEvent();
  }, []);

  const handleServiceClick = useCallback(() => {
    if (isPc) {
      handleServiceClickPc(detail);
      return;
    }
    const sourceUrl = detail?.weCodeUrl?.trim() ?? '';
    if (!sourceUrl) {
      showToast(t('assistantDetail.customerServiceUnavailable'));
      return;
    }

    openH5Webview({
      uri: getUrlHost(sourceUrl) === APP_ID()
        ? CUSTOMER_SERVICE_WEBVIEW_URI
        : buildCustomerServiceWebviewUri(sourceUrl),
    });
  }, [detail?.weCodeUrl, t]);

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }

    handleClosePage();
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

    const targetPartnerAccount = (detail?.partnerAccount ?? resolvedPartnerAccount).trim();

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
  }, [detail, isPc, resolvedPartnerAccount]);

  const handleRequestDeleteAssistant = useCallback(() => {
    setIsPcMenuOpen(false);

    if (isPc) {
      // Reserved for future implementation.
      return;
    }

    setOverlay('delete-modal');
  }, [isPc]);

  const handleConfirmDelete = useCallback(async () => {
    const targetPartnerAccount = (detail?.partnerAccount ?? partnerAccount ?? '').trim();
    const targetRobotId = (detail?.id ?? '').trim();

    if (!targetPartnerAccount && !targetRobotId) {
      showToast(t('assistantDetail.deleteFailed'));
      return;
    }

    try {
      await deleteWeAgent({
        ...(targetPartnerAccount ? { partnerAccount: targetPartnerAccount } : {}),
        ...(targetRobotId ? { robotId: targetRobotId } : {}),
      });
      setOverlay('none');
      window.HWH5.close();
    } catch (error) {
      WeLog(`AssistantDetail deleteWeAgent failed | extra=${JSON.stringify({
        partnerAccount: targetPartnerAccount,
        robotId: targetRobotId,
      })} | error=${JSON.stringify(error)}`);
      showToast(t('assistantDetail.deleteFailed'));
    }
  }, [detail?.id, detail?.partnerAccount, partnerAccount, t]);

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
        onClick: handleClosePage,
      },
    ],
    [handleClosePage, t],
  );

  const renderIconButton = useCallback((
    icon: string,
    ariaLabel: string,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void,
  ) => (
    <button
      type="button"
      className="assistant-detail__icon-btn"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <img src={icon} alt="" className="assistant-detail__icon" draggable="false" />
    </button>
  ), []);

  const orgValueNode = showOrgRow ? (
    isInternalAssistant || !isPc ? (
      <span className="assistant-detail__org-value">{orgValue}</span>
    ) : (
      <div className="assistant-detail__value-with-actions">
        <span className="assistant-detail__org-value">{orgValue}</span>
        {renderIconButton(
          iconCopy,
          t('assistantDetail.copyAppId'),
          (event) => {
            runButtonClickWithDebounce(event, () => {
              void handleCopy(orgValue, t('assistantDetail.appIdCopied'));
            });
          },
        )}
      </div>
    )
  ) : null;

  const secretValueNode = showSecretRow ? (
    !isPc ? (
      <span className="assistant-detail__org-value">{ownerValue}</span>
    ) : (
      <div className="assistant-detail__value-with-actions">
        <span className="assistant-detail__org-value">{ownerValue}</span>
        <div className="assistant-detail__action-group">
          {renderIconButton(
            isSecretVisible ? openEyeIcon : closeEyeIcon,
            isSecretVisible ? t('assistantDetail.hideSecret') : t('assistantDetail.showSecret'),
            (event) => {
              runButtonClickWithDebounce(event, () => {
                toggleSecretVisible();
              });
            },
          )}
          {renderIconButton(
            iconCopy,
            t('assistantDetail.copySecret'),
            (event) => {
              runButtonClickWithDebounce(event, () => {
                void handleCopy(secret, t('assistantDetail.secretCopied'));
              });
            },
          )}
        </div>
      </div>
    )
  ) : null;

  if (isPc && pcView === 'edit') {
    return (
      <EditAssistantContent
        isPcMiniApp
        source='assistantDetail'
        initialDetail={detail}
        partnerAccount={resolvedPartnerAccount}
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

        {showIntroCard ? (
          <section className="assistant-detail__card assistant-detail__card--intro">
            <h3 className="assistant-detail__section-title">{t('assistantDetail.introTitle')}</h3>
            {hasDescription ? <p className="assistant-detail__section-desc">{displayDescription}</p> : null}
            {showCreatorRow ? (
              <DetailInfoRow
                label={t('assistantDetail.creator')}
                valueNode={<span className="assistant-detail__org-value">{displayCreator}</span>}
              />
            ) : null}
          </section>
        ) : null}

        {showOrgCard ? (
          <section className="assistant-detail__card assistant-detail__card--org">
            {showOrgRow ? (
              <DetailInfoRow
                label={orgLabel}
                valueNode={orgValueNode}
              />
            ) : null}
            {showSecretRow ? (
              <DetailInfoRow
                label={ownerLabel}
                valueNode={secretValueNode}
              />
            ) : null}
          </section>
        ) : null}
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
