import React, { useCallback, useRef, useState } from 'react';
import { BRAIN_ILLUSTRATION, DEFAULT_AVATARS, INTERNAL_ASSISTANTS } from './digital-twin/constants';
import { StepBasicInfo } from './digital-twin/StepBasicInfo';
import { StepBrainSelect } from './digital-twin/StepBrainSelect';
import type { CreateDigitalTwinParams, DigitalTwinBasicInfoPayload, DigitalTwinBrainPayload } from '../types/digitalTwin';
import '../styles/DigitalTwinCreator.less';

const DigitalTwinCreator: React.FC = () => {
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

  const handleConfirm = useCallback((payload: DigitalTwinBrainPayload) => {
    const basicInfo = basicInfoRef.current;
    if (!basicInfo) return;

    const params: CreateDigitalTwinParams = {
      name: basicInfo.name,
      icon: basicInfo.icon,
      description: basicInfo.description,
      digitalTwintype: payload.digitalTwintype,
    };

    if (payload.digitalTwintype === 'internal') {
      params.agent = '助手分身';
    }

    (window as any).create(params);
  }, []);

  return (
    <div className="digital-twin-creator">
      {step === 1 ? (
        <StepBasicInfo
          defaultAvatars={DEFAULT_AVATARS}
          onClose={handleClose}
          onCancel={handleCancel}
          onNext={handleNext}
        />
      ) : (
        <StepBrainSelect
          illustration={BRAIN_ILLUSTRATION}
          internalAssistants={INTERNAL_ASSISTANTS}
          onClose={handleClose}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

export default DigitalTwinCreator;
export { DigitalTwinCreator };
