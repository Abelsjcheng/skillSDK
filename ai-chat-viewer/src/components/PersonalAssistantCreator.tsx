import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isPcMiniApp } from '../constants';
import { DEFAULT_AVATARS } from './createAssistant/constants';
import { StepBasicInfo } from './createAssistant/StepBasicInfo';
import { StepBrainSelect } from './createAssistant/StepBrainSelect';
import type {
  CreateDigitalTwinParams,
  DigitalTwinBasicInfoPayload,
  DigitalTwinBrainPayload,
} from '../types/digitalTwin';
import {
  buildOpenWeAgentCUIParams,
  createDigitalTwin,
  getAgentType,
  getQueryParam,
  getWeAgentDetails,
  openWeAgentCUI,
  resolveRobotIdForOpenWeAgentCUI,
  resolveWeCodeUrlForOpenWeAgentCUI,
  type CreateDigitalTwinResult,
} from '../utils/hwext';
import { WeLog } from '../utils/logger';
import { showToast } from '../utils/toast';
import '../styles/DigitalTwinCreator.less';

function resolvePartnerAccount(result: CreateDigitalTwinResult): string {
  const value = result?.partnerAccount;
  return typeof value === 'string' ? value.trim() : '';
}

const PersonalAssistantCreator: React.FC = () => {
  const { t } = useTranslation();
  const isPc = isPcMiniApp();
  const [step, setStep] = useState<1 | 2>(1);
  const basicInfoRef = useRef<DigitalTwinBasicInfoPayload | null>(null);

  const from = useMemo(() => getQueryParam('from') ?? '', []);

  const handleNext = useCallback((payload: DigitalTwinBasicInfoPayload) => {
    basicInfoRef.current = payload;
    setStep(2);
  }, []);

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).Pedestal?.remote?.getCurrentWindow) {
      (window as any).Pedestal.remote.getCurrentWindow().close();
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).Pedestal?.remote?.getCurrentWindow) {
      (window as any).Pedestal.remote.getCurrentWindow().close();
    }
  }, []);

  const handlePrev = useCallback(() => {
    setStep(1);
  }, []);

  const handleConfirm = useCallback(
    async (payload: DigitalTwinBrainPayload) => {
      const basicInfo = basicInfoRef.current;
      if (!basicInfo) return;

      const params: CreateDigitalTwinParams = {
        name: basicInfo.name,
        icon: basicInfo.icon,
        description: basicInfo.description,
        weCrewType: payload.digitalTwintype === 'internal' ? 1 : 0,
      };

      if (payload.digitalTwintype === 'internal' && payload.bizRobotId) {
        params.bizRobotId = payload.bizRobotId;
      }

      try {
        const createResult = await createDigitalTwin(params);

        if (!resolvePartnerAccount(createResult)) {
          WeLog(`PersonalAssistantCreator createDigitalTwin returned invalid result | extra=${JSON.stringify({
            createResult,
          })}`);
          showToast(t('createAssistant.createFailed'));
          return;
        }

        if (from !== 'weAgent') {
          const partnerAccount = resolvePartnerAccount(createResult);
          if (!isPc) {
            if (typeof window.HWH5.openIMChat === 'function') {
              await window.HWH5.openIMChat({ chatId: partnerAccount });
            } else {
              window.HWH5.close();
            }
          } else if (typeof window !== 'undefined' && window.Pedestal?.callMethod) {
            await window.Pedestal.callMethod('method://agentSkills/handleSdk', { owner: partnerAccount });
          }
          return;
        }

        const partnerAccount = resolvePartnerAccount(createResult);
        if (!partnerAccount) {
          console.warn('createDigitalTwin did not return partnerAccount for weAgent flow.');
          return;
        }

        const detailResult = await getWeAgentDetails({ partnerAccount });
        const detail = detailResult?.weAgentDetailsArray?.[0];
        if (!detail) {
          console.warn('getWeAgentDetails did not return detail for partnerAccount:', partnerAccount);
          return;
        }
        const weCodeUrl = resolveWeCodeUrlForOpenWeAgentCUI(detail, partnerAccount);
        const robotId = resolveRobotIdForOpenWeAgentCUI({
          detailRobotId: detail.robotId,
          createRobotId: createResult.robotId,
        });
        const openParams = buildOpenWeAgentCUIParams(weCodeUrl, partnerAccount, {
          bizRobotId: detail.bizRobotId,
          robotId,
        });
        await openWeAgentCUI(openParams);
        if (!isPc) {
          window.HWH5.close();
        }
      } catch (error) {
        WeLog(`PersonalAssistantCreator confirmCreateAssistant failed | extra=${JSON.stringify({ from })} | error=${JSON.stringify(error)}`);
        showToast(t('createAssistant.createFailed'));
      }
    },
    [from, isPc, t],
  );

  return (
    <div className={`digital-twin-creator ${isPc ? 'is-pc' : 'is-mobile'}`.trim()}>
      {step === 1 ? (
        <StepBasicInfo
          isPcMiniApp={isPc}
          defaultAvatars={DEFAULT_AVATARS}
          initialValue={basicInfoRef.current}
          onClose={handleClose}
          onCancel={handleCancel}
          onNext={handleNext}
        />
      ) : (
        <StepBrainSelect
          isPcMiniApp={isPc}
          onClose={handleClose}
          onCancel={handleCancel}
          onPrev={handlePrev}
          onConfirm={handleConfirm}
          loadAgentTypes={async () => {
            const result = await getAgentType();
            return result && Array.isArray(result.content) ? result.content : [];
          }}
        />
      )}
    </div>
  );
};

export default PersonalAssistantCreator;
