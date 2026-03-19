import React, { useCallback, useState } from 'react';
import { BRAIN_ILLUSTRATION, DEFAULT_AVATARS, INTERNAL_ASSISTANTS } from './digital-twin/constants';
import { StepBasicInfo } from './digital-twin/StepBasicInfo';
import { StepBrainSelect } from './digital-twin/StepBrainSelect';
import '../styles/DigitalTwinCreator.less';

const noop = () => {};

const DigitalTwinCreator: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const handleNext = useCallback(() => setStep(2), []);

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

  const handleConfirmNoop = useCallback(noop, []);

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
          onConfirm={handleConfirmNoop}
        />
      )}
    </div>
  );
};

export default DigitalTwinCreator;
export { DigitalTwinCreator };
