import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import checkIcon from '../../imgs/check.svg';
import deleteIcon from '../../imgs/delete.png';
import docIcon from '../../imgs/doc.png';
import fileUploadIcon from '../../imgs/fileUpload.png';
import sendIcon from '../../imgs/send_icon.svg';
import stopIcon from '../../imgs/stop_icon.svg';
import '../../styles/WeAgentCUIFooter.less';
import { useSlashCommandSuggest } from '../../hooks/useSlashCommandSuggest';
import type {
  SendShortcutMode,
  ShortcutOption,
  WeAgentCUIFooterProps,
} from '../../types/components';
import type { SlashCommandItem, SlashCommandToken } from '../../types/slashCommand';
import { uploadAgentFile } from '../../utils/agentFileUpload';
import { selectAgentFile } from '../../utils/agentFileSelect';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import { WeLog } from '../../utils/logger';
import { showToast } from '../../utils/toast';
import SlashCommandComposer, { SlashCommandComposerHandle } from './SlashCommandComposer';
import SlashCommandPanel from './SlashCommandPanel';

const MAX_SELECTED_FILES = 20;
interface SelectedUploadFile {
  id: string;
  filePath: string;
  name: string;
}

const WeAgentCUIFooter: React.FC<WeAgentCUIFooterProps> = ({
  isPcMiniApp = false,
  mode,
  ak = '',
  partnerAccount = '',
  onSend,
  onStop,
  leftActions,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [selectedSlashToken, setSelectedSlashToken] = useState<SlashCommandToken | null>(null);
  const [shortcutMode, setShortcutMode] = useState<SendShortcutMode>('enter');
  const [isShortcutPopupOpen, setIsShortcutPopupOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadFile[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [fileUploadTooltipPosition, setFileUploadTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const composerRef = useRef<SlashCommandComposerHandle | null>(null);
  const fileUploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const fileIdRef = useRef(0);
  const uploadRunIdRef = useRef(0);
  const stoppedUploadRunIdRef = useRef<number | null>(null);
  const slashTokenSpaceDeletedRef = useRef(false);
  const sendWrapRef = useRef<HTMLDivElement | null>(null);
  const isGenerating = mode === 'generating';
  const isBusy = isGenerating || isUploadingFiles;
  const slashSuggest = useSlashCommandSuggest({ ak, partnerAccount, isPcMiniApp });
  const fileUploadTooltipText = t('weAgent.fileUploadToolTip');
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
      isBusy ? 'we-agent-cui-footer__stop-btn' : '',
    ]
      .filter(Boolean)
      .join(' ')),
    [isBusy],
  );
  const sendButtonLabel = isBusy ? t('common.stop') : t('common.send');
  const sendButtonIcon = isBusy ? stopIcon : sendIcon;

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

  const handleSend = async () => {
    if (isBusy) {
      return;
    }

    const trimmedValue = value.trim();
    const filesToUpload = selectedFiles;
    if (!trimmedValue && filesToUpload.length === 0) {
      return;
    }

    if (filesToUpload.length === 0) {
      onSend(trimmedValue);
      setValue('');
      setIsShortcutPopupOpen(false);
      return;
    }

    const uploadRunId = uploadRunIdRef.current + 1;
    uploadRunIdRef.current = uploadRunId;
    stoppedUploadRunIdRef.current = null;
    setIsUploadingFiles(true);
    setIsShortcutPopupOpen(false);

    try {
      const uploadResults = await Promise.all(
        filesToUpload.map((selectedFile) => uploadAgentFile({
          fileName: selectedFile.name,
          filePath: selectedFile.filePath,
          uploadId: selectedFile.id,
        })),
      );

      if (stoppedUploadRunIdRef.current === uploadRunId) {
        return;
      }

      const umLinks = uploadResults
        .map((result) => result.umLink?.trim())
        .filter((umLink): umLink is string => Boolean(umLink));
      if (umLinks.length !== filesToUpload.length) {
        throw new Error('File upload result missing umLink');
      }

      const fileMessage = umLinks.join('');
      onSend(trimmedValue ? `${fileMessage}\n${trimmedValue}` : fileMessage);
      setValue('');
      setSelectedFiles([]);
    } catch (error) {
      if (stoppedUploadRunIdRef.current === uploadRunId) {
        return;
      }

      WeLog(`WeAgentCUIFooter upload files failed | error=${JSON.stringify(error)}`);
      showToast(t('weAgent.fileUploadFailed'));
    } finally {
      if (uploadRunIdRef.current === uploadRunId) {
        setIsUploadingFiles(false);
      }
    }
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
    if (event.nativeEvent.isComposing || isBusy) {
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
    void handleSend();
  };

  const handlePcKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || isBusy) {
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
      void handleSend();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSend();
    }
  };

  const selectShortcutMode = (nextShortcutMode: SendShortcutMode) => {
    setShortcutMode(nextShortcutMode);
    setIsShortcutPopupOpen(false);
  };

  const handleSendButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isUploadingFiles) {
      stoppedUploadRunIdRef.current = uploadRunIdRef.current;
      onStop();
      return;
    }

    if (isGenerating) {
      onStop();
      return;
    }

    runButtonClickWithDebounce(event, () => {
      void handleSend();
    });
  };

  const showFileUploadTooltip = () => {
    const button = fileUploadButtonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    setFileUploadTooltipPosition({
      left: rect.left + rect.width / 2,
      top: rect.top - 4,
    });
  };

  const hideFileUploadTooltip = () => {
    setFileUploadTooltipPosition(null);
  };

  const openFilePicker = async () => {
    if (isUploadingFiles) {
      return;
    }

    hideFileUploadTooltip();
    if (selectedFiles.length >= MAX_SELECTED_FILES) {
      return;
    }

    try {
      const selectedFile = await selectAgentFile();
      if (!selectedFile) {
        return;
      }

      fileIdRef.current += 1;
      setSelectedFiles((currentFiles) => {
        if (currentFiles.length >= MAX_SELECTED_FILES) {
          return currentFiles;
        }

        return [
          ...currentFiles,
          {
            id: `${selectedFile.filePath}-${fileIdRef.current}`,
            filePath: selectedFile.filePath,
            name: selectedFile.fileName,
          },
        ];
      });
    } catch (error) {
      WeLog(`WeAgentCUIFooter select file failed | error=${JSON.stringify(error)}`);
      showToast(t('weAgent.fileSelectFailed'));
    }
  };

  const deleteSelectedFile = (fileId: string) => {
    if (isUploadingFiles) {
      return;
    }

    setSelectedFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  };

  const footerClassName = useMemo(
    () => ([
      'we-agent-cui-footer',
      isPcMiniApp ? 'we-agent-cui-footer--pc' : '',
      selectedFiles.length > 0 ? 'we-agent-cui-footer--has-files' : '',
    ]
      .filter(Boolean)
      .join(' ')),
    [isPcMiniApp, selectedFiles.length],
  );

  const renderSendButton = () => (
    <button
      type="button"
      className={sendButtonClassName}
      onClick={handleSendButtonClick}
      disabled={isBusy ? false : (!value.trim() && selectedFiles.length === 0)}
      aria-label={sendButtonLabel}
    >
      <img className="we-agent-cui-footer__send-icon" src={sendButtonIcon} alt="" draggable="false" />
    </button>
  );

  const renderFileUploadButton = () => (
    <button
      ref={fileUploadButtonRef}
      type="button"
      className="we-agent-cui-footer__file-upload-btn"
      aria-label={t('weAgent.fileUpload')}
      onMouseEnter={showFileUploadTooltip}
      onMouseLeave={hideFileUploadTooltip}
      onFocus={showFileUploadTooltip}
      onBlur={hideFileUploadTooltip}
      onClick={openFilePicker}
      disabled={isUploadingFiles}
    >
      <img
        className="we-agent-cui-footer__file-upload-icon"
        src={fileUploadIcon}
        alt=""
        draggable="false"
      />
    </button>
  );


  const renderFilePreview = () => {
    if (selectedFiles.length === 0) {
      return null;
    }

    return (
      <div className="we-agent-cui-footer__file-list" aria-label={t('weAgent.selectedFiles')}>
        {selectedFiles.map((selectedFile) => (
          <div className="we-agent-cui-footer__file-card" key={selectedFile.id} title={selectedFile.name}>
            <img
              className="we-agent-cui-footer__file-card-thumb"
              src={docIcon}
              alt=""
              draggable="false"
            />
            <span className="we-agent-cui-footer__file-card-name">{selectedFile.name}</span>
            <button
              type="button"
              className="we-agent-cui-footer__file-card-delete"
              aria-label={`${t('common.delete')}${selectedFile.name}`}
              onClick={() => {
                deleteSelectedFile(selectedFile.id);
              }}
              disabled={isUploadingFiles}
            >
              <img
                className="we-agent-cui-footer__file-card-delete-icon"
                src={deleteIcon}
                alt=""
                draggable="false"
              />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="we-agent-cui-footer__file-list-upload"
          aria-label={t('weAgent.fileUpload')}
          onClick={openFilePicker}
          disabled={isUploadingFiles}
        >
          <img
            className="we-agent-cui-footer__file-list-upload-icon"
            src={fileUploadIcon}
            alt=""
            draggable="false"
          />
        </button>
      </div>
    );
  };

  const renderFileUploadTooltip = () => {
    if (!fileUploadTooltipPosition || typeof document === 'undefined') {
      return null;
    }

    return createPortal(
      <div
        className="we-agent-cui-footer__file-upload-tooltip"
        role="tooltip"
        style={{
          left: `${fileUploadTooltipPosition.left}px`,
          top: `${fileUploadTooltipPosition.top}px`,
        }}
      >
        {fileUploadTooltipText}
        <span className="we-agent-cui-footer__file-upload-tooltip-arrow" />
      </div>,
      document.body,
    );
  };

  const renderSlashPanel = () => (
    slashSuggest.isOpen ? (
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
      <>
        <div className={footerClassName}>
          {renderSlashPanel()}
          {renderFilePreview()}
          {renderFileUploadButton()}
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
        {renderFileUploadTooltip()}
      </>
    );
  }

  return (
    <>
      <div className={footerClassName}>
        {renderSlashPanel()}
        {renderFilePreview()}
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
          <div className="we-agent-cui-footer__toolbar-left">
            {renderFileUploadButton()}
            {leftActions}
          </div>
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
      {renderFileUploadTooltip()}
    </>
  );
};

export default WeAgentCUIFooter;




