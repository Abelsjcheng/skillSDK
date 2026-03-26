import React from 'react';
import { useMobileStatusBarHeight } from '../../utils/useMobileStatusBarHeight';

const noop = () => {};

interface CreatorStepHeaderProps {
  isPcMiniApp: boolean;
  onClose: () => void;
  onMobileBack?: () => void;
}

export function getStepClassName(isPcMiniApp: boolean): string {
  return `digital-twin ${isPcMiniApp ? '' : 'digital-twin--mobile'}`.trim();
}

export const CreatorStepHeader: React.FC<CreatorStepHeaderProps> = ({
  isPcMiniApp,
  onClose,
  onMobileBack,
}) => {
  const handleMobileBack = onMobileBack ?? noop;
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
          <button type="button" className="digital-twin__close-btn" aria-label="关闭创建个人助理" onClick={onClose}>
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
  );
};
