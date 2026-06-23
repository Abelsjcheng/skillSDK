import { render, waitFor } from '@testing-library/react';
import SkillCUI from '../skillCUI';
import { reportCoreFlowError } from '../../utils/telemetry';

jest.mock('../../components/Content', () => ({
  Content: () => <div data-testid="content" />,
}));

jest.mock('../../components/skillCUI/SkillCUIFooter', () => ({
  SkillCUIFooter: () => <div data-testid="footer" />,
}));

jest.mock('../../components/skillCUI/SkillCUIHeader', () => ({
  SkillCUIHeader: () => <div data-testid="header" />,
}));

jest.mock('../../hooks/useIosKeyboardLift', () => ({
  useIosKeyboardLift: jest.fn(() => ({
    keyboardContainerStyle: {},
  })),
}));

jest.mock('../../hooks/useChatSession', () => ({
  useChatSession: jest.fn(() => ({
    messages: [],
    pendingAssistantPreview: {
      visible: false,
      welinkSessionId: null,
      startedAt: 0,
    },
    welinkSessionId: '',
    sessionStatus: 'idle',
    isGenerating: false,
    isLoadingHistory: false,
    hasMoreHistory: false,
    scrollToBottomSignal: 0,
    onLoadMoreHistory: jest.fn(),
    onQuestionAnswered: jest.fn(),
    onSend: jest.fn(),
    onStop: jest.fn(),
    onSendToIM: jest.fn(),
    onCopy: jest.fn(),
    resetTransientState: jest.fn(),
  })),
}));

jest.mock('../../utils/telemetry', () => ({
  installBrowserJsErrorTelemetry: jest.fn(() => jest.fn()),
  reportCoreFlowError: jest.fn(),
}));

jest.mock('../../utils/toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('../../utils/hwext', () => ({
  getQueryParam: jest.fn(() => ''),
}));

const mockReportCoreFlowError = reportCoreFlowError as jest.MockedFunction<typeof reportCoreFlowError>;

describe('SkillCUI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports missing welinkSessionId once for empty entry', async () => {
    render(<SkillCUI />);

    await waitFor(() => {
      expect(mockReportCoreFlowError).toHaveBeenCalledWith(
        'flow_skillcui_missing_param_error',
        'SkillCUI 缺少会话参数',
        expect.any(Error),
        expect.objectContaining({
          page: 'skillCUI',
          stage: 'missingWelinkSessionId',
        }),
      );
    });
  });
});
