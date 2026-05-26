import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AssistantDetail from '../../pages/assistantDetail';
import i18n from '../../i18n/config';

function renderAssistantDetail(initialEntry = '/assistantDetail?partnerAccount=x00_1'): void {
  window.location.hash = initialEntry;
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/assistantDetail" element={<AssistantDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function installAssistantDetailMock(kind: 'internal' | 'internalMyAgent' | 'external'): jest.Mock {
  const getWeAgentDetails = jest.fn(() => {
    if (kind === 'internal' || kind === 'internalMyAgent') {
      return {
        weAgentDetailsArray: [
          {
            name: 'Assistant A',
            icon: '',
            desc: 'Internal assistant description',
            moduleId: 'M1000',
            appKey: 'app-key-1',
            appSecret: 'app-secret-1',
            partnerAccount: 'x00_1',
            createdBy: 'u1',
            creatorName: 'creator-zh',
            creatorWorkId: '10001',
            creatorW3Account: 'creator_w3',
            creatorNameEn: 'creator-en',
            ownerWelinkId: 'u2',
            ownerW3Account: 'owner_w3',
            ownerName: 'owner-zh',
            ownerNameEn: 'owner-en',
            ownerDeptName: 'dept-zh',
            ownerDeptNameEn: 'dept-en',
            id: 'robot_1',
            bizRobotId: '8041241',
            bizRobotTag: kind === 'internalMyAgent' ? 'myAgent' : '',
            bizRobotName: 'Staff Assistant',
            bizRobotNameEn: 'Staff Assistant',
            weCodeUrl: 'h5://123456/html/index.html',
          },
        ],
      };
    }

    return {
      weAgentDetailsArray: [
        {
          name: 'External Assistant',
          icon: '',
          desc: 'External assistant description',
          moduleId: 'M2000',
          appKey: 'external-app-key',
          appSecret: 'external-app-secret',
          partnerAccount: 'x00_1',
          createdBy: 'u1',
          creatorName: 'external-creator-zh',
          creatorWorkId: '',
          creatorW3Account: '',
          creatorNameEn: 'external-creator-en',
          ownerWelinkId: '',
          ownerW3Account: '',
          ownerName: '',
          ownerNameEn: '',
          ownerDeptName: '',
          ownerDeptNameEn: '',
          id: 'robot_2',
          bizRobotId: '',
          bizRobotTag: '',
          bizRobotName: '',
          bizRobotNameEn: '',
          weCodeUrl: 'h5://123456/html/index.html',
        },
      ],
    };
  });

  Object.defineProperty(window, 'HWH5EXT', {
    value: {
      getWeAgentDetails,
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'HWH5', {
    value: {
      navigateBack: jest.fn(),
      openWebview: jest.fn(),
    },
    configurable: true,
    writable: true,
  });

  return getWeAgentDetails;
}

describe('AssistantDetail', () => {
  beforeEach(() => {
    window.location.hash = '/assistantDetail?partnerAccount=x00_1';
    window.localStorage.setItem('language', '2052');
    void i18n.changeLanguage('zh');
    installAssistantDetailMock('internal');
  });

  afterEach(() => {
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
    window.location.hash = '';
    window.localStorage.removeItem('language');
  });

  it('renders assistant detail content and header actions', async () => {
    renderAssistantDetail();

    expect(screen.getByText(i18n.t('assistantDetail.title'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('common.back') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('common.service') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('assistantDetail.editAction') })).toBeInTheDocument();

    expect(await screen.findByText('Assistant A')).toBeInTheDocument();
    expect(await screen.findAllByText('Staff Assistant')).toHaveLength(2);
    expect(screen.getByText(i18n.t('assistantDetail.introTitle'))).toBeInTheDocument();
    expect(screen.getByText('Internal assistant description')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.creator'))).toBeInTheDocument();
    expect(screen.getByText('creator-zh creator_w3')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.capabilityProvider'))).toBeInTheDocument();
  });

  it('uses creatorNameEn with creatorW3Account when current language is english', async () => {
    window.localStorage.setItem('language', '1033');
    await i18n.changeLanguage('en');
    installAssistantDetailMock('internal');

    renderAssistantDetail();

    expect(await screen.findByText('creator-en creator_w3')).toBeInTheDocument();
  });

  it('hides creator row and shows exclusive assistant tag for internal myAgent assistant', async () => {
    installAssistantDetailMock('internalMyAgent');

    renderAssistantDetail();

    expect(await screen.findAllByText('专属助手')).toHaveLength(2);
    expect(screen.queryByText(i18n.t('assistantDetail.creator'))).not.toBeInTheDocument();
    expect(screen.queryByText('creator-zh creator_w3')).not.toBeInTheDocument();
  });

  it('requests my-agent detail without partnerAccount when type is myAgent on mobile', async () => {
    const getWeAgentDetails = installAssistantDetailMock('internalMyAgent');

    renderAssistantDetail('/assistantDetail?type=myAgent');

    expect(await screen.findByText('Assistant A')).toBeInTheDocument();
    expect(getWeAgentDetails).toHaveBeenCalledWith({});
  });

  it('renders appid and secret actions for external assistant', async () => {
    installAssistantDetailMock('external');

    renderAssistantDetail();

    expect(await screen.findByText('External Assistant')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.appId'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.secret'))).toBeInTheDocument();
    expect(screen.getByText('external-app-key')).toBeInTheDocument();
  });
});
