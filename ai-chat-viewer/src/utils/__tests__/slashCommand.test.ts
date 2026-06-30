import {
  findSlashTrigger,
  filterSlashCommands,
  normalizeSlashCommands,
  replaceSlashTrigger,
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

  it('finds a slash trigger only at the beginning of the input', () => {
    expect(findSlashTrigger('/ne', 3)).toEqual({ start: 0, end: 3, query: 'ne' });
    expect(findSlashTrigger('hello /ne', 9)).toBeNull();
    expect(findSlashTrigger('hello/a', 7)).toBeNull();
    expect(findSlashTrigger('/new session', 12)).toBeNull();
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

  it('replaces the slash fragment and appends a trailing space', () => {
    expect(replaceSlashTrigger('ask /ne today', { start: 4, end: 7, query: 'ne' }, '/new')).toBe('ask /new today');
  });
});
