import React from 'react';
import { createPortal } from 'react-dom';
import type { ConfirmModalProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import '../../styles/ConfirmModal.less';

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  cancelText,
  confirmText,
  onClose,
  onConfirm,
  confirmTextColor,
}) => {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="confirm-modal" role="presentation">
      <button
        type="button"
        className="confirm-modal__mask"
        aria-label={cancelText}
        onClick={(event) => {
          runButtonClickWithDebounce(event, onClose);
        }}
      />
      <div className="confirm-modal__wrap">
        <div className="confirm-modal__panel" role="dialog" aria-modal="true">
          <h3 className="confirm-modal__title">{title}</h3>
          <p className="confirm-modal__description">{description}</p>
          <div className="confirm-modal__actions">
            <button
              type="button"
              className="confirm-modal__action"
              onClick={(event) => {
                runButtonClickWithDebounce(event, onClose);
              }}
            >
              {cancelText}
            </button>
            <div className="confirm-modal__action-divider" />
            <button
              type="button"
              className="confirm-modal__action"
              style={confirmTextColor ? { color: confirmTextColor } : undefined}
              onClick={(event) => {
                runButtonClickWithDebounce(event, onConfirm);
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

export default ConfirmModal;
