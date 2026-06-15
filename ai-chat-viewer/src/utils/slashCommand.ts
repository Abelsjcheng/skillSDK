import type { SlashCommandItem, SlashCommandToken, SlashCommandTrigger } from '../types/slashCommand';

function normalizeCommandName(command: string): string {
  const trimmedCommand = command.trim();
  if (!trimmedCommand) {
    return '';
  }
  return trimmedCommand.startsWith('/') ? trimmedCommand : `/${trimmedCommand}`;
}

export function normalizeSlashCommands(rawCommands: unknown): SlashCommandItem[] {
  if (!Array.isArray(rawCommands)) {
    return [];
  }

  const commands: SlashCommandItem[] = [];

  rawCommands.forEach((rawCommand) => {
    if (!rawCommand || typeof rawCommand !== 'object') {
      return;
    }
    const item = rawCommand as { command?: unknown; description?: unknown };
    if (typeof item.command !== 'string') {
      return;
    }

    const command = normalizeCommandName(item.command);
    if (!command) {
      return;
    }
    commands.push({
      command,
      description: typeof item.description === 'string' ? item.description : '',
    });
  });

  return commands;
}

export function findSlashTrigger(value: string, cursor: number): SlashCommandTrigger | null {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const beforeCursor = value.slice(0, safeCursor);
  const slashIndex = beforeCursor.lastIndexOf('/');

  if (slashIndex < 0) {
    return null;
  }

  if (slashIndex !== 0) {
    return null;
  }

  const previousCharacter = slashIndex > 0 ? value[slashIndex - 1] : '';
  if (previousCharacter && !/\s/.test(previousCharacter)) {
    return null;
  }

  const fragment = value.slice(slashIndex, safeCursor);
  if (/\s/.test(fragment)) {
    return null;
  }

  return {
    start: slashIndex,
    end: safeCursor,
    query: fragment.slice(1),
  };
}

export function filterSlashCommands(commands: SlashCommandItem[], query: string): SlashCommandItem[] {
  const normalizedQuery = query.trim().replace(/^\//, '').toLowerCase();
  if (!normalizedQuery) {
    return commands;
  }

  return commands.filter((item) => (
    item.command.replace(/^\//, '').toLowerCase().startsWith(normalizedQuery)
  ));
}

export function replaceSlashTrigger(
  value: string,
  trigger: SlashCommandTrigger,
  command: string,
): { value: string; cursor: number; token: SlashCommandToken } {
  const normalizedCommand = normalizeCommandName(command);
  const replacement = `${normalizedCommand} `;
  const suffix = value.slice(trigger.end);
  const normalizedSuffix = suffix.startsWith(' ') ? suffix.slice(1) : suffix;
  const nextValue = `${value.slice(0, trigger.start)}${replacement}${normalizedSuffix}`;
  const cursor = trigger.start + replacement.length;
  const tokenEnd = trigger.start + normalizedCommand.length;

  return {
    value: nextValue,
    cursor,
    token: {
      command: normalizedCommand,
      start: trigger.start,
      end: tokenEnd,
    },
  };
}
