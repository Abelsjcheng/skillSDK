import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivateAssistant from '../../pages/activateAssistant';

describe('ActivateAssistant', () => {
  afterEach(() => {
    delete (window as any).Pedestal;
    delete (window as any).HWH5EXT;
    delete (window as any).HWH5;
  });

  it('renders guide image and select button', () => {
    render(
      <MemoryRouter>
        <ActivateAssistant />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '选择助手' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '激活助手引导图' })).toBeInTheDocument();
  });

  it('opens select assistant page instead of create assistant page when list is empty', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: '选择助手' }));

    await waitFor(() => {
      expect(openWebview).toHaveBeenCalledWith({
        uri: expect.stringContaining('#selectAssistant'),
      });
    });
    expect(openWebview).not.toHaveBeenCalledWith({
      uri: expect.stringContaining('#createAssistant'),
    });
  });
});
