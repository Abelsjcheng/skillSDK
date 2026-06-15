import { querySlashCommands } from '../slashCommandApi';

describe('querySlashCommands', () => {
  beforeEach(() => {
    delete (window as any).HWH5;
  });

  it('calls HWH5.fetch with url, get options, json headers and stringified ak body', async () => {
    const reply = {
      code: 200,
      errormsg: '',
      data: [{ command: '/new', description: '新建会话' }],
    };
    const json = jest.fn().mockResolvedValue(reply);
    const fetch = jest.fn().mockResolvedValue({ json });
    (window as any).HWH5 = { fetch };

    await expect(querySlashCommands({
      ak: 'appkey',
      partnerAccount: 'partner-1',
    })).resolves.toEqual([{ command: '/new', description: '新建会话' }]);

    expect(fetch).toHaveBeenCalledWith('/api/v1/slash-commands/query', {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ak: 'appkey' }),
    });
    expect(json).toHaveBeenCalledTimes(1);
  });
});
