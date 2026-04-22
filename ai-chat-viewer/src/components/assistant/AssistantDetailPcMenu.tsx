import React from 'react';
import deleteIcon from '../../imgs/delete_icon.png';
import editIcon from '../../imgs/edit_icon.png';
import type { AssistantDetailPcMenuProps } from '../../types/components';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import '../../styles/AssistantDetailPcMenu.less';

const AssistantDetailPcMenu: React.FC<AssistantDetailPcMenuProps> = ({
  open,
  top,
  left,
  onClose,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="assistant-detail-pc-menu-layer">
      <button
        type="button"
        className="assistant-detail-pc-menu-layer__mask"
        aria-label="close menu"
        onClick={onClose}
      />
      <div
        className="assistant-detail-pc-menu"
        style={{
          top: `${top}px`,
          left: `${left}px`,
        }}
      >
        <button
          type="button"
          className="assistant-detail-pc-menu__item"
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              onEdit();
            });
          }}
        >
          <img src={editIcon} alt="" className="assistant-detail-pc-menu__icon" aria-hidden="true" />
          <span className="assistant-detail-pc-menu__text">{editLabel}</span>
        </button>
        <button
          type="button"
          className="assistant-detail-pc-menu__item assistant-detail-pc-menu__item--danger"
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              onDelete();
            });
          }}
        >
          <img src={deleteIcon} alt="" className="assistant-detail-pc-menu__icon" aria-hidden="true" />
          <span className="assistant-detail-pc-menu__text">{deleteLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default AssistantDetailPcMenu;
