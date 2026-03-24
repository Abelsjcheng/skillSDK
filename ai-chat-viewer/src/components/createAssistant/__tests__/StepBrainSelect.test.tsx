import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StepBrainSelect } from '../StepBrainSelect';
import { BRAIN_ILLUSTRATION } from '../constants';

const Noop = () => {};

describe('StepBrainSelect', () => {
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
  });

  it('enables confirm when selecting custom brain', async () => {
    render(
      <StepBrainSelect
        illustration={BRAIN_ILLUSTRATION}
        onClose={Noop}
        onCancel={Noop}
        onPrev={Noop}
        onConfirm={Noop}
      />,
    );

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    const confirmButton = screen.getByRole('button', { name: '确定' });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('自定义助手'));
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton).toHaveClass('is-active');
  });

  it('keeps confirm disabled for internal brain before selecting an internal assistant', async () => {
    render(
      <StepBrainSelect
        illustration={BRAIN_ILLUSTRATION}
        onClose={Noop}
        onCancel={Noop}
        onPrev={Noop}
        onConfirm={Noop}
      />,
    );

    fireEvent.click(screen.getByLabelText('内部助手'));
    await screen.findByRole('button', { name: '写作助手' });

    const confirmButton = screen.getByRole('button', { name: '确定' });
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveClass('is-disabled');
  });

  it('enables confirm after selecting an internal assistant and marks selected style', async () => {
    render(
      <StepBrainSelect
        illustration={BRAIN_ILLUSTRATION}
        onClose={Noop}
        onCancel={Noop}
        onPrev={Noop}
        onConfirm={Noop}
      />,
    );

    fireEvent.click(screen.getByLabelText('内部助手'));
    const assistantButton = await screen.findByRole('button', { name: '写作助手' });
    fireEvent.click(assistantButton);

    expect(assistantButton).toHaveClass('is-selected');
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled();
  });

  it('calls onPrev when clicking previous button', () => {
    const onPrevMock = jest.fn();
    render(
      <StepBrainSelect
        illustration={BRAIN_ILLUSTRATION}
        onClose={Noop}
        onCancel={Noop}
        onPrev={onPrevMock}
        onConfirm={Noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '上一步' }));
    expect(onPrevMock).toHaveBeenCalledTimes(1);
  });
});
