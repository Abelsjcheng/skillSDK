import React, { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import '../styles/Footer.less';

interface FooterProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const Footer: React.FC<FooterProps> = ({
  onSend,
  onStop,
  isGenerating,
  disabled = false,
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isGenerating) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, isGenerating, onSend]);

  const handlePrimaryAction = useCallback(() => {
    if (isGenerating) {
      onStop();
      return;
    }
    handleSend();
  }, [isGenerating, onStop, handleSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating) {
        handleSend();
      }
    }
  }, [isGenerating, handleSend]);

  const inputDisabled = disabled || isGenerating;
  const buttonDisabled = disabled || (!isGenerating && !value.trim());

  return (
    <div className="footer-container">
      <textarea
        ref={textareaRef}
        className="footer-input"
        placeholder={isGenerating ? 'AI 正在生成中...' : '请输入您的问题...'}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={inputDisabled}
      />
      <button
        className={`send-icon-btn ${isGenerating ? 'stop-mode' : ''}`}
        onClick={handlePrimaryAction}
        disabled={buttonDisabled}
        title={isGenerating ? '停止生成' : '生成'}
        type="button"
      >
        <span className="send-btn-text">{isGenerating ? '停止生成' : '生成'}</span>
      </button>
    </div>
  );
};

export default Footer;
