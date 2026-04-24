import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvatarImage from '../AvatarImage';
import bannerEn from '../../imgs/banner-en.png';
import banner from '../../imgs/banner.png';
import defaultAvatar from '../../imgs/defaultAvatar.png';
import type { DigitalTwinBrainPayload, InternalAssistantOption } from '../../types/digitalTwin';
import type { StepBrainSelectProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { canConfirm } from '../../utils/digitalTwinValidation';
import { WeLog } from '../../utils/logger';
import { showToast } from '../../utils/toast';
import { INTERNAL_ASSISTANTS } from './constants';
import { CreatorStepFooter } from './CreatorStepFooter';
import { CreatorStepHeader, getStepClassName } from './CreatorStepHeader';

async function defaultLoadAgentTypes(): Promise<InternalAssistantOption[]> {
  if (typeof window === 'undefined') {
    return INTERNAL_ASSISTANTS;
  }

  const getAgentType = (window as any).getAgentType;
  if (typeof getAgentType !== 'function') {
    return INTERNAL_ASSISTANTS;
  }

  const result = await getAgentType();
  if (Array.isArray(result)) {
    return result as InternalAssistantOption[];
  }
  if (result && typeof result === 'object' && Array.isArray((result as { content?: unknown }).content)) {
    return (result as { content: InternalAssistantOption[] }).content;
  }
  return INTERNAL_ASSISTANTS;
}

export const StepBrainSelect: React.FC<StepBrainSelectProps> = ({
  isPcMiniApp = true,
  onClose,
  onPrev,
  onConfirm,
  loadAgentTypes,
}) => {
  const { t, i18n } = useTranslation();
  const illustration = (i18n.resolvedLanguage ?? i18n.language) === 'en' ? bannerEn : banner;
  const [selectedBizRobotId, setSelectedBizRobotId] = useState<string | undefined>(INTERNAL_ASSISTANTS[0]?.bizRobotId);
  const [internalAssistants, setInternalAssistants] = useState<InternalAssistantOption[]>(INTERNAL_ASSISTANTS);

  const fetchAgentTypes = useCallback(async (): Promise<void> => {
    try {
      const loader = loadAgentTypes ?? defaultLoadAgentTypes;
      const result = await loader();
      if (Array.isArray(result)) {
        setInternalAssistants(result);
      }
    } catch (error) {
      WeLog(`StepBrainSelect getAgentType failed | error=${JSON.stringify(error)}`);
      showToast(t('createAssistant.loadInternalAssistantsFailed'));
      setInternalAssistants(INTERNAL_ASSISTANTS);
    }
  }, [loadAgentTypes, t]);

  useEffect(() => {
    void fetchAgentTypes();
  }, [fetchAgentTypes]);

  useEffect(() => {
    const hasSelectedAssistant = internalAssistants.some((assistant) => assistant.bizRobotId === selectedBizRobotId);
    if (hasSelectedAssistant) {
      return;
    }

    setSelectedBizRobotId(internalAssistants[0]?.bizRobotId);
  }, [internalAssistants, selectedBizRobotId]);

  const confirmEnabled = useMemo(
    () => canConfirm('internal', selectedBizRobotId),
    [selectedBizRobotId],
  );

  const handleConfirm = useCallback(() => {
    if (!confirmEnabled) return;
    onConfirm({
      digitalTwintype: 'internal',
      bizRobotId: selectedBizRobotId,
    });
  }, [confirmEnabled, onConfirm, selectedBizRobotId]);

  const handleOpenGuideDocument = useCallback((url: string) => {
    if (isPcMiniApp) {
      (window as any)?.Pedestal.callMethod('method://pedestal/openUrl', url);
    } else {
      window?.HWH5.openWebview?.({ uri: url })
    }
  }, []);

  return (
    <section className={getStepClassName(isPcMiniApp)}>
      <CreatorStepHeader isPcMiniApp={isPcMiniApp} onClose={onClose} onMobileBack={onPrev} />

      <div className="digital-twin__content digital-twin__content--step2">
        <div className="digital-twin__brain-type-block">
          <h3 className="digital-twin__brain-title">{t('createAssistant.brainTitle')}</h3>
        </div>

        <div className="digital-twin__brain-detail">
          {internalAssistants.length > 0 ? (
            <div className="digital-twin__assistant-grid">
              {internalAssistants.map((assistant) => {
                const selected = selectedBizRobotId === assistant.bizRobotId;
                return (
                  <button
                    key={assistant.bizRobotId}
                    type="button"
                    className={`digital-twin__assistant-btn ${selected ? 'is-selected' : ''}`.trim()}
                    onClick={(event) => {
                      runButtonClickWithDebounce(event, () => {
                        setSelectedBizRobotId(assistant.bizRobotId);
                      });
                    }}
                    aria-label={assistant.name}
                  >
                    <span className="digital-twin__assistant-content">
                      <AvatarImage
                        src={assistant.icon}
                        fallbackSrc={defaultAvatar}
                        alt=""
                        className="digital-twin__assistant-icon"
                        aria-hidden="true"
                      />
                      <span className="digital-twin__assistant-label">{assistant.name}</span>
                    </span>
                    {selected ? <span className="digital-twin__check">&#10003;</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <img
          className="digital-twin__brain-illustration"
          src={illustration}
          alt={t('createAssistant.illustrationAlt')}
          onClick={() => {
            handleOpenGuideDocument('');
          }}
        />
      </div>

      <CreatorStepFooter
        isPcMiniApp={isPcMiniApp}
        pcButtons={[
          { label: t('createAssistant.prev'), onClick: onPrev, variant: 'cancel' },
          {
            label: t('createAssistant.confirm'),
            onClick: handleConfirm,
            variant: 'confirm',
            enabled: confirmEnabled,
            withStateClass: true,
          },
        ]}
        mobileButton={{
          label: t('createAssistant.confirm'),
          onClick: handleConfirm,
          variant: 'confirm',
          enabled: confirmEnabled,
          withStateClass: true,
        }}
      />
    </section>
  );
};
