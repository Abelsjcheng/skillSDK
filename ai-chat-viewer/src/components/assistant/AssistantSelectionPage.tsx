import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/SwitchAssistant.less';
import {
  dispatchAssistantCloseEvent,
  dispatchSwitchAssistantSelectEvent,
} from '../../utils/assistantHostBridge';
import { runButtonClickWithDebounce } from '../../utils/buttonDebounce';
import AssistantCardList from './AssistantCardList';
import AssistantPageHeader from './AssistantPageHeader';
import type { AssistantItem } from '../../types/assistant';

interface AssistantSelectionPageProps {
  title: string;
  isPcMiniApp?: boolean;
  leftButtonText: string;
  rightButtonText: string;
  defaultSelectedAssistantId?: string;
  onLeftButtonClick?: () => void;
  onRightButtonClick?: () => void;
  onService?: () => void;
  assistants?: AssistantItem[];
  selectedAssistantId?: string;
  onSelectAssistant?: (assistantId: string) => void;
  rightButtonDisabled?: boolean;
}

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
      <AssistantPageHeader title={title} isPcMiniApp={isPcMiniApp} onService={onService} />

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
