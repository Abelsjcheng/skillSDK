import React from 'react';
import closeIcon from '../../imgs/close_icon.png';
import backIcon from '../../imgs/back_icon.svg';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { useMobileStatusBarHeight } from '../../utils/useMobileStatusBarHeight';

interface CreatorStepHeaderProps {
  isPcMiniApp: boolean;
  onClose: () => void;
}

export function getStepClassName(isPcMiniApp: boolean): string {
  return `digital-twin ${isPcMiniApp ? '' : 'digital-twin--mobile'}`.trim();
}

export const CreatorStepHeader: React.FC<CreatorStepHeaderProps> = ({
  isPcMiniApp,
  onClose,
}) => {
  const statusBarHeight = useMobileStatusBarHeight(isPcMiniApp);
  const mobileHeaderStyle = !isPcMiniApp && statusBarHeight > 0
    ? {
      paddingTop: `${statusBarHeight}px`,
      height: `${44 + statusBarHeight}px`,
      minHeight: `${44 + statusBarHeight}px`,
      flexBasis: `${44 + statusBarHeight}px`,
    }
    : undefined;

  return (
    <header className="digital-twin__header" style={mobileHeaderStyle}>
      {isPcMiniApp ? (
        <>
          <span className="digital-twin__title">创建个人助理</span>
          <button
            type="button"
            className="digital-twin__close-btn"
            aria-label="关闭创建个人助理"
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
              aria-label="返回上一页"
                onClick={(event) => {
                  runButtonClickWithDebounce(event, () => {
                    window.HWH5.navigateBack();
                  });
                }}
              >
                <img src={backIcon} alt="" className="digital-twin__mobile-back-icon" aria-hidden="true" />
              </button>
          </div>
          <span className="digital-twin__mobile-title">创建个人助理</span>
          <div className="digital-twin__mobile-header-side" aria-hidden="true" />
        </>
      )}
    </header>
  );
};
