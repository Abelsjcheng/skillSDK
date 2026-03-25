import React from 'react';
import { render, screen } from '@testing-library/react';
import AssistantDetail from '../../pages/assistantDetail';

describe('AssistantDetail', () => {
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

  it('renders assistant detail content and header actions', () => {
    render(<AssistantDetail />);

    expect(screen.getByText('助理详情')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客服' })).toBeInTheDocument();

    expect(screen.getByText('小咪')).toBeInTheDocument();
    expect(screen.getByText('员工助手')).toBeInTheDocument();
    expect(screen.getByText('助理简介')).toBeInTheDocument();
    expect(screen.getByText('你的全能AI生活助理')).toBeInTheDocument();
    expect(screen.getByText('创建者')).toBeInTheDocument();
    expect(screen.getByText('小米')).toBeInTheDocument();
    expect(screen.getByText('部门')).toBeInTheDocument();
    expect(screen.getByText('责任人')).toBeInTheDocument();
  });
});
