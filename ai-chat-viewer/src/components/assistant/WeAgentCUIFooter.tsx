import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import checkIcon from '../../imgs/check.svg';
import sendIcon from '../../imgs/send_icon.svg';
import stopIcon from '../../imgs/stop_icon.svg';
import '../../styles/WeAgentCUIFooter.less';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';

type SendShortcutMode = 'enter' | 'ctrlEnter';

interface ShortcutOption {
  mode: SendShortcutMode;
  label: string;
}

interface WeAgentCUIFooterProps {
  isPcMiniApp?: boolean;
  mode: 'generate' | 'generating' | 'regenerate';
  onSend: (message: string) => void;
  onStop: () => void;
  leftActions?: React.ReactNode;
}

const WeAgentCUIFooter: React.FC<WeAgentCUIFooterProps> = ({
  isPcMiniApp = false,
  mode,
  onSend,
  onStop,
  leftActions,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [shortcutMode, setShortcutMode] = useState<SendShortcutMode>('enter');
  const [isShortcutPopupOpen, setIsShortcutPopupOpen] = useState(false);
  const sendWrapRef = useRef<HTMLDivElement | null>(null);
  const isGenerating = mode === 'generating';
  const shortcutOptions = useMemo<ShortcutOption[]>(() => ([
    { mode: 'enter', label: t('weAgent.shortcut.enterSend') },
    { mode: 'ctrlEnter', label: t('weAgent.shortcut.ctrlEnterSend') },
  ]), [t]);
  const shortcutModeLabel = useMemo(
    () => (shortcutMode === 'enter' ? t('weAgent.shortcut.enterAction') : t('weAgent.shortcut.ctrlEnterAction')),
    [shortcutMode, t],
  );
  const sendButtonClassName = useMemo(
    () => ([
      'we-agent-cui-footer__send-btn',
      isGenerating ? 'we-agent-cui-footer__stop-btn' : '',
    ]
      .filter(Boolean)
      .join(' ')),
    [isGenerating],
  );
  const sendButtonLabel = isGenerating ? t('common.stop') : t('common.send');
  const sendButtonIcon = isGenerating ? stopIcon : sendIcon;

  useEffect(() => {
    if (!isPcMiniApp || !isShortcutPopupOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (sendWrapRef.current?.contains(target)) {
        return;
      }
      setIsShortcutPopupOpen(false);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [isPcMiniApp, isShortcutPopupOpen]);

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    onSend(trimmedValue);
    setValue('');
    setIsShortcutPopupOpen(false);
  };

  const handleMobileKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || isGenerating) {
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSend();
  };

  const handlePcKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || isGenerating) {
      return;
    }

    if (shortcutMode === 'enter') {
      if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      handleSend();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSend();
    }
  };

  const selectShortcutMode = (nextShortcutMode: SendShortcutMode) => {
    setShortcutMode(nextShortcutMode);
    setIsShortcutPopupOpen(false);
  };

  const handleSendButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    runButtonClickWithDebounce(event, () => {
      if (isGenerating) {
        onStop();
        return;
      }

      handleSend();
    });
  };

  const renderSendButton = () => (
    <button
      type="button"
      className={sendButtonClassName}
      onClick={handleSendButtonClick}
      disabled={isGenerating ? false : !value.trim()}
      aria-label={sendButtonLabel}
    >
      <img className="we-agent-cui-footer__send-icon" src={sendButtonIcon} alt="" />
    </button>
  );

  if (!isPcMiniApp) {
    return (
      <div className="we-agent-cui-footer">
        <input
          type="text"
          className="we-agent-cui-footer__input"
          placeholder={t('weAgent.inputPlaceholder')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleMobileKeyDown}
        />
        {renderSendButton()}
      </div>
    );
  }

  return (
    <div className="we-agent-cui-footer we-agent-cui-footer--pc">
      <textarea
        className="we-agent-cui-footer__input"
        placeholder={t('weAgent.inputPlaceholder')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handlePcKeyDown}
        rows={1}
      />
      <div className="we-agent-cui-footer__toolbar">
        <div className="we-agent-cui-footer__toolbar-left">{leftActions}</div>
        <div className="we-agent-cui-footer__toolbar-right">
          <div className="we-agent-cui-footer__send-wrap" ref={sendWrapRef}>
            {isShortcutPopupOpen ? (
              <div
                className="we-agent-cui-footer__shortcut-popup"
                role="menu"
                aria-label={t('weAgent.shortcut.settings')}
              >
                {shortcutOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    className={[
                      'we-agent-cui-footer__shortcut-item',
                      shortcutMode === option.mode ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={(event) => {
                      runButtonClickWithDebounce(event, () => {
                        selectShortcutMode(option.mode);
                      });
                    }}
                  >
                    <span className="we-agent-cui-footer__shortcut-check-slot">
                      {shortcutMode === option.mode ? (
                        <img className="we-agent-cui-footer__shortcut-check-icon" src={checkIcon} alt="" />
                      ) : null}
                    </span>
                    <span className="we-agent-cui-footer__shortcut-text">{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="we-agent-cui-footer__send-control">
              {renderSendButton()}
              <button
                type="button"
                className="we-agent-cui-footer__shortcut-arrow-btn"
                aria-label={shortcutModeLabel}
                onClick={(event) => {
                  runButtonClickWithDebounce(event, () => {
                    setIsShortcutPopupOpen((current) => !current);
                  });
                }}
              >
                <span
                  className={[
                    'we-agent-cui-footer__shortcut-arrow-icon',
                    isShortcutPopupOpen ? 'is-open' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeAgentCUIFooter;
