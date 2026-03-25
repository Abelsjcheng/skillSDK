import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { PersonalAssistantCreator } from '../PersonalAssistantCreator';

describe('PersonalAssistantCreator', () => {
  const getAgentTypeMock = jest.fn();

  beforeEach(() => {
    getAgentTypeMock.mockReset();
    getAgentTypeMock.mockResolvedValue([
      { name: '写作助手', icon: 'https://example.com/assistant-writing.png', bizRobotId: '8041241' },
      { name: '会议助手', icon: 'https://example.com/assistant-meeting.png', bizRobotId: '8041242' },
    ]);

    Object.defineProperty(window, 'getAgentType', {
      value: getAgentTypeMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'Pedestal', {
      value: {
        callMethod: jest.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  it('switches to step2 after filling required fields and clicking next', () => {
    render(<PersonalAssistantCreator />);

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '内部个人助理简介' } });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText(/请选择你的.*个人助理.*大脑：/)).toBeInTheDocument();
  });

  it('goes back to step1 when clicking previous button on step2', () => {
    render(<PersonalAssistantCreator />);

    fireEvent.click(screen.getByRole('listitem', { name: '选择默认头像 avatar-2' }));
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '智能助手' } });
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: '内部个人助理简介' } });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText(/请选择你的.*个人助理.*大脑：/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '上一步' }));
    expect(screen.getByLabelText('名称')).toHaveValue('智能助手');
    expect(screen.getByLabelText('简介')).toHaveValue('内部个人助理简介');
    expect(screen.getByRole('listitem', { name: '选择默认头像 avatar-2' })).toHaveClass('is-selected');
  });

  it('calls window.Pedestal.remote.getCurrentWindow().close when clicking close and cancel', () => {
    const closeMock = jest.fn();
    const pedestalMock = {
      callMethod: jest.fn(),
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

    render(<PersonalAssistantCreator />);

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

    render(<PersonalAssistantCreator />);

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

    render(<PersonalAssistantCreator />);

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
    expect(libSource).not.toContain('export { PersonalAssistantCreator };');

    const pageEntryPath = path.resolve(__dirname, '../../pages/createAssistant.tsx');
    expect(fs.existsSync(pageEntryPath)).toBe(true);
  });
});

