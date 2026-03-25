import React from 'react';
import { render, screen } from '@testing-library/react';
import SwitchAssistant from '../../pages/switchAssistant';

describe('SwitchAssistant', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: jest.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (window as any).Pedestal;
  });

  it('renders switch assistant page header and list items', () => {
    render(<SwitchAssistant />);

    expect(screen.getByText('切换助理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消选择' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认切换' })).toBeInTheDocument();

    expect(screen.getAllByText('编程助理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('某某助手').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/设计师一枚/).length).toBeGreaterThan(0);
  });
});
