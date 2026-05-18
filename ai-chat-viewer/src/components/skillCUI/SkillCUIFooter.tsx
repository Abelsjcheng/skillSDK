import React, { KeyboardEvent, useMemo, useState } from 'react';
import starSendIcon from '../../imgs/star_icon.svg';
import stopIcon from '../../imgs/stop_icon.svg';

interface SkillCUIFooterProps {
  mode: 'generate' | 'generating';
  onSend: (content: string) => void;
  onStop: () => void;
}

export const SkillCUIFooter: React.FC<SkillCUIFooterProps> = ({
  mode,
  onSend,
  onStop,
}) => {
  const [value, setValue] = useState('');
  const isGenerating = mode === 'generating';
  const trimmedValue = value.trim();
  const isSendDisabled = !trimmedValue;

  const buttonLabel = isGenerating ? '停止生成' : '生成';
  const buttonIcon = isGenerating ? stopIcon : starSendIcon;
  const buttonClassName = useMemo(
    () => ([
      'skill-cui-footer__btn',
      isGenerating ? 'is-generating' : '',
      !isGenerating && isSendDisabled ? 'is-disabled' : '',
    ].filter(Boolean).join(' ')),
    [isGenerating, isSendDisabled],
  );

  const handleSend = () => {
    if (!trimmedValue || isGenerating) {
      return;
    }
    onSend(trimmedValue);
    setValue('');
  };

  const handleButtonClick = () => {
    if (isGenerating) {
      onStop();
      return;
    }
    handleSend();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (isGenerating) {
      onStop();
      return;
    }
    handleSend();
  };

  return (
    <div className="skill-cui-footer">
      {!isGenerating ? (
        <input
          type="text"
          className="skill-cui-footer__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="可输入要求进行调整"
        />
      ) : null}
      <button
        type="button"
        className={buttonClassName}
        onClick={handleButtonClick}
        disabled={!isGenerating && isSendDisabled}
      >
        <img className="skill-cui-footer__btn-icon" src={buttonIcon} alt="" draggable="false" />
        <span className="skill-cui-footer__btn-text">{buttonLabel}</span>
      </button>
    </div>
  );
};
