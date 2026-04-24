import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StepBrainSelect } from '../StepBrainSelect';

const noop = () => {};

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

  it('defaults to selecting the first internal assistant and enables confirm', async () => {
    render(
      <StepBrainSelect
        onClose={noop}
        onCancel={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    const firstAssistantButton = await screen.findByRole('button', { name: '写作助手' });
    const confirmButton = screen.getByRole('button', { name: '确定' });

    expect(firstAssistantButton).toHaveClass('is-selected');
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton).toHaveClass('is-active');
    expect(screen.getByText('请选择AI能力提供方：')).toBeInTheDocument();
  });

  it('does not render provider tabs or subtitle anymore', async () => {
    render(
      <StepBrainSelect
        onClose={noop}
        onCancel={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText('内部提供方')).not.toBeInTheDocument();
    expect(screen.queryByText('自定义')).not.toBeInTheDocument();
    expect(screen.queryByText('请选择')).not.toBeInTheDocument();
  });

  it('marks the clicked internal assistant as selected', async () => {
    render(
      <StepBrainSelect
        onClose={noop}
        onCancel={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    const secondAssistantButton = await screen.findByRole('button', { name: '会议助手' });
    fireEvent.click(secondAssistantButton);

    expect(secondAssistantButton).toHaveClass('is-selected');
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled();
  });

  it('does not render cancel button on pc', async () => {
    render(
      <StepBrainSelect
        onClose={noop}
        onCancel={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    await screen.findByRole('button', { name: '写作助手' });
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });

  it('calls onPrev when clicking previous button', async () => {
    const onPrevMock = jest.fn();
    render(
      <StepBrainSelect
        onClose={noop}
        onCancel={noop}
        onPrev={onPrevMock}
        onConfirm={noop}
      />,
    );

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '上一步' }));
    expect(onPrevMock).toHaveBeenCalledTimes(1);
  });
});
