import React from 'react';
import { render, screen } from '@testing-library/react';
import SwitchAssistant from '../../pages/switchAssistant';

describe('SwitchAssistant', () => {
  const callMethodMock = jest.fn();

  beforeEach(() => {
    callMethodMock.mockImplementation((_method: string, payload: { funName: string; params: unknown }) => {
      if (payload.funName === 'getWeAgentList') {
        return {
          content: [
            {
              name: '编程助理',
              icon: '',
              description: '设计师一枚，擅长代码实现与技术方案整理',
              partnerAccount: 'x00_1',
              bizRobotName: '某某助手',
              bizRobotNameEn: 'assistant',
            },
          ],
        };
      }
      if (payload.funName === 'getWeAgentDetails') {
        return {
          WeAgentDetailsArray: [
            {
              name: '编程助理',
              icon: '',
              desc: '设计师一枚，擅长代码实现与技术方案整理',
              moduleId: '',
              appKey: '',
              appSecret: '',
              partnerAccount: 'x00_1',
              createdBy: '',
              creatorName: '',
              creatorNameEn: '',
              ownerWelinkId: '',
              ownerName: '',
              ownerNameEn: '',
              ownerDeptName: '',
              ownerDeptNameEn: '',
              bizRobotId: '',
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
    delete (window as any).Pedestal;
  });

  it('renders switch assistant page header and list items', async () => {
    render(<SwitchAssistant />);

    expect(screen.getByText('切换助理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消选择' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认切换' })).toBeInTheDocument();

    expect(await screen.findByText('编程助理')).toBeInTheDocument();
    expect(await screen.findByText('某某助手')).toBeInTheDocument();
    expect(await screen.findByText(/设计师一枚/)).toBeInTheDocument();
  });
});
