import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { AssistantDetailActionSheetProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import '../../styles/AssistantDetailActionSheet.less';

const AssistantDetailActionSheet: React.FC<AssistantDetailActionSheetProps> = ({
  open,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="assistant-detail-action-sheet" role="presentation">
      <button
        type="button"
        className="assistant-detail-action-sheet__mask"
        aria-label={t('assistantDetail.cancelAction')}
        onClick={(event) => {
          runButtonClickWithDebounce(event, onClose);
        }}
      />
      <div className="assistant-detail-action-sheet__wrap">
        <div className="assistant-detail-action-sheet__panel" role="dialog" aria-modal="true">
          <button
            type="button"
            className="assistant-detail-action-sheet__item"
            onClick={(event) => {
              runButtonClickWithDebounce(event, onEdit);
            }}
          >
            {t('assistantDetail.editInfo')}
          </button>
          <div className="assistant-detail-action-sheet__divider" />
          <button
            type="button"
            className="assistant-detail-action-sheet__item assistant-detail-action-sheet__item--danger"
            onClick={(event) => {
              runButtonClickWithDebounce(event, onDelete);
            }}
          >
            {t('assistantDetail.deleteAssistant')}
          </button>
          <div className="assistant-detail-action-sheet__gap" />
          <button
            type="button"
            className="assistant-detail-action-sheet__item"
            onClick={(event) => {
              runButtonClickWithDebounce(event, onClose);
            }}
          >
            {t('assistantDetail.cancelAction')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AssistantDetailActionSheet;
