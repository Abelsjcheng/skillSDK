import React, { useState, KeyboardEvent, useEffect, useRef } from 'react';
import '../styles/Footer.less';

interface FooterProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const Footer: React.FC<FooterProps> = ({ onSend, disabled = false }) => {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (isFocused && inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFocused]);

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (trimmedValue && !disabled) {
      onSend(trimmedValue);
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={`footer-container ${isFocused ? 'footer-focused' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        className="footer-input"
        placeholder="请输入您的问题..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
      />
      <button 
        className="send-icon-btn" 
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        title="生成"
      >
        <svg 
          className="send-icon" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
        <span className="send-btn-text">生成</span>
      </button>
    </div>
  );
};

export default Footer;
