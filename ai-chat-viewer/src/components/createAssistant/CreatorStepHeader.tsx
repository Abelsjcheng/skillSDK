import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import backIcon from '../../imgs/back_icon.svg';
import closeIcon from '../../imgs/close_icon.png';
import type { CreatorStepHeaderProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { useMobileStatusBarHeight } from '../../utils/useMobileStatusBarHeight';

export function getStepClassName(isPcMiniApp: boolean): string {
  return `digital-twin ${isPcMiniApp ? '' : 'digital-twin--mobile'}`.trim();
}

export const CreatorStepHeader: React.FC<CreatorStepHeaderProps> = ({
  isPcMiniApp,
  onClose,
  onMobileBack,
}) => {
  const { t } = useTranslation();
  const statusBarHeight = useMobileStatusBarHeight(isPcMiniApp);
  const mobileHeaderStyle = !isPcMiniApp && statusBarHeight > 0
    ? {
        paddingTop: `${statusBarHeight}px`,
        height: `${44 + statusBarHeight}px`,
        minHeight: `${44 + statusBarHeight}px`,
        flexBasis: `${44 + statusBarHeight}px`,
      }
    : undefined;

  const handleMobileBack = useCallback(() => {
    if (onMobileBack) {
      onMobileBack();
      return;
    }
    window.HWH5.navigateBack();
  }, [onMobileBack]);

  return (
    <header className="digital-twin__header" style={mobileHeaderStyle}>
      {isPcMiniApp ? (
        <>
          <span className="digital-twin__title">{t('createAssistant.title')}</span>
          <button
            type="button"
            className="digital-twin__close-btn"
            aria-label={t('createAssistant.close')}
            onClick={(event) => {
              runButtonClickWithDebounce(event, () => {
                onClose();
              });
            }}
          >
            <img src={closeIcon} alt="" className="digital-twin__close-icon" aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <div className="digital-twin__mobile-header-side">
            <button
              type="button"
              className="digital-twin__mobile-back-btn"
              aria-label={t('createAssistant.back')}
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  handleMobileBack();
                });
              }}
            >
              <img src={backIcon} alt="" className="digital-twin__mobile-back-icon" aria-hidden="true" />
            </button>
          </div>
          <span className="digital-twin__mobile-title">{t('createAssistant.title')}</span>
          <div className="digital-twin__mobile-header-side" aria-hidden="true" />
        </>
      )}
    </header>
  );
};
