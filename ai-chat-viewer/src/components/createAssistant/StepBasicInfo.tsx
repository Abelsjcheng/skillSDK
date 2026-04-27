import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import selectionIcon from '../../imgs/selection_icon.png';
import defaultAvatar from '../../imgs/defaultAvatar.png';
import addIcon from '../../imgs/add_icon.svg';
import type {
  DefaultAvatarOption,
  DigitalTwinBasicInfoPayload,
  GetFilePathResult,
  UploadTinyImageResult,
} from '../../types/digitalTwin';
import type { StepBasicInfoProps } from '../../types/components';
import { chooseImage, uploadFile } from '../../utils/hwext';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import {
  canProceedNext,
  hasInvalidDescription,
  hasInvalidName,
  validateAvatarFile,
} from '../../utils/digitalTwinValidation';
import { WeLog } from '../../utils/logger';
import { showToast } from '../../utils/toast';
import AvatarImage from '../AvatarImage';
import { CreatorStepFooter } from './CreatorStepFooter';
import { CreatorStepHeader, getStepClassName } from './CreatorStepHeader';

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
  className,
  showHeader = true,
  expired = false,
  expiredImageSrc,
  expiredMessage,
  providerChannel,
  onClose,
  onMobileBack,
  onNext,
  submitLabel,
}) => {
  const { t } = useTranslation();
  const [avatarType, setAvatarType] = useState<'default' | 'custom'>(initialValue?.avatarType ?? 'default');
  const [avatarId, setAvatarId] = useState<string | undefined>(
    resolveInitialDefaultAvatarId(defaultAvatars, initialValue),
  );
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | undefined>(
    initialValue?.avatarType === 'custom' ? initialValue.icon : undefined,
  );
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [prefersDarkMode, setPrefersDarkMode] = useState(() =>
    !isPcMiniApp && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
  );
  const resolvedSubmitLabel = submitLabel ?? t('createAssistant.next');
  const providerChannelText = providerChannel ? `AI能力提供方：${providerChannel}` : '';

  useEffect(() => {
    setAvatarType(initialValue?.avatarType ?? 'default');
    setAvatarId(resolveInitialDefaultAvatarId(defaultAvatars, initialValue));
    setCustomAvatarPreview(initialValue?.avatarType === 'custom' ? initialValue.icon : undefined);
    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
    setSubmitAttempted(false);
  }, [defaultAvatars, initialValue]);

  useEffect(() => {
    if (isPcMiniApp) {
      setPrefersDarkMode(false);
      return;
    }

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) {
      return;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDarkMode(event.matches);
    };

    setPrefersDarkMode(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [isPcMiniApp]);

  const nameIsInvalid = useMemo(
    () => hasInvalidName(name) || (submitAttempted && !name.trim()),
    [name, submitAttempted],
  );
  const descriptionIsInvalid = useMemo(
    () => hasInvalidDescription(description) || (submitAttempted && !description.trim()),
    [description, submitAttempted],
  );
  const canNext = useMemo(() => canProceedNext(name, description), [description, name]);
  const allowDarkModeValidateClick = useMemo(
    () => prefersDarkMode && (!name.trim() || !description.trim()),
    [description, name, prefersDarkMode],
  );

  const currentAvatarSrc =
    avatarType === 'custom'
      ? customAvatarPreview
      : defaultAvatars.find((item) => item.id === avatarId)?.image ?? defaultAvatars[0]?.image;

  const handleSelectDefaultAvatar = useCallback((selectedAvatarId: string) => {
    setAvatarType('default');
    setAvatarId(selectedAvatarId);
  }, []);

  const handleAvatarUpload = useCallback(
    async (file: GetFilePathResult) => {
      const result = validateAvatarFile(file);
      if (!result.valid) {
        showToast(result.reason);
        return;
      }
      try {
        const uploadFileResult = (await uploadFile({
          serverlUrl: '',
          filePath: file.filePath,
          name: 'file',
          formData: {
            app: 'athena',
          },
        })) as UploadTinyImageResult;
        const urlObj = new URL(uploadFileResult.tinyImageUrl);
        setAvatarType('custom');
        setCustomAvatarPreview(urlObj.pathname);
      } catch (error) {
        WeLog(`StepBasicInfo uploadFile failed | extra=${JSON.stringify({ filePath: file.filePath })} | error=${JSON.stringify(error)}`);
        showToast(t('createAssistant.uploadAvatarFailed'));
      }
    },
    [t],
  );

  const handleChooseUpload = useCallback(async () => {
    try {
      const fileResult = (await chooseImage({
        flag: 1,
        imagePickerMode: 'IMAGE',
        maxSelectedCount: 1,
        showOrigin: true,
        type: 1,
      })) as GetFilePathResult;
      if (!fileResult.filePath) {
        return;
      }
      await handleAvatarUpload(fileResult);
    } catch (error) {
      WeLog(`StepBasicInfo chooseImage failed | error=${JSON.stringify(error)}`);
      showToast(t('createAssistant.chooseAvatarFailed'));
    }
  }, [handleAvatarUpload, t]);

  const handleMobileInputTouchStart = useCallback(
    (event: React.TouchEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (isPcMiniApp) return;
      const target = event.currentTarget;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollTop, left: 0, behavior: 'auto' });
      });
    },
    [isPcMiniApp],
  );

  const handleNext = useCallback(() => {
    setSubmitAttempted(true);
    if (!canNext) return;
    onNext({
      avatarType,
      avatarId,
      name,
      icon: currentAvatarSrc ?? '',
      description,
    });
  }, [avatarId, avatarType, canNext, currentAvatarSrc, description, name, onNext]);

  return (
    <section className={`${getStepClassName(isPcMiniApp)} ${className ?? ''}`.trim()}>
      {showHeader ? (
        <CreatorStepHeader
          isPcMiniApp={isPcMiniApp}
          onClose={onClose}
          onMobileBack={onMobileBack}
        />
      ) : null}

      {expired ? (
        <div className="digital-twin__content digital-twin__content--step1 digital-twin__content--expired">
          <div className="digital-twin__expired-wrap">
            {expiredImageSrc ? (
              <img
                src={expiredImageSrc}
                alt={t('createAssistant.qrcodeExpiredAlt')}
                className="digital-twin__expired-image"
              />
            ) : null}
            {expiredMessage ? (
              <p className="digital-twin__expired-message">{expiredMessage}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="digital-twin__content digital-twin__content--step1">
            <div className="digital-twin__avatar-section">
              <div className="digital-twin__avatar-preview-wrap">
                <div className="digital-twin__avatar-preview">
                  <AvatarImage
                    src={currentAvatarSrc}
                    fallbackSrc={defaultAvatar}
                    alt={t('createAssistant.avatarPreview')}
                    className="digital-twin__avatar-preview-img"
                    draggable="false"
                  />
                </div>
                <p className="digital-twin__avatar-tip">{t('createAssistant.avatarTip')}</p>
              </div>

              <div
                className="digital-twin__avatar-options"
                role="list"
                aria-label={t('createAssistant.defaultAvatarList')}
              >
                {defaultAvatars.map((avatar) => {
                  const selected = avatarType === 'default' && avatarId === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      role="listitem"
                      className={`digital-twin__avatar-option ${selected ? 'is-selected' : ''}`.trim()}
                      aria-label={t('createAssistant.selectDefaultAvatar', { id: avatar.id })}
                      onClick={(event) => {
                        runButtonClickWithDebounce(event, () => {
                          handleSelectDefaultAvatar(avatar.id);
                        });
                      }}
                    >
                      <AvatarImage
                        src={avatar.image}
                        fallbackSrc={defaultAvatar}
                        alt={t('createAssistant.defaultAvatarAlt', { id: avatar.id })}
                        className="digital-twin__avatar-option-img"
                        draggable="false"
                      />
                      {selected ? <img src={selectionIcon} alt="" aria-hidden="true" className="digital-twin__check" /> : null}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={`digital-twin__avatar-option digital-twin__avatar-option--upload ${avatarType === 'custom' ? 'is-selected' : ''
                    }`.trim()}
                  aria-label={t('createAssistant.uploadCustomAvatar')}
                  onClick={(event) => {
                    runButtonClickWithDebounce(event, () => {
                      void handleChooseUpload();
                    });
                  }}
                >
                  <img src={addIcon} alt="" aria-hidden="true" className="digital-twin__upload-icon" />
                  {avatarType === 'custom' ? <img src={selectionIcon} alt="" aria-hidden="true" className="digital-twin__check" /> : null}
                </button>
              </div>
            </div>

            <div className="digital-twin__form-section">
              <div className="digital-twin__field">
                <div className="digital-twin__label-row">
                  <span id="digital-twin-name-label" className="digital-twin__label">
                    {t('createAssistant.name')}
                  </span>
                  {nameIsInvalid ? (
                    <span className="digital-twin__label-hint">
                      {t('createAssistant.nameInvalidHint')}
                    </span>
                  ) : null}
                </div>
                <input
                  id="digital-twin-name"
                  aria-labelledby="digital-twin-name-label"
                  className={`digital-twin__input ${nameIsInvalid ? 'is-invalid' : ''}`.trim()}
                  type="text"
                  value={name}
                  placeholder={t('createAssistant.namePlaceholder')}
                  onChange={(event) => setName(event.target.value)}
                  onTouchStart={handleMobileInputTouchStart}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }}
                />
              </div>

              <div className="digital-twin__field">
                <div className="digital-twin__label-row">
                  <span id="digital-twin-description-label" className="digital-twin__label">
                    {t('createAssistant.description')}
                  </span>
                  {descriptionIsInvalid ? (
                    <span className="digital-twin__label-hint">
                      {t('createAssistant.descriptionInvalidHint')}
                    </span>
                  ) : null}
                </div>
                <textarea
                  id="digital-twin-description"
                  aria-labelledby="digital-twin-description-label"
                  className={`digital-twin__textarea ${descriptionIsInvalid ? 'is-invalid' : ''}`.trim()}
                  value={description}
                  placeholder={t('createAssistant.descriptionPlaceholder')}
                  onChange={(event) => setDescription(event.target.value)}
                  onTouchStart={handleMobileInputTouchStart}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }}
                />
              </div>

              {!isPcMiniApp && providerChannelText ? (
                <div className="digital-twin__provider-note digital-twin__provider-note--mobile">
                  {providerChannelText}
                </div>
              ) : null}
            </div>
          </div>

          <CreatorStepFooter
            isPcMiniApp={isPcMiniApp}
            leftContent={
              isPcMiniApp && providerChannelText ? (
                <div className="digital-twin__provider-note">{providerChannelText}</div>
              ) : undefined
            }
            pcButtons={[
              {
                label: resolvedSubmitLabel,
                onClick: handleNext,
                variant: 'next',
                enabled: allowDarkModeValidateClick || canNext,
                withStateClass: true,
              },
            ]}
            mobileButton={{
              label: resolvedSubmitLabel,
              onClick: handleNext,
              variant: 'next',
              enabled: allowDarkModeValidateClick || canNext,
              withStateClass: true,
            }}
          />
        </>
      )}
    </section>
  );
};
