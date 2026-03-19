import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StepBrainSelect } from '../StepBrainSelect';
import { BRAIN_ILLUSTRATION, INTERNAL_ASSISTANTS } from '../constants';

const Noop = () => {};

describe('StepBrainSelect', () => {
  it('enables confirm when selecting custom brain', () => {
    render(
      <StepBrainSelect
        illustration={BRAIN_ILLUSTRATION}
        internalAssistants={INTERNAL_ASSISTANTS}
        onClose={Noop}
        onCancel={Noop}
        onConfirm={Noop}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: '确定' });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('自定义助手'));
    expect(confirmButton).not.toBeDisabled();
    expect(confirmButton).toHaveClass('is-active');
  });

  it('keeps confirm disabled for internal brain before selecting an internal assistant', () => {
    render(
      <StepBrainSelect
        illustration={BRAIN_ILLUSTRATION}
        internalAssistants={INTERNAL_ASSISTANTS}
        onClose={Noop}
        onCancel={Noop}
        onConfirm={Noop}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: '确定' });
    fireEvent.click(screen.getByLabelText('内部助手'));

    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveClass('is-disabled');
  });

  it('enables confirm after selecting an internal assistant and marks selected style', () => {
    render(
      <StepBrainSelect
        illustration={BRAIN_ILLUSTRATION}
        internalAssistants={INTERNAL_ASSISTANTS}
        onClose={Noop}
        onCancel={Noop}
        onConfirm={Noop}
      />,
    );

    fireEvent.click(screen.getByLabelText('内部助手'));
    const assistantButton = screen.getByRole('button', { name: /写作助手/i });
    fireEvent.click(assistantButton);

    expect(assistantButton).toHaveClass('is-selected');
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled();
  });
});
