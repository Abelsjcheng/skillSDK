import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StartAssistant from '../../pages/startAssistant';

describe('StartAssistant', () => {
  afterEach(() => {
    delete (window as any).Pedestal;
  });

  it('renders mobile layout when not in pc miniapp', () => {
    Object.defineProperty(window, 'Pedestal', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <StartAssistant />
      </MemoryRouter>,
    );

    expect(screen.getByText('启动助理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建助理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '立即启用' })).toBeInTheDocument();
  });

  it('renders pc layout when in pc miniapp', () => {
    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: jest.fn((_method: string, payload: { funName: string; params: unknown }) => {
          if (payload.funName === 'getWeAgentList') {
            return { content: [] };
          }
          return undefined;
        }),
      },
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <StartAssistant />
      </MemoryRouter>,
    );

    expect(screen.getByText('启用助理')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '客服' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建助理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '立即启用' })).toBeInTheDocument();
  });
});
