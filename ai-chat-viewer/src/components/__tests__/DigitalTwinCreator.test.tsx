import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { DigitalTwinCreator } from '../DigitalTwinCreator';

describe('DigitalTwinCreator', () => {
  const getAgentTypeMock = jest.fn();

  beforeEach(() => {
    getAgentTypeMock.mockReset();
    getAgentTypeMock.mockResolvedValue({
      content: [
        { name: '写作助手', icon: 'https://example.com/assistant-writing.png', bizRobotId: '8041241' },
        { name: '会议助手', icon: 'https://example.com/assistant-meeting.png', bizRobotId: '8041242' },
      ],
    });

    Object.defineProperty(window, 'getAgentType', {
      value: getAgentTypeMock,
      configurable: true,
      writable: true,
    });
  });

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

  it('calls window.createDigitalTwin with custom digital twin payload when clicking confirm', async () => {
    const createDigitalTwinMock = jest.fn();
    Object.defineProperty(window, 'createDigitalTwin', {
      value: createDigitalTwinMock,
      configurable: true,
      writable: true,
    });

    render(<DigitalTwinCreator />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '内部个人助理简介' } });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByLabelText('自定义助手'));
    const confirmButton = screen.getByRole('button', { name: '确定' });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    expect(createDigitalTwinMock).toHaveBeenCalledTimes(1);
    expect(createDigitalTwinMock).toHaveBeenCalledWith({
      name: '智能助手',
      icon: expect.any(String),
      description: '内部个人助理简介',
      weCrewType: 0,
    });
  });

  it('calls window.createDigitalTwin with internal digital twin payload and bizRobotId', async () => {
    const createDigitalTwinMock = jest.fn();
    Object.defineProperty(window, 'createDigitalTwin', {
      value: createDigitalTwinMock,
      configurable: true,
      writable: true,
    });

    render(<DigitalTwinCreator />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手2' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '内部类型测试' } });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.click(screen.getByLabelText('内部助手'));
    fireEvent.click(await screen.findByRole('button', { name: '写作助手' }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(createDigitalTwinMock).toHaveBeenCalledTimes(1);
    expect(createDigitalTwinMock).toHaveBeenCalledWith({
      name: '智能助手2',
      icon: expect.any(String),
      description: '内部类型测试',
      weCrewType: 1,
      bizRobotId: '8041241',
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
