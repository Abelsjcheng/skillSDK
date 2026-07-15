import type { SlashCommandItem } from '../types/slashCommand';

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

export function findSlashQuery(value: string): string | null {
  if (!value.startsWith('/')) {
    return null;
  }

  const fragment = value.trimEnd();
  if (/\s/.test(fragment)) {
    return null;
  }

  return fragment.slice(1);
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

export function buildSlashCommandValue(command: string): string {
  const normalizedCommand = normalizeCommandName(command);
  return `${normalizedCommand} `;
}
