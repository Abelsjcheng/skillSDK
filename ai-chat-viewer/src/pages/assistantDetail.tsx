import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import iconCopy from '../imgs/copy_icon.svg';
import moreIcon from '../imgs/more_icon.png';
import closeEyeIcon from '../imgs/close_eye_icon.svg';
import openEyeIcon from '../imgs/open_eye_icon.svg';
import customerIcon from '../imgs/customer_icon.svg';
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
  UNIVERSAL_ASSISTANT_BIZ_TAG,
} from '../utils/assistantTag';
import { showToast } from '../utils/toast';
import '../styles/AssistantDetail.less';
import { handleServiceClickPc } from '../utils/assistantPcHandle';
import { canIUse } from '../utils/versionCheck';
import { useSubmitLock } from '../hooks/useSubmitLock';

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
  const navigate = useNavigate();
  const isPc = isPcMiniApp();
  const [detail, setDetail] = useState<WeAgentDetails | null>(null);
  const [isSecretVisible, setIsSecretVisible] = useState<boolean>(false);
  const [overlay, setOverlay] = useState<AssistantDetailOverlay>('none');
  const [pcView, setPcView] = useState<AssistantDetailPcView>('detail');
  const [isPcMenuOpen, setIsPcMenuOpen] = useState<boolean>(false);
  const [assistantEditSupported, setAssistantEditSupported] = useState<boolean>(isPc);
  const [pcMenuPosition, setPcMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const { submitting: deleteSubmitting, runWithSubmitLock: runDeleteWithSubmitLock } = useSubmitLock();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);

  const resolvedPartnerAccount = isPc
    ? (partnerAccount?.trim() ?? '')
    : useMemo(() => getQueryParam('partnerAccount') ?? '', []);

  useEffect(() => {
    void ensureLanguageInitialized();
  }, []);

  useEffect(() => {
    if (isPc) {
      setAssistantEditSupported(true);
      return;
    }

    let cancelled = false;
    setAssistantEditSupported(false);

    const checkAssistantEditSupported = async () => {
      try {
        const supported = await canIUse.assistantEdit();
        if (!cancelled) {
          setAssistantEditSupported(supported);
        }
      } catch (error) {
        WeLog(`AssistantDetail assistantEdit version check failed | error=${JSON.stringify(error)}`);
        if (!cancelled) {
          setAssistantEditSupported(false);
        }
      }
    };

    void checkAssistantEditSupported();

    return () => {
      cancelled = true;
    };
  }, [isPc]);

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
  const displayTag = resolveAssistantTag(detail, i18n.resolvedLanguage ?? i18n.language);
  const displayDescription = detail?.desc ?? '';
  const creatorDisplayName = (i18n.resolvedLanguage ?? i18n.language) === 'en'
    ? detail?.creatorNameEn
    : detail?.creatorName;
  const displayCreator = joinDisplayValue(creatorDisplayName, detail?.creatorW3Account);

  const isInternalAssistant = Boolean(detail?.bizRobotId?.trim());
  const isExclusiveAssistant = isInternalAssistant && bizRobotTag === EXCLUSIVE_ASSISTANT_BIZ_TAG;
  const shouldShowAppCredential = bizRobotTag
    ? bizRobotTag !== EXCLUSIVE_ASSISTANT_BIZ_TAG && bizRobotTag !== UNIVERSAL_ASSISTANT_BIZ_TAG
    : !isInternalAssistant;
  const secret = detail?.appSecret ?? '';
  const displaySecret = isSecretVisible ? secret : maskSecret(secret);

  const orgLabel = t('assistantDetail.appId');
  const orgValue = detail?.appKey ?? '';
  const ownerLabel = t('assistantDetail.secret');
  const ownerValue = displaySecret;
  const hasDescription = Boolean(displayDescription.trim());
  const hasCreator = Boolean(displayCreator.trim());
  const hasOrgValue = Boolean(orgValue.trim());
  const hasSecretValue = Boolean(secret.trim());
  const showCreatorRow = !isExclusiveAssistant && hasCreator;
  const showOrgRow = shouldShowAppCredential && hasOrgValue;
  const showSecretRow = shouldShowAppCredential && hasSecretValue;
  const showIntroCard = hasDescription || showCreatorRow;
  const showOrgCard = showOrgRow || showSecretRow;

  const toggleSecretVisible = useCallback(() => {
    if (!shouldShowAppCredential) return;
    setIsSecretVisible((previous) => !previous);
  }, [shouldShowAppCredential]);

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
  }, [detail?.partnerAccount, shouldShowAppCredential]);

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

    if (isPc) {
      setPcView('edit');
      return;
    }

    setOverlay('none');
    navigate(
      {
        pathname: '/editAssistant',
      },
      {
        state: {
          source: 'assistantDetail',
          detail,
        },
      },
    );
  }, [detail, isPc, navigate]);

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

    if (!targetPartnerAccount) {
      showToast(t('assistantDetail.deleteFailed'));
      return;
    }

    await runDeleteWithSubmitLock(async () => {
      try {
        await deleteWeAgent({
          partnerAccount: targetPartnerAccount,
        });
        setOverlay('none');
        window.HWH5.close();
      } catch (error) {
        WeLog(`AssistantDetail deleteWeAgent failed | extra=${JSON.stringify({
          partnerAccount: targetPartnerAccount,
        })} | error=${JSON.stringify(error)}`);
        showToast(t('assistantDetail.deleteFailed'));
      }
    });
  }, [detail?.partnerAccount, partnerAccount, runDeleteWithSubmitLock, t]);

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
    () => {
      const actions: AssistantPageHeaderAction[] = [{
        label: t('common.service'),
        icon: customerIcon,
        onClick: handleServiceClick,
      }];

      if (detail && !isExclusiveAssistant) {
        actions.push({
          label: t('assistantDetail.editAction'),
          icon: moreIcon,
          onClick: handleTogglePcMenu,
          buttonRef: moreButtonRef,
        });
      }

      return actions;
    },
    [detail, handleServiceClick, handleTogglePcMenu, isExclusiveAssistant, t],
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
    !isPc ? (
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
        mobileRightActionIcon={!isPc && assistantEditSupported && detail && !isExclusiveAssistant ? editIcon : undefined}
        mobileRightActionLabel={!isPc && assistantEditSupported && detail && !isExclusiveAssistant ? t('assistantDetail.editAction') : undefined}
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

      {isPc && detail && !isExclusiveAssistant ? (
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
      ) : !isPc && assistantEditSupported && detail && !isExclusiveAssistant ? (
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
            submitting={deleteSubmitting}
            onClose={handleCloseOverlay}
            onConfirm={handleConfirmDelete}
          />
        </>
      ) : null}
    </div>
  );
};

export default AssistantDetail;
