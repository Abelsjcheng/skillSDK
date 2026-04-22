import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import '../../styles/AssistantDetailDeleteModal.less';

interface AssistantDetailDeleteModalProps {
  open: boolean;
  assistantName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const AssistantDetailDeleteModal: React.FC<AssistantDetailDeleteModalProps> = ({
  open,
  assistantName,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="assistant-detail-delete-modal" role="presentation">
      <button
        type="button"
        className="assistant-detail-delete-modal__mask"
        aria-label={t('assistantDetail.cancelAction')}
        onClick={(event) => {
          runButtonClickWithDebounce(event, onClose);
        }}
      />
      <div className="assistant-detail-delete-modal__wrap">
        <div className="assistant-detail-delete-modal__panel" role="dialog" aria-modal="true">
          <h3 className="assistant-detail-delete-modal__title">
            {t('assistantDetail.confirmDeleteTitle', { name: assistantName })}
          </h3>
          <p className="assistant-detail-delete-modal__description">
            {t('assistantDetail.confirmDeleteDescription')}
          </p>
          <div className="assistant-detail-delete-modal__actions">
            <button
              type="button"
              className="assistant-detail-delete-modal__action"
              onClick={(event) => {
                runButtonClickWithDebounce(event, onClose);
              }}
            >
              {t('assistantDetail.cancelAction')}
            </button>
            <div className="assistant-detail-delete-modal__action-divider" />
            <button
              type="button"
              className="assistant-detail-delete-modal__action assistant-detail-delete-modal__action--danger"
              onClick={(event) => {
                runButtonClickWithDebounce(event, onConfirm);
              }}
            >
              {t('assistantDetail.deleteAssistant')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AssistantDetailDeleteModal;
