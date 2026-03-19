import React, { useCallback, useState } from 'react';
import { BRAIN_ILLUSTRATION, DEFAULT_AVATARS, INTERNAL_ASSISTANTS } from './personal-agent/constants';
import { StepBasicInfo } from './personal-agent/StepBasicInfo';
import { StepBrainSelect } from './personal-agent/StepBrainSelect';
import '../styles/PersonalAgentCreator.less';

const noop = () => {};

const PersonalAgentCreator: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const handleNext = useCallback(() => setStep(2), []);

  const handleCloseNoop = useCallback(noop, []);
  const handleCancelNoop = useCallback(noop, []);
  const handleConfirmNoop = useCallback(noop, []);

  return (
    <div className="personal-agent-creator">
      {step === 1 ? (
        <StepBasicInfo
          defaultAvatars={DEFAULT_AVATARS}
          onClose={handleCloseNoop}
          onCancel={handleCancelNoop}
          onNext={handleNext}
        />
      ) : (
        <StepBrainSelect
          illustration={BRAIN_ILLUSTRATION}
          internalAssistants={INTERNAL_ASSISTANTS}
          onClose={handleCloseNoop}
          onCancel={handleCancelNoop}
          onConfirm={handleConfirmNoop}
        />
      )}
    </div>
  );
};

export default PersonalAgentCreator;
export { PersonalAgentCreator };
