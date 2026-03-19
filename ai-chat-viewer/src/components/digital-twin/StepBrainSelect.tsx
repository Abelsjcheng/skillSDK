import React, { useCallback, useMemo, useState } from 'react';
import type { BrainType, DigitalTwinBrainPayload, InternalAssistantOption } from '../../types/digitalTwin';
import { canConfirm } from '../../utils/digitalTwinValidation';

interface StepBrainSelectProps {
  illustration: string;
  internalAssistants: InternalAssistantOption[];
  onClose: () => void;
  onCancel: () => void;
  onConfirm: (payload: DigitalTwinBrainPayload) => void;
}

export const StepBrainSelect: React.FC<StepBrainSelectProps> = ({
  illustration,
  internalAssistants,
  onClose,
  onCancel,
  onConfirm,
}) => {
  const [brainType, setBrainType] = useState<BrainType | undefined>();
  const [selectedInternalAssistantId, setSelectedInternalAssistantId] = useState<string | undefined>();

  const confirmEnabled = useMemo(
    () => canConfirm(brainType, selectedInternalAssistantId),
    [brainType, selectedInternalAssistantId],
  );

  const handleBrainTypeChange = useCallback((value: BrainType) => {
    setBrainType(value);
    if (value === 'custom') {
      setSelectedInternalAssistantId(undefined);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirmEnabled || !brainType) return;
    onConfirm({
      digitalTwintype: brainType,
      internalAssistantId: selectedInternalAssistantId,
    });
  }, [brainType, confirmEnabled, onConfirm, selectedInternalAssistantId]);

  return (
    <section className="digital-twin">
      <header className="digital-twin__header digital-twin__header--close-only">
        <button
          type="button"
          className="digital-twin__close-btn"
          aria-label="关闭创建个人助理"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="digital-twin__illustration-wrap">
        <img className="digital-twin__illustration" src={illustration} alt="个人助理插画" />
      </div>

      <div className="digital-twin__content digital-twin__content--step2">
        <div className="digital-twin__brain-type-block">
          <h3 className="digital-twin__brain-title">请选择你的「个人助理」大脑：</h3>
          <div className="digital-twin__brain-radios" role="radiogroup" aria-label="个人助理大脑类型">
            <label className="digital-twin__radio-item">
              <input
                type="radio"
                name="brain-type"
                checked={brainType === 'internal'}
                onChange={() => handleBrainTypeChange('internal')}
              />
              <span>内部助手</span>
            </label>
            <label className="digital-twin__radio-item">
              <input
                type="radio"
                name="brain-type"
                checked={brainType === 'custom'}
                onChange={() => handleBrainTypeChange('custom')}
              />
              <span>自定义助手</span>
            </label>
          </div>
        </div>

        <div className="digital-twin__brain-detail">
          {brainType === 'internal' ? (
            <>
              <h4 className="digital-twin__brain-subtitle">请选择</h4>
              <div className="digital-twin__assistant-grid">
                {internalAssistants.map((assistant) => {
                  const selected = selectedInternalAssistantId === assistant.id;
                  return (
                    <button
                      key={assistant.id}
                      type="button"
                      className={`digital-twin__assistant-btn ${selected ? 'is-selected' : ''}`.trim()}
                      onClick={() => setSelectedInternalAssistantId(assistant.id)}
                    >
                      <span className="digital-twin__assistant-content">
                        {assistant.icon ? (
                          <img
                            src={assistant.icon}
                            alt=""
                            className="digital-twin__assistant-icon"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="digital-twin__assistant-label">{assistant.label}</span>
                      </span>
                      {selected ? <span className="digital-twin__check">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {brainType === 'custom' ? (
            <p className="digital-twin__custom-tip">需自定义部署、安装OpenCode/OpenClaw等工具</p>
          ) : null}
        </div>
      </div>

      <footer className="digital-twin__actions">
        <button
          type="button"
          className="digital-twin__action-btn digital-twin__action-btn--cancel"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="button"
          className={`digital-twin__action-btn digital-twin__action-btn--confirm ${
            confirmEnabled ? 'is-active' : 'is-disabled'
          }`.trim()}
          disabled={!confirmEnabled}
          onClick={handleConfirm}
        >
          确定
        </button>
      </footer>
    </section>
  );
};

