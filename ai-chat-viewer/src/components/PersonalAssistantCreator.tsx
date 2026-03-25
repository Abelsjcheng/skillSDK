import React, { useCallback, useRef, useState } from 'react';
import { BRAIN_ILLUSTRATION, DEFAULT_AVATARS } from './createAssistant/constants';
import { StepBasicInfo } from './createAssistant/StepBasicInfo';
import { StepBrainSelect } from './createAssistant/StepBrainSelect';
import type {
  CreateDigitalTwinParams,
  DigitalTwinBasicInfoPayload,
  DigitalTwinBrainPayload,
} from '../types/digitalTwin';
import { isPcMiniApp } from '../utils/hwext';
import '../styles/DigitalTwinCreator.less';

const PersonalAssistantCreator: React.FC = () => {
  const isPc = isPcMiniApp();
  const [step, setStep] = useState<1 | 2>(1);
  const basicInfoRef = useRef<DigitalTwinBasicInfoPayload | null>(null);

  const handleNext = useCallback((payload: DigitalTwinBasicInfoPayload) => {
    basicInfoRef.current = payload;
    setStep(2);
  }, []);

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      (window as any).Pedestal.remote.getCurrentWindow().close();
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (typeof window !== 'undefined') {
      (window as any).Pedestal.remote.getCurrentWindow().close();
    }
  }, []);

  const handlePrev = useCallback(() => {
    setStep(1);
  }, []);

  const handleConfirm = useCallback((payload: DigitalTwinBrainPayload) => {
    const basicInfo = basicInfoRef.current;
    if (!basicInfo || typeof window === 'undefined') return;

    const params: CreateDigitalTwinParams = {
      name: basicInfo.name,
      icon: basicInfo.icon,
      description: basicInfo.description,
      weCrewType: payload.digitalTwintype === 'internal' ? 1 : 0,
    };

    if (payload.digitalTwintype === 'internal' && payload.bizRobotId) {
      params.bizRobotId = payload.bizRobotId;
    }

    (window as any).createDigitalTwin(params);
  }, []);

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
        />
      )}
    </div>
  );
};

export default PersonalAssistantCreator;
