import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DefaultAvatarOption } from '../../types/personalAgent';
import { canProceedNext, validateAvatarFile } from '../../utils/personalAgentValidation';
import { showToast } from '../../utils/toast';

interface StepBasicInfoProps {
  defaultAvatars: DefaultAvatarOption[];
  onClose: () => void;
  onCancel: () => void;
  onNext: () => void;
}

export const StepBasicInfo: React.FC<StepBasicInfoProps> = ({
  defaultAvatars,
  onClose,
  onCancel,
  onNext,
}) => {
  const [avatarType, setAvatarType] = useState<'default' | 'custom'>('default');
  const [avatarId, setAvatarId] = useState<string | undefined>(defaultAvatars[0]?.id);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | undefined>();
  const [avatarError, setAvatarError] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastObjectUrlRef = useRef<string>();

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
    };
  }, []);

  const canNext = useMemo(() => canProceedNext(name, description), [name, description]);

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
          toastClassName: 'personal-agent-toast',
          hideClassName: 'personal-agent-toast-hide',
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

    const previewUrl =
      typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : undefined;

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
    onNext();
  }, [canNext, onNext]);

  return (
    <section className="personal-agent">
      <header className="personal-agent__header">
        <span className="personal-agent__title">创建个人助理</span>
        <button
          type="button"
          className="personal-agent__close-btn"
          aria-label="关闭创建个人助理"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="personal-agent__content personal-agent__content--step1">
        <div className="personal-agent__avatar-preview-wrap">
          <div className="personal-agent__avatar-preview">
            {currentAvatarSrc ? (
              <img src={currentAvatarSrc} alt="当前头像预览" className="personal-agent__avatar-preview-img" />
            ) : null}
          </div>
          <p className="personal-agent__avatar-tip">支持JPG/PNG格式，小于2MB</p>
          {avatarError ? <p className="personal-agent__error-text">{avatarError}</p> : null}
        </div>

        <div className="personal-agent__avatar-options" role="list" aria-label="默认头像列表">
          {defaultAvatars.map((avatar) => {
            const selected = avatarType === 'default' && avatarId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                role="listitem"
                className={`personal-agent__avatar-option ${selected ? 'is-selected' : ''}`.trim()}
                aria-label={`选择默认头像 ${avatar.id}`}
                onClick={() => handleSelectDefaultAvatar(avatar.id)}
              >
                <img src={avatar.image} alt={`默认头像 ${avatar.id}`} className="personal-agent__avatar-option-img" />
                {selected ? <span className="personal-agent__check">✓</span> : null}
              </button>
            );
          })}

          <button
            type="button"
            className={`personal-agent__avatar-option personal-agent__avatar-option--upload ${
              avatarType === 'custom' ? 'is-selected' : ''
            }`.trim()}
            aria-label="上传自定义头像"
            onClick={handleChooseUpload}
          >
            +
            {avatarType === 'custom' ? <span className="personal-agent__check">✓</span> : null}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            className="personal-agent__hidden-file"
            onChange={handleFileChange}
            data-testid="avatar-upload-input"
          />
        </div>

        <div className="personal-agent__field">
          <label className="personal-agent__label" htmlFor="personal-agent-name">
            名称
          </label>
          <input
            id="personal-agent-name"
            className="personal-agent__input"
            type="text"
            value={name}
            placeholder="例如：智能助手"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="personal-agent__field">
          <label className="personal-agent__label" htmlFor="personal-agent-description">
            简介
          </label>
          <textarea
            id="personal-agent-description"
            className="personal-agent__textarea"
            value={description}
            placeholder="介绍助理的功能和应用场景"
            onChange={(event) => setDescription(event.target.value)}
          />
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
          className={`personal-agent__action-btn personal-agent__action-btn--next ${
            canNext ? 'is-active' : 'is-disabled'
          }`.trim()}
          disabled={!canNext}
          onClick={handleNext}
        >
          下一步
        </button>
      </footer>
    </section>
  );
};
