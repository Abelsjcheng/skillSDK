import React, { useEffect, useRef } from 'react';
import type { SlashCommandItem } from '../../types/slashCommand';

interface SlashCommandPanelProps {
  commands: SlashCommandItem[];
  highlightedIndex: number;
  onSelect: (command: SlashCommandItem) => void;
}

const SlashCommandPanel: React.FC<SlashCommandPanelProps> = ({
  commands,
  highlightedIndex,
  onSelect,
}) => {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (highlightedIndex < 0) {
      return;
    }
    const highlightedItem = itemRefs.current[highlightedIndex];
    if (typeof highlightedItem?.scrollIntoView !== 'function') {
      return;
    }
    highlightedItem.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  return (
    <div className="we-agent-cui-footer__slash-panel" role="listbox" aria-label="Slash commands">
      {commands.map((command, index) => (
        <button
          key={`${command.command}-${index}`}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          type="button"
          role="option"
          aria-selected={highlightedIndex === index}
          className={[
            'we-agent-cui-footer__slash-item',
            highlightedIndex === index ? 'is-highlighted' : '',
          ].filter(Boolean).join(' ')}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(command);
          }}
        >
          <span className="we-agent-cui-footer__slash-command">{command.command}</span>
          {command.description ? (
            <span className="we-agent-cui-footer__slash-description">{command.description}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
};

export default SlashCommandPanel;
