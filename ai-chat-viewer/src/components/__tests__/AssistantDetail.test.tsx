import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AssistantDetail from '../../pages/assistantDetail';
import type { WeAgentDetails } from '../../utils/hwext';

function createDetail(partnerAccount: string, overrides: Partial<WeAgentDetails> = {}): WeAgentDetails {
  return {
    name: `助理-${partnerAccount}`,
    icon: '',
    desc: `简介-${partnerAccount}`,
    moduleId: `M-${partnerAccount}`,
    appKey: `app-key-${partnerAccount}`,
    appSecret: `app-secret-${partnerAccount}`,
    partnerAccount,
    createdBy: `creator-${partnerAccount}`,
    creatorName: `创建者-${partnerAccount}`,
    creatorNameEn: `creator-${partnerAccount}`,
    ownerWelinkId: `owner-${partnerAccount}`,
    ownerName: `责任人-${partnerAccount}`,
    ownerNameEn: `owner-${partnerAccount}`,
    ownerDeptName: `部门-${partnerAccount}`,
    ownerDeptNameEn: `dept-${partnerAccount}`,
    bizRobotId: `robot-${partnerAccount}`,
    bizRobotName: `标签-${partnerAccount}`,
    bizRobotNameEn: `Tag-${partnerAccount}`,
    weCodeUrl: 'h5://123456/html/index.html',
    ...overrides,
  };
}

describe('AssistantDetail', () => {
  afterEach(() => {
    delete (window as any).Pedestal;
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
    window.location.hash = '';
  });

  it('uses props partnerAccount in PC environment', async () => {
    const detail = createDetail('pc_1');
    const callMethod = jest.fn((_method: string, payload: { funName: string; params: unknown }) => {
      if (payload.funName === 'getWeAgentDetails') {
        return { WeAgentDetailsArray: [detail] };
      }
      return undefined;
    });

    Object.defineProperty(window, 'Pedestal', {
      value: { callMethod },
      configurable: true,
      writable: true,
    });

    render(<AssistantDetail partnerAccount="  pc_1  " />);

    expect(screen.getByText('助理详情')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();
    expect(await screen.findByText('助理-pc_1')).toBeInTheDocument();
    expect(screen.getByText('标签-pc_1')).toBeInTheDocument();
    expect(screen.getByText('部门-pc_1')).toBeInTheDocument();
    expect(screen.getByText('责任人-pc_1')).toBeInTheDocument();

    expect(callMethod).toHaveBeenCalledWith(
      'method://agentSkills/handleSdk',
      expect.objectContaining({
        funName: 'getWeAgentDetails',
        params: { partnerAccounts: ['pc_1'] },
      }),
    );
  });

  it('does not request details in PC environment when props partnerAccount is missing', async () => {
    const callMethod = jest.fn();

    Object.defineProperty(window, 'Pedestal', {
      value: { callMethod },
      configurable: true,
      writable: true,
    });

    render(<AssistantDetail />);

    expect(screen.getByText('助理详情')).toBeInTheDocument();
    expect(screen.queryByText(/助理-/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(callMethod).not.toHaveBeenCalledWith(
        'method://agentSkills/handleSdk',
        expect.objectContaining({ funName: 'getWeAgentDetails' }),
      );
    });
  });

  it('uses query partnerAccount in non-PC environment', async () => {
    const detail = createDetail('mobile_1');
    const getWeAgentDetails = jest.fn(async () => ({ WeAgentDetailsArray: [detail] }));

    delete (window as any).Pedestal;
    Object.defineProperty(window, 'HWH5EXT', {
      value: { getWeAgentDetails },
      configurable: true,
      writable: true,
    });
    window.location.hash = '/assistantDetail?partnerAccount=mobile_1';

    render(<AssistantDetail partnerAccount="ignored_in_mobile" />);

    expect(screen.getByText('助理详情')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();
    expect(await screen.findByText('助理-mobile_1')).toBeInTheDocument();
    expect(screen.getByText('标签-mobile_1')).toBeInTheDocument();

    await waitFor(() => {
      expect(getWeAgentDetails).toHaveBeenCalledWith({ partnerAccount: 'mobile_1' });
    });
  });

  it('does not request details in non-PC environment when query partnerAccount is missing', async () => {
    const getWeAgentDetails = jest.fn();

    delete (window as any).Pedestal;
    Object.defineProperty(window, 'HWH5EXT', {
      value: { getWeAgentDetails },
      configurable: true,
      writable: true,
    });

    render(<AssistantDetail />);

    expect(screen.getByText('助理详情')).toBeInTheDocument();
    expect(screen.queryByText(/助理-/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(getWeAgentDetails).not.toHaveBeenCalled();
    });
  });

  it('re-requests details when props partnerAccount changes in PC environment', async () => {
    const getDetailByPartnerAccount = (partnerAccount: string) => createDetail(partnerAccount);
    const callMethod = jest.fn((_method: string, payload: { funName: string; params: { partnerAccounts?: string[] } }) => {
      if (payload.funName === 'getWeAgentDetails') {
        const account = payload.params.partnerAccounts?.[0] ?? '';
        return { WeAgentDetailsArray: [getDetailByPartnerAccount(account)] };
      }
      return undefined;
    });

    Object.defineProperty(window, 'Pedestal', {
      value: { callMethod },
      configurable: true,
      writable: true,
    });

    const { rerender } = render(<AssistantDetail partnerAccount="pc_1" />);

    expect(await screen.findByText('助理-pc_1')).toBeInTheDocument();

    rerender(<AssistantDetail partnerAccount="pc_2" />);

    expect(await screen.findByText('助理-pc_2')).toBeInTheDocument();
    expect(screen.queryByText('助理-pc_1')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(callMethod).toHaveBeenCalledWith(
        'method://agentSkills/handleSdk',
        expect.objectContaining({
          funName: 'getWeAgentDetails',
          params: { partnerAccounts: ['pc_2'] },
        }),
      );
    });
  });
});
