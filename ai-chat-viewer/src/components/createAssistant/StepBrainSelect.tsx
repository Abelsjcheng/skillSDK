import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvatarImage from '../AvatarImage';
import bannerPcEn from '../../imgs/banner-pc-en.png';
import bannerPcZh from '../../imgs/banner-pc-zh.png';
import bannerPhoneEn from '../../imgs/banner-phone-en.png';
import bannerPhoneZh from '../../imgs/banner-phone-zh.png';
import defaultAvatar from '../../imgs/defaultAvatar.png';
import type { InternalAssistantOption } from '../../types/digitalTwin';
import type { StepBrainSelectProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { canConfirm } from '../../utils/digitalTwinValidation';
import { WeLog } from '../../utils/logger';
import { showToast } from '../../utils/toast';
import { INTERNAL_ASSISTANTS } from './constants';
import { CreatorStepFooter } from './CreatorStepFooter';
import { CreatorStepHeader, getStepClassName } from './CreatorStepHeader';
import { getAgentType } from '../../utils/hwext';

export const StepBrainSelect: React.FC<StepBrainSelectProps> = ({
  isPcMiniApp = true,
  onClose,
  onPrev,
  onConfirm,
}) => {
  const { t, i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage ?? i18n.language;
  const isEnglish = resolvedLanguage === 'en';
  const illustration = isPcMiniApp
    ? (isEnglish ? bannerPcEn : bannerPcZh)
    : (isEnglish ? bannerPhoneEn : bannerPhoneZh);
  const [selectedBizRobotId, setSelectedBizRobotId] = useState<string | undefined>(INTERNAL_ASSISTANTS[0]?.bizRobotId);
  const [internalAssistants, setInternalAssistants] = useState<InternalAssistantOption[]>(INTERNAL_ASSISTANTS);

  const fetchAgentTypes = useCallback(async (): Promise<void> => {
    try {
      const result = await getAgentType();
      setInternalAssistants(Array.isArray(result?.content) ? result.content : INTERNAL_ASSISTANTS);
    } catch (error) {
      WeLog(`StepBrainSelect getAgentType failed | error=${JSON.stringify(error)}`);
      showToast(t('createAssistant.loadInternalAssistantsFailed'));
      setInternalAssistants(INTERNAL_ASSISTANTS);
    }
  }, [t]);

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

  return (
    <section className={getStepClassName(isPcMiniApp)}>
      <CreatorStepHeader
        isPcMiniApp={isPcMiniApp}
        onClose={onClose}
        onMobileBack={onPrev}
        pcTitle={isPcMiniApp ? t("createAssistant.brainTitle") : undefined}
      />

      <div className="digital-twin__content digital-twin__content--step2">
        {!isPcMiniApp ? (
          <div className="digital-twin__brain-type-block">
            <h3 className="digital-twin__brain-title">
              {t("createAssistant.brainTitle")}
            </h3>
          </div>
        ) : null}

        <div className="digital-twin__brain-detail">
          {internalAssistants.length > 0 ? (
            <div className="digital-twin__assistant-grid">
              {internalAssistants.map((assistant) => {
                const selected = selectedBizRobotId === assistant.bizRobotId;
                return (
                  <button
                    key={assistant.bizRobotId}
                    type="button"
                    className={`digital-twin__assistant-btn ${selected ? "is-selected" : ""}`.trim()}
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
                      <span className="digital-twin__assistant-label">
                        {assistant.name}
                      </span>
                    </span>
                    {selected ? (
                      <span className="digital-twin__check">&#10003;</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <img
          className={[
            "digital-twin__brain-illustration",
            isPcMiniApp ? "digital-twin__brain-illustration_pc" : "",
          ].join(" ")}
          src={illustration}
          alt={t("createAssistant.illustrationAlt")}
          draggable="false"
        />
      </div>

      <CreatorStepFooter
        isPcMiniApp={isPcMiniApp}
        pcButtons={[
          {
            label: t("createAssistant.prev"),
            onClick: onPrev,
            variant: "cancel",
          },
          {
            label: t("createAssistant.confirm"),
            onClick: handleConfirm,
            variant: "confirm",
            enabled: confirmEnabled,
            withStateClass: true,
          },
        ]}
        mobileButton={{
          label: t("createAssistant.confirm"),
          onClick: handleConfirm,
          variant: "confirm",
          enabled: confirmEnabled,
          withStateClass: true,
        }}
      />
    </section>
  );
};
