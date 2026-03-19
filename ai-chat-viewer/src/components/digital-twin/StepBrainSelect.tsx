import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentTypeListResult, BrainType, DigitalTwinBrainPayload, InternalAssistantOption } from '../../types/digitalTwin';
import { canConfirm } from '../../utils/digitalTwinValidation';

interface StepBrainSelectProps {
  illustration: string;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: (payload: DigitalTwinBrainPayload) => void;
}

function normalizeAgentTypeList(result: unknown): InternalAssistantOption[] {
  const payload = result as AgentTypeListResult | null | undefined;
  const source =
    Array.isArray(payload?.content)
      ? payload.content
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(result)
          ? result
          : [];

  return source.reduce<InternalAssistantOption[]>((list, item) => {
    const raw = (item ?? {}) as Record<string, unknown>;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const icon = typeof raw.icon === 'string' ? raw.icon.trim() : '';
    const bizRobotId = typeof raw.bizRobotId === 'string' ? raw.bizRobotId.trim() : '';

    if (!name || !bizRobotId) {
      return list;
    }

    const option: InternalAssistantOption = {
      name,
      bizRobotId,
    };

    if (icon) {
      option.icon = icon;
    }

    list.push(option);
    return list;
  }, []);
}

export const StepBrainSelect: React.FC<StepBrainSelectProps> = ({
  illustration,
  onClose,
  onCancel,
  onConfirm,
}) => {
  const [brainType, setBrainType] = useState<BrainType | undefined>();
  const [selectedBizRobotId, setSelectedBizRobotId] = useState<string | undefined>();
  const [internalAssistants, setInternalAssistants] = useState<InternalAssistantOption[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const fetchAgentTypes = async () => {
      if (typeof window === 'undefined') return;

      const getAgentType = (window as any).getAgentType;
      if (typeof getAgentType !== 'function') {
        if (active) {
          setInternalAssistants([]);
        }
        return;
      }

      if (active) {
        setLoadingAssistants(true);
      }

      try {
        const result = await getAgentType();
        if (!active) return;
        setInternalAssistants(normalizeAgentTypeList(result));
      } catch (_error) {
        if (!active) return;
        setInternalAssistants([]);
      } finally {
        if (active) {
          setLoadingAssistants(false);
        }
      }
    };

    void fetchAgentTypes();

    return () => {
      active = false;
    };
  }, []);

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
              {loadingAssistants ? (
                <p className="digital-twin__custom-tip">内部助手加载中...</p>
              ) : null}
              {!loadingAssistants && internalAssistants.length === 0 ? (
                <p className="digital-twin__custom-tip">暂无可用内部助手</p>
              ) : null}
              {!loadingAssistants && internalAssistants.length > 0 ? (
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
