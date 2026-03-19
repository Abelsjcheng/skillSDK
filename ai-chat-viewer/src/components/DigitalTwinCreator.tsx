import React, { useCallback, useRef, useState } from 'react';
import { BRAIN_ILLUSTRATION, DEFAULT_AVATARS } from './digital-twin/constants';
import { StepBasicInfo } from './digital-twin/StepBasicInfo';
import { StepBrainSelect } from './digital-twin/StepBrainSelect';
import type {
  CreateDigitalTwinParams,
  DigitalTwinBasicInfoPayload,
  DigitalTwinBrainPayload,
} from '../types/digitalTwin';
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
