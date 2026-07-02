import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AssistantDetail from '../../pages/assistantDetail';
import i18n from '../../i18n/config';

function renderAssistantDetail(): void {
  render(
    <MemoryRouter initialEntries={['/assistantDetail?partnerAccount=x00_1']}>
      <Routes>
        <Route path="/assistantDetail" element={<AssistantDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function installAssistantDetailMock(kind: 'internal' | 'internalMyAgent' | 'external' | 'externalEmpty'): void {
  Object.defineProperty(window, 'HWH5EXT', {
    value: {
      getWeAgentDetails: jest.fn(() => {
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
              desc: kind === 'externalEmpty' ? '' : 'External assistant description',
              moduleId: 'M2000',
              appKey: kind === 'externalEmpty' ? '' : 'external-app-key',
              appSecret: kind === 'externalEmpty' ? '' : 'external-app-secret',
              partnerAccount: 'x00_1',
              createdBy: 'u1',
              creatorName: kind === 'externalEmpty' ? '' : 'external-creator-zh',
              creatorWorkId: '',
              creatorW3Account: '',
              creatorNameEn: kind === 'externalEmpty' ? '' : 'external-creator-en',
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
      }),
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'HWH5', {
    value: {
      addEventListener: jest.fn(),
      navigateBack: jest.fn(),
      openWebview: jest.fn(),
    },
    configurable: true,
    writable: true,
  });
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

  it('renders as an exported component without router context', async () => {
    render(<AssistantDetail partnerAccount="x00_1" />);

    expect(await screen.findByText('Assistant A')).toBeInTheDocument();
  });

  it('uses creatorNameEn with creatorW3Account when current language is english', async () => {
    window.localStorage.setItem('language', '1033');
    await i18n.changeLanguage('en');
    installAssistantDetailMock('internal');

    renderAssistantDetail();

    expect(await screen.findByText('creator-en creator_w3')).toBeInTheDocument();
  });

  it('hides creator row and capability provider for internal myAgent assistant', async () => {
    installAssistantDetailMock('internalMyAgent');

    renderAssistantDetail();

    expect(await screen.findAllByText('专属助手')).toHaveLength(1);
    expect(screen.queryByText(i18n.t('assistantDetail.creator'))).not.toBeInTheDocument();
    expect(screen.queryByText('creator-zh creator_w3')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('assistantDetail.capabilityProvider'))).not.toBeInTheDocument();
  });

  it('renders appid and secret actions for external assistant', async () => {
    installAssistantDetailMock('external');

    renderAssistantDetail();

    expect(await screen.findByText('External Assistant')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.appId'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.secret'))).toBeInTheDocument();
    expect(screen.getByText('external-app-key')).toBeInTheDocument();
  });

  it('renders info rows only when detail values exist', async () => {
    installAssistantDetailMock('externalEmpty');

    renderAssistantDetail();

    expect(await screen.findByText('External Assistant')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('assistantDetail.creator'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('assistantDetail.appId'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('assistantDetail.secret'))).not.toBeInTheDocument();
    expect(screen.queryByText('External assistant description')).not.toBeInTheDocument();
  });
});
