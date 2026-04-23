import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AssistantDetailDeleteModalProps } from '../../types/components';
import ConfirmModal from '../system/ConfirmModal';

const AssistantDetailDeleteModal: React.FC<AssistantDetailDeleteModalProps> = ({
  open,
  assistantName,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <ConfirmModal
      open={open}
      title={t('assistantDetail.confirmDeleteTitle', { name: assistantName })}
      description={t('assistantDetail.confirmDeleteDescription')}
      cancelText={t('assistantDetail.cancelAction')}
      confirmText={t('assistantDetail.deleteAssistant')}
      confirmTextColor="rgba(243, 111, 100, 1)"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

export default AssistantDetailDeleteModal;
