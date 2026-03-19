import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { DigitalTwinCreator } from '../DigitalTwinCreator';

describe('DigitalTwinCreator', () => {
  it('switches to step2 after filling required fields and clicking next', () => {
    render(<DigitalTwinCreator />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '内部个人助理简介' } });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText(/请选择你的.*个人助理.*大脑：/)).toBeInTheDocument();
  });

  it('calls window.Pedestal.remote.getCurrentWindow().close when clicking close and cancel', () => {
    const closeMock = jest.fn();
    const pedestalMock = {
      remote: {
        getCurrentWindow: () => ({
          close: closeMock,
        }),
      },
    };
    Object.defineProperty(window, 'Pedestal', {
      value: pedestalMock,
      configurable: true,
      writable: true,
    });

    render(<DigitalTwinCreator />);

    fireEvent.click(screen.getByRole('button', { name: '关闭创建个人助理' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(closeMock).toHaveBeenCalledTimes(2);
  });

  it('calls window.create with custom digital twin payload when clicking confirm', () => {
    const createMock = jest.fn();
    Object.defineProperty(window, 'create', {
      value: createMock,
      configurable: true,
      writable: true,
    });

    render(<DigitalTwinCreator />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '内部个人助理简介' } });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.click(screen.getByLabelText('自定义助手'));
    const confirmButton = screen.getByRole('button', { name: '确定' });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      name: '智能助手',
      icon: expect.any(String),
      description: '内部个人助理简介',
      digitalTwintype: 'custom',
    });
  });

  it('calls window.create with internal digital twin payload and agent field', () => {
    const createMock = jest.fn();
    Object.defineProperty(window, 'create', {
      value: createMock,
      configurable: true,
      writable: true,
    });

    render(<DigitalTwinCreator />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手2' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '内部类型测试' } });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.click(screen.getByLabelText('内部助手'));
    fireEvent.click(screen.getByRole('button', { name: /写作助手/i }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      name: '智能助手2',
      icon: expect.any(String),
      description: '内部类型测试',
      digitalTwintype: 'internal',
      agent: '助手分身',
    });
  });

  it('is not exported from lib entry and has standalone page entry', () => {
    const libFilePath = path.resolve(__dirname, '../../lib/index.ts');
    const libSource = fs.readFileSync(libFilePath, 'utf8');
    expect(libSource).not.toContain('export { DigitalTwinCreator };');

    const pageEntryPath = path.resolve(__dirname, '../../pages/digital-twin/index.tsx');
    expect(fs.existsSync(pageEntryPath)).toBe(true);
  });
});

