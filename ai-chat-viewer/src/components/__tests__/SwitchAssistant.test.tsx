import { render, screen } from '@testing-library/react';
import SwitchAssistant from '../../pages/switchAssistant';
import * as constants from '../../constants';

describe('SwitchAssistant', () => {
  const callMethodMock = jest.fn();
  let isPcMiniAppSpy: jest.SpyInstance<boolean, []>;

  beforeEach(() => {
    isPcMiniAppSpy = jest.spyOn(constants, 'isPcMiniApp');
    isPcMiniAppSpy.mockReturnValue(false);

    callMethodMock.mockImplementation((_method: string, payload: { funName: string; params: unknown }) => {
      if (payload.funName === 'getWeAgentList') {
        return {
          content: [
            {
              name: '编程助手',
              icon: '',
              description: '设计师一枚，擅长代码实现与技术方案整理',
              partnerAccount: 'x00_1',
              bizRobotName: 'staffAssistant',
              bizRobotNameEn: 'staffAssistant',
              bizRobotTag: 'myAgent',
              robotId: '',
            },
          ],
        };
      }
      if (payload.funName === 'getWeAgentDetails') {
        return {
          weAgentDetailsArray: [
            {
              name: '编程助手',
              icon: '',
              desc: '设计师一枚，擅长代码实现与技术方案整理',
              moduleId: '',
              appKey: '',
              appSecret: '',
              partnerAccount: 'x00_1',
              createdBy: '',
              creatorName: '',
              creatorWorkId: '',
              creatorW3Account: '',
              creatorNameEn: '',
              ownerWelinkId: '',
              ownerW3Account: '',
              ownerName: '',
              ownerNameEn: '',
              ownerDeptName: '',
              ownerDeptNameEn: '',
              id: 'robot_1',
              bizRobotId: '',
              bizRobotTag: '',
              weCodeUrl: 'h5://123456/html/index.html',
            },
          ],
        };
      }
      if (payload.funName === 'openWeAgentCUI') {
        return { status: 'success' };
      }
      return undefined;
    });

    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: callMethodMock,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    isPcMiniAppSpy.mockRestore();
    delete (window as any).Pedestal;
    delete (window as any).HWH5EXT;
  });

  it('renders switch assistant page header and list items', async () => {
    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        getWeAgentList: jest.fn(async () => ({
          content: [
            {
              name: '编程助手',
              icon: '',
              description: '设计师一枚，擅长代码实现与技术方案整理',
              partnerAccount: 'x00_1',
              bizRobotName: 'staffAssistant',
              bizRobotNameEn: 'staffAssistant',
              bizRobotTag: 'myAgent',
              robotId: '',
            },
          ],
        })),
        getWeAgentDetails: jest.fn(async () => ({
          weAgentDetailsArray: [
            {
              name: '编程助手',
              icon: '',
              desc: '设计师一枚，擅长代码实现与技术方案整理',
              moduleId: '',
              appKey: '',
              appSecret: '',
              partnerAccount: 'x00_1',
              createdBy: '',
              creatorName: '',
              creatorWorkId: '',
              creatorW3Account: '',
              creatorNameEn: '',
              ownerWelinkId: '',
              ownerW3Account: '',
              ownerName: '',
              ownerNameEn: '',
              ownerDeptName: '',
              ownerDeptNameEn: '',
              id: 'robot_1',
              bizRobotId: '',
              bizRobotTag: 'myAgent',
              weCodeUrl: 'h5://123456/html/index.html',
            },
          ],
        })),
        openWeAgentCUI: jest.fn(async () => ({ status: 'success' })),
      },
      configurable: true,
      writable: true,
    });

    render(<SwitchAssistant />);

    expect(screen.getByText('切换助手')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消选择' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认切换' })).toBeInTheDocument();

    expect(await screen.findByText('编程助手')).toBeInTheDocument();
    expect(await screen.findByText('专属助手')).toBeInTheDocument();
    expect(await screen.findByText(/设计师一枚/)).toBeInTheDocument();
  });
});
