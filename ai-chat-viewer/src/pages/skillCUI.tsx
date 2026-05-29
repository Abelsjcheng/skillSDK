import React, { useEffect, useRef } from 'react';
import { Content } from '../components/Content';
import { SkillCUIFooter } from '../components/skillCUI/SkillCUIFooter';
import { SkillCUIHeader } from '../components/skillCUI/SkillCUIHeader';
import { isPcMiniApp } from '../constants';
import { useChatSession } from '../hooks/useChatSession';
import type { SkillCUIProps } from '../types/pages';
import { getQueryParam } from '../utils/hwext';
import { installBrowserJsErrorTelemetry } from '../utils/telemetry';
import { showToast } from '../utils/toast';
import '../styles/App.less';
import '../styles/SkillCUI.less';

  const SkillCUI: React.FC<SkillCUIProps> = ({ welinkSessionId: welinkSessionIdProp }) => {
  const emptySessionToastShownRef = useRef(false);
  const isPc = isPcMiniApp();
  const welinkSessionId = isPc
    ? (welinkSessionIdProp?.trim() || '')
    : (getQueryParam('welinkSessionId')?.trim() || '');
  const session = useChatSession({ mode: 'skillCUI', welinkSessionId });

  useEffect(() => {
    if (welinkSessionId) {
      emptySessionToastShownRef.current = false;
      return;
    }

    if (!emptySessionToastShownRef.current) {
      showToast('缺少 welinkSessionId');
      emptySessionToastShownRef.current = true;
    }
  }, [welinkSessionId]);

  useEffect(() => installBrowserJsErrorTelemetry(() => ({
    page: 'skillCUI',
    welinkSessionId: welinkSessionId || undefined,
  })), [welinkSessionId]);

  return (
    <div className="app-container skill-cui">
      <div className="header-wrapper">
        <SkillCUIHeader />
      </div>
      <div className="content-wrapper">
        {welinkSessionId ? (
          <Content
            messages={session.messages}
            pendingAssistantPreview={session.pendingAssistantPreview}
            welinkSessionId={session.welinkSessionId}
            messageVariant="plain"
            showMessageActions
            showWelcome={false}
            scrollToBottomSignal={session.scrollToBottomSignal}
            isLoadingHistory={session.isLoadingHistory}
            hasMoreHistory={session.hasMoreHistory}
            onLoadMoreHistory={session.onLoadMoreHistory}
            onQuestionAnswered={session.onQuestionAnswered}
            onCopy={session.onCopy}
            onSendToIM={session.onSendToIM}
          />
        ) : (
          <div className="skill-cui__empty-content" />
        )}
      </div>
      <div className="footer-wrapper">
        <SkillCUIFooter
          mode={session.isGenerating ? 'generating' : 'generate'}
          onSend={session.onSend}
          onStop={session.onStop}
        />
      </div>
    </div>
  );
};

export default SkillCUI;
