import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { StepBasicInfo } from '../components/createAssistant/StepBasicInfo';
import { DEFAULT_AVATARS } from '../components/createAssistant/constants';
import { isPcMiniApp } from '../constants';
import qrcodeExpiredNotice from '../imgs/qrcode_expired_notice.png';
import type { CreateAssistantRouteState, CreateDigitalTwinParams, DigitalTwinBasicInfoPayload } from '../types/digitalTwin';
import { createDigitalTwin, getQueryParam, queryQrcodeInfo, updateQrcodeInfo } from '../utils/hwext';
import { closeCreateAssistantWindow, handleCreateForOtherScene, resolvePartnerAccount } from '../utils/createAssistantFlow';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';
import '../styles/DigitalTwinCreator.less';

const CreateAssistantBasicPage: React.FC = () => {
  const { t } = useTranslation();
  const isPc = isPcMiniApp();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as CreateAssistantRouteState | null;
  const initialValue = useMemo(() => routeState?.draft ?? null, [routeState]);
  const from = useMemo(() => getQueryParam('from', location.search) ?? '', [location.search]);
  const qrcode = useMemo(() => getQueryParam('qrcode', location.search) ?? '', [location.search]);
  const channel = useMemo(() => getQueryParam('channel', location.search)?.trim() ?? '', [location.search]);
  const isQrcodeScene = from === 'qrcode';
  const [qrcodeLoaded, setQrcodeLoaded] = useState(!isQrcodeScene);
  const [qrcodeExpired, setQrcodeExpired] = useState(false);

  const updateQrcodeStatusSafely = useCallback(async (status: number, robotId?: string) => {
    try {
      await updateQrcodeInfo({ qrcode, robotId, status });
    } catch (error) {
      WeLog(`CreateAssistantBasicPage updateQrcodeInfo failed | extra=${JSON.stringify({
        qrcode,
        status,
        robotId: robotId ?? '',
      })} | error=${JSON.stringify(error)}`);
      showToast(t('createAssistant.updateQrcodeInfoFailed'));
    }
  }, [qrcode, t]);

  useEffect(() => {
    if (!isQrcodeScene || !qrcode) {
      setQrcodeLoaded(true);
      setQrcodeExpired(false);
      return;
    }

    let cancelled = false;

    const fetchQrcodeInfo = async () => {
      try {
        const result = await queryQrcodeInfo({ qrcode });
        if (cancelled) {
          return;
        }

        const expireTimestamp = Number(result.expireTime);
        const expired = Number.isFinite(expireTimestamp) && Date.now() > expireTimestamp * 1000;

        setQrcodeExpired(expired);
        setQrcodeLoaded(true);
        void updateQrcodeStatusSafely(1);
      } catch (error) {
        WeLog(`CreateAssistantBasicPage queryQrcodeInfo failed | extra=${JSON.stringify({ qrcode })} | error=${JSON.stringify(error)}`);
        if (!cancelled) {
          setQrcodeExpired(false);
          setQrcodeLoaded(true);
        }
        showToast(t('createAssistant.queryQrcodeInfoFailed'));
      }
    };

    void fetchQrcodeInfo();

    return () => {
      cancelled = true;
    };
  }, [isQrcodeScene, qrcode, t, updateQrcodeStatusSafely]);

  useEffect(() => {
    if (isPc || !isQrcodeScene || !qrcode) {
      return;
    }

    window.HWH5.addEventListener?.({
      type: 'back',
      func: () => {
        void updateQrcodeStatusSafely(3);
        return true;
      },
    });
  }, [isPc, isQrcodeScene, qrcode, updateQrcodeStatusSafely]);

  const handleClose = useCallback(async () => {
    if (isQrcodeScene) {
      await updateQrcodeStatusSafely(3);
    }
    closeCreateAssistantWindow();
  }, [isQrcodeScene, updateQrcodeStatusSafely]);

  const handleCancel = useCallback(async () => {
    if (isQrcodeScene) {
      await updateQrcodeStatusSafely(3);
    }
    closeCreateAssistantWindow();
  }, [isQrcodeScene, updateQrcodeStatusSafely]);

  const handleMobileBack = useCallback(async () => {
    if (isQrcodeScene) {
      await updateQrcodeStatusSafely(3);
    }
    window.HWH5.navigateBack();
  }, [isQrcodeScene, updateQrcodeStatusSafely]);

  const handleNext = useCallback(async (payload: DigitalTwinBasicInfoPayload) => {
    if (!isQrcodeScene) {
      navigate(
        {
          pathname: '/selectBrainAssistant',
          search: location.search,
        },
        {
          state: {
            draft: payload,
          } satisfies CreateAssistantRouteState,
        },
      );
      return;
    }

    const params: CreateDigitalTwinParams = {
      name: payload.name,
      icon: payload.icon,
      description: payload.description,
      qrcode,
    };

    try {
      const createResult = await createDigitalTwin(params);
      const partnerAccount = resolvePartnerAccount(createResult);
      const createdRobotId = typeof createResult.robotId === 'string' ? createResult.robotId.trim() : '';

      if (!partnerAccount) {
        WeLog(`CreateAssistantBasicPage createDigitalTwin returned invalid result | extra=${JSON.stringify({
          createResult,
        })}`);
        showToast(t('createAssistant.createFailed'));
        return;
      }

      await updateQrcodeStatusSafely(2, createdRobotId);
      await handleCreateForOtherScene(createResult);
    } catch (error) {
      WeLog(`CreateAssistantBasicPage createDigitalTwin failed | extra=${JSON.stringify({
        from,
        qrcode,
      })} | error=${JSON.stringify(error)}`);
      showToast(t('createAssistant.createFailed'));
    }
  }, [from, isQrcodeScene, location.search, navigate, qrcode, t, updateQrcodeStatusSafely]);

  if (isQrcodeScene && !qrcodeLoaded) {
    return <div className={`digital-twin-creator ${isPc ? 'is-pc' : 'is-mobile'}`.trim()} />;
  }

  return (
    <div className={`digital-twin-creator ${isPc ? 'is-pc' : 'is-mobile'}`.trim()}>
      <StepBasicInfo
        isPcMiniApp={isPc}
        defaultAvatars={DEFAULT_AVATARS}
        initialValue={initialValue}
        expired={qrcodeExpired}
        expiredImageSrc={qrcodeExpiredNotice}
        providerChannel={isQrcodeScene ? channel : ''}
        onClose={handleClose}
        onCancel={handleCancel}
        onMobileBack={handleMobileBack}
        onNext={handleNext}
        submitLabel={isQrcodeScene && !qrcodeExpired ? t('common.confirm') : undefined}
      />
    </div>
  );
};

export default CreateAssistantBasicPage;
