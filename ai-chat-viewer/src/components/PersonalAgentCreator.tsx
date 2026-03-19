import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRAIN_ILLUSTRATION, DEFAULT_AVATARS, INTERNAL_ASSISTANTS } from './personal-agent/constants';
import { StepBasicInfo } from './personal-agent/StepBasicInfo';
import { StepBrainSelect } from './personal-agent/StepBrainSelect';
import type { BrainType } from '../types/personalAgent';
import { canConfirm, canProceedNext, validateAvatarFile } from '../utils/personalAgentValidation';
import '../styles/PersonalAgentCreator.less';

const noop = () => {};

const PersonalAgentCreator: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [avatarType, setAvatarType] = useState<'default' | 'custom'>('default');
  const [avatarId, setAvatarId] = useState<string | undefined>(DEFAULT_AVATARS[0]?.id);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | undefined>();
  const [avatarError, setAvatarError] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brainType, setBrainType] = useState<BrainType | undefined>();
  const [internalAssistantId, setInternalAssistantId] = useState<string | undefined>();

  const lastObjectUrlRef = useRef<string>();
  const customAvatarFileRef = useRef<File>();

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
    };
  }, []);

  const nextEnabled = useMemo(() => canProceedNext(name, description), [name, description]);
  const confirmEnabled = useMemo(
    () => canConfirm(brainType, internalAssistantId),
    [brainType, internalAssistantId],
  );

  const handleSelectDefaultAvatar = useCallback((selectedAvatarId: string) => {
    setAvatarType('default');
    setAvatarId(selectedAvatarId);
    setAvatarError('');
  }, []);

  const handleAvatarUpload = useCallback((file: File) => {
    const result = validateAvatarFile(file);
    if (!result.valid) {
      setAvatarError(result.reason ?? '头像文件不合法');
      return;
    }

    if (lastObjectUrlRef.current && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = undefined;
    }

    const previewUrl =
      typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : undefined;

    if (previewUrl) {
      lastObjectUrlRef.current = previewUrl;
    }

    setAvatarType('custom');
    customAvatarFileRef.current = file;
    setCustomAvatarPreview(previewUrl);
    setAvatarError('');
  }, []);

  const handleNext = useCallback(() => {
    if (!nextEnabled) return;
    setStep(2);
  }, [nextEnabled]);

  const handleBrainTypeChange = useCallback((value: BrainType) => {
    setBrainType(value);
    if (value === 'custom') {
      setInternalAssistantId(undefined);
    }
  }, []);

  const handleSelectInternalAssistant = useCallback((assistantId: string) => {
    setInternalAssistantId(assistantId);
  }, []);

  const handleCloseNoop = useCallback(noop, []);
  const handleCancelNoop = useCallback(noop, []);
  const handleConfirmNoop = useCallback(noop, []);

  return (
    <div className="personal-agent-creator">
      {step === 1 ? (
        <StepBasicInfo
          defaultAvatars={DEFAULT_AVATARS}
          selectedAvatarType={avatarType}
          selectedAvatarId={avatarId}
          customAvatarPreview={customAvatarPreview}
          avatarError={avatarError}
          name={name}
          description={description}
          canNext={nextEnabled}
          onSelectDefaultAvatar={handleSelectDefaultAvatar}
          onAvatarUpload={handleAvatarUpload}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onClose={handleCloseNoop}
          onCancel={handleCancelNoop}
          onNext={handleNext}
        />
      ) : (
        <StepBrainSelect
          illustration={BRAIN_ILLUSTRATION}
          internalAssistants={INTERNAL_ASSISTANTS}
          brainType={brainType}
          selectedInternalAssistantId={internalAssistantId}
          canConfirm={confirmEnabled}
          onBrainTypeChange={handleBrainTypeChange}
          onSelectInternalAssistant={handleSelectInternalAssistant}
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
