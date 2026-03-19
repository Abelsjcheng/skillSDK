import React from 'react';
import type { BrainType, InternalAssistantOption } from '../../types/personalAgent';

interface StepBrainSelectProps {
  brainType?: BrainType;
  selectedInternalAssistantId?: string;
  canConfirm: boolean;
  illustration: string;
  internalAssistants: InternalAssistantOption[];
  onBrainTypeChange: (brainType: BrainType) => void;
  onSelectInternalAssistant: (assistantId: string) => void;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const StepBrainSelect: React.FC<StepBrainSelectProps> = ({
  brainType,
  selectedInternalAssistantId,
  canConfirm,
  illustration,
  internalAssistants,
  onBrainTypeChange,
  onSelectInternalAssistant,
  onClose,
  onCancel,
  onConfirm,
}) => {
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
          <h3 className="personal-agent__brain-title">请选择你的个人助理大脑：</h3>
          <div className="personal-agent__brain-radios" role="radiogroup" aria-label="个人助理大脑类型">
            <label className="personal-agent__radio-item">
              <input
                type="radio"
                name="brain-type"
                checked={brainType === 'internal'}
                onChange={() => onBrainTypeChange('internal')}
              />
              <span>内部助手</span>
            </label>
            <label className="personal-agent__radio-item">
              <input
                type="radio"
                name="brain-type"
                checked={brainType === 'custom'}
                onChange={() => onBrainTypeChange('custom')}
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
                      onClick={() => onSelectInternalAssistant(assistant.id)}
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
            canConfirm ? 'is-active' : 'is-disabled'
          }`.trim()}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          确定
        </button>
      </footer>
    </section>
  );
};
