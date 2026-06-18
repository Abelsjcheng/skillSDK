import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AssistantPageHeader from './AssistantPageHeader';
import { StepBasicInfo } from '../createAssistant/StepBasicInfo';
import { DEFAULT_AVATARS, resolveAssistantIconUrl } from '../createAssistant/constants';
import { ensureLanguageInitialized } from '../../i18n/config';
import type { WeAgentDetails } from '../../types/bridge';
import type { EditAssistantContentProps } from '../../types/components';
import type { DigitalTwinBasicInfoPayload } from '../../types/digitalTwin';
import {
  CUSTOMER_SERVICE_WEBVIEW_URI,
  getAssistantDetails,
  openH5Webview,
  updateWeAgent,
} from '../../utils/hwext';
import { WeLog } from '../../utils/logger';
import { showToast } from '../../utils/toast';
import '../../styles/DigitalTwinCreator.less';

function resolveInitialValue(detail: WeAgentDetails): DigitalTwinBasicInfoPayload {
  const icon = resolveAssistantIconUrl(detail.icon);
  const matchedDefaultAvatar = DEFAULT_AVATARS.find((avatar) => avatar.image === detail.icon);

  return {
    avatarType: matchedDefaultAvatar ? 'default' : 'custom',
    avatarId: matchedDefaultAvatar?.id,
    name: detail.name ?? '',
    icon,
    description: detail.desc ?? '',
  };
}

const noop = () => {};

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
        const result = await getAssistantDetails({ partnerAccount: normalizedPartnerAccount });
        const nextDetail = result?.weAgentDetailsArray?.[0] ?? null;
        if (!cancelled) {
          setDetail(nextDetail);
        }
      } catch (error) {
        WeLog(`EditAssistantContent getAssistantDetails failed | extra=${JSON.stringify({ partnerAccount: normalizedPartnerAccount })} | error=${JSON.stringify(error)}`);
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
  }, [initialDetail, partnerAccount, t]);

  const initialValue = useMemo(() => (detail ? resolveInitialValue(detail) : null), [detail]);

  const handleSubmit = useCallback(
    async (payload: DigitalTwinBasicInfoPayload) => {
      const targetPartnerAccount = (detail?.partnerAccount ?? partnerAccount).trim();
      if (!targetPartnerAccount) {
        showToast(t('editAssistant.invalidTarget'));
        return;
      }

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
    },
    [detail, onClose, onSuccess, partnerAccount, source, t],
  );

  return (
    <div
      className={`digital-twin-creator digital-twin-creator--assistant-edit${isPcMiniApp ? ' is-pc' : ' is-mobile'}`.trim()}
    >
      <AssistantPageHeader
        title={isPcMiniApp ? '' : t('editAssistant.title')}
        isPcMiniApp={isPcMiniApp}
        onClose={onClose}
        onService={handleServiceClick}
      />
      <StepBasicInfo
        isPcMiniApp={false}
        className="digital-twin--assistant-edit"
        defaultAvatars={DEFAULT_AVATARS}
        initialValue={initialValue}
        showHeader={false}
        onClose={onClose}
        onNext={handleSubmit}
        submitLabel={t('createAssistant.confirm')}
      />
    </div>
  );
};

export default EditAssistantContent;
