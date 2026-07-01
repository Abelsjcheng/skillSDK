import { render, screen } from '@testing-library/react';
import SlashCommandPanel from '../assistant/SlashCommandPanel';

const commands = Array.from({ length: 12 }, (_, index) => ({
  command: `/cmd${index}`,
  description: `命令 ${index}`,
}));

describe('SlashCommandPanel', () => {
  const scrollIntoView = jest.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  it('scrolls the highlighted item into view when keyboard highlight moves', () => {
    const { rerender } = render(
      <SlashCommandPanel
        commands={commands}
        highlightedIndex={0}
        onSelect={jest.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    expect(screen.getByRole('option', { name: '/cmd0 命令 0' })).toHaveAttribute('aria-selected', 'true');

    scrollIntoView.mockClear();
    rerender(
      <SlashCommandPanel
        commands={commands}
        highlightedIndex={10}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: '/cmd10 命令 10' })).toHaveAttribute('aria-selected', 'true');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });
});
