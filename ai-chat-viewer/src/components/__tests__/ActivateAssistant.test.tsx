import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivateAssistant from '../../pages/activateAssistant';

describe('ActivateAssistant', () => {
  afterEach(() => {
    delete (window as any).Pedestal;
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
  });

  it('renders guide image and select button', async () => {
    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        getWeAgentList: jest.fn(async () => ({
          content: [{ name: '助手', icon: '', description: '', partnerAccount: 'x1', bizRobotName: '', bizRobotNameEn: '', bizRobotTag: '', robotId: '' }],
        })),
      },
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <ActivateAssistant />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: '选择助手' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '激活助手引导图' })).toBeInTheDocument();
  });

  it('shows service unavailable text and hides select button when list is empty', async () => {
    const openWebview = jest.fn();

    Object.defineProperty(window, 'HWH5EXT', {
      value: {
        getWeAgentList: jest.fn(async () => ({ content: [] })),
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'HWH5', {
      value: {
        openWebview,
        uem: jest.fn(),
      },
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <ActivateAssistant />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('暂未开通助手服务')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '选择助手' })).not.toBeInTheDocument();
    expect(openWebview).not.toHaveBeenCalled();
  });
});
