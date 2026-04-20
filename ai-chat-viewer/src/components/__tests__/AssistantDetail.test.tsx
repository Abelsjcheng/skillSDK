import { render, screen } from '@testing-library/react';
import AssistantDetail from '../../pages/assistantDetail';
import i18n from '../../i18n/config';

function installAssistantDetailMock(kind: 'internal' | 'external'): void {
  Object.defineProperty(window, 'Pedestal', {
    value: {
      callMethod: jest.fn((_method: string, payload: { funName: string; params: unknown }) => {
        if (payload.funName !== 'getWeAgentDetails') {
          return undefined;
        }

        if (kind === 'internal') {
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
                bizRobotTag: '',
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
      }),
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
    delete (window as any).Pedestal;
    window.location.hash = '';
    window.localStorage.removeItem('language');
  });

  it('renders assistant detail content and header actions', async () => {
    render(<AssistantDetail />);

    expect(screen.getByText(i18n.t('assistantDetail.title'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('common.close') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('common.service') })).toBeInTheDocument();

    expect(await screen.findByText('Assistant A')).toBeInTheDocument();
    expect(await screen.findAllByText('Staff Assistant')).toHaveLength(2);
    expect(screen.getByText(i18n.t('assistantDetail.introTitle'))).toBeInTheDocument();
    expect(screen.getByText('Internal assistant description')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.creator'))).toBeInTheDocument();
    expect(screen.getByText('creator-zh u1')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.capabilityProvider'))).toBeInTheDocument();
  });

  it('uses creatorNameEn when current language is english', async () => {
    window.localStorage.setItem('language', '1033');
    await i18n.changeLanguage('en');
    installAssistantDetailMock('internal');

    render(<AssistantDetail />);

    expect(await screen.findByText('creator-en u1')).toBeInTheDocument();
  });

  it('renders appid and secret actions for external assistant', async () => {
    installAssistantDetailMock('external');

    render(<AssistantDetail />);

    expect(await screen.findByText('External Assistant')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.appId'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('assistantDetail.secret'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('assistantDetail.copyAppId') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('assistantDetail.showSecret') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('assistantDetail.copySecret') })).toBeInTheDocument();
  });
});
