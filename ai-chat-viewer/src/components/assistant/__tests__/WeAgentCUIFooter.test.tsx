import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import WeAgentCUIFooter from '../WeAgentCUIFooter';

function renderPcFooter() {
  return render(
    <WeAgentCUIFooter
      isPcMiniApp
      mode="generate"
      onSend={jest.fn()}
      onStop={jest.fn()}
    />,
  );
}

function attachDataTransfer(event: Event, dataTransfer: DataTransfer): void {
  Object.defineProperty(event, 'dataTransfer', {
    value: dataTransfer,
  });
}

describe('WeAgentCUIFooter', () => {
  it('prevents dropping files into the pc textarea', () => {
    renderPcFooter();

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'existing text' } });

    const dragOverEvent = createEvent.dragOver(textarea);
    attachDataTransfer(dragOverEvent, {
      files: [new File(['demo'], 'demo.txt', { type: 'text/plain' })],
      types: ['Files'],
    } as unknown as DataTransfer);

    fireEvent(textarea, dragOverEvent);

    const dropEvent = createEvent.drop(textarea);
    attachDataTransfer(dropEvent, {
      files: [new File(['demo'], 'demo.txt', { type: 'text/plain' })],
      types: ['Files'],
    } as unknown as DataTransfer);

    fireEvent(textarea, dropEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(dropEvent.defaultPrevented).toBe(true);
    expect(textarea).toHaveValue('existing text');
  });

  it('does not block non-file drops into the pc textarea', () => {
    renderPcFooter();

    const textarea = screen.getByRole('textbox');

    const dragOverEvent = createEvent.dragOver(textarea);
    attachDataTransfer(dragOverEvent, {
      files: [],
      types: ['text/plain'],
    } as unknown as DataTransfer);

    fireEvent(textarea, dragOverEvent);

    const dropEvent = createEvent.drop(textarea);
    attachDataTransfer(dropEvent, {
      files: [],
      types: ['text/plain'],
    } as unknown as DataTransfer);

    fireEvent(textarea, dropEvent);

    expect(dragOverEvent.defaultPrevented).toBe(false);
    expect(dropEvent.defaultPrevented).toBe(false);
  });
});
