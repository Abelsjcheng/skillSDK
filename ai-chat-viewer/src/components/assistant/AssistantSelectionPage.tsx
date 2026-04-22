import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/SwitchAssistant.less';
import closeIcon from '../../imgs/close_icon.svg';
import serviceIcon from '../../imgs/icon-service.svg';
import {
  dispatchAssistantCloseEvent,
  dispatchSwitchAssistantSelectEvent,
} from '../../utils/assistantHostBridge';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import AssistantCardList from './AssistantCardList';
import AssistantPageHeader, { type AssistantPageHeaderAction } from './AssistantPageHeader';
import type { AssistantSelectionPageProps } from '../../types/components';
import type { AssistantItem } from '../../types/assistant';

const EMPTY_ASSISTANT_LIST: AssistantItem[] = [];
const noop = () => {};

const AssistantSelectionPage: React.FC<AssistantSelectionPageProps> = ({
  title,
  isPcMiniApp = false,
  leftButtonText,
  rightButtonText,
  defaultSelectedAssistantId,
  onLeftButtonClick = noop,
  onRightButtonClick = noop,
  onService = noop,
  assistants,
  selectedAssistantId,
  onSelectAssistant,
  rightButtonDisabled = false,
}) => {
  const { t } = useTranslation();
  const assistantList = useMemo(() => assistants ?? EMPTY_ASSISTANT_LIST, [assistants]);
  const isSelectionControlled = selectedAssistantId !== undefined;
  const resolvedDefaultSelectedAssistantId = useMemo(
    () => defaultSelectedAssistantId ?? assistantList[0]?.id ?? '',
    [assistantList, defaultSelectedAssistantId],
  );

  const [internalSelectedAssistantId, setInternalSelectedAssistantId] = useState<string>(
    resolvedDefaultSelectedAssistantId,
  );

  useEffect(() => {
    if (isSelectionControlled) {
      return;
    }

    setInternalSelectedAssistantId(resolvedDefaultSelectedAssistantId);
  }, [isSelectionControlled, resolvedDefaultSelectedAssistantId]);

  const currentSelectedAssistantId = isSelectionControlled ? (selectedAssistantId ?? '') : internalSelectedAssistantId;

  const pcLeftActions = useMemo<AssistantPageHeaderAction[]>(
    () => [
      {
        label: t('common.service'),
        icon: serviceIcon,
        onClick: onService,
      },
    ],
    [onService, t],
  );

  const pcRightActions = useMemo<AssistantPageHeaderAction[]>(
    () => [
      {
        label: t('common.close'),
        icon: closeIcon,
        onClick: () => {
          dispatchAssistantCloseEvent();
        },
      },
    ],
    [t],
  );

  const handleSelectAssistant = (assistantId: string) => {
    if (!isSelectionControlled) {
      setInternalSelectedAssistantId(assistantId);
    }
    dispatchSwitchAssistantSelectEvent(assistantId);
    onSelectAssistant?.(assistantId);
  };

  return (
    <div
      className={`switch-assistant${isPcMiniApp ? ' switch-assistant--pc' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dispatchAssistantCloseEvent();
        }
      }}
    >
      <AssistantPageHeader
        title={title}
        isPcMiniApp={isPcMiniApp}
        onService={onService}
        pcLeftActions={isPcMiniApp ? pcLeftActions : undefined}
        pcRightActions={isPcMiniApp ? pcRightActions : undefined}
      />

      <main className="switch-assistant__content">
        <AssistantCardList
          assistants={assistantList}
          selectedAssistantId={currentSelectedAssistantId}
          onSelectAssistant={handleSelectAssistant}
        />
      </main>

      <footer className="switch-assistant__actions">
        <button
          type="button"
          className="switch-assistant__action-btn switch-assistant__action-btn--cancel"
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              onLeftButtonClick();
            });
          }}
        >
          {leftButtonText}
        </button>
        <button
          type="button"
          className="switch-assistant__action-btn switch-assistant__action-btn--confirm"
          onClick={(event) => {
            runButtonClickWithDebounce(event, () => {
              onRightButtonClick();
            });
          }}
          disabled={rightButtonDisabled}
        >
          {rightButtonText}
        </button>
      </footer>
    </div>
  );
};

export default AssistantSelectionPage;
