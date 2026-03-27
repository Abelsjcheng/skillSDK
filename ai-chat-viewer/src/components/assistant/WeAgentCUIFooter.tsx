import React, { KeyboardEvent, useState } from 'react';
import iconWeAgentSend from '../../imgs/icon-we-agent-send.svg';
import '../../styles/WeAgentCUIFooter.less';

interface WeAgentCUIFooterProps {
  onSend: (message: string) => void;
}

const WeAgentCUIFooter: React.FC<WeAgentCUIFooterProps> = ({ onSend }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    onSend(trimmedValue);
    setValue('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
        className="we-agent-cui-footer__send-btn"
        onClick={handleSend}
        disabled={!value.trim()}
        aria-label="发送"
      >
        <img
          className="we-agent-cui-footer__send-icon"
          src={iconWeAgentSend}
          alt=""
        />
      </button>
    </div>
  );
};

export default WeAgentCUIFooter;
