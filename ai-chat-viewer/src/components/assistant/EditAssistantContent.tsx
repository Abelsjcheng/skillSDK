import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssistantPageHeader from './AssistantPageHeader';
import { StepBasicInfo } from '../createAssistant/StepBasicInfo';
import {
  DEFAULT_NEW_AVATARS,
  resolveDefaultAvatarIdByIcon,
} from '../createAssistant/constants';
import { ensureLanguageInitialized } from '../../i18n/config';
import type { AssistantDetailsFetchResult, WeAgentDetails } from '../../types/bridge';
import type { EditAssistantContentProps } from '../../types/components';
import type { DigitalTwinBasicInfoPayload } from '../../types/digitalTwin';
import { HOST } from '../../constants';
import {
  CUSTOMER_SERVICE_WEBVIEW_URI,
  getWeAgentDetails,
  openH5Webview,
  updateWeAgent,
} from '../../utils/hwext';
import { WeLog } from '../../utils/logger';
import { reportCoreFlowError } from '../../utils/telemetry';
import { showToast } from '../../utils/toast';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import '../../styles/DigitalTwinCreator.less';

function resolveInitialValue(detail: WeAgentDetails): DigitalTwinBasicInfoPayload {
  const avatarId = resolveDefaultAvatarIdByIcon(detail.icon);

  return {
    avatarType: avatarId ? 'default' : 'custom',
    avatarId,
    name: detail.name ?? '',
    icon: detail.icon ?? '',
    description: detail.desc ?? '',
  };
}

const noop = () => {};

async function fetchMobileAssistantDetails(partnerAccount: string): Promise<WeAgentDetails[]> {
  if (typeof window.HWH5?.fetchFull !== 'function') {
    throw new Error('HWH5.fetchFull is not available.');
  }

  const response = await window.HWH5.fetchFull<AssistantDetailsFetchResult>(
    `${HOST()}/v1/robot-partners/${encodeURIComponent(partnerAccount)}`,
    {
      method: 'GET',
      headers: {},
    },
  );
  const result = await response.json();
  return result.data ?? [];
}

const EditAssistantContent: React.FC<EditAssistantContentProps> = ({
  isPcMiniApp = false,
  source = 'external',
  initialDetail = null,
  partnerAccount = '',
  onClose,
  onSuccess = noop,
}) => {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<WeAgentDetails | null>(initialDetail);
  const { submitting, runWithSubmitLock } = useSubmitLock();
  const useCreateAssistantLayout = isPcMiniApp && source === 'external';

  const handleServiceClick = useCallback(() => {
    openH5Webview({
      uri: CUSTOMER_SERVICE_WEBVIEW_URI,
    });
  }, []);

  useEffect(() => {
    void ensureLanguageInitialized();
  }, []);

  useEffect(() => {
    const normalizedPartnerAccount = partnerAccount.trim();
    if (!normalizedPartnerAccount) {
      setDetail(initialDetail);
      return;
    }

    let cancelled = false;

    const fetchAssistantDetail = async () => {
      try {
        const details = isPcMiniApp
          ? (await getWeAgentDetails({ partnerAccount: normalizedPartnerAccount })).weAgentDetailsArray
          : await fetchMobileAssistantDetails(normalizedPartnerAccount);
        const nextDetail = details?.[0] ?? null;
        if (!cancelled) {
          setDetail(nextDetail);
        }
      } catch (error) {
        WeLog(`EditAssistantContent load details failed | extra=${JSON.stringify({
          partnerAccount: normalizedPartnerAccount,
          isPcMiniApp,
        })} | error=${JSON.stringify(error)}`);
        void reportCoreFlowError('flow_edit_assistant_error', '编辑助手流程失败', error, {
          page: 'editAssistant',
          stage: 'getWeAgentDetails',
          source,
          partnerAccount: normalizedPartnerAccount,
          isPc: isPcMiniApp,
        });
        showToast(t('editAssistant.loadFailed'));
        if (!cancelled) {
          setDetail(initialDetail);
        }
      }
    };

    void fetchAssistantDetail();

    return () => {
      cancelled = true;
    };
  }, [initialDetail, isPcMiniApp, partnerAccount, source, t]);

  const initialValue = useMemo(() => (detail ? resolveInitialValue(detail) : null), [detail]);

  const handleSubmit = useCallback(
    async (payload: DigitalTwinBasicInfoPayload) => {
      const targetPartnerAccount = (detail?.partnerAccount ?? partnerAccount).trim();
      if (!targetPartnerAccount) {
        showToast(t('editAssistant.invalidTarget'));
        return;
      }

      await runWithSubmitLock(async () => {
        try {
          await updateWeAgent({
            partnerAccount: targetPartnerAccount,
            name: payload.name,
            icon: payload.icon,
            description: payload.description,
          });
        } catch (error) {
          WeLog(`EditAssistantContent update failed | extra=${JSON.stringify({
            partnerAccount: targetPartnerAccount,
            source,
          })} | error=${JSON.stringify(error)}`);
          showToast(t('editAssistant.updateFailed'));
          return;
        }

        onSuccess(payload);
        onClose();
      });
    },
    [detail, onClose, onSuccess, partnerAccount, runWithSubmitLock, source, t],

  );

  return (
    <div
      className={
        useCreateAssistantLayout
          ? 'digital-twin-creator is-pc'
          : `digital-twin-creator digital-twin-creator--assistant-edit${isPcMiniApp ? ' is-pc' : ' is-mobile'}`.trim()
      }
    >
      {!useCreateAssistantLayout ? (
        <AssistantPageHeader
          title={isPcMiniApp ? '' : t('editAssistant.title')}
          isPcMiniApp={isPcMiniApp}
          onClose={onClose}
          onService={handleServiceClick}
        />
      ) : null}
      <StepBasicInfo
        isPcMiniApp={useCreateAssistantLayout}
        className={useCreateAssistantLayout ? undefined : 'digital-twin--assistant-edit'}
        defaultAvatars={DEFAULT_NEW_AVATARS}
        initialValue={initialValue}
        showHeader={useCreateAssistantLayout}
        pcTitle={useCreateAssistantLayout ? t('editAssistant.title') : undefined}
        onClose={onClose}
        onNext={handleSubmit}
        submitting={submitting}
        submitLabel={t('createAssistant.confirm')}
      />
    </div>
  );
};

export default EditAssistantContent;
