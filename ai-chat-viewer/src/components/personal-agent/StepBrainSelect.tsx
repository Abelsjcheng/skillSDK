import React, { useCallback, useMemo, useState } from 'react';
import type { BrainType, InternalAssistantOption } from '../../types/personalAgent';
import { canConfirm } from '../../utils/personalAgentValidation';

interface StepBrainSelectProps {
  illustration: string;
  internalAssistants: InternalAssistantOption[];
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
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
    if (!confirmEnabled) return;
    onConfirm();
  }, [confirmEnabled, onConfirm]);

  return (
    <section className="personal-agent">
      <header className="personal-agent__header personal-agent__header--close-only">
        <button
          type="button"
          className="personal-agent__close-btn"
          aria-label="关闭创建个人助理"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="personal-agent__illustration-wrap">
        <img className="personal-agent__illustration" src={illustration} alt="个人助理插画" />
      </div>

      <div className="personal-agent__content personal-agent__content--step2">
        <div className="personal-agent__brain-type-block">
          <h3 className="personal-agent__brain-title">请选择你的「个人助理」大脑：</h3>
          <div className="personal-agent__brain-radios" role="radiogroup" aria-label="个人助理大脑类型">
            <label className="personal-agent__radio-item">
              <input
                type="radio"
                name="brain-type"
                checked={brainType === 'internal'}
                onChange={() => handleBrainTypeChange('internal')}
              />
              <span>内部助手</span>
            </label>
            <label className="personal-agent__radio-item">
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

        <div className="personal-agent__brain-detail">
          {brainType === 'internal' ? (
            <>
              <h4 className="personal-agent__brain-subtitle">请选择</h4>
              <div className="personal-agent__assistant-grid">
                {internalAssistants.map((assistant) => {
                  const selected = selectedInternalAssistantId === assistant.id;
                  return (
                    <button
                      key={assistant.id}
                      type="button"
                      className={`personal-agent__assistant-btn ${selected ? 'is-selected' : ''}`.trim()}
                      onClick={() => setSelectedInternalAssistantId(assistant.id)}
                    >
                      <span className="personal-agent__assistant-content">
                        {assistant.icon ? (
                          <img
                            src={assistant.icon}
                            alt=""
                            className="personal-agent__assistant-icon"
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="personal-agent__assistant-label">{assistant.label}</span>
                      </span>
                      {selected ? <span className="personal-agent__check">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {brainType === 'custom' ? (
            <p className="personal-agent__custom-tip">需自定义部署、安装OpenCode/OpenClaw等工具</p>
          ) : null}
        </div>
      </div>

      <footer className="personal-agent__actions">
        <button
          type="button"
          className="personal-agent__action-btn personal-agent__action-btn--cancel"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="button"
          className={`personal-agent__action-btn personal-agent__action-btn--confirm ${
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
