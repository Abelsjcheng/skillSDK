import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { BrainType, DigitalTwinBrainPayload, InternalAssistantOption } from '../../types/digitalTwin';
import { canConfirm } from '../../utils/digitalTwinValidation';
import { INTERNAL_ASSISTANTS } from './constants';

interface StepBrainSelectProps {
  isPcMiniApp?: boolean;
  illustration: string;
  onClose: () => void;
  onCancel: () => void;
  onPrev: () => void;
  onConfirm: (payload: DigitalTwinBrainPayload) => void;
}

const GUIDE_DOCUMENT_URL = '';

export const StepBrainSelect: React.FC<StepBrainSelectProps> = ({
  isPcMiniApp = true,
  illustration,
  onClose,
  onCancel,
  onPrev,
  onConfirm,
}) => {
  const [brainType, setBrainType] = useState<BrainType | undefined>('internal');
  const [selectedBizRobotId, setSelectedBizRobotId] = useState<string | undefined>();
  const [internalAssistants, setInternalAssistants] = useState<InternalAssistantOption[]>(INTERNAL_ASSISTANTS);

  const fetchAgentTypes = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      const getAgentType = (window as any).getAgentType;
      if (typeof getAgentType !== 'function') {
        return;
      }

      const result = await getAgentType();
      setInternalAssistants(result as InternalAssistantOption[]);
    } catch (_error) {
      setInternalAssistants(INTERNAL_ASSISTANTS);
    }
  }, []);

  useEffect(() => {
    fetchAgentTypes();
  }, [fetchAgentTypes]);

  const confirmEnabled = useMemo(
    () => canConfirm(brainType, selectedBizRobotId),
    [brainType, selectedBizRobotId],
  );

  const handleBrainTypeChange = useCallback((value: BrainType) => {
    setBrainType(value);
    if (value === 'custom') {
      setSelectedBizRobotId(undefined);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirmEnabled || !brainType) return;
    onConfirm({
      digitalTwintype: brainType,
      bizRobotId: selectedBizRobotId,
    });
  }, [brainType, confirmEnabled, onConfirm, selectedBizRobotId]);

  const handleOpenGuideDocument = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (typeof window === 'undefined') return;
    window.open(GUIDE_DOCUMENT_URL, '_blank');
  }, []);

  return (
    <section className={`digital-twin ${isPcMiniApp ? '' : 'digital-twin--mobile'}`.trim()}>
      <header className="digital-twin__header">
        {isPcMiniApp ? (
          <>
            <span className="digital-twin__title">创建个人助理</span>
            <button
              type="button"
              className="digital-twin__close-btn"
              aria-label="关闭创建个人助理"
              onClick={onClose}
            >
              ×
            </button>
          </>
        ) : (
          <>
            <div className="digital-twin__mobile-header-side">
              <button
                type="button"
                className="digital-twin__mobile-back-btn"
                aria-label="返回上一页"
                onClick={onPrev}
              >
                {'<'}
              </button>
            </div>
            <span className="digital-twin__mobile-title">创建个人助理</span>
            <div className="digital-twin__mobile-header-side" aria-hidden="true" />
          </>
        )}
      </header>

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
              {internalAssistants.length > 0 ? (
                <div className="digital-twin__assistant-grid">
                  {internalAssistants.map((assistant) => {
                    const selected = selectedBizRobotId === assistant.bizRobotId;
                    return (
                      <button
                        key={assistant.bizRobotId}
                        type="button"
                        className={`digital-twin__assistant-btn ${selected ? 'is-selected' : ''}`.trim()}
                        onClick={() => setSelectedBizRobotId(assistant.bizRobotId)}
                        aria-label={assistant.name}
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
                          <span className="digital-twin__assistant-label">{assistant.name}</span>
                        </span>
                        {selected ? <span className="digital-twin__check">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}

          {brainType === 'custom' ? (
            <p className="digital-twin__custom-tip">
              需在本地电脑自定义部署第三方助手，点击查看
              <a
                href={GUIDE_DOCUMENT_URL}
                className="digital-twin__custom-tip-link"
                target="_blank"
                rel="noreferrer"
                onClick={handleOpenGuideDocument}
              >
                指导文档→
              </a>
            </p>
          ) : null}
        </div>

        <div className="digital-twin__brain-illustration-wrap">
          <img className="digital-twin__brain-illustration" src={illustration} alt="个人助理插画" />
        </div>
      </div>

      <footer className="digital-twin__actions">
        {isPcMiniApp ? (
          <>
            <button
              type="button"
              className="digital-twin__action-btn digital-twin__action-btn--cancel"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="button"
              className="digital-twin__action-btn digital-twin__action-btn--cancel"
              onClick={onPrev}
            >
              上一步
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
          </>
        ) : (
          <button
            type="button"
            className={`digital-twin__action-btn digital-twin__action-btn--confirm digital-twin__action-btn--mobile-primary ${
              confirmEnabled ? 'is-active' : 'is-disabled'
            }`.trim()}
            disabled={!confirmEnabled}
            onClick={handleConfirm}
          >
            确定
          </button>
        )}
      </footer>
    </section>
  );
};
