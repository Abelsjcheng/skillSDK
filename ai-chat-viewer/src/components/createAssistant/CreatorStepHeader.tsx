import React from 'react';

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

  return (
    <header className="digital-twin__header">
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
