import React, { KeyboardEvent, useState } from 'react';
import iconWeAgentSend from '../../imgs/icon-we-agent-send.svg';
import iconWeAgentStop from '../../imgs/icon-we-agent-stop.svg';
import '../../styles/WeAgentCUIFooter.less';

interface WeAgentCUIFooterProps {
  mode: 'generate' | 'generating' | 'regenerate';
  onSend: (message: string) => void;
  onStop: () => void;
}

const WeAgentCUIFooter: React.FC<WeAgentCUIFooterProps> = ({ mode, onSend, onStop }) => {
  const [value, setValue] = useState('');
  const isGenerating = mode === 'generating';

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    onSend(trimmedValue);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isGenerating) {
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    handleSend();
  };

  return (
    <div className="we-agent-cui-footer">
      <input
        type="text"
        className="we-agent-cui-footer__input"
        placeholder="有问题尽管问我~"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className={[
          'we-agent-cui-footer__send-btn',
          isGenerating ? 'we-agent-cui-footer__stop-btn' : '',
        ].filter(Boolean).join(' ')}
        onClick={isGenerating ? onStop : handleSend}
        disabled={isGenerating ? false : !value.trim()}
        aria-label={isGenerating ? '停止' : '发送'}
      >
        <img
          className="we-agent-cui-footer__send-icon"
          src={isGenerating ? iconWeAgentStop : iconWeAgentSend}
          alt=""
        />
      </button>
    </div>
  );
};

export default WeAgentCUIFooter;
