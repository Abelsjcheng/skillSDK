import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BRAIN_ILLUSTRATION, DEFAULT_AVATARS } from './createAssistant/constants';
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
  isPcMiniApp,
  openWeAgentCUI,
  type CreateDigitalTwinResult,
} from '../utils/hwext';
import '../styles/DigitalTwinCreator.less';

function resolvePartnerAccount(result: CreateDigitalTwinResult): string {
  const value = result.partnerAccount;
  return typeof value === 'string' ? value.trim() : '';
}

const PersonalAssistantCreator: React.FC = () => {
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

  const handleCreateForOtherScene = useCallback(async (_result: CreateDigitalTwinResult) => {
    // 非 weAgent 入口的后续链路预留，待后续接口补齐后接入。
    console.info('createDigitalTwin success in non-weAgent flow, pending follow-up integration.');
  }, []);

  const handleConfirm = useCallback(async (payload: DigitalTwinBrainPayload) => {
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

      if (from !== 'weAgent') {
        await handleCreateForOtherScene(createResult);
        return;
      }

      const partnerAccount = resolvePartnerAccount(createResult);
      if (!partnerAccount) {
        console.warn('createDigitalTwin did not return partnerAccount for weAgent flow.');
        return;
      }

      const detailResult = await getWeAgentDetails({ partnerAccount });
      const detail = detailResult?.WeAgentDetailsArray?.[0];
      if (!detail) {
        console.warn('getWeAgentDetails did not return detail for partnerAccount:', partnerAccount);
        return;
      }
      const openParams = buildOpenWeAgentCUIParams(detail.weCodeUrl, partnerAccount);
      await openWeAgentCUI(openParams);
    } catch (error) {
      console.error('confirm create assistant failed:', error);
    }
  }, [from, handleCreateForOtherScene]);

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
          illustration={BRAIN_ILLUSTRATION}
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
