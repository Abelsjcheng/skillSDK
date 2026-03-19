import React, { ChangeEvent, useRef } from 'react';
import type { DefaultAvatarOption } from '../../types/personalAgent';

interface StepBasicInfoProps {
  defaultAvatars: DefaultAvatarOption[];
  selectedAvatarType: 'default' | 'custom';
  selectedAvatarId?: string;
  customAvatarPreview?: string;
  avatarError?: string;
  name: string;
  description: string;
  canNext: boolean;
  onSelectDefaultAvatar: (avatarId: string) => void;
  onAvatarUpload: (file: File) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onCancel: () => void;
  onNext: () => void;
}

export const StepBasicInfo: React.FC<StepBasicInfoProps> = ({
  defaultAvatars,
  selectedAvatarType,
  selectedAvatarId,
  customAvatarPreview,
  avatarError,
  name,
  description,
  canNext,
  onSelectDefaultAvatar,
  onAvatarUpload,
  onNameChange,
  onDescriptionChange,
  onClose,
  onCancel,
  onNext,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAvatarSrc =
    selectedAvatarType === 'custom'
      ? customAvatarPreview
      : defaultAvatars.find((item) => item.id === selectedAvatarId)?.image ?? defaultAvatars[0]?.image;

  const handleChooseUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onAvatarUpload(file);
    event.target.value = '';
  };

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
            const selected = selectedAvatarType === 'default' && selectedAvatarId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                role="listitem"
                className={`personal-agent__avatar-option ${selected ? 'is-selected' : ''}`.trim()}
                aria-label={`选择默认头像 ${avatar.id}`}
                onClick={() => onSelectDefaultAvatar(avatar.id)}
              >
                <img src={avatar.image} alt={`默认头像 ${avatar.id}`} className="personal-agent__avatar-option-img" />
                {selected ? <span className="personal-agent__check">✓</span> : null}
              </button>
            );
          })}

          <button
            type="button"
            className={`personal-agent__avatar-option personal-agent__avatar-option--upload ${
              selectedAvatarType === 'custom' ? 'is-selected' : ''
            }`.trim()}
            aria-label="上传自定义头像"
            onClick={handleChooseUpload}
          >
            +
            {selectedAvatarType === 'custom' ? <span className="personal-agent__check">✓</span> : null}
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
            onChange={(event) => onNameChange(event.target.value)}
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
            onChange={(event) => onDescriptionChange(event.target.value)}
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
          onClick={onNext}
        >
          下一步
        </button>
      </footer>
    </section>
  );
};

