import {
  buildSlashCommandValue,
  filterSlashCommands,
  findSlashQuery,
  normalizeSlashCommands,
} from '../slashCommand';

describe('slashCommand utilities', () => {
  it('normalizes commands with slash prefix and preserves backend row count', () => {
    expect(normalizeSlashCommands([
      { command: 'new', description: '新建会话' },
      { command: '/new', description: '新建同名命令' },
      { command: ' ', description: '无效命令' },
      { command: '/help', description: 123 },
    ])).toEqual([
      { command: '/new', description: '新建会话' },
      { command: '/new', description: '新建同名命令' },
      { command: '/help', description: '' },
    ]);
  });

  it('finds a slash query only at the beginning of the input', () => {
    expect(findSlashQuery('/ne')).toBe('ne');
    expect(findSlashQuery('hello /ne')).toBeNull();
    expect(findSlashQuery('hello/a')).toBeNull();
    expect(findSlashQuery('/new session')).toBeNull();
  });

  it('filters by command prefix without matching description', () => {
    const commands = [
      { command: '/new', description: '创建 help 会话' },
      { command: '/help', description: '帮助' },
    ];

    expect(filterSlashCommands(commands, '')).toEqual(commands);
    expect(filterSlashCommands(commands, 'n')).toEqual([{ command: '/new', description: '创建 help 会话' }]);
    expect(filterSlashCommands(commands, 'he')).toEqual([{ command: '/help', description: '帮助' }]);
  });

  it('builds a plain slash command value with trailing space', () => {
    expect(buildSlashCommandValue('/new')).toBe('/new ');
  });
});
