import React from 'react';
import { createPortal } from 'react-dom';
import { isPcMiniApp } from '../../constants';
import closeIcon from '../../imgs/close_icon.svg';
import type { ResponsiveConfirmModalProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import '../../styles/ResponsiveConfirmModal.less';

const ResponsiveConfirmModal: React.FC<ResponsiveConfirmModalProps> = ({
  open,
  headerTitle = '提示',
  title,
  description,
  cancelText = '取消',
  confirmText = '确定',
  cancelTextColor = '#666',
  cancelBackgroundColor = '#f5f5f5',
  confirmTextColor = '#fff',
  confirmBackgroundColor = '#0D94FF',
  mobileCancelTextColor,
  mobileConfirmTextColor,
  showMask,
  confirmDisabled = false,
  onClose,
  onCancel,
  onConfirm,
}) => {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  const isPc = isPcMiniApp();
  const shouldShowMask = isPc ? false : (showMask ?? true);
  const cancelStyle = isPc
    ? { color: cancelTextColor, backgroundColor: cancelBackgroundColor }
    : { color: mobileCancelTextColor ?? '#333' };
  const confirmStyle = isPc
    ? { color: confirmTextColor, backgroundColor: confirmBackgroundColor }
    : { color: mobileConfirmTextColor ?? '#0D94FF' };

  const handleCancel = (): void => {
    onCancel?.();
    onClose();
  };

  return createPortal(
    <div
      className={[
        'responsive-confirm-modal',
        isPc ? 'responsive-confirm-modal--pc' : 'responsive-confirm-modal--mobile',
        shouldShowMask ? 'has-mask' : 'is-maskless',
      ].join(' ')}
      role="presentation"
    >
      {shouldShowMask && (
        <button
          type="button"
          className="responsive-confirm-modal__mask"
          aria-label={cancelText}
          onClick={(event) => {
            runButtonClickWithDebounce(event, onClose);
          }}
        />
      )}
      <div className="responsive-confirm-modal__wrap">
        <div
          className="responsive-confirm-modal__panel"
          role="dialog"
          aria-modal={!isPc}
          aria-labelledby="responsive-confirm-modal-title"
        >
          {isPc && (
            <div className="responsive-confirm-modal__header">
              <div className="responsive-confirm-modal__header-title">{headerTitle}</div>
              <button
                type="button"
                className="responsive-confirm-modal__close"
                aria-label={cancelText}
                onClick={(event) => {
                  runButtonClickWithDebounce(event, onClose);
                }}
              >
                <span
                  className="responsive-confirm-modal__close-icon"
                  style={{ WebkitMaskImage: `url(${closeIcon})`, maskImage: `url(${closeIcon})` }}
                  aria-hidden="true"
                />
              </button>
            </div>
          )}
          <div className="responsive-confirm-modal__body">
            <div id="responsive-confirm-modal-title" className="responsive-confirm-modal__body-title">
              {title}
            </div>
            {description ? (
              <div className="responsive-confirm-modal__body-description">
                {description}
              </div>
            ) : null}
          </div>
          <div className="responsive-confirm-modal__footer">
            <button
              type="button"
              className="responsive-confirm-modal__action responsive-confirm-modal__action--cancel"
              style={cancelStyle}
              onClick={(event) => {
                runButtonClickWithDebounce(event, handleCancel);
              }}
            >
              {cancelText}
            </button>
            {!isPc && <div className="responsive-confirm-modal__divider" />}
            <button
              type="button"
              className="responsive-confirm-modal__action responsive-confirm-modal__action--confirm"
              style={confirmStyle}
              disabled={confirmDisabled}
              onClick={(event) => {
                runButtonClickWithDebounce(event, () => {
                  onConfirm?.();
                });
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ResponsiveConfirmModal;
