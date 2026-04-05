import { render, screen } from '@testing-library/react';
import AssistantDetail from '../../pages/assistantDetail';

describe('AssistantDetail', () => {
  beforeEach(() => {
    window.location.hash = '/assistantDetail?partnerAccount=x00_1';

    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: jest.fn((_method: string, payload: { funName: string; params: unknown }) => {
          if (payload.funName === 'getWeAgentDetails') {
            return {
              WeAgentDetailsArray: [
                {
                  name: '小咪',
                  icon: '',
                  desc: '你的全能AI生活助理',
                  moduleId: 'M1000',
                  appKey: 'app-key-1',
                  appSecret: 'app-secret-1',
                  partnerAccount: 'x00_1',
                  createdBy: 'u1',
                  creatorName: '小米',
                  creatorWorkId: '10001',
                  creatorNameEn: 'xiaomi',
                  ownerWelinkId: 'u2',
                  ownerName: '测试负责人',
                  ownerNameEn: 'tester',
                  ownerDeptName: '测试部门',
                  ownerDeptNameEn: 'test',
                  bizRobotId: '8041241',
                  bizRobotName: '员工助手',
                  bizRobotNameEn: 'Staff Assistant',
                  weCodeUrl: 'h5://123456/html/index.html',
                },
              ],
            };
          }
          return undefined;
        }),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (window as any).Pedestal;
    window.location.hash = '';
  });

  it('renders assistant detail content and header actions', async () => {
    render(<AssistantDetail />);

    expect(screen.getByText('助理详情')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();

    expect(await screen.findByText('小咪')).toBeInTheDocument();
    expect(await screen.findByText('员工助手')).toBeInTheDocument();
    expect(screen.getByText('助理简介')).toBeInTheDocument();
    expect(screen.getByText('你的全能AI生活助理')).toBeInTheDocument();
    expect(screen.getByText('创建者')).toBeInTheDocument();
    expect(screen.getByText('小米 u1')).toBeInTheDocument();
    expect(screen.getByText('部门')).toBeInTheDocument();
    expect(screen.getByText('责任人')).toBeInTheDocument();
    expect(screen.getByText('测试负责人 u2')).toBeInTheDocument();
  });

  it('renders appid and secret actions for external assistant', async () => {
    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: jest.fn((_method: string, payload: { funName: string; params: unknown }) => {
          if (payload.funName === 'getWeAgentDetails') {
            return {
              WeAgentDetailsArray: [
                {
                  name: '外部助理',
                  icon: '',
                  desc: '面向外部服务',
                  moduleId: 'M2000',
                  appKey: 'external-app-key',
                  appSecret: 'external-app-secret',
                  partnerAccount: 'x00_1',
                  createdBy: 'u1',
                  creatorName: '测试创建者',
                  creatorNameEn: 'creator',
                  ownerWelinkId: '',
                  ownerName: '',
                  ownerNameEn: '',
                  ownerDeptName: '',
                  ownerDeptNameEn: '',
                  bizRobotId: '',
                  bizRobotName: '',
                  bizRobotNameEn: '',
                  weCodeUrl: 'h5://123456/html/index.html',
                },
              ],
            };
          }
          return undefined;
        }),
      },
      configurable: true,
      writable: true,
    });

    render(<AssistantDetail />);

    expect(await screen.findByText('外部助理')).toBeInTheDocument();
    expect(screen.getByText('APPID')).toBeInTheDocument();
    expect(screen.getByText('密钥')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制APPID' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看密钥' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制密钥' })).toBeInTheDocument();
  });
});
