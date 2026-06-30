import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import checkIcon from '../../imgs/check.svg';
import sendIcon from '../../imgs/send_icon.svg';
import stopIcon from '../../imgs/stop_icon.svg';
import '../../styles/WeAgentCUIFooter.less';
import { useSlashCommandSuggest } from '../../hooks/useSlashCommandSuggest';
import type {
  SendShortcutMode,
  ShortcutOption,
  SlashCommandComposerHandle,
  WeAgentCUIFooterProps,
} from '../../types/components';
import type { SlashCommandItem, SlashCommandToken } from '../../types/slashCommand';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import SlashCommandComposer from './SlashCommandComposer';
import SlashCommandPanel from './SlashCommandPanel';

const WeAgentCUIFooter: React.FC<WeAgentCUIFooterProps> = ({
  isPcMiniApp = false,
  mode,
  partnerAccount = '',
  slashCommands = [],
  onRequestSlashCommands,
  onSend,
  onStop,
  leftActions,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [selectedSlashToken, setSelectedSlashToken] = useState<SlashCommandToken | null>(null);
  const [shortcutMode, setShortcutMode] = useState<SendShortcutMode>('enter');
  const [isShortcutPopupOpen, setIsShortcutPopupOpen] = useState(false);
  const composerRef = useRef<SlashCommandComposerHandle | null>(null);
  const slashTokenSpaceDeletedRef = useRef(false);
  const sendWrapRef = useRef<HTMLDivElement | null>(null);
  const isGenerating = mode === 'generating';
  const slashSuggest = useSlashCommandSuggest({
    partnerAccount,
    isPcMiniApp,
    slashCommands,
    onRequestCommands: onRequestSlashCommands,
  });
  const isSlashPanelOpen = slashSuggest.isOpen;
  const closeSlashPanel = slashSuggest.close;
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

  useEffect(() => {
    if (!isSlashPanelOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        target instanceof Element
        && target.closest('.we-agent-cui-footer__slash-panel, .we-agent-cui-footer__input')
      ) {
        return;
      }
      closeSlashPanel();
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [closeSlashPanel, isSlashPanelOpen]);

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    onSend(trimmedValue);
    setValue('');
    setIsShortcutPopupOpen(false);
  };

  const setComposerCursor = (cursor: number) => {
    composerRef.current?.setCursor(cursor);
    composerRef.current?.focus();
    window.requestAnimationFrame(() => {
      composerRef.current?.setCursor(cursor);
      composerRef.current?.focus();
    });
  };

  const handleInputValueChange = (nextValue: string, cursor: number) => {
    if (
      selectedSlashToken
      && nextValue.slice(selectedSlashToken.start, selectedSlashToken.end) !== selectedSlashToken.command
    ) {
      setSelectedSlashToken(null);
      slashTokenSpaceDeletedRef.current = false;
    }
    setValue(nextValue);
    slashSuggest.handleValueChange(nextValue, cursor);
  };

  const selectSlashCommand = (command?: SlashCommandItem) => {
    const result = slashSuggest.selectCommand(value, command);
    if (!result) {
      return false;
    }
    setValue(result.value);
    setSelectedSlashToken(result.token);
    slashTokenSpaceDeletedRef.current = false;
    setComposerCursor(result.cursor);
    return true;
  };

  const deleteSelectedSlashToken = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (!selectedSlashToken || (event.key !== 'Backspace' && event.key !== 'Delete')) {
      return false;
    }

    const selectionRange = composerRef.current?.getSelectionRange() ?? { start: value.length, end: value.length };
    const rangeStart = selectionRange.start;
    const rangeEnd = selectionRange.end;
    const tokenStart = selectedSlashToken.start;
    const tokenEnd = selectedSlashToken.end;
    const isCollapsedSelection = rangeStart === rangeEnd;
    const isBackspaceOnTokenWithOnlySpace = event.key === 'Backspace'
      && value === `${selectedSlashToken.command} `;
    if (isBackspaceOnTokenWithOnlySpace) {
      event.preventDefault();
      const nextValue = selectedSlashToken.command;
      slashTokenSpaceDeletedRef.current = true;
      setValue(nextValue);
      slashSuggest.close();
      setComposerCursor(tokenEnd);
      return true;
    }
    const isBackspaceAfterTokenSpace = event.key === 'Backspace'
      && isCollapsedSelection
      && rangeStart === tokenEnd + 1
      && value[tokenEnd] === ' ';
    if (isBackspaceAfterTokenSpace && !slashTokenSpaceDeletedRef.current) {
      event.preventDefault();
      const nextValue = `${value.slice(0, tokenEnd)}${value.slice(tokenEnd + 1)}`;
      slashTokenSpaceDeletedRef.current = true;
      setValue(nextValue);
      slashSuggest.close();
      setComposerCursor(tokenEnd);
      return true;
    }
    const isDeletingBareToken = value === selectedSlashToken.command;
    if (isDeletingBareToken) {
      event.preventDefault();
      const nextValue = `${value.slice(0, tokenStart)}${value.slice(tokenEnd)}`;
      setValue(nextValue);
      setSelectedSlashToken(null);
      slashTokenSpaceDeletedRef.current = false;
      slashSuggest.close();
      setComposerCursor(tokenStart);
      return true;
    }
    const cursorTouchesToken = event.key === 'Backspace'
      ? isCollapsedSelection && rangeStart > tokenStart && rangeStart <= tokenEnd + 1
      : isCollapsedSelection && rangeStart >= tokenStart && rangeStart < tokenEnd;
    const selectionCoversToken = rangeStart <= tokenStart && rangeEnd >= tokenEnd;

    if (!cursorTouchesToken && !selectionCoversToken) {
      return false;
    }

    event.preventDefault();
    const tokenRemoveEnd = slashTokenSpaceDeletedRef.current && value[tokenEnd] === ' '
      ? tokenEnd + 1
      : tokenEnd;
    const nextValue = `${value.slice(0, tokenStart)}${value.slice(tokenRemoveEnd)}`;
    setValue(nextValue);
    setSelectedSlashToken(null);
    slashTokenSpaceDeletedRef.current = false;
    slashSuggest.close();
    setComposerCursor(tokenStart);
    return true;
  };

  const handleSlashKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!slashSuggest.isOpen) {
      return false;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      slashSuggest.close();
      return true;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      slashSuggest.moveHighlight(1);
      return true;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      slashSuggest.moveHighlight(-1);
      return true;
    }

    if (event.key === 'Enter' && slashSuggest.highlightedIndex >= 0) {
      event.preventDefault();
      return selectSlashCommand();
    }

    return false;
  };

  const handleMobileKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || isGenerating) {
      return;
    }

    if (handleSlashKeyDown(event)) {
      return;
    }

    if (deleteSelectedSlashToken(event)) {
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSend();
  };

  const handlePcKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || isGenerating) {
      return;
    }

    if (handleSlashKeyDown(event)) {
      return;
    }

    if (deleteSelectedSlashToken(event)) {
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
      <img className="we-agent-cui-footer__send-icon" src={sendButtonIcon} alt="" draggable="false" />
    </button>
  );

  const renderSlashPanel = () => (
    isSlashPanelOpen ? (
      <SlashCommandPanel
        commands={slashSuggest.filteredCommands}
        highlightedIndex={slashSuggest.highlightedIndex}
        onSelect={(command) => {
          selectSlashCommand(command);
        }}
      />
    ) : null
  );

  if (!isPcMiniApp) {
    return (
      <div className="we-agent-cui-footer">
        {renderSlashPanel()}
        <SlashCommandComposer
          ref={composerRef}
          className="we-agent-cui-footer__input"
          isPcMiniApp={false}
          placeholder={t('weAgent.inputPlaceholder')}
          value={value}
          slashToken={selectedSlashToken}
          onChange={handleInputValueChange}
          onKeyDown={handleMobileKeyDown}
        />
        {renderSendButton()}
      </div>
    );
  }

  return (
    <div className="we-agent-cui-footer we-agent-cui-footer--pc">
      {renderSlashPanel()}
      <SlashCommandComposer
        ref={composerRef}
        className="we-agent-cui-footer__input"
        isPcMiniApp
        placeholder={t('weAgent.inputPlaceholder')}
        value={value}
        slashToken={selectedSlashToken}
        onChange={handleInputValueChange}
        onKeyDown={handlePcKeyDown}
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
                        <img className="we-agent-cui-footer__shortcut-check-icon" src={checkIcon} alt="" draggable="false" />
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
