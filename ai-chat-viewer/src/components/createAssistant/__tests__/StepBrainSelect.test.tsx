import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getAgentType } from '../../../utils/hwext';
import { StepBrainSelect } from '../StepBrainSelect';

jest.mock('../../../utils/hwext', () => ({
  getAgentType: jest.fn(),
}));

const noop = () => {};
const getAgentTypeMock = getAgentType as jest.MockedFunction<typeof getAgentType>;

describe('StepBrainSelect', () => {
  beforeEach(() => {
    getAgentTypeMock.mockReset();
    getAgentTypeMock.mockResolvedValue({
      content: [
        { name: 'Writing Assistant', icon: 'https://example.com/assistant-writing.png', bizRobotId: '8041241' },
        { name: 'Meeting Assistant', icon: 'https://example.com/assistant-meeting.png', bizRobotId: '8041242' },
      ],
    });
  });

  it('defaults to selecting the first internal assistant and enables confirm', async () => {
    const { container } = render(
      <StepBrainSelect
        onClose={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    const firstAssistantButton = await screen.findByRole('button', { name: 'Writing Assistant' });
    const confirmButton = container.querySelector('.digital-twin__action-btn--confirm') as HTMLButtonElement | null;

    expect(firstAssistantButton).toHaveClass('is-selected');
    expect(confirmButton).not.toBeNull();
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton).toHaveClass('is-active');
  });

  it('does not render provider tabs or subtitle anymore', async () => {
    render(
      <StepBrainSelect
        onClose={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('marks the clicked internal assistant as selected', async () => {
    const { container } = render(
      <StepBrainSelect
        onClose={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    const secondAssistantButton = await screen.findByRole('button', { name: 'Meeting Assistant' });
    fireEvent.click(secondAssistantButton);

    const confirmButton = container.querySelector('.digital-twin__action-btn--confirm') as HTMLButtonElement | null;

    expect(secondAssistantButton).toHaveClass('is-selected');
    expect(confirmButton).not.toBeNull();
    expect(confirmButton).not.toBeDisabled();
  });

  it('does not render cancel button on pc', async () => {
    render(
      <StepBrainSelect
        onClose={noop}
        onPrev={noop}
        onConfirm={noop}
      />,
    );

    await screen.findByRole('button', { name: 'Writing Assistant' });
    expect(document.querySelectorAll('.digital-twin__action-btn--cancel')).toHaveLength(1);
  });

  it('calls onPrev when clicking previous button', async () => {
    const onPrevMock = jest.fn();
    const { container } = render(
      <StepBrainSelect
        onClose={noop}
        onPrev={onPrevMock}
        onConfirm={noop}
      />,
    );

    await waitFor(() => {
      expect(getAgentTypeMock).toHaveBeenCalledTimes(1);
    });

    const prevButton = container.querySelector('.digital-twin__action-btn--cancel') as HTMLButtonElement | null;
    expect(prevButton).not.toBeNull();

    fireEvent.click(prevButton as HTMLButtonElement);
    expect(onPrevMock).toHaveBeenCalledTimes(1);
  });
});
