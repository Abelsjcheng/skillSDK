import React, { ChangeEvent, useCallback, useMemo, useRef, useState } from 'react';
import type { DefaultAvatarOption, DigitalTwinBasicInfoPayload } from '../../types/digitalTwin';
import { canProceedNext, hasInvalidBasicTextChar, validateAvatarFile } from '../../utils/digitalTwinValidation';
import { showToast } from '../../utils/toast';

interface StepBasicInfoProps {
  isPcMiniApp?: boolean;
  defaultAvatars: DefaultAvatarOption[];
  initialValue?: DigitalTwinBasicInfoPayload | null;
  onClose: () => void;
  onCancel: () => void;
  onNext: (payload: DigitalTwinBasicInfoPayload) => void;
}

function resolveInitialDefaultAvatarId(
  defaultAvatars: DefaultAvatarOption[],
  initialValue?: DigitalTwinBasicInfoPayload | null,
): string | undefined {
  if (initialValue?.avatarType !== 'default') {
    return defaultAvatars[0]?.id;
  }

  if (initialValue.avatarId) {
    return initialValue.avatarId;
  }

  if (initialValue.icon) {
    return defaultAvatars.find((avatar) => avatar.image === initialValue.icon)?.id ?? defaultAvatars[0]?.id;
  }

  return defaultAvatars[0]?.id;
}

export const StepBasicInfo: React.FC<StepBasicInfoProps> = ({
  isPcMiniApp = true,
  defaultAvatars,
  initialValue,
  onClose,
  onCancel,
  onNext,
}) => {
  const [avatarType, setAvatarType] = useState<'default' | 'custom'>(initialValue?.avatarType ?? 'default');
  const [avatarId, setAvatarId] = useState<string | undefined>(
    resolveInitialDefaultAvatarId(defaultAvatars, initialValue),
  );
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | undefined>(
    initialValue?.avatarType === 'custom' ? initialValue.icon : undefined,
  );
  const [avatarError, setAvatarError] = useState<string>('');
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastObjectUrlRef = useRef<string | undefined>(
    initialValue?.avatarType === 'custom' ? initialValue.icon : undefined,
  );

  const nameHasInvalidChar = useMemo(() => hasInvalidBasicTextChar(name), [name]);
  const descriptionHasInvalidChar = useMemo(() => hasInvalidBasicTextChar(description), [description]);
  const canNext = useMemo(
    () => canProceedNext(name, description) && !nameHasInvalidChar && !descriptionHasInvalidChar,
    [description, descriptionHasInvalidChar, name, nameHasInvalidChar],
  );

  const currentAvatarSrc =
    avatarType === 'custom'
      ? customAvatarPreview
      : defaultAvatars.find((item) => item.id === avatarId)?.image ?? defaultAvatars[0]?.image;

  const handleChooseUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSelectDefaultAvatar = useCallback((selectedAvatarId: string) => {
    setAvatarType('default');
    setAvatarId(selectedAvatarId);
    setAvatarError('');
  }, []);

  const handleAvatarUpload = useCallback((file: File) => {
    const result = validateAvatarFile(file);
    if (!result.valid) {
      if (result.code === 'size') {
        showToast(result.reason, {
          toastClassName: 'digital-twin-toast',
          hideClassName: 'digital-twin-toast-hide',
        });
        setAvatarError('');
      } else {
        setAvatarError(result.reason);
      }
      return;
    }

    if (lastObjectUrlRef.current && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = undefined;
    }

    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined;

    if (previewUrl) {
      lastObjectUrlRef.current = previewUrl;
    }

    setAvatarType('custom');
    setCustomAvatarPreview(previewUrl);
    setAvatarError('');
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleAvatarUpload(file);
    event.target.value = '';
  };

  const handleNext = useCallback(() => {
    if (!canNext) return;
    onNext({
      avatarType,
      avatarId,
      name,
      icon: currentAvatarSrc ?? '',
      description,
    });
  }, [avatarId, avatarType, canNext, currentAvatarSrc, description, name, onNext]);

  const handleMobileBack = useCallback(() => {}, []);

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
                onClick={handleMobileBack}
              >
                {'<'}
              </button>
            </div>
            <span className="digital-twin__mobile-title">创建个人助理</span>
            <div className="digital-twin__mobile-header-side" aria-hidden="true" />
          </>
        )}
      </header>

      <div className="digital-twin__content digital-twin__content--step1">
        <div className="digital-twin__avatar-preview-wrap">
          <div className="digital-twin__avatar-preview">
            {currentAvatarSrc ? (
              <img src={currentAvatarSrc} alt="当前头像预览" className="digital-twin__avatar-preview-img" />
            ) : null}
          </div>
          <p className="digital-twin__avatar-tip">支持JPG/PNG格式，小于2MB</p>
          {avatarError ? <p className="digital-twin__error-text">{avatarError}</p> : null}
        </div>

        <div className="digital-twin__avatar-options" role="list" aria-label="默认头像列表">
          {defaultAvatars.map((avatar) => {
            const selected = avatarType === 'default' && avatarId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                role="listitem"
                className={`digital-twin__avatar-option ${selected ? 'is-selected' : ''}`.trim()}
                aria-label={`选择默认头像 ${avatar.id}`}
                onClick={() => handleSelectDefaultAvatar(avatar.id)}
              >
                <img src={avatar.image} alt={`默认头像 ${avatar.id}`} className="digital-twin__avatar-option-img" />
                {selected ? <span className="digital-twin__check">✓</span> : null}
              </button>
            );
          })}

          <button
            type="button"
            className={`digital-twin__avatar-option digital-twin__avatar-option--upload ${
              avatarType === 'custom' ? 'is-selected' : ''
            }`.trim()}
            aria-label="上传自定义头像"
            onClick={handleChooseUpload}
          >
            +
            {avatarType === 'custom' ? <span className="digital-twin__check">✓</span> : null}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            className="digital-twin__hidden-file"
            onChange={handleFileChange}
            data-testid="avatar-upload-input"
          />
        </div>

        <div className="digital-twin__field">
          <label className="digital-twin__label" htmlFor="digital-twin-name">
            名称
          </label>
          <input
            id="digital-twin-name"
            className={`digital-twin__input ${nameHasInvalidChar ? 'is-invalid' : ''}`.trim()}
            type="text"
            value={name}
            placeholder="例如：智能助手"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="digital-twin__field">
          <label className="digital-twin__label" htmlFor="digital-twin-description">
            简介
          </label>
          <textarea
            id="digital-twin-description"
            className={`digital-twin__textarea ${descriptionHasInvalidChar ? 'is-invalid' : ''}`.trim()}
            value={description}
            placeholder="介绍助理的功能和应用场景"
            onChange={(event) => setDescription(event.target.value)}
          />
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
              className={`digital-twin__action-btn digital-twin__action-btn--next ${
                canNext ? 'is-active' : 'is-disabled'
              }`.trim()}
              disabled={!canNext}
              onClick={handleNext}
            >
              下一步
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`digital-twin__action-btn digital-twin__action-btn--next digital-twin__action-btn--mobile-primary ${
              canNext ? 'is-active' : 'is-disabled'
            }`.trim()}
            disabled={!canNext}
            onClick={handleNext}
          >
            下一步
          </button>
        )}
      </footer>
    </section>
  );
};

